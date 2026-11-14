import { completedLevels, isUnlocked, journey, type JourneyLevel } from './progression';
import './tokens.css';

const requested = new URLSearchParams(location.search).get('level');
const website = import.meta.env.BASE_URL === '/game/';
let completed:ReturnType<typeof completedLevels>=[];
try{completed=completedLevels(localStorage);}catch{/* The first level works without storage. */}
const level = journey.find(item => item.route === requested) as JourneyLevel | undefined;

if(!level||level.id==='moving-in'){
  const {startMovingIn}=await import('./moving-in');startMovingIn();
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
