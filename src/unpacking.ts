import './moving-in.css';
import './unpacking.css';
import * as THREE from 'three';
import {ArrivalScene} from './arrival-scene';
import {colors,colorOrder,items,checks,initialUnpack,see,canStartUnpacking,pick,answer,currentItem,unpacked,checked,type ColorId,type ItemId,type UnpackState} from './unpack-state';
import {completeLevel,journey} from './progression';
import {EffectsController} from './effects';

type Phase='intro'|'study'|'unpack'|'check'|'complete';
type Point=[number,number,number];
const eye={x:.15,z:-5.3};
const suitcaseAt:Point=[1.1,.66,-7];
const overview:Point=[.35,1,-7.6];
/** Where each item ends up in the room, and how it sits there. */
const places:Record<ItemId,{to:Point;rot:Point;scale:number;where:string}>={
  sweater:{to:[.72,1.075,-8],rot:[0,0,0],scale:1,where:'on the lower shelf'},
  shirt:{to:[.3,1.525,-8],rot:[0,0,0],scale:1,where:'on the top shelf'},
  towel:{to:[-1.25,1.72,-8.1],rot:[Math.PI/2,0,0],scale:1.5,where:'on a hook'},
  trousers:{to:[.3,1.075,-8],rot:[0,0,0],scale:1,where:'on the lower shelf'},
  scarf:{to:[-1.55,1.63,-8.1],rot:[0,0,Math.PI/2],scale:1.5,where:'on a hook'},
};
const packed:Record<ItemId,Point>={sweater:[-.14,.22,-.06],shirt:[.14,.22,-.06],towel:[-.14,.2,.1],trousers:[.14,.2,.1],scarf:[0,.28,.02]};
/** Tip garments toward the room camera so their silhouettes read in the open suitcase. */
const packedTilt:Record<ItemId,Point>={sweater:[-.95,0,.15],shirt:[-1.05,0,-.1],towel:[-.55,0,0],trousers:[-.85,0,.2],scarf:[-.4,.2,0]};
const sights:Record<typeof checks[number]['target'],Point>={towel:places.towel.to,plant:[-1.45,.55,-5.6],shirt:places.shirt.to};

