import { geoDistance, geoOrthographic, geoPath } from 'd3-geo';
import { earthLand } from './earth-land';
import { clayEarthSvg, earthClouds } from './earth-art';
import { playTransitionTune, transitionMuted, rememberTransitionMuted } from './transition-tune';

const arrivalKey = 'wayword-adventure-arrival';

/** Globe journey shown only after valid demo auth submission. */
export function setupAdventureTransition(isAuth: boolean, navigate: (destination: string) => void): () => void {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let arrivalTimer: number | undefined;
  if (isAuth || location.pathname.startsWith('/languages')) {
    try {
      const started = Number(sessionStorage.getItem(arrivalKey));
      sessionStorage.removeItem(arrivalKey);
      if (started && Date.now() - started < 10000 && !motion.matches) {
        document.body.classList.add('adventure-arrival');
        arrivalTimer = window.setTimeout(() => document.body.classList.remove('adventure-arrival'), 1500);
      }
    } catch { /* Navigation also works when browser storage is unavailable. */ }
  }
  let overlay: HTMLDivElement | undefined;
  let journey: Animation | undefined;
  let leaving = false;
  let zoomFrame = 0;
  let tune: ReturnType<typeof playTransitionTune> = null;

  function onNavigate(event: Event) {
    const destination = (event as CustomEvent<{ destination: string }>).detail?.destination;
    if (typeof destination !== 'string') return;
    const url = new URL(destination, location.href);
    if (url.origin !== location.origin) return;
    if (motion.matches) { navigate(url.href); return; }
    void travel(url.href);
  }

  async function travel(destination: string) {
    if (leaving) return;
    leaving = true;
    document.documentElement.classList.add('adventure-transition-active');
    overlay = document.createElement('div');
    overlay.className = 'adventure-transition';
    overlay.innerHTML = `<div class="journey-backdrop"></div><div class="journey-sky-clouds" aria-hidden="true"><span class="sky-cloud sky-cloud-one"></span><span class="sky-cloud sky-cloud-two"></span><span class="sky-cloud sky-cloud-three"></span></div><div class="journey-dusk-glow" aria-hidden="true"></div><div class="journey-art" aria-hidden="true"><span class="journey-orbit"></span><span class="journey-spark journey-spark-one">✦</span><span class="journey-spark journey-spark-two">✧</span>${clayEarthSvg}</div><div class="journey-cream-wash" aria-hidden="true"></div><p class="journey-caption" role="status">A new day. Your next adventure.</p>`;
    document.body.append(overlay);
    let muted = transitionMuted();
    tune = playTransitionTune(muted);
    const sound = document.createElement('button');
    sound.className = 'journey-sound'; sound.type = 'button';
    function updateSound() {
      sound.textContent = tune ? (muted ? '♫ Sound off' : '♫ Sound on') : 'Sound unavailable';
      sound.setAttribute('aria-label', muted ? 'Unmute transition music' : 'Mute transition music');
      sound.setAttribute('aria-pressed', String(muted));
      sound.disabled = !tune;
    }
    sound.onclick = () => { muted = !muted; rememberTransitionMuted(muted); tune?.setMuted(muted); updateSound(); };
    updateSound(); overlay.append(sound);
    // Zoom the SVG camera itself, keeping the globe vector-sharp at every size.
    const globe = overlay.querySelector<SVGSVGElement>('.journey-globe')!;
    const art = overlay.querySelector<HTMLElement>('.journey-art')!;
    const width = innerWidth;
    const height = innerHeight;
    const finalScale = Math.hypot(width, height) / 175;
    const zoomDuration = 2400;
    const land = [...globe.querySelectorAll<SVGPathElement>('.journey-land-layer')];
    const surfaceClouds = [...globe.querySelectorAll<SVGGElement>('.earth-cloud')];
    const projection = geoOrthographic().translate([120, 120]).scale(96).precision(.25);
    const projectLand = geoPath(projection);
    const shade = globe.querySelector<SVGCircleElement>('.journey-dusk-shade')!;
    const glow = overlay.querySelector<HTMLElement>('.journey-dusk-glow')!;
    const wash = overlay.querySelector<HTMLElement>('.journey-cream-wash')!;
    const caption = overlay.querySelector<HTMLElement>('.journey-caption')!;
    const startedAt = performance.now();
    function drawZoom(now: number) {
      const progress = Math.min(1, (now - startedAt) / zoomDuration);
      const drift = progress * progress * (3 - 2 * progress);
      const rotation = -18 + drift * 210;
      projection.rotate([rotation, -12, 0]);
      const coastlines = projectLand(earthLand) ?? '';
      land.forEach(layer => layer.setAttribute('d', coastlines));
      const center = projection.invert!([120, 120])!;
      surfaceClouds.forEach((cloud, i) => {
        const position = earthClouds[i];
        const distance = geoDistance(center, position);
        const point = projection(position)!;
        const visibility = Math.max(0, Math.min(1, (Math.PI / 2 - distance) / .2));
        cloud.setAttribute('opacity', String(visibility * .9));
        cloud.setAttribute('transform', `translate(${point[0]} ${point[1]}) scale(${Math.max(.15, Math.cos(distance)) * .7} .7)`);
      });
      // A pastel dusk preserves the passing-day idea without a dark loading screen.
      const dusk = Math.pow(Math.sin(Math.PI * progress), 2);
      shade.setAttribute('opacity', String(dusk * .2));
      glow.style.opacity = String(dusk * .8);
      const dayColor = [43, 35, 64];
      const duskColor = [31, 90, 87];
      const channels = dayColor.map((channel, i) => Math.round(channel + (duskColor[i] - channel) * dusk));
      caption.style.color = `rgb(${channels.join(',')})`;
      // The zoom grows continuously and eases at both ends, without a late surge.
      const t = Math.max(0, Math.min(1, (progress - .36) / .64));
      const eased = t * t * t * (t * (t * 6 - 15) + 10);
      const scale = Math.exp(Math.log(finalScale) * eased);
      // Keep text on the quiet opening frame, then clear it before the close-up.
      const appear = Math.min(1, progress / .1);
      const fade = Math.max(0, Math.min(1, (scale - 1.015) / .1));
      const disappear = fade * fade * (3 - 2 * fade);
      caption.style.opacity = String(appear * (1 - disappear));
      caption.style.visibility = disappear === 1 ? 'hidden' : 'visible';
      caption.style.transform = `translateY(${5 * (1 - appear) - 3 * disappear}px)`;
      const arrival = Math.max(0, Math.min(1, (progress - .78) / .22));
      wash.style.opacity = String(arrival * arrival * (3 - 2 * arrival));
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
    handoff.querySelector('.journey-sound')?.remove();
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
    tune?.stop();
    tune = null;
    document.documentElement.classList.remove('adventure-transition-active');
    cancelAnimationFrame(zoomFrame);
    journey?.cancel();
    overlay?.remove();
    overlay = undefined;
    leaving = false;
  }
  document.addEventListener('wayword:navigate', onNavigate);
  // Reset the outgoing overlay when returning through the back/forward cache.
  window.addEventListener('pageshow', reset);
  return () => {
    document.removeEventListener('wayword:navigate', onNavigate);
    window.clearTimeout(arrivalTimer);
    document.body.classList.remove('adventure-arrival');
    window.removeEventListener('pageshow', reset);
    reset();
  };
}
