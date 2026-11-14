import { setupMapMusic, mapMusicButton } from './map-music';
import {mapNatureMarkup} from './map-nature';
import {setupMapIntroAudio,setupMapNodeClickAudio} from './map-intro-audio';
import {isBasicUnlocked} from '../../src/unit-unlock';
import {recordLanguageStarted} from '../../src/learning-history';
import {completedLevels,isUnlocked,journey} from '../../src/progression';

export function renderLevelMap(app:HTMLDivElement,brand:string){
  let completed:ReturnType<typeof completedLevels>=[],canSave=true;
  try{localStorage.setItem('wayword.storage-check','1');localStorage.removeItem('wayword.storage-check');completed=completedLevels(localStorage);recordLanguageStarted(localStorage,'ne');}catch{canSave=false;}
  let basicOpen=completed.length>0;try{basicOpen ||= isBasicUnlocked(localStorage);}catch{}try{basicOpen ||= isBasicUnlocked(sessionStorage);}catch{}
  const positions=[{x:43,y:86},{x:68,y:61},{x:32,y:36},{x:61,y:11}];
  const active = [...journey].reverse().find(level => level.implemented && isUnlocked(level.id,completed) && !completed.includes(level.id))
    ?? [...journey].reverse().find(level => level.implemented && isUnlocked(level.id,completed))!;
  const activeHref = active.id === 'moving-in' && !basicOpen ? '/unit/index.html' : `/game/index.html?level=${active.route}`;
  const activeCta = active.id === 'moving-in' && !basicOpen ? 'Unlock Basic' : completed.includes(active.id) ? 'Play again' : active.id === 'next-adventure' ? 'Learn to count' : 'Start this quest';
  document.body.classList.add('is-map-screen','is-journey-screen');
  app.innerHTML=`<a class="skip" href="#map-main">Skip to content</a><header class="nav wrap map-nav unit-nav journey-nav">${brand}${mapMusicButton}<a class="map-language" href="/languages/index.html"><span aria-hidden="true">🇳🇵</span><span class="journey-language-names"><strong lang="ne">नेपाली</strong><small>Nepali</small></span><span class="journey-change-language">Change ↗</span></a></header><main id="map-main" class="map-page wrap"><h1 class="sr-only">Your lesson map</h1><section class="quest-map journey-map" aria-label="Your four-chapter journey, starting at the bottom"><div class="map-terrain" aria-hidden="true">${mapNatureMarkup}</div><svg class="map-trail" aria-hidden="true"><path fill="none" stroke="#fffaf0" stroke-width="28" stroke-linecap="round"/><path fill="none" stroke="#cbbca2" stroke-width="5" stroke-dasharray="2 17" stroke-linecap="round"/></svg>${journey.map((level,index)=>{
    const unlocked=isUnlocked(level.id,completed),finished=completed.includes(level.id),playable=unlocked&&level.implemented;
    const href=level.id==='moving-in'&&!basicOpen?'/unit/index.html':`/game/index.html?level=${level.route}`;
    const title=index===3?'FINALE':`CHAPTER ${String(level.chapter).padStart(2,'0')}`;
    const node=playable?`<a class="level-node playable ${finished?'completed':''}" href="${href}" aria-label="${finished?'Replay':'Play'} level ${level.chapter}, ${level.title}">${finished?'✓':String(level.chapter).padStart(2,'0')}</a>`:`<button class="level-node ${unlocked?'future':'locked'}" disabled aria-label="Level ${level.chapter}, ${unlocked?'coming next':'locked'}">${String(level.chapter).padStart(2,'0')}</button>`;
    return `<div class="map-level journey-level-${index+1} ${level.id===active.id?'is-current-quest':''}" style="left:${positions[index].x}%;top:${positions[index].y}%">${node}<div class="level-label"><small>${title} · ${finished?'COMPLETE':!level.implemented?'COMING NEXT':unlocked?level.id==='moving-in'&&!basicOpen?'LETTERS FIRST':'READY TO PLAY':'LOCKED'}</small><strong>${level.title}</strong><p>${level.subtitle}</p></div></div>`;
  }).join('')}</section><section class="journey-current-quest" aria-label="Your next playable lesson"><div class="journey-current-copy"><small>${completed.includes(active.id)?'READY TO REPLAY':'YOUR NEXT QUEST'} · CHAPTER ${String(active.chapter).padStart(2,'0')}</small><strong>${active.title}</strong><a class="journey-basic-link" href="/unit/index.html">${basicOpen?'Practice Nepali letters':'Start with five Nepali letters'} ↗</a></div><a class="button primary" href="${activeHref}">${activeCta} <span aria-hidden="true">↗</span></a></section><p class="map-progress-note">${canSave?'Progress saved on this browser':'Progress saving unavailable'} · Four chapters · The market is the finale</p></main>`;
  const stopMusic = setupMapMusic(app.querySelector<HTMLButtonElement>('.map-music')!);
  const map=app.querySelector<HTMLElement>('.quest-map')!,trail=app.querySelector<SVGSVGElement>('.map-trail')!;
  const stopIntroAudio=setupMapIntroAudio();
  const stopNodeClickAudio=setupMapNodeClickAudio();
  const align=()=>{const bounds=map.getBoundingClientRect(),nodes=[...map.querySelectorAll('.level-node')].map(node=>{const rect=node.getBoundingClientRect();return{x:rect.left+rect.width/2-bounds.left,y:rect.top+rect.height/2-bounds.top};});trail.setAttribute('viewBox',`0 0 ${bounds.width} ${bounds.height}`);let path=`M${nodes[0].x} ${nodes[0].y}`;for(let i=1;i<nodes.length;i++){const a=nodes[i-1],b=nodes[i],gap=(a.y-b.y)/2;path+=` C${a.x} ${a.y-gap} ${b.x} ${b.y+gap} ${b.x} ${b.y}`;}trail.querySelectorAll('path').forEach(element=>element.setAttribute('d',path));};
  const observer=new ResizeObserver(align);observer.observe(map);align();
  const pauseNature = () => map.classList.toggle('is-nature-paused', document.hidden);
  document.addEventListener('visibilitychange', pauseNature);
  pauseNature();
  const animations: Animation[] = [];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let mask: SVGDefsElement | undefined;
  let trailGroup: SVGGElement | undefined;
  if (!reducedMotion.matches) {
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
    [1, 2, 3, 4].forEach((level, index) => {
      const delay = 180 + index * 280;
      animate(map.querySelector(`.journey-level-${level} .level-node`)!, [
        { opacity: 0, transform: 'rotate(-16deg) scale(.25)', offset: 0 },
        { opacity: 1, transform: 'rotate(-4deg) scale(1.12)', offset: .65 },
        { opacity: 1, transform: 'rotate(-7deg) scale(1)', offset: 1 },
      ], { duration: 540, delay, easing: 'cubic-bezier(.22,.61,.36,1)' });
      animate(map.querySelector(`.journey-level-${level} .level-label`)!, [
        { opacity: 0, transform: 'translateY(6px)' },
        { opacity: 1, transform: 'translateY(0)' },
      ], { duration: 400, delay: delay + 140, easing: 'ease-out' });
    });
    map.querySelectorAll('.nature-tree-pop').forEach((element, index) => {
      animate(element, [
        { opacity: 0, transform: 'scale(.45)' },
        { opacity: 1, transform: 'scale(1.07)', offset: .7 },
        { opacity: 1, transform: 'scale(1)' },
      ], { duration: 560, delay: 180 + index % 5 * 85, easing: 'cubic-bezier(.22,.61,.36,1)' });
    });
    map.querySelectorAll('.nature-flower-pop').forEach((element, index) => {
      animate(element, [{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'scale(1)' }], {
        duration: 420, delay: 450 + index % 5 * 65, easing: 'ease-out',
      });
    });
  }
  function finishEntrance() {
    animations.forEach(animation => animation.cancel());
    trailGroup?.removeAttribute('mask');
    mask?.remove();
  }
  reducedMotion.addEventListener('change', finishEntrance);
  return () => {
    stopMusic();
    stopIntroAudio();
    stopNodeClickAudio();
    document.removeEventListener('visibilitychange', pauseNature);
    document.body.classList.remove('is-map-screen','is-journey-screen');
    observer.disconnect();
    reducedMotion.removeEventListener('change', finishEntrance);
    finishEntrance();
  };
}
