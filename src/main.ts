import { isBasicUnlocked } from './unit-unlock';
import { completedLevels, isUnlocked } from './progression';
import './tokens.css';

const requested = new URLSearchParams(location.search).get('level');
let completed:ReturnType<typeof completedLevels>=[];
try{completed=completedLevels(localStorage);}catch{/* The first level works without storage. */}
let basicOpen=true;
if(import.meta.env.BASE_URL==='/game/'&&completed.length===0){basicOpen=false;try{basicOpen=isBasicUnlocked(localStorage);}catch{}try{basicOpen ||= isBasicUnlocked(sessionStorage);}catch{}}
if(!basicOpen){location.replace('/unit/index.html');}
else if(requested==='shop'&&isUnlocked('little-shop',completed)||requested==='market'&&isUnlocked('next-adventure',completed)){
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