class UnpackingGame{
  private app=document.querySelector<HTMLDivElement>('#app')!;
  private state:UnpackState=initialUnpack();private phase:Phase='intro';private selected:ColorId='red';private pending=false;private reading=true;
  private scene?:ArrivalScene;private suitcase=new THREE.Group();private things=new Map<ItemId,THREE.Group>();
  private effects=new EffectsController();private disposeTapControls=()=>{};
  private pose={x:eye.x,z:eye.z,yaw:0,pitch:-.3};private aim={yaw:0,pitch:-.3};private raf=0;
  private timers=new Set<ReturnType<typeof setTimeout>>();private drag?:{id:number;x:number;y:number;moved:boolean};private ignoreClickUntil=0;
  private panel:HTMLElement;private overlay:HTMLElement;private observer:ResizeObserver;
  constructor(){
    this.app.className='arrival-app unpack-app';this.app.dataset.readingHelp='true';
    const home=import.meta.env.BASE_URL==='/game/'?'/':'./';
    this.app.innerHTML=`<div id="arrival-world" class="arrival-world"></div><div class="arrival-vignette"></div><header class="arrival-header"><div class="lesson-navigation"><a class="arrival-brand" href="${home}" aria-label="Wayword home"><span>w</span>wayword<i>.</i></a><a class="lesson-back-map arrival-quiet" href="/map/index.html">← Back to map</a></div><span class="arrival-chapter">CHAPTER 02 · UNPACK YOUR SUITCASE</span><div class="arrival-header-actions"><button id="tap-sounds" class="arrival-quiet" type="button"></button><button id="arrival-reading" class="arrival-quiet" aria-label="Show Latin-letter guides" aria-pressed="true">Aa</button><button id="arrival-restart" class="arrival-quiet">Start over ↺</button></div></header><section class="arrival-dialogue unpack-panel" aria-labelledby="unpack-title" hidden></section><section id="arrival-overlay" class="arrival-overlay" role="dialog" aria-modal="false" aria-labelledby="arrival-title"></section>`;
    this.panel=this.app.querySelector('.unpack-panel')!;this.overlay=this.app.querySelector('#arrival-overlay')!;
    try{
      this.scene=new ArrivalScene(this.app.querySelector('#arrival-world')!,()=>{});
      this.scene.renderer.domElement.setAttribute('aria-label','Your new room: an open blue suitcase on the bed, a wall shelf, two hooks, a window and a lamp.');
      this.buildRoom();this.scene.placeInside(this.pose);
    }catch{this.app.querySelector('#arrival-world')!.innerHTML='<div class="arrival-fallback unpack-fallback"><p>The 3D room isn’t available on this device.<br>Use the buttons to unpack.</p></div>';}
    this.observer=new ResizeObserver(this.layout);this.observer.observe(this.panel);
    this.app.addEventListener('click',this.click);this.app.addEventListener('pointerdown',this.pointerDown);this.app.addEventListener('pointermove',this.pointerMove);this.app.addEventListener('pointerup',this.pointerUp);this.app.addEventListener('pointercancel',this.pointerUp);
    this.disposeTapControls=this.effects.bindTapControls(this.app,this.app.querySelector('#tap-sounds')!);
    window.addEventListener('keydown',this.keyDown);
    this.intro();this.frame();
  }
  private duration(ms:number){return this.scene?.reduced||matchMedia('(prefers-reduced-motion: reduce)').matches?0:ms;}
  private later(ms:number,callback:()=>void){const timer=setTimeout(()=>{this.timers.delete(timer);callback();},this.duration(ms));this.timers.add(timer);}
  private setPhase(phase:Phase){this.phase=phase;this.app.dataset.phase=phase;}
  private word(color:ColorId,english=true){const c=colors[color];return `<strong lang="ne">${c.word}</strong><span class="arrival-roman" lang="ne-Latn">${c.roman}</span>${english?`<small>${c.meaning}</small>`:''}`;}
  private dot(color:ColorId){return `<i class="unpack-dot" style="--swatch:${colors[color].hex}" aria-hidden="true"></i>`;}
  private garmentIcon(id:ItemId){
    const paths:Record<ItemId,string>={
      shirt:'M8 8.5L4 11v2.2l4-1.3V20h8v-8.1l4 1.3V11l-4-2.5L15.2 5H8.8L8 8.5zM12 9.2l1.6-1.4h-3.2L12 9.2z',
      trousers:'M8 4h8l.5 7H13l-.5 9h-1L11 11H7.5L8 4zm1.2 1.2v5.3h1.3V5.2H9.2zm4.1 0v5.3h1.3V5.2h-1.3z',
      sweater:'M7 9.2L3 12v2.3l4-1.4V20h10v-7.1l4 1.4V12l-4-2.8V6.2c0-1.2-1-2.2-2.2-2.2h-3.6C8 4 7 5 7 6.2v3z',
      towel:'M6 5h12v14H6V5zm2 2v10h8V7H8zm1.5 1.5h5v1.2h-5V8.5z',
      scarf:'M5 10.5c0-2 1.8-3.5 4-3.5h2c1 0 1.8.4 2.3 1l3.2-1.4.8 1.8-2.8 1.2c.3.5.5 1.1.5 1.7 0 2-1.8 3.5-4 3.5H9c-2.2 0-4-1.5-4-3.5zm4-1.7c-.9 0-1.6.5-1.6 1.2S8.1 12 9 12h2c.9 0 1.6-.5 1.6-1.2s-.7-1.2-1.6-1.2H9z',
    };
    return `<svg class="unpack-garment" viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[id]}"/></svg>`;
  }

