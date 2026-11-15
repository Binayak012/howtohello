/** Let a short, soft press finish before leaving the lesson map. */
export function setupMapNodeClickAudio(root: HTMLElement): () => void {
  const audio = new Audio('/audio/map-node-click.wav');
  audio.preload = 'auto';
  audio.volume = .3;
  let stopped = false;
  let navigation: number | undefined;
  let pressed: HTMLElement | null = null;
  let pressAnimation: Animation | undefined;

  function onClick(event: MouseEvent) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target;
    const link = target instanceof Element
      ? target.closest<HTMLAnchorElement>('a.level-node.playable, .journey-current-quest a.button.primary') : null;
    if (!link || !root.contains(link) || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    event.preventDefault();
    if (stopped || navigation !== undefined) return;
    pressed = link;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const resting = getComputedStyle(link).transform;
    if (!reducedMotion) {
      pressAnimation = link.animate([
        { transform: resting, offset: 0 },
        { transform: `${resting === 'none' ? '' : resting} translateY(3px) scale(.96)`, offset: .3 },
        { transform: resting, offset: 1 },
      ], { duration: 170, easing: 'cubic-bezier(.22,.61,.36,1)' });


    }
    audio.currentTime = 0;
    // Play within the click gesture, including keyboard and assistive activation.
    void audio.play().catch(() => { /* Sound must never block a lesson. */ });
    navigation = window.setTimeout(() => {
      if (!stopped) window.location.assign(link.href);
    }, reducedMotion ? 140 : 190);
  }

  function resetPress() {
    window.clearTimeout(navigation);
    navigation = undefined;
    pressAnimation?.cancel();
    pressed?.classList.remove('is-lesson-pressed');
    pressed = null;
  }
  window.addEventListener('pageshow', resetPress);
  root.addEventListener('click', onClick);
  return () => {
    stopped = true;
    resetPress();
    window.removeEventListener('pageshow', resetPress);
    root.removeEventListener('click', onClick);
    pressed?.classList.remove('is-lesson-pressed');
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  };
}
