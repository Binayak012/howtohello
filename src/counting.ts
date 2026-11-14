import './moving-in.css';
import './unpacking.css';
import './counting.css';
import * as THREE from 'three';
import {ArrivalScene} from './arrival-scene';
import {numbers,apple} from './numbers';
import {appleCount,rounds,recall,initialCounting,seeNumber,canStartCounting,addApple,removeApple,giveBasket,answerCount,counted,recalled,type CountingState} from './counting-state';
import {completeLevel,levelHref,nextLevel} from './progression';

type Phase='intro'|'study'|'count'|'recall'|'complete'|'look';
type Point=[number,number,number];
// The courtyard bench from chapter 1: apples on the seat, Lila's basket at the right end.
const eye={x:-4.55,z:-.35};
const benchAt:Point=[-4.65,.6,-2.8];
const basketAt:Point=[-3.85,.56,-2.8];
const lilaAt={x:-4.1,z:-3.9};
const benchSpot=(i:number):Point=>[-5.45+i*.24,.62,-2.78];
const basketSpot=(i:number):Point=>[basketAt[0]+[-.07,.07,-.07,.07,0][i],.66+(i===4?.1:0),basketAt[2]+[-.06,-.06,.06,.06,0][i]];

class CountingGame{
  private app=document.querySelector<HTMLDivElement>('#app')!;
  private state:CountingState=initialCounting();private phase:Phase='intro';private selected=1;private pending=false;private reading=true;
  private scene?:ArrivalScene;private apples:THREE.Group[]=[];private inBasket:boolean[]=Array(appleCount).fill(false);private basket=new THREE.Group();
  private pose={x:eye.x,z:eye.z,yaw:0,pitch:-.4};private aim={yaw:0,pitch:-.4};private raf=0;
  private timers=new Set<ReturnType<typeof setTimeout>>();private drag?:{id:number;x:number;y:number;moved:boolean};private ignoreClickUntil=0;
  private panel:HTMLElement;private overlay:HTMLElement;private observer:ResizeObserver;
  constructor(){
    this.app.className='arrival-app unpack-app counting-app';this.app.dataset.readingHelp='true';
    const home=import.meta.env.BASE_URL==='/game/'?'/':'./';
    this.app.innerHTML=`<div id="arrival-world" class="arrival-world"></div><div class="arrival-vignette"></div><header class="arrival-header"><a class="arrival-brand" href="${home}" aria-label="Wayword home"><span>w</span>wayword<i>.</i></a><span class="arrival-chapter">CHAPTER 03 · COUNTING WITH LILA</span><div class="arrival-header-actions"><button id="arrival-reading" class="arrival-quiet" aria-label="Show Latin-letter guides" aria-pressed="true">Aa</button><button id="arrival-restart" class="arrival-quiet">Start over ↺</button></div></header><section class="arrival-dialogue unpack-panel" aria-labelledby="count-title" hidden></section><section id="arrival-overlay" class="arrival-overlay" role="dialog" aria-modal="false" aria-labelledby="arrival-title"></section>`;
    this.panel=this.app.querySelector('.unpack-panel')!;this.overlay=this.app.querySelector('#arrival-overlay')!;
    try{
      this.scene=new ArrivalScene(this.app.querySelector('#arrival-world')!,()=>{});
      this.scene.renderer.domElement.setAttribute('aria-label','The courtyard bench: five apples on the seat, a basket at the end, and your neighbor Lila beside it.');
      this.buildBench();this.placeScene();
    }catch{this.app.querySelector('#arrival-world')!.innerHTML='<div class="arrival-fallback unpack-fallback"><p>The 3D courtyard isn’t available on this device.<br>Use the buttons to fill the basket.</p></div>';}
    this.observer=new ResizeObserver(this.layout);this.observer.observe(this.panel);
    this.app.addEventListener('click',this.click);this.app.addEventListener('pointerdown',this.pointerDown);this.app.addEventListener('pointermove',this.pointerMove);this.app.addEventListener('pointerup',this.pointerUp);this.app.addEventListener('pointercancel',this.pointerUp);
    window.addEventListener('keydown',this.keyDown);
    this.intro();this.frame();
  }
  private duration(ms:number){return this.scene?.reduced||matchMedia('(prefers-reduced-motion: reduce)').matches?0:ms;}
  private later(ms:number,callback:()=>void){const timer=setTimeout(()=>{this.timers.delete(timer);callback();},this.duration(ms));this.timers.add(timer);}
  private setPhase(phase:Phase){this.phase=phase;this.app.dataset.phase=phase;}
  private word(value:number){const n=numbers[value-1];return `<strong lang="ne">${n.word}</strong><span class="arrival-roman" lang="ne-Latn">${n.roman}</span>`;}
  private appleRow(count:number){return `<span class="count-apples" role="img" aria-label="${count} ${count===1?'apple':'apples'}">${Array.from({length:count},()=>`<i>${apple}</i>`).join('')}</span>`;}

