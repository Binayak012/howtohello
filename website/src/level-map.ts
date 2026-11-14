import { recordLanguageStarted } from '../../src/learning-history';
import { completedLevels, isUnlocked } from '../../src/progression';

export function renderLevelMap(app: HTMLDivElement, brand: string) {
  let completed: ReturnType<typeof completedLevels> = [];
  let canSave = true;
  try {
    localStorage.setItem('wayword.storage-check', '1');
    localStorage.removeItem('wayword.storage-check');
    completed = completedLevels(localStorage);
    recordLanguageStarted(localStorage, 'ne');
  } catch { canSave = false; }
  const finished = completed.includes('little-shop');
  const nextUnlocked = isUnlocked('next-adventure', completed);
  app.innerHTML = `<a class="skip" href="#map-main">Skip to content</a><header class="nav wrap">${brand}<a class="map-language" href="/languages/index.html"><span aria-hidden="true">🇳🇵</span> नेपाली <span>Change language ↗</span></a></header>
  <main id="map-main" class="map-page wrap"><h1 class="sr-only">Your lesson map</h1>
  <section class="quest-map" aria-label="Level map, starting at the bottom"><div class="map-terrain" aria-hidden="true"></div>
  <svg class="map-trail" viewBox="0 0 800 900" preserveAspectRatio="none" aria-hidden="true"><path d="M400 724C400 640 610 660 610 513S230 440 230 288S560 180 560 60" fill="none" stroke="#fffaf0" stroke-width="28" stroke-linecap="round"/><path d="M400 724C400 640 610 660 610 513S230 440 230 288S560 180 560 60" fill="none" stroke="#cbbca2" stroke-width="5" stroke-dasharray="2 17" stroke-linecap="round"/></svg>
  <span class="map-tree tree-one" aria-hidden="true">♣</span><span class="map-tree tree-two" aria-hidden="true">♣</span><span class="map-stone stone-one" aria-hidden="true"></span><span class="map-stone stone-two" aria-hidden="true"></span>
  <div class="map-level map-level-three"><button disabled class="level-node locked" aria-label="Level 3 locked. Complete the earlier quests first."><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></button><div class="level-label"><small>03 · BEYOND THE CLOUDS</small><strong>A hidden horizon</strong><p>Complete the earlier quests to explore further.</p></div></div>
  <div class="map-level map-level-two"><button class="level-node ${nextUnlocked ? 'future' : 'locked'}" disabled aria-describedby="next-level-status" aria-label="Level 2, ${nextUnlocked ? 'unlocked, coming soon' : 'locked'}">${nextUnlocked ? '02' : '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>'}</button><div class="level-label"><small>02 · THE NEXT ADVENTURE</small><strong>${nextUnlocked ? 'A new corner awaits' : 'One step further'}</strong><p id="next-level-status">${nextUnlocked ? 'Unlocked! This level is still being built.' : 'Finish The Little Shop to unlock. Coming soon.'}</p></div></div>
  <div class="map-level map-level-one"><a class="level-node playable ${finished ? 'completed' : ''}" href="/game/index.html" aria-label="${finished ? 'Replay' : 'Play'} level 1, The Little Shop">${finished ? '✓' : '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 13h22v16H5zM3 13 7 4h18l4 9M12 29V18h8v11M3 13q3 6 6 0 3 6 7 0 3 6 7 0 3 6 6 0"/></svg>'}</a><div class="level-label"><small>01 · ${finished ? 'QUEST COMPLETE' : 'READY TO PLAY'}</small><strong>The Little Shop</strong><a class="button primary" href="/game/index.html">${finished ? 'Play again' : 'Start this quest'} <span aria-hidden="true">↗</span></a></div></div>
  <div class="map-clouds" aria-hidden="true"><span class="cloud cloud-one"></span><span class="cloud cloud-two"></span><span class="cloud cloud-three"></span><span class="cloud cloud-four"></span></div><p class="cloud-caption">More of the world is waiting…</p>
  </section><p class="map-progress-note">${canSave ? 'Progress saved on this browser' : 'Progress saving unavailable'} · More quests coming soon</p></main>`;
  const map = app.querySelector<HTMLElement>('.quest-map')!;
  const trail = app.querySelector<SVGSVGElement>('.map-trail')!;
  function alignTrail() {
    const bounds = map.getBoundingClientRect();
    const point = (selector: string) => {
      const node = map.querySelector(selector)!.getBoundingClientRect();
      return { x: node.left + node.width / 2 - bounds.left, y: node.top + node.height / 2 - bounds.top };
    };
    const a = point('.map-level-one .level-node');
    const b = point('.map-level-two .level-node');
    const c = point('.map-level-three .level-node');
    trail.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
    const gap = (a.y - b.y) / 2;
    const upperGap = (b.y - c.y) / 2;
    const path = `M${a.x} ${a.y} C${a.x} ${a.y-gap} ${b.x} ${b.y+gap} ${b.x} ${b.y} S${c.x} ${c.y+upperGap} ${c.x} ${c.y} S${bounds.width*.7} 50 ${bounds.width*.65} -40`;
    trail.querySelectorAll('path').forEach(line => line.setAttribute('d', path));
  }
  alignTrail();
  const observer = new ResizeObserver(alignTrail);
  observer.observe(map);
  const animations: Animation[] = [];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let arriving = false;
  try {
    const started = Number(sessionStorage.getItem('wayword.map-arrival'));
    sessionStorage.removeItem('wayword.map-arrival');
    arriving = started > 0 && Date.now() - started < 10000;
  } catch { /* The static map remains fully usable. */ }
  let mask: SVGDefsElement | undefined;
  let trailGroup: SVGGElement | undefined;
  if (arriving && !reducedMotion.matches) {
    const animate = (element: Element, frames: Keyframe[], options: KeyframeAnimationOptions) => {
      animations.push(element.animate(frames, { fill: 'backwards', ...options }));
    };
    animate(map.querySelector('.map-terrain')!, [{ opacity: 0 }, { opacity: 1 }], { duration: 650, easing: 'ease-out' });
    // Mask the complete trail so its dotted center keeps its own dash pattern.
    const svgNS = 'http://www.w3.org/2000/svg';
    mask = document.createElementNS(svgNS, 'defs');
    const revealMask = document.createElementNS(svgNS, 'mask');
    revealMask.id = 'map-trail-reveal';
    revealMask.setAttribute('maskUnits', 'userSpaceOnUse');
    revealMask.setAttribute('x', '0');
    revealMask.setAttribute('y', '0');
    revealMask.setAttribute('width', '100%');
    revealMask.setAttribute('height', '100%');
    const revealPath = document.createElementNS(svgNS, 'path');
    revealPath.setAttribute('d', trail.querySelector('path')!.getAttribute('d')!);
    revealPath.setAttribute('pathLength', '1');
    revealPath.setAttribute('fill', 'none');
    revealPath.setAttribute('stroke', 'white');
    revealPath.setAttribute('stroke-width', '64');
    revealPath.setAttribute('stroke-linecap', 'round');
    revealPath.style.strokeDasharray = '1';
    revealMask.append(revealPath);
    mask.append(revealMask);
    trailGroup = document.createElementNS(svgNS, 'g');
    trailGroup.setAttribute('mask', 'url(#map-trail-reveal)');
    [...trail.children].forEach(child => trailGroup!.append(child));
    trail.append(mask, trailGroup);
    animate(revealPath, [{ strokeDashoffset: '1' }, { strokeDashoffset: '0' }], { duration: 1150, delay: 100, easing: 'cubic-bezier(.4,0,.2,1)' });
    ['one', 'two', 'three'].forEach((level, index) => {
      const delay = 180 + index * 280;
      animate(map.querySelector(`.map-level-${level} .level-node`)!, [
        { opacity: 0, transform: 'rotate(-16deg) scale(.25)', offset: 0 },
        { opacity: 1, transform: 'rotate(-4deg) scale(1.12)', offset: .65 },
        { opacity: 1, transform: 'rotate(-7deg) scale(1)', offset: 1 },
      ], { duration: 540, delay, easing: 'cubic-bezier(.22,.61,.36,1)' });
      animate(map.querySelector(`.map-level-${level} .level-label`)!, [
        { opacity: 0, transform: 'translateY(6px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ], { duration: 400, delay: delay + 140, easing: 'ease-out' });
    });
    map.querySelectorAll('.map-tree,.map-stone').forEach((element, index) => {
      animate(element, [{ opacity: 0, scale: '.7' }, { opacity: 1, scale: '1' }], { duration: 500, delay: 220 + index * 90, easing: 'ease-out' });
    });
    animate(map.querySelector('.map-clouds')!, [{ opacity: .6 }, { opacity: 1 }], { duration: 1000, easing: 'ease-out' });
  }
  function finishEntrance() {
    animations.forEach(animation => animation.cancel());
    trailGroup?.removeAttribute('mask');
    mask?.remove();
  }
  reducedMotion.addEventListener('change', finishEntrance);
  return () => {
    observer.disconnect();
    reducedMotion.removeEventListener('change', finishEntrance);
    finishEntrance();
  };
}
