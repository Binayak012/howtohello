import { completedLevels, isUnlocked } from './progression';
import './tokens.css';
import { canAccessLesson } from './tracing-progress';
import { journey } from './progression';

const requested = new URLSearchParams(location.search).get('level');
let completed:ReturnType<typeof completedLevels>=[];
try{completed=completedLevels(localStorage);}catch{/* The first level works without storage. */}
const writingStores: Storage[] = [];
try { writingStores.push(localStorage); } catch {}
try { writingStores.push(sessionStorage); } catch {}
const requestedLesson = journey.find(level => level.route === requested);
if (requestedLesson && !canAccessLesson(requestedLesson.chapter, writingStores)) {
  location.replace('/unit/index.html');
} else if(requested==='shop'&&isUnlocked('little-shop',completed)||requested==='market'&&isUnlocked('next-adventure',completed)){
  await import('./shop-game');
}else if(requested==='second-lesson'&&isUnlocked('second-lesson',completed)){
  const {startUnpacking}=await import('./unpacking');startUnpacking();
}else if(requested==='shop'||requested==='market'||requested==='second-lesson'){
  await import('./moving-in.css');
  const app=document.querySelector<HTMLDivElement>('#app')!;
  app.className='arrival-app';app.dataset.phase='locked';
  const map=import.meta.env.BASE_URL==='/game/'?'/map/index.html':'./';
  app.innerHTML=`<main class="arrival-placeholder"><p class="arrival-eyebrow">YOUR NEIGHBORHOOD STORY</p><h1>A little earlier in the story…</h1><p>Start with Your First Hello, then follow your journey. Your progress stays on this browser.</p><a class="arrival-primary" href="${map}">Back to your journey ↗</a><a href="?level=moving-in">Play Your First Hello</a></main>`;
}else{
  const {startMovingIn}=await import('./moving-in');startMovingIn();
}

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