  // ---- 3D bench ------------------------------------------------------------
  private buildBench(){
    const scene=this.scene!;
    this.basket.position.set(...basketAt);scene.scene.add(this.basket);
    const wall=new THREE.CylinderGeometry(.22,.17,.16,20,1,true),floor=new THREE.CircleGeometry(.17,20),wicker=new THREE.MeshStandardMaterial({color:'#b98a55',roughness:.9,side:THREE.DoubleSide});
    const sides=new THREE.Mesh(wall,wicker);sides.position.y=.08;sides.castShadow=true;const base=new THREE.Mesh(floor,wicker);base.rotation.x=-Math.PI/2;base.position.y=.005;this.basket.add(sides,base);
    const rim=new THREE.Mesh(new THREE.TorusGeometry(.22,.018,8,24),new THREE.MeshStandardMaterial({color:'#8f6639'}));rim.rotation.x=Math.PI/2;rim.position.y=.16;this.basket.add(rim);
    for(let i=0;i<appleCount;i++){
      const group=new THREE.Group();group.userData.apple=i;group.name=`count-apple-${i}`;
      const fruit=new THREE.Mesh(new THREE.SphereGeometry(.075,16,12),new THREE.MeshStandardMaterial({color:'#d4533e',roughness:.6}));fruit.castShadow=true;group.add(fruit);
      scene.box(group,[.012,.04,.012],[0,.085,0],'#6d5139');scene.box(group,[.04,.012,.025],[.022,.095,0],'#6f9874');
      this.apples.push(group);
    }
  }
  /** Puts the camera at the bench, moves Lila beside it, and lays the apples back on the seat. */
  private placeScene(){
    const scene=this.scene;if(!scene)return;
    scene.placeInside(this.pose);scene.parcel.visible=false;
    const lila=scene.actors.get('neighbor')!;lila.home.set(lilaAt.x,0,lilaAt.z);lila.facing=Math.atan2(eye.x-lilaAt.x,eye.z-lilaAt.z);lila.root.position.copy(lila.home);lila.root.rotation.set(0,lila.facing,0);
    this.inBasket.fill(false);this.apples.forEach((group,i)=>{scene.scene.add(group);group.position.set(...benchSpot(i));group.rotation.set(0,i*.9,0);group.scale.setScalar(1);});
  }
  private moveApple(i:number,toBasket:boolean){
    this.inBasket[i]=toBasket;const slot=toBasket?this.inBasket.filter(Boolean).length-1:i;
    if(this.scene)this.scene.transfer(this.apples[i],this.scene.scene,new THREE.Vector3(...(toBasket?basketSpot(slot):benchSpot(i))),450,1,new THREE.Euler(0,i*.9,0));
  }
  /** Returns every apple to the bench, then optionally places `count` in the basket. */
  private setBasket(count:number){
    this.apples.forEach((_,i)=>{if(this.inBasket[i])this.moveApple(i,false);});
    for(let i=0;i<count;i++)this.moveApple(i,true);
  }
  private lookAt(point:Point){
    const dx=point[0]-this.pose.x,dz=point[2]-this.pose.z,wide=innerWidth>560&&this.phase!=='intro'&&this.phase!=='complete';
    const shift=wide?Math.atan(.38*Math.tan(THREE.MathUtils.degToRad(31))*innerWidth/innerHeight):0;
    this.aim={yaw:Math.atan2(-dx,-dz)+shift,pitch:Math.max(-.9,Math.min(.3,Math.atan2(point[1]-1.58,Math.hypot(dx,dz))))};
  }
  private homeView(){this.lookAt(benchAt);}
  private frame=()=>{
    this.raf=requestAnimationFrame(this.frame);const k=this.duration(1)?.12:1;
    const dyaw=Math.atan2(Math.sin(this.aim.yaw-this.pose.yaw),Math.cos(this.aim.yaw-this.pose.yaw));this.pose.yaw+=dyaw*k;this.pose.pitch+=(this.aim.pitch-this.pose.pitch)*k;
    this.scene?.setPose(this.pose);
  };

