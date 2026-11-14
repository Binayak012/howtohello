/** The stationary guide tosses a decorative pen beside the focused field. */
export function setupAuthGuide(): () => void {
  const form = document.querySelector<HTMLFormElement>('#auth-form');
  const homeImage = document.querySelector<HTMLElement>('.auth-held-pen');
  if (!form || !homeImage) return () => {};
  const home = homeImage;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const companion = document.createElement('div');
  companion.className = 'auth-field-pen';
  companion.setAttribute('aria-hidden', 'true');
  companion.innerHTML = home.innerHTML;
  document.body.append(companion);
  let current: HTMLInputElement | null = null;
  let movement: Animation | undefined;
  let frame = 0;
  let disposed = false;
  let modeFrame = 0;
  let returning = false;
  const character = document.querySelector<HTMLElement>('.auth-character');
  function updateEyes() {
    const active = document.activeElement;
    character?.classList.toggle('is-private', active instanceof Element && !!active.closest('.password-field'));
  }

  function destination(input: HTMLInputElement) {
    const bounds = input.getBoundingClientRect();
    const width = innerWidth <= 700 ? 12 : 16;
    return { x: Math.max(3, bounds.left - width - 7), y: bounds.top + bounds.height / 2 - width * 2, width };
  }

  function place(input: HTMLInputElement, animate = true) {
    returning = false;
    const firstJump = companion.hidden;
    const target = destination(input);
    const source = firstJump ? home.getBoundingClientRect() : companion.getBoundingClientRect();
    const hasSource = source.width > 0 && source.height > 0;
    const from = hasSource ? { x: source.left, y: source.top, width: source.width } : { ...target, y: target.y - 35 };
    movement?.cancel();
    companion.hidden = false;
    home.classList.add('pen-in-flight');
    const transform = (x: number, y: number, width: number, angle = -18) => `translate(${x}px, ${y}px) scale(${width / 16}) rotate(${angle}deg)`;
    companion.style.transform = transform(target.x, target.y, target.width);
    if (!animate || reducedMotion.matches) return;
    const start = transform(from.x, from.y, from.width);
    const end = transform(target.x, target.y, target.width);
    const keyframes: Keyframe[] = firstJump ? [
      { transform: start, offset: 0 },
      { transform: transform((from.x + target.x) / 2, Math.min(from.y, target.y) - 90, target.width, 165), offset: .5 },
      { transform: transform(target.x, target.y, target.width, 342), offset: 1 },
    ] : [{ transform: start }, { transform: end }];
    movement = companion.animate(keyframes, { duration: firstJump ? 750 : 380, easing: 'cubic-bezier(.22,.61,.36,1)' });
  }

  function returnHome() {
    if (companion.hidden || returning) return;
    // Read the real transform, not the rotated bounding box (which inflates width).
    const from = new DOMMatrix(getComputedStyle(companion).transform);
    const to = home.querySelector('svg')?.getScreenCTM();
    const bounds = home.getBoundingClientRect();
    movement?.cancel();
    if (reducedMotion.matches || !to || !bounds.width || !bounds.height) {
      companion.hidden = true;
      home.classList.remove('pen-in-flight');
      return;
    }
    returning = true;
    const matrix = (m: DOMMatrixReadOnly) => `matrix(${m.a},${m.b},${m.c},${m.d},${m.e},${m.f})`;
    const frames: Keyframe[] = [];
    // Sample a shallow arc, with the exact held-pen transform as the landing point.
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const blend = (a: number, b: number) => a + (b - a) * t;
      const pose = new DOMMatrix([
        blend(from.a, to.a), blend(from.b, to.b),
        blend(from.c, to.c), blend(from.d, to.d),
        blend(from.e, to.e), blend(from.f, to.f) - Math.sin(Math.PI * t) * 45,
      ]);
      frames.push({ transform: matrix(pose), offset: t });
    }
    movement = companion.animate(frames, {
      duration: 800, easing: 'cubic-bezier(.37,0,.2,1)', fill: 'forwards',
    });
    movement.onfinish = () => {
      // Both pens share the same final pose, so the handoff is invisible.
      home.classList.remove('pen-in-flight');
      companion.hidden = true;
      movement?.cancel();
      returning = false;
    };
  }

  function followFocus() {
    if (disposed) return;
    updateEyes();
    const focused = document.activeElement;
    if (focused instanceof HTMLInputElement && form!.contains(focused)) {
      if (current !== focused) { current = focused; place(focused); }
    } else if (focused instanceof Element && focused.closest('.auth-tabs')) {
      // Switching modes keeps the pen at the form instead of sending it home.
    } else if (focused instanceof Node && form!.contains(focused) && focused instanceof Element && focused.closest('.password-field')) {
      // Keep the guide beside the password while the Show/Hide button is used.
    } else {
      current = null;
      returnHome();
    }
  }
  function onBlur() {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(followFocus);
  }
  function reposition() {
    if (current) place(current, false);
  }
  function onModeChange() {
    cancelAnimationFrame(frame);
    cancelAnimationFrame(modeFrame);
    // Tab changes alone do not summon the pen or focus an input.
    // Only transfer an existing typing session to the new mode's first field.
    if (!current || companion.hidden) return;
    const source = companion.hidden
      ? home.querySelector('svg')?.getScreenCTM()
      : new DOMMatrix(getComputedStyle(companion).transform);
    const name = form!.querySelector<HTMLInputElement>('#name');
    const next = name && !name.disabled ? name : form!.querySelector<HTMLInputElement>('#email');
    if (!next) return;
    next.focus({ preventScroll: true });
    current = next;
    movement?.cancel();
    returning = false;
    companion.hidden = false;
    home.classList.add('pen-in-flight');
    const initialTarget = destination(next);
    const from = source ?? new DOMMatrix().translate(initialTarget.x, initialTarget.y - 30).scale(initialTarget.width / 16);
    const started = performance.now();
    function followLayout(now: number) {
      if (disposed || !current) return;
      const t = reducedMotion.matches ? 1 : Math.min(1, (now - started) / 450);
      const ease = 1 - Math.pow(1 - t, 3);
      const target = destination(current);
      const to = new DOMMatrix().translate(target.x, target.y).scale(target.width / 16).rotate(-18);
      const blend = (a: number, b: number) => a + (b - a) * ease;
      companion.style.transform = `matrix(${blend(from.a, to.a)},${blend(from.b, to.b)},${blend(from.c, to.c)},${blend(from.d, to.d)},${blend(from.e, to.e)},${blend(from.f, to.f)})`;
      if (t < 1) modeFrame = requestAnimationFrame(followLayout);
    }
    modeFrame = requestAnimationFrame(followLayout);
  }
  companion.hidden = true;
  document.addEventListener('auth-mode-change', onModeChange);
  document.addEventListener('focusin', followFocus);
  form.addEventListener('input', updateEyes);
  document.addEventListener('focusout', onBlur);
  window.addEventListener('resize', reposition);
  window.addEventListener('scroll', reposition, { passive: true });
  window.visualViewport?.addEventListener('resize', reposition);
  reducedMotion.addEventListener('change', reposition);
  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    cancelAnimationFrame(modeFrame);
    document.removeEventListener('auth-mode-change', onModeChange);
    movement?.cancel();
    companion.remove();
    character?.classList.remove('is-private');
    form.removeEventListener('input', updateEyes);
    home.classList.remove('pen-in-flight');
    document.removeEventListener('focusin', followFocus);
    document.removeEventListener('focusout', onBlur);
    window.removeEventListener('resize', reposition);
    window.removeEventListener('scroll', reposition);
    window.visualViewport?.removeEventListener('resize', reposition);
    reducedMotion.removeEventListener('change', reposition);
  };
}