  // ---- 3D room additions -------------------------------------------------
  private buildRoom(){
    const scene=this.scene!;
    for(const y of[1.02,1.47]){scene.box(scene.scene,[.95,.04,.3],[.5,y,-8.02],'#b39c79');for(const x of[.1,.9])scene.box(scene.scene,[.04,.12,.22],[x,y-.08,-8.08],'#9a8464');}
    for(const x of[-1.55,-1.25]){scene.box(scene.scene,[.05,.05,.12],[x,1.85,-8.12],'#8c7a5c');}
    // The open suitcase rests on the bed with its lid leaning back.
    this.suitcase.position.set(...suitcaseAt);scene.scene.add(this.suitcase);
    scene.box(this.suitcase,[.62,.16,.42],[0,.08,0],'#5a899c');scene.box(this.suitcase,[.56,.02,.36],[0,.15,0],'#d9cbb0');
    const lid=new THREE.Group();lid.position.set(0,.16,-.21);lid.rotation.x=-.35;this.suitcase.add(lid);scene.box(lid,[.62,.42,.05],[0,.21,-.02],'#5a899c');scene.box(lid,[.13,.17,.02],[.16,.25,.015],'#efc65d');
    for(const item of items){
      const group=new THREE.Group(),hex=colors[item.color].hex,trim=item.color==='white'?'#d8d2c4':new THREE.Color(hex).multiplyScalar(.75).getStyle();
      group.userData.item=item.id;group.name=`unpack-${item.id}`;
      this.buildGarment(group,item.id,hex,trim);
      this.things.set(item.id,group);
    }
    this.repack();
  }
  /** Folded clothing silhouettes so shirt, trousers, and the rest read at a glance. */
  private buildGarment(group:THREE.Group,id:ItemId,hex:string,trim:string){
    const scene=this.scene!;
    if(id==='shirt'){
      // Compact button-up: short sleeves, open collar, and a center placket.
      scene.box(group,[.095,.038,.145],[0,0,-.015],hex);
      for(const x of[-.09,.09])scene.box(group,[.07,.032,.05],[x,.004,.06],hex);
      scene.box(group,[.055,.045,.03],[0,.01,.095],trim);
      scene.box(group,[.02,.046,.03],[-.02,.012,.09],hex);
      scene.box(group,[.02,.046,.03],[.02,.012,.09],hex);
      scene.box(group,[.016,.048,.12],[0,.012,-.01],trim);
      for(const z of[-.04,.02])scene.box(group,[.014,.05,.014],[0,.014,z],trim);
      return;
    }
    if(id==='trousers'){
      // Waistband with two separate legs — an inverted-U silhouette.
      scene.box(group,[.18,.04,.045],[0,0,.085],hex);
      scene.box(group,[.18,.046,.018],[0,.006,.105],trim);
      for(const x of[-.05,.05])scene.box(group,[.07,.04,.17],[x,0,-.02],hex);
      scene.box(group,[.028,.045,.04],[0,.005,.05],trim);
      return;
    }
    if(id==='scarf'){
      scene.box(group,[.32,.032,.05],[0,0,0],hex);
      scene.box(group,[.05,.038,.055],[0,.005,0],trim);
      for(const x of[-.18,.18])for(const z of[-.018,0,.018])scene.box(group,[.04,.025,.01],[x,0,z],trim);
      return;
    }
    if(id==='towel'){
      scene.box(group,[.17,.035,.17],[0,0,0],hex);
      scene.box(group,[.17,.045,.04],[0,.008,.075],trim);
      scene.box(group,[.14,.018,.13],[0,.02,-.01],trim);
      return;
    }
    // Sweater: thicker body, long sleeves with cuffs, round crew neck, ribbed hem.
    scene.box(group,[.12,.055,.125],[0,0,-.02],hex);
    for(const x of[-.11,.11]){
      scene.box(group,[.1,.05,.065],[x,.006,.03],hex);
      scene.box(group,[.035,.055,.065],[x*1.4,.006,.03],trim);
    }
    scene.box(group,[.08,.06,.05],[0,.014,.08],trim);
    scene.box(group,[.045,.04,.035],[0,.02,.095],hex);
    scene.box(group,[.12,.06,.035],[0,.012,-.085],trim);
  }
  private repack(){
    for(const item of items){
      const group=this.things.get(item.id)!;
      this.suitcase.add(group);
      group.position.set(...packed[item.id]);
      group.rotation.set(...packedTilt[item.id]);
      group.scale.setScalar(1);
    }
  }
  /** Turns toward a point. On wide screens the panel covers the left, so the point is framed right of center. */
  private lookAt(point:Point){
    const dx=point[0]-this.pose.x,dz=point[2]-this.pose.z,wide=innerWidth>560&&this.phase!=='intro'&&this.phase!=='complete';
    const shift=wide?Math.atan(.38*Math.tan(THREE.MathUtils.degToRad(31))*innerWidth/innerHeight):0;
    this.aim={yaw:Math.atan2(-dx,-dz)+shift,pitch:Math.max(-.9,Math.min(.3,Math.atan2(point[1]-1.58,Math.hypot(dx,dz))))};
  }
  private homeView(){this.lookAt(this.phase==='intro'||this.phase==='complete'?overview:suitcaseAt);}
  private frame=()=>{
    this.raf=requestAnimationFrame(this.frame);const k=this.duration(1)?.12:1;
    const dyaw=Math.atan2(Math.sin(this.aim.yaw-this.pose.yaw),Math.cos(this.aim.yaw-this.pose.yaw));this.pose.yaw+=dyaw*k;this.pose.pitch+=(this.aim.pitch-this.pose.pitch)*k;
    this.scene?.setPose(this.pose);this.app.dataset.unpackYaw=this.pose.yaw.toFixed(2);
  };