  // ---- Screens ---------------------------------------------------------------
  private intro(){
    this.setPhase('intro');this.panel.hidden=true;this.overlay.hidden=false;this.homeView();
    this.overlay.innerHTML=`<article class="arrival-card"><span class="arrival-spark" aria-hidden="true">✦</span><p class="arrival-eyebrow">CHAPTER 03 · THE COURTYARD</p><h1 id="arrival-title">Counting with Lila.</h1><p>Lila is back from the market with a bag of apples.<br>“Could you help me fill my basket? I’ll tell you how many.”</p>${this.appleRow(5)}<button class="arrival-primary" data-count="begin">Learn numbers 1–5 ↗</button><p class="arrival-small">Five numbers · Fill the basket · No timer</p></article>`;
    this.overlay.querySelector<HTMLButtonElement>('button')!.focus();
  }
  private study(){
    const entering=this.phase!=='study';this.setPhase('study');this.overlay.hidden=true;this.panel.hidden=false;this.state=seeNumber(this.state,this.selected);if(entering)this.homeView();
    const n=numbers[this.selected-1],ready=canStartCounting(this.state),left=appleCount-this.state.seen.length;
    this.panel.innerHTML=`<header><span class="arrival-eyebrow">LILA · YOUR NEIGHBOR</span><span class="arrival-eyebrow">${this.state.seen.length} OF 5 EXPLORED</span></header><h2 id="count-title" tabindex="-1">Five numbers for counting.</h2><p>Tap each number to see the word and its apples.</p><div class="count-tabs" role="group" aria-label="Numbers">${numbers.map(number=>`<button data-number="${number.value}" aria-label="Learn ${number.english.toLowerCase()}" aria-pressed="${number.value===this.selected}" class="${this.state.seen.includes(number.value)?'seen':''}"><b>${number.value}</b><span lang="ne">${number.digit}</span></button>`).join('')}</div><div class="arrival-phrase count-card"><span class="count-numerals"><b>${n.value}</b><span lang="ne">${n.digit}</span></span>${this.word(n.value)}<small>${n.english}</small>${this.appleRow(n.value)}</div><button class="arrival-primary" data-count="start" ${ready?'':'disabled'}>${ready?'Help Lila ↗':`Explore ${left} more ${left===1?'number':'numbers'}`}</button>`;
    this.layout();
  }
  private task(feedback=''){
    this.setPhase('count');this.panel.hidden=false;const wanted=rounds[this.state.round],have=this.state.basket;
    this.panel.innerHTML=`<header><span class="arrival-eyebrow">FILL THE BASKET · ${this.state.round+1} OF ${rounds.length}</span><button class="arrival-quiet" data-count="review">Numbers</button></header><h2 id="count-title" tabindex="-1">“Please put <span class="unpack-target">${this.word(wanted)}</span> ${wanted===1?'apple':'apples'} in my basket.”</h2><p>Tap apples on the bench to add them, or tap one in the basket to take it out.</p><div class="count-basket" aria-live="polite"><span class="count-basket-label">In the basket</span><b class="count-basket-number">${have}</b>${this.appleRow(have)}</div><div class="count-controls"><button class="arrival-quiet" data-count="remove" ${have===0?'disabled':''} aria-label="Take one apple out">− One out</button><button class="arrival-quiet" data-count="add" ${have===appleCount?'disabled':''} aria-label="Add one apple">+ One in</button><button class="arrival-primary" data-count="give">Give Lila the basket ↗</button></div><p class="unpack-status" role="status" aria-live="polite">${feedback}</p>`;
    this.layout();
  }
  private ask(feedback=''){
    this.setPhase('recall');this.panel.hidden=false;const question=recall[this.state.recall];
    this.panel.innerHTML=`<header><span class="arrival-eyebrow">QUICK CHECK · ${this.state.recall+1} OF ${recall.length}</span></header><h2 id="count-title" tabindex="-1">How many apples are in the basket?</h2><p>Lila fills the basket herself and looks at you.</p><div class="arrival-answers">${question.options.map(value=>`<button data-answer="${value}">${this.word(value)}</button>`).join('')}</div><p class="unpack-status" role="status" aria-live="polite">${feedback}</p>`;
    this.layout();
  }
  private nextStep(){const next=nextLevel('counting')!;return{next,href:levelHref(next,import.meta.env.BASE_URL==='/game/')};}
  private finish(){
    this.setPhase('complete');this.panel.hidden=true;this.homeView();let saved=false;
    try{saved=completeLevel(localStorage,'counting');}catch{/* Completion still shows without storage. */}
    const {next,href}=this.nextStep(),chapter=String(next.chapter).padStart(2,'0');
    this.overlay.hidden=false;
    this.overlay.innerHTML=`<article class="arrival-card arrival-complete"><span class="arrival-spark" aria-hidden="true">✓</span><p class="arrival-eyebrow">CHAPTER 03 · COMPLETE</p><h2 id="arrival-title">A basket full of numbers.</h2><p>You filled Lila’s basket, one to five.</p><ul class="arrival-words count-words" aria-label="Five numbers you used">${numbers.map(n=>`<li><b>${n.value}</b><strong lang="ne">${n.word}</strong><span class="arrival-roman" lang="ne-Latn">${n.roman}</span></li>`).join('')}</ul><p class="arrival-stats"><strong>Five numbers · ${this.state.misses} ${this.state.misses===1?'retry':'retries'}</strong></p><div class="arrival-next"><small>UP NEXT · CHAPTER ${chapter}</small><strong>${next.title}</strong><span>Lila hands you her notebook: “Now try writing a few letters!”</span></div><a class="arrival-primary" href="${href}">Start chapter ${chapter} ↗</a><div class="arrival-card-actions"><button class="arrival-quiet" data-count="look">Look around</button><button class="arrival-quiet" data-count="restart">Replay chapter</button></div><p class="arrival-small">${saved?'Progress saved on this browser.':'Progress saving is unavailable. You can still replay this lesson.'}</p></article>`;
    this.overlay.querySelector<HTMLAnchorElement>('a')!.focus({preventScroll:true});
  }

