import { completedLevels, isUnlocked, journey, type JourneyLevel } from './progression';
import { mountDemoSkip } from './demo-skip';
import { mountLessonSettings } from './lesson-settings';
import './tokens.css';
import { canAccessLesson } from './tracing-progress';

const requested = new URLSearchParams(location.search).get('level');
const website = import.meta.env.BASE_URL === '/game/';
let completed:ReturnType<typeof completedLevels>=[];
try{completed=completedLevels(localStorage);}catch{/* The first level works without storage. */}
const level = journey.find(item => item.route === requested) as JourneyLevel | undefined;
mountDemoSkip(website, level?.id ?? 'moving-in');
// Chapters from the shop onward also need the first five vowels traced (see tracing-progress).
const writingStores: Storage[] = [];
try { writingStores.push(localStorage); } catch { /* Storage may be blocked. */ }
try { writingStores.push(sessionStorage); } catch { /* Storage may be blocked. */ }

if(!level||level.id==='moving-in'){
  const {startMovingIn}=await import('./moving-in');startMovingIn();
}else if(website&&level.id!=='letters'&&!canAccessLesson(level.chapter,writingStores)){
  location.replace('/unit/index.html');
}else if(!isUnlocked(level.id,completed)){
  await import('./moving-in.css');
  const app=document.querySelector<HTMLDivElement>('#app')!;
  app.className='arrival-app';app.dataset.phase='locked';
  app.innerHTML=`<main class="arrival-placeholder"><p class="arrival-eyebrow">YOUR NEIGHBORHOOD STORY</p><h1>A little earlier in the story…</h1><p>Chapter ${String(level.chapter).padStart(2,'0')}, ${level.title}, opens after the chapters before it. Your progress stays on this browser.</p><a class="arrival-primary" href="${website?'/map/index.html':'./'}">Back to your journey ↗</a><a href="?level=moving-in">Play Your First Hello</a></main>`;
}else if(level.id==='second-lesson'){
  const {startUnpacking}=await import('./unpacking');startUnpacking();
}else if(level.id==='counting'){
  const {startCounting}=await import('./counting');startCounting();
}else if(level.id==='letters'){
  // Letter tracing lives on the website's /unit page.
  if(website)location.replace('/unit/index.html');
  else{
    await import('./moving-in.css');
    const app=document.querySelector<HTMLDivElement>('#app')!;app.className='arrival-app';app.dataset.phase='locked';
    app.innerHTML=`<main class="arrival-placeholder"><p class="arrival-eyebrow">CHAPTER 04</p><h1>Your First Letters</h1><p>Letter tracing runs on the full site. Start it with <code>npm run dev</code> and open the map.</p><a class="arrival-primary" href="?level=shop">Skip to The Little Shop ↗</a></main>`;
  }
}else{
  await import('./shop-game');
}

mountLessonSettings(document.querySelector<HTMLElement>('#app')!);

// Reveal the world and UI separately so objects do not appear all at once.
if (import.meta.env.BASE_URL === '/game/' && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const app = document.querySelector('#app')!;
  const reveal = (selector: string, duration: number, delay = 0) => {
    app.querySelectorAll<HTMLElement>(selector).forEach(element => {
      element.animate([{opacity:0},{opacity:1}], {
        duration, delay, easing:'cubic-bezier(.22,.61,.36,1)', fill:'backwards',
      });
    });
  };
  // Keep the canvas intact: fading its container works for all scene objects,
  // including transparent sprites, without changing their materials.
  reveal('#arrival-world, #scene', 520);
  reveal('.arrival-header, .masthead', 300, 30);
  reveal('.arrival-overlay, .welcome, .market-arrival:not([hidden])', 420, 70);
  reveal('.arrival-journal, .arrival-pocket, .scene-top', 380, 60);
}

// Keep useful feedback on screen until the lesson has rendered its first frame.
requestAnimationFrame(() => requestAnimationFrame(() => {
  const opening = document.querySelector('#lesson-opening');
  opening?.classList.add('is-ready');
  window.setTimeout(() => opening?.remove(), 200);
}));