  // ---- Screens ------------------------------------------------------------
  private intro(){
    this.setPhase('intro');this.panel.hidden=true;this.overlay.hidden=false;this.homeView();
    this.overlay.innerHTML=`<article class="arrival-card"><span class="arrival-spark" aria-hidden="true">✦</span><p class="arrival-eyebrow">CHAPTER 02 · SETTLING IN</p><h1 id="arrival-title" tabindex="-1">Unpack your suitcase.</h1><p>Asha knocks and leans in the doorway.<br>“Let’s make this room yours. I’ll call out colors.”</p><div class="unpack-intro-dots">${colorOrder.map(color=>this.dot(color)).join('')}</div><button class="arrival-primary" data-unpack="begin">Learn five colors ↗</button><p class="arrival-small">Five colors · Five things to put away · No timer</p></article>`;
    this.overlay.querySelector<HTMLElement>('#arrival-title')!.focus({preventScroll:true});
  }
  private study(){
    const entering=this.phase!=='study';this.setPhase('study');this.overlay.hidden=true;this.panel.hidden=false;this.state=see(this.state,this.selected);if(entering)this.homeView();
    const c=colors[this.selected],ready=canStartUnpacking(this.state);
    this.panel.innerHTML=`<header><span class="arrival-eyebrow">ASHA · YOUR HOST</span><span class="arrival-eyebrow">${this.state.seen.length} OF 5 EXPLORED</span></header><h2 id="unpack-title" tabindex="-1">Five colors for your things.</h2><p>Tap each color to hear what Asha calls it.</p><div class="unpack-swatches" role="group" aria-label="Colors">${colorOrder.map(color=>`<button data-color="${color}" aria-pressed="${color===this.selected}" class="${this.state.seen.includes(color)?'seen':''}">${this.dot(color)}<span lang="ne">${colors[color].word}</span></button>`).join('')}</div><div class="arrival-phrase unpack-card" style="--swatch:${c.hex}">${this.dot(this.selected)}${this.word(this.selected)}</div><button class="arrival-primary" data-unpack="start" ${ready?'':'disabled'}>${ready?'Start unpacking ↗':`Explore ${5-this.state.seen.length} more ${5-this.state.seen.length===1?'color':'colors'}`}</button>`;
    this.layout();
  }
  private task(feedback=''){
    this.setPhase('unpack');this.panel.hidden=false;const item=currentItem(this.state)!;
    const left=items.filter((_,index)=>index>=this.state.task);
    this.panel.innerHTML=`<header><span class="arrival-eyebrow">UNPACKING · ${this.state.task+1} OF 5</span><button class="arrival-quiet" data-unpack="review">Colors</button></header><h2 id="unpack-title" tabindex="-1">“Put away the <span class="unpack-target">${this.word(item.color,false)}</span> one.”</h2><p>Find it in the suitcase on the bed: tap it in the room or below.</p><div class="unpack-tray" role="group" aria-label="In your suitcase">${[...left].sort((a,b)=>a.name.localeCompare(b.name)).map(thing=>`<button data-item="${thing.id}">${this.dot(thing.color)}${this.garmentIcon(thing.id)}<span>${thing.name}</span></button>`).join('')}</div><p class="unpack-status" role="status" aria-live="polite">${feedback}</p>`;
    this.layout();
  }
  private check(feedback=''){
    this.setPhase('check');this.panel.hidden=false;const question=checks[this.state.check];this.lookAt(sights[question.target]);
    this.panel.innerHTML=`<header><span class="arrival-eyebrow">QUICK CHECK · ${this.state.check+1} OF 3</span></header><h2 id="unpack-title" tabindex="-1">What color is ${question.label}?</h2><p>Asha points across the room.</p><div class="arrival-answers">${question.options.map(color=>`<button data-answer="${color}">${this.word(color,false)}</button>`).join('')}</div><p class="unpack-status" role="status" aria-live="polite">${feedback}</p>`;
    this.layout();
  }
  private nextStep(){const next=journey[2],website=import.meta.env.BASE_URL==='/game/';return{next,href:`${website?'/game/index.html':''}?level=${next.route}`};}
  private finish(){
    this.setPhase('complete');this.panel.hidden=true;this.homeView();let saved=false;
    try{saved=completeLevel(localStorage,'second-lesson');}catch{/* Completion still shows without storage. */}
    const {next,href}=this.nextStep(),chapter=String(next.chapter).padStart(2,'0');
    this.overlay.hidden=false;
    this.overlay.innerHTML=`<article class="arrival-card arrival-complete"><span class="arrival-spark" aria-hidden="true">✓</span><p class="arrival-eyebrow">CHAPTER 02 · COMPLETE</p><h2 id="arrival-title" tabindex="-1">Your room, your colors.</h2><p>Everything has a place, and you can name every color.</p><ul class="arrival-words unpack-words" aria-label="Five colors you used">${colorOrder.map(color=>`<li>${this.dot(color)}<strong lang="ne">${colors[color].word}</strong><span class="arrival-roman" lang="ne-Latn">${colors[color].roman}</span></li>`).join('')}</ul><p class="arrival-stats"><strong>Five colors · ${this.state.misses} ${this.state.misses===1?'retry':'retries'}</strong></p><div class="arrival-next"><small>UP NEXT · CHAPTER ${chapter}</small><strong>${next.title}</strong><span>“Your kitchen is empty,” Asha laughs. “The little shop is just around the corner.”</span></div><a class="arrival-primary" href="${href}">Start chapter ${chapter} ↗</a><div class="arrival-card-actions"><button class="arrival-quiet" data-unpack="look">Look around</button><button class="arrival-quiet" data-unpack="restart">Replay chapter</button></div><p class="arrival-small">${saved?'Progress saved on this browser.':'Progress saving is unavailable. You can still replay this lesson.'}</p></article>`;
    this.overlay.querySelector<HTMLElement>('#arrival-title')!.focus({preventScroll:true});
  }