  // ---- Actions -----------------------------------------------------------------
  private change(add:boolean,index?:number){
    if(this.phase!=='count'||this.pending)return;
    const before=this.state.basket;this.state=add?addApple(this.state):removeApple(this.state);if(this.state.basket===before)return;
    if(add){const i=index??this.inBasket.findIndex(inside=>!inside);if(i>=0)this.moveApple(i,true);}
    else{const i=index??this.inBasket.lastIndexOf(true);if(i>=0){this.moveApple(i,false);this.restack();}}
    this.task();
  }
  /** Keeps the remaining basket apples in the lowest slots after one is taken out. */
  private restack(){let slot=0;this.inBasket.forEach((inside,i)=>{if(inside&&this.scene)this.scene.transfer(this.apples[i],this.scene.scene,new THREE.Vector3(...basketSpot(slot++)),300,1,new THREE.Euler(0,i*.9,0));});}
  private give(){
    if(this.phase!=='count'||this.pending)return;const wanted=rounds[this.state.round],have=this.state.basket,result=giveBasket(this.state);this.state=result.state;
    if(!result.correct){this.scene?.react('neighbor','shake',this.pose);this.task(have===0?`The basket is empty. Lila asked for ${numbers[wanted-1].word}.`:`That’s ${numbers[have-1].word} <span class="arrival-roman">(${have})</span>. Lila asked for ${numbers[wanted-1].word}.`);return;}
    this.pending=true;this.scene?.react('neighbor','thanks',this.pose);
    this.panel.querySelectorAll<HTMLButtonElement>('[data-count]').forEach(button=>button.disabled=true);
    this.panel.querySelector('.unpack-status')!.innerHTML=`धन्यवाद! <span lang="ne">${numbers[wanted-1].word}</span> ${wanted===1?'apple':'apples'}, exactly right.`;
    this.later(1300,()=>{this.pending=false;this.setBasket(0);if(counted(this.state)){this.setBasket(recall[0].count);this.ask();}else this.task();});
  }
  private respond(value:number){
    if(this.phase!=='recall'||this.pending)return;const question=recall[this.state.recall],result=answerCount(this.state,value);this.state=result.state;
    if(!result.correct){this.ask(`Not quite. Count the apples in the basket again.`);return;}
    this.pending=true;this.scene?.react('neighbor','wave',this.pose);
    this.panel.querySelectorAll<HTMLButtonElement>('[data-answer]').forEach(button=>{button.disabled=true;button.classList.toggle('unpack-right',Number(button.dataset.answer)===value);});
    this.panel.querySelector('.unpack-status')!.textContent=`Yes, ${numbers[question.count-1].word}!`;
    this.later(1000,()=>{this.pending=false;if(recalled(this.state)){this.setBasket(0);this.finish();}else{this.setBasket(recall[this.state.recall].count);this.ask();}});
  }
  private click=(event:MouseEvent)=>{
    const target=event.target instanceof Element?event.target:null,button=target?.closest<HTMLButtonElement>('button');
    if(button&&!button.disabled){
      const action=button.dataset.count;
      if(button.id==='arrival-restart'||action==='restart'){this.reset();return;}
      if(button.id==='arrival-reading'){this.reading=!this.reading;this.app.dataset.readingHelp=String(this.reading);button.setAttribute('aria-pressed',String(this.reading));return;}
      if(action==='begin'){this.study();this.panel.querySelector<HTMLElement>('#count-title')!.focus({preventScroll:true});return;}
      if(button.dataset.number){this.selected=Number(button.dataset.number);this.study();this.panel.querySelector<HTMLElement>(`[data-number="${this.selected}"]`)!.focus();return;}
      if(action==='start'&&canStartCounting(this.state)){this.task();this.panel.querySelector<HTMLElement>('#count-title')!.focus({preventScroll:true});return;}
      if(action==='review'&&!this.pending){this.study();return;}
      if(action==='add'||action==='remove'){this.change(action==='add');this.panel.querySelector<HTMLElement>(`[data-count="${action}"]`)?.focus();return;}
      if(action==='give'){this.give();return;}
      if(action==='look'){
        this.overlay.hidden=true;this.setPhase('look');this.panel.hidden=false;const {next,href}=this.nextStep();
        this.panel.innerHTML=`<header><span class="arrival-eyebrow">CHAPTER 03 · COMPLETE</span></header><h2 id="count-title" tabindex="-1">Thanks for helping.</h2><p>Drag to look around the courtyard. ${next.title} is next.</p><a class="arrival-primary" href="${href}">Start chapter ${String(next.chapter).padStart(2,'0')} ↗</a>`;this.layout();return;
      }
      if(button.dataset.answer){this.respond(Number(button.dataset.answer));return;}
      return;
    }
    if(this.scene&&target===this.scene.renderer.domElement&&performance.now()>this.ignoreClickUntil){const hit=this.scene.hit(event.clientX,event.clientY,'apple');if(hit){const i=hit.userData.apple as number;this.change(!this.inBasket[i],i);}}
  };
  private keyDown=(event:KeyboardEvent)=>{
    if(event.target instanceof HTMLElement&&event.target.closest('input,textarea,select,button'))return;
    if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();this.aim.yaw+=event.key==='ArrowLeft'?.25:-.25;}
  };
  private pointerDown=(event:PointerEvent)=>{if(event.button!==0||!this.scene||event.target!==this.scene.renderer.domElement)return;this.scene.renderer.domElement.setPointerCapture(event.pointerId);this.drag={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};};
  private pointerMove=(event:PointerEvent)=>{if(!this.drag||this.drag.id!==event.pointerId)return;const dx=event.clientX-this.drag.x,dy=event.clientY-this.drag.y;this.aim.yaw-=dx*.004;this.aim.pitch=Math.max(-.9,Math.min(.3,this.aim.pitch-dy*.003));this.pose.yaw=this.aim.yaw;this.pose.pitch=this.aim.pitch;this.drag.x=event.clientX;this.drag.y=event.clientY;if(Math.abs(dx)+Math.abs(dy)>2)this.drag.moved=true;};
  private pointerUp=()=>{if(this.drag?.moved)this.ignoreClickUntil=performance.now()+300;this.drag=undefined;};
  private layout=()=>{this.app.style.setProperty('--unpack-panel',`${this.panel.hidden?0:this.panel.getBoundingClientRect().height+24}px`);};
  private reset(){
    this.timers.forEach(timer=>clearTimeout(timer));this.timers.clear();this.pending=false;this.state=initialCounting();this.selected=1;
    if(this.scene){this.scene.reset();this.placeScene();}
    this.intro();
  }
  dispose(){this.timers.forEach(timer=>clearTimeout(timer));cancelAnimationFrame(this.raf);this.observer.disconnect();this.scene?.dispose();this.app.removeEventListener('click',this.click);this.app.removeEventListener('pointerdown',this.pointerDown);this.app.removeEventListener('pointermove',this.pointerMove);this.app.removeEventListener('pointerup',this.pointerUp);this.app.removeEventListener('pointercancel',this.pointerUp);window.removeEventListener('keydown',this.keyDown);}
}
export function startCounting(){const game=new CountingGame();if(import.meta.hot)import.meta.hot.dispose(()=>game.dispose());return game;}
