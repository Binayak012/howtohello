// Simplified, original continent silhouettes in longitude/latitude coordinates.
const continents = [
  [[-165,65],[-130,72],[-105,60],[-65,53],[-82,25],[-100,16],[-118,32],[-145,50]],
  [[-80,12],[-48,4],[-35,-8],[-52,-35],[-70,-55],[-76,-15]],
  [[-18,35],[15,37],[40,12],[32,-12],[18,-35],[4,-28],[-12,4]],
  [[-10,37],[-5,58],[25,72],[70,65],[110,72],[170,55],[145,35],[118,20],[105,0],[80,8],[65,28],[40,40],[25,35]],
  [[112,-12],[138,-10],[154,-26],[145,-40],[117,-34]],
  [[-52,60],[-25,70],[-38,82],[-60,78]],
];

function continentPath(points: number[][], rotation: number): string {
  const radians = Math.PI / 180;
  const projected = points.map(([longitude, latitude]) => {
    const lon = (longitude + rotation) * radians;
    const lat = latitude * radians;
    return { x: 96 * Math.cos(lat) * Math.sin(lon), y: -96 * Math.sin(lat), z: Math.cos(lat) * Math.cos(lon) };
  });
  const visible: { x: number; y: number }[] = [];
  for (let i = 0; i < projected.length; i++) {
    const a = projected[i];
    const b = projected[(i + 1) % projected.length];
    if (a.z >= 0) visible.push(a);
    if ((a.z >= 0) !== (b.z >= 0)) {
      const t = a.z / (a.z - b.z);
      visible.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  return visible.length < 3 ? '' : visible.map((point, i) => `${i ? 'L' : 'M'}${(120 + point.x).toFixed(2)} ${(120 + point.y).toFixed(2)}`).join(' ') + 'Z';
}

const arrivalKey = 'wayword-adventure-arrival';

/** A brief, decorative globe journey reserved for first-time sign-up links. */
export function setupAdventureTransition(isAuth: boolean, navigate: (destination: string) => void): () => void {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (isAuth) {
    try {
      const started = Number(sessionStorage.getItem(arrivalKey));
      sessionStorage.removeItem(arrivalKey);
      if (started && Date.now() - started < 10000 && !motion.matches) {
        document.body.classList.add('adventure-arrival');
        window.setTimeout(() => document.body.classList.remove('adventure-arrival'), 1500);
      }
    } catch { /* Navigation also works when browser storage is unavailable. */ }
    return () => {};
  }
  let overlay: HTMLDivElement | undefined;
  let journey: Animation | undefined;
  let leaving = false;
  let zoomFrame = 0;

  async function onClick(event: MouseEvent) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target;
    const link = target instanceof Element ? target.closest<HTMLAnchorElement>('a[data-adventure]') : null;
    if (!link || link.target === '_blank' || motion.matches) return;
    event.preventDefault();
    if (leaving) return;
    leaving = true;
    document.documentElement.classList.add('adventure-transition-active');
    const destination = link.href;
    overlay = document.createElement('div');
    overlay.className = 'adventure-transition';
    overlay.innerHTML = `<div class="journey-backdrop"></div><div class="journey-night-sky" aria-hidden="true"></div><div class="journey-art" aria-hidden="true"><span class="journey-orbit"></span><span class="journey-spark journey-spark-one">✦</span><span class="journey-spark journey-spark-two">✧</span><svg class="journey-globe" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="journey-ocean" cx="32%" cy="25%" r="80%"><stop stop-color="#4caaa1"/><stop offset=".6" stop-color="#1f7a7a"/><stop offset="1" stop-color="#145454"/></radialGradient><clipPath id="journey-circle"><circle cx="120" cy="120" r="96"/></clipPath></defs><circle cx="120" cy="126" r="98" fill="#2b2340" opacity=".08"/><g clip-path="url(#journey-circle)"><circle cx="120" cy="120" r="96" fill="url(#journey-ocean)"/><g class="journey-land" fill="#f0d69d" stroke="#f0d69d" stroke-width="2" stroke-linejoin="round">${continents.map(() => '<path/>').join('')}</g><g fill="none" stroke="#fff6e8" stroke-width="1" opacity=".19"><ellipse cx="120" cy="120" rx="48" ry="96"/><path d="M24 120h192M37 72h166M37 168h166"/></g><path d="M50 67q30-37 77-29" fill="none" stroke="white" stroke-width="8" stroke-linecap="round" opacity=".25"/><circle class="journey-night-shade" cx="120" cy="120" r="96" fill="#10182f" opacity="0"/></g></svg></div><p class="journey-caption" role="status">A new day. Your next adventure.</p>`;
    document.body.append(overlay);
    // Zoom the SVG camera itself, keeping the globe vector-sharp at every size.
    const globe = overlay.querySelector<SVGSVGElement>('.journey-globe')!;
    const art = overlay.querySelector<HTMLElement>('.journey-art')!;
    const width = innerWidth;
    const height = innerHeight;
    const finalScale = Math.hypot(width, height) / 175;
    const zoomDuration = 2400;
    const land = [...globe.querySelectorAll<SVGPathElement>('.journey-land path')];
    const shade = globe.querySelector<SVGCircleElement>('.journey-night-shade')!;
    const sky = overlay.querySelector<HTMLElement>('.journey-night-sky')!;
    const caption = overlay.querySelector<HTMLElement>('.journey-caption')!;
    const startedAt = performance.now();
    function drawZoom(now: number) {
      const progress = Math.min(1, (now - startedAt) / zoomDuration);
      const rotation = -30 + progress * 360;
      land.forEach((path, i) => path.setAttribute('d', continentPath(continents[i], rotation)));
      const night = Math.pow(Math.sin(Math.PI * progress), 3);
      shade.setAttribute('opacity', String(night * .82));
      sky.style.opacity = String(night);
      // Share the lighting clock so the caption eases naturally into moonlight.
      const light = Math.max(0, Math.min(1, (night - .2) / .55));
      const blend = light * light * (3 - 2 * light);
      const dayColor = [43, 35, 64];
      const nightColor = [255, 246, 232];
      const channels = dayColor.map((channel, i) => Math.round(channel + (nightColor[i] - channel) * blend));
      caption.style.color = `rgb(${channels.join(',')})`;
      caption.style.textShadow = `0 2px 14px rgba(244,182,63,${(blend * .22).toFixed(3)})`;
      // See the day/night cycle before the final camera move into the globe.
      const t = Math.max(0, (progress - .52) / .48);
      const eased = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const scale = 1 + (finalScale - 1) * eased;
      const viewWidth = width / scale;
      const viewHeight = height / scale;
      globe.setAttribute('viewBox', `${120 - viewWidth / 2} ${120 - viewHeight / 2} ${viewWidth} ${viewHeight}`);
      if (progress < 1) zoomFrame = requestAnimationFrame(drawZoom);
    }
    drawZoom(startedAt);
    journey = art.animate([
      { opacity: 0, offset: 0 },
      { opacity: 1, offset: .12 },
      { opacity: 1, offset: 1 },
    ], { duration: zoomDuration, fill: 'forwards' });
    try { await journey.finished; } catch { return; }
    drawZoom(startedAt + zoomDuration);
    try { sessionStorage.setItem(arrivalKey, String(Date.now())); } catch { /* Optional arrival animation. */ }
    // Carry the exact final globe frame across the synchronous page swap.
    const handoff = overlay!.cloneNode(true) as HTMLDivElement;
    handoff.querySelector('.journey-caption')?.remove();
    handoff.setAttribute('aria-hidden', 'true');
    handoff.style.pointerEvents = 'none';
    navigate(destination);
    document.documentElement.classList.add('adventure-transition-active');
    document.body.append(handoff);
    const reveal = handoff.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 650, easing: 'ease-in-out', fill: 'forwards',
    });
    const finishReveal = () => {
      handoff.remove();
      document.documentElement.classList.remove('adventure-transition-active');
    };
    reveal.onfinish = finishReveal;
    reveal.oncancel = finishReveal;
  }

  function reset() {
    document.documentElement.classList.remove('adventure-transition-active');
    cancelAnimationFrame(zoomFrame);
    journey?.cancel();
    overlay?.remove();
    overlay = undefined;
    leaving = false;
  }
  document.addEventListener('click', onClick);
  // Reset the outgoing overlay when returning through the back/forward cache.
  window.addEventListener('pageshow', reset);
  return () => {
    document.removeEventListener('click', onClick);
    window.removeEventListener('pageshow', reset);
    reset();
  };
}