  // ---- Actions ------------------------------------------------------------
  private choose(id:ItemId){
    if(this.phase!=='unpack'||this.pending)return;
    const item=items.find(thing=>thing.id===id)!,wanted=currentItem(this.state)!,result=pick(this.state,id);this.state=result.state;
    if(!result.correct){
      if(items.indexOf(item)<this.state.task)return;
      this.task(`That one is ${colors[item.color].word} <span class="arrival-roman">(${colors[item.color].roman})</span>. Look for ${colors[wanted.color].word}.`);
      this.panel.querySelector(`[data-item="${id}"]`)?.classList.add('unpack-wrong');return;
    }
    const place=places[id],group=this.things.get(id);this.pending=true;
    this.panel.querySelector(`[data-item="${id}"]`)?.remove();this.panel.querySelectorAll<HTMLButtonElement>('[data-item]').forEach(button=>button.disabled=true);
    this.panel.querySelector('.unpack-status')!.textContent=`Yes! The ${colors[item.color].word} ${item.name} goes ${place.where}.`;
    if(group&&this.scene){this.scene.transfer(group,this.scene.scene,new THREE.Vector3(...place.to),900,place.scale,new THREE.Euler(...place.rot));}
    this.lookAt(place.to);
    this.later(1500,()=>{this.pending=false;this.homeView();if(unpacked(this.state))this.check();else this.task();});
  }
  private respond(color:ColorId){
    if(this.phase!=='check'||this.pending)return;const question=checks[this.state.check],result=answer(this.state,color);this.state=result.state;
    if(!result.correct){this.check(`Not quite: that’s ${colors[color].meaning.toLowerCase()}. Look again.`);return;}
    this.pending=true;this.panel.querySelector('.unpack-status')!.textContent=`Yes, ${colors[question.answer].word}!`;this.panel.querySelectorAll<HTMLButtonElement>('[data-answer]').forEach(button=>{button.disabled=true;button.classList.toggle('unpack-right',button.dataset.answer===color);});
    this.later(900,()=>{this.pending=false;if(checked(this.state))this.finish();else this.check();});
  }
  private click=(event:MouseEvent)=>{
    const target=event.target instanceof Element?event.target:null,button=target?.closest<HTMLButtonElement>('button');
    if(button&&!button.disabled){
      const action=button.dataset.unpack;
      if(button.id==='arrival-restart'||action==='restart'){this.reset();return;}
      if(button.id==='arrival-reading'){this.reading=!this.reading;this.app.dataset.readingHelp=String(this.reading);button.setAttribute('aria-pressed',String(this.reading));return;}
      if(action==='begin'){this.study();this.panel.querySelector<HTMLElement>('#unpack-title')!.focus({preventScroll:true});return;}
      if(button.dataset.color){this.selected=button.dataset.color as ColorId;this.study();this.panel.querySelector<HTMLElement>(`[data-color="${this.selected}"]`)!.focus();return;}
      if(action==='start'&&canStartUnpacking(this.state)){this.task();this.panel.querySelector<HTMLElement>('#unpack-title')!.focus({preventScroll:true});return;}
      if(action==='review'&&!this.pending){this.study();return;}
      if(action==='look'){
        this.overlay.hidden=true;this.app.dataset.phase='look';this.panel.hidden=false;const {next,href}=this.nextStep();
        this.panel.innerHTML=`<header><span class="arrival-eyebrow">CHAPTER 02 · COMPLETE</span></header><h2 id="unpack-title" tabindex="-1">All unpacked.</h2><p>Drag to look around your room. When you’re ready, Asha will point you to ${next.title}.</p><a class="arrival-primary" href="${href}">Start chapter ${String(next.chapter).padStart(2,'0')} ↗</a>`;this.layout();return;
      }
      if(button.dataset.item){this.choose(button.dataset.item as ItemId);return;}
      if(button.dataset.answer){this.respond(button.dataset.answer as ColorId);return;}
      return;
    }
    if(this.scene&&target===this.scene.renderer.domElement&&performance.now()>this.ignoreClickUntil){const hit=this.scene.hit(event.clientX,event.clientY,'item');if(hit)this.choose(hit.userData.item as ItemId);}
  };
  private keyDown=(event:KeyboardEvent)=>{
    if(event.target instanceof HTMLElement&&event.target.closest('input,textarea,select,button'))return;
    if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();this.aim.yaw+=event.key==='ArrowLeft'?.25:-.25;}
  };
  private pointerDown=(event:PointerEvent)=>{if(event.button!==0||!this.scene||event.target!==this.scene.renderer.domElement)return;this.scene.renderer.domElement.setPointerCapture(event.pointerId);this.drag={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};};
  private pointerMove=(event:PointerEvent)=>{if(!this.drag||this.drag.id!==event.pointerId)return;const dx=event.clientX-this.drag.x,dy=event.clientY-this.drag.y;this.aim.yaw-=dx*.004;this.aim.pitch=Math.max(-.9,Math.min(.3,this.aim.pitch-dy*.003));this.pose.yaw=this.aim.yaw;this.pose.pitch=this.aim.pitch;this.drag.x=event.clientX;this.drag.y=event.clientY;if(Math.abs(dx)+Math.abs(dy)>2)this.drag.moved=true;};
  private pointerUp=()=>{if(this.drag?.moved)this.ignoreClickUntil=performance.now()+300;this.drag=undefined;};
  /** On phones the panel sits at the bottom; shrink the 3D view so the suitcase stays visible above it. */
  private layout=()=>{this.app.style.setProperty('--unpack-panel',`${this.panel.hidden?0:this.panel.getBoundingClientRect().height+24}px`);};
  private reset(){
    this.timers.forEach(timer=>clearTimeout(timer));this.timers.clear();this.pending=false;this.state=initialUnpack();this.selected='red';
    if(this.scene){this.scene.reset();this.scene.placeInside(this.pose);this.repack();}
    this.intro();
  }
  dispose(){this.timers.forEach(timer=>clearTimeout(timer));cancelAnimationFrame(this.raf);this.observer.disconnect();this.disposeTapControls();this.effects.dispose();this.scene?.dispose();this.app.removeEventListener('click',this.click);this.app.removeEventListener('pointerdown',this.pointerDown);this.app.removeEventListener('pointermove',this.pointerMove);this.app.removeEventListener('pointerup',this.pointerUp);this.app.removeEventListener('pointercancel',this.pointerUp);window.removeEventListener('keydown',this.keyDown);}
}
export function startUnpacking(){
  const game=new UnpackingGame(),dispose=()=>game.dispose();
  window.addEventListener('pagehide',dispose,{once:true});
  if(import.meta.hot)import.meta.hot.dispose(()=>{window.removeEventListener('pagehide',dispose);game.dispose();});
  return game;
}
