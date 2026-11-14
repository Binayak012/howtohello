import './moving-in.css';
import {ArrivalScene} from './arrival-scene';
import {arrivalStart,initialArrival,arrivalAction,arrivalSpots,arrivalPhrases,walkArrival,type ArrivalPose,type ArrivalState,type ArrivalTarget,type ArrivalAction} from './arrival-state';
import {completeLevel,levelHref,nextLevel} from './progression';
import {recordLanguageStarted} from './learning-history';

const suitcaseIcon='<svg viewBox="0 0 64 80" aria-hidden="true"><rect x="20" y="3" width="24" height="12" rx="4" fill="none" stroke="#645b4f" stroke-width="5"/><rect x="7" y="14" width="50" height="59" rx="10" fill="#648e9d"/><path d="M20 15v56M44 15v56" stroke="#a5b8bb" stroke-width="4"/><rect x="32" y="25" width="16" height="20" rx="3" fill="#efc65d"/><circle cx="40" cy="35" r="5" fill="#fff0ad"/><circle cx="17" cy="74" r="4" fill="#5c6056"/><circle cx="47" cy="74" r="4" fill="#5c6056"/></svg>';
const ticket=`<div class="arrival-ticket">${suitcaseIcon}<div><strong>Your suitcase</strong><small>Blue, with a yellow sun tag.<br>Match this picture when Biren shows you the bags.</small></div></div>`;
type Dialogue='host-greet'|'host-please'|'host-thanks'|'porter-teach'|'porter-red'|'porter-blue'|'neighbor-greet'|'neighbor-help'|'information'|'review';

class MovingInGame{
  private app=document.querySelector<HTMLDivElement>('#app')!;
  private state:ArrivalState=initialArrival();private pose:ArrivalPose=arrivalStart();
  private scene?:ArrivalScene;private keys=new Set<string>();private raf=0;private last=0;
  private phase:'intro'|'explore'|'talking'|'arriving'|'complete'='intro';private dialogue?:Dialogue;private pending=false;private misses=0;
  private keyReady=false;private bagReady=false;private reading=true;private doorOpen=false;private completed=false;
  private timers=new Set<ReturnType<typeof setTimeout>>();private drag?:{id:number;x:number;y:number;moved:boolean};private ignoreClicksUntil=0;
  private feedback:HTMLElement;private modal:HTMLElement;private talk:HTMLButtonElement;private journal:HTMLElement;private pocket:HTMLElement;
  constructor(){
    try{recordLanguageStarted(localStorage,'ne');}catch{/* Optional local history. */}
    this.app.className='arrival-app';this.app.dataset.readingHelp='true';
    const home=import.meta.env.BASE_URL==='/game/'?'/':'./';
    this.app.innerHTML=`<div id="arrival-world" class="arrival-world"></div><div class="arrival-vignette"></div><header class="arrival-header"><a class="arrival-brand" href="${home}" aria-label="Wayword home"><span>w</span>wayword<i>.</i></a><span class="arrival-chapter">CHAPTER 01 · YOUR FIRST HELLO</span><div class="arrival-header-actions"><button id="arrival-reading" class="arrival-quiet" aria-label="Show Latin-letter guides" aria-pressed="true">Aa</button><button id="arrival-restart" class="arrival-quiet">Start over ↺</button></div></header><aside class="arrival-journal"></aside><aside class="arrival-pocket"></aside><span class="arrival-crosshair" aria-hidden="true">+</span><button id="arrival-talk" class="arrival-talk" disabled>Walk up to Asha to begin</button><p class="arrival-status" role="status" aria-live="polite"></p><div class="arrival-controls" aria-label="Courtyard movement controls"><button data-arrival-move="turnleft" aria-label="Look left">↶</button><button data-arrival-move="forward" aria-label="Walk forward">↑</button><button data-arrival-move="turnright" aria-label="Look right">↷</button><button data-arrival-move="left" aria-label="Walk left">←</button><button data-arrival-move="backward" aria-label="Walk backward">↓</button><button data-arrival-move="right" aria-label="Walk right">→</button></div><p class="arrival-keys">WASD move · ← → turn · drag to look · E / Space interact</p><section class="arrival-dialogue" role="dialog" aria-modal="false" aria-labelledby="arrival-dialogue-title" hidden></section><section id="arrival-overlay" class="arrival-overlay" role="dialog" aria-modal="false" aria-labelledby="arrival-title"></section>`;
    this.feedback=this.app.querySelector('.arrival-status')!;this.modal=this.app.querySelector('.arrival-dialogue')!;this.talk=this.app.querySelector('#arrival-talk')!;this.journal=this.app.querySelector('.arrival-journal')!;this.pocket=this.app.querySelector('.arrival-pocket')!;
    try{this.scene=new ArrivalScene(this.app.querySelector('#arrival-world')!,target=>{if(performance.now()>this.ignoreClicksUntil)this.interact(target);});}
    catch{this.fallback();}
    this.app.addEventListener('click',this.click);this.app.addEventListener('pointerdown',this.pointerDown);this.app.addEventListener('pointermove',this.pointerMove);this.app.addEventListener('pointerup',this.pointerUp);this.app.addEventListener('pointercancel',this.pointerUp);this.app.addEventListener('lostpointercapture',this.pointerUp);
    window.addEventListener('resize',this.layoutConversation);window.addEventListener('keydown',this.keyDown);window.addEventListener('keyup',this.keyUp);window.addEventListener('blur',this.clearInput);document.addEventListener('visibilitychange',this.clearInput);
    this.intro();this.updateJournal();this.frame(performance.now());
  }
  private duration(ms:number){return this.scene?.reduced||matchMedia('(prefers-reduced-motion: reduce)').matches?0:ms;}
  private later(ms:number,callback:()=>void){const timer=setTimeout(()=>{this.timers.delete(timer);callback();},this.duration(ms));this.timers.add(timer);}
  private setState(action:ArrivalAction){this.state=arrivalAction(this.state,action);this.updateJournal();}
  private setPhase(phase:typeof this.phase){this.phase=phase;this.app.dataset.phase=phase;this.scene?.setConversation(phase==='talking');this.clearInput();}
  private say(text:string){this.feedback.textContent=text;}
  private focusWorld(){const world=this.scene?.renderer.domElement??this.talk;world.focus({preventScroll:true});}
  private phrase(key:keyof typeof arrivalPhrases){const phrase=arrivalPhrases[key];return `<div class="arrival-phrase"><strong lang="ne">${phrase.word}</strong><span class="arrival-roman" lang="ne-Latn">${phrase.roman}</span><small>${phrase.meaning}</small></div>`;}
  private intro(){
    this.setPhase('intro');const overlay=this.app.querySelector<HTMLElement>('#arrival-overlay')!;overlay.hidden=false;
    overlay.innerHTML=`<article class="arrival-card"><span class="arrival-spark" aria-hidden="true">✦</span><p class="arrival-eyebrow">CHAPTER 01 · MOVING IN</p><h1 id="arrival-title">Your first hello.</h1><p>A new home. A few unfamiliar faces.<br>Your first words can make them feel familiar.</p><p>Meet Asha, your host. Collect your key,<br>find your suitcase, and bring it home.</p>${ticket}<button class="arrival-primary" data-arrival-action="begin">Step into the courtyard ↗</button><p class="arrival-small">Learn by doing · Five useful phrases · No timer</p></article>`;
    overlay.querySelector<HTMLButtonElement>('button')!.focus();
  }
  private updateJournal(){
    const state=this.state;
    const task=(done:boolean,text:string)=>`<li class="${done?'done':''}"><b>${done?'✓':'○'}</b><span>${text}</span></li>`;
    const next=this.completed?`<a class="arrival-primary arrival-journal-next" href="${this.nextStep().href}">${this.nextStep().label}</a>`:'';
    this.journal.innerHTML=`<p class="arrival-eyebrow">MOVING IN · YOUR FIRST HELLO</p><h2>${state.bagHome?'You’re home.':'A little more at home.'}</h2><ul>${task(state.thanked,'Greet Asha and collect your key')}${task(state.bagHeld||state.bagHome,'Find your suitcase with Biren')}${task(state.bagHome,'Carry your suitcase through your door')}${task(state.parcelReturned,'Help Lila with her parcel · optional')}</ul><button class="arrival-quiet" data-arrival-action="review">My first words</button>${next}`;
    this.pocket.innerHTML=`<strong>YOUR THINGS</strong><p>${state.keyTaken?'✓ Your room key':'○ Your room key'}<br>${state.bagHeld?'✓ Your blue suitcase':state.bagHome?'✓ Suitcase delivered':'○ Your suitcase'}${state.parcelHeld?'<br>✓ Lila’s parcel':''}</p>${!state.bagHome?ticket:''}`;
  }
  private targets():ArrivalTarget[]{
    const targets:ArrivalTarget[]=['host','porter','neighbor','door'];
    if(this.state.requestedKey&&!this.state.keyTaken&&this.keyReady)targets.unshift('key');
    if(this.bagReady&&!this.state.bagHeld&&!this.state.bagHome)targets.unshift('suitcase');
    if(!this.state.parcelHeld&&!this.state.parcelReturned)targets.push('parcel');
    return targets;
  }
  private spot(target:ArrivalTarget){const actor=target==='host'||target==='porter'||target==='neighbor'?this.scene?.actors.get(target):undefined;return actor?{x:actor.root.position.x,z:actor.root.position.z}:arrivalSpots[target];}
  private near(target:ArrivalTarget){const spot=this.spot(target),dx=spot.x-this.pose.x,dz=spot.z-this.pose.z,distance=Math.hypot(dx,dz);return distance<2.5&&(distance<.25||(-Math.sin(this.pose.yaw)*dx-Math.cos(this.pose.yaw)*dz)/distance>.3);}
  private nearest(){return this.targets().filter(target=>this.near(target)).sort((a,b)=>Math.hypot(this.spot(a).x-this.pose.x,this.spot(a).z-this.pose.z)-Math.hypot(this.spot(b).x-this.pose.x,this.spot(b).z-this.pose.z))[0];}
  private interact(target?:ArrivalTarget){
    if(this.phase!=='explore'||this.pending)return;
    const chosen=target??this.nearest();if(!chosen||!this.targets().includes(chosen)||!this.near(chosen)){this.say('Walk a little closer and face the person or object.');return;}
    if(chosen==='host'){
      if(!this.state.greeted)this.showDialogue('host-greet');else if(!this.state.requestedKey)this.showDialogue('host-please');else if(!this.state.keyTaken)this.say('Your key is on the little table. Pick it up.');else if(!this.state.thanked)this.showDialogue('host-thanks');else{this.scene?.react('host','wave',this.pose);this.information('Asha · your host','You’re very welcome.','Biren has your suitcase. Look for the luggage cart.');}return;
    }
    if(chosen==='key'){
      this.setState('key');this.keyReady=false;this.scene?.takeKey();this.pending=true;this.say('You take your room key from the table.');this.later(700,()=>{this.pending=false;this.showDialogue('host-thanks');});return;
    }
    if(chosen==='porter'){
      if(!this.state.thanked){this.scene?.react('porter','point',this.pose);this.information('Biren · your porter','Welcome to the courtyard.','Meet Asha first—she has your room key. I’ll keep your bags here.');}
      else if(this.state.bagHeld||this.state.bagHome){this.scene?.react('porter','wave',this.pose);this.information('Biren · your porter','That’s the one.','Your new home is through the green door. Take your suitcase inside when you’re ready.');}
      else if(this.bagReady)this.say('Your blue suitcase is on the ground beside Biren. Pick it up.');
      else if(this.state.rejectedWrongCase)this.showDialogue('porter-blue');else this.showDialogue('porter-teach');return;
    }
    if(chosen==='suitcase'){
      this.setState('bag');this.bagReady=false;this.scene?.takeCase();this.say('You lift your own suitcase. Carry it to the green door.');return;
    }
    if(chosen==='parcel'){
      this.setState('parcel');this.scene?.takeParcel();this.say('You picked up a parcel. Lila is near the courtyard bench.');return;
    }
    if(chosen==='neighbor'){
      if(!this.state.greeted){this.information('Lila · your neighbor','Hello, new neighbor.','Asha is waiting to welcome you. Come say hello afterward.');return;}
      if(!this.state.neighborGreeted){this.showDialogue('neighbor-greet');return;}
      if(this.state.parcelHeld){this.giveParcel();return;}
      if(this.state.parcelReturned){this.scene?.react('neighbor','wave',this.pose);this.information('Lila · your neighbor','Lovely to meet you.','Thank you again for the parcel. See you around the neighborhood!');return;}
      this.showDialogue('neighbor-help');return;
    }
    if(chosen==='door'){
      if(!this.state.keyTaken){this.say('Meet Asha for your room key first.');return;}
      if(!this.doorOpen){this.doorOpen=true;this.scene?.unlock();this.pending=true;this.say('Your key turns. The door opens onto your new home.');this.later(800,()=>{this.pending=false;this.say(this.state.bagHeld?'The door is open. Bring your suitcase inside.':'Your door is open. Biren can help you find your suitcase.');});return;}
      if(!this.state.bagHeld){this.say(this.state.bagHome?'Your suitcase is already safely inside.':'Collect your suitcase from Biren, then bring it home.');return;}
      if(!this.state.thanked){this.showDialogue('host-thanks');return;}
      // Let the walk inside finish and hold on the room for a moment before the results appear.
      this.pending=true;this.setPhase('arriving');this.scene?.enter();this.say('You carry your suitcase over the threshold.');this.later(1500,()=>this.say('Welcome home.'));this.later(3100,()=>{this.pending=false;this.setState('home');this.finish();});
    }
  }
  private showDialogue(dialogue:Dialogue){this.dialogue=dialogue;this.setPhase('talking');this.modal.hidden=false;
    let person='YOUR FIRST WORDS',title='',body='';
    if(dialogue==='host-greet'){person='ASHA · YOUR HOST';title='A familiar first word.';body=`<p>Asha smiles and brings her hands together. “Welcome!”</p><p>Start with <strong>namaste</strong>, a respectful greeting.</p>${this.phrase('hello')}<button class="arrival-primary" data-arrival-action="hello">Say namaste ↗</button>`;this.scene?.react('host','hello',this.pose);}
    if(dialogue==='host-please'){person='ASHA · YOUR HOST';title='Your key, please.';body=`<p>“I have your room key right here.”</p><p><strong>Kripaya</strong> means “please.” Use it at the start of this polite request.</p>${this.phrase('please')}<p class="arrival-context-note"><span lang="ne">कृपया साँचो दिनुहोस्।</span><br><span class="arrival-roman">kripaya saancho dinuhos</span><br>Please give me the key.</p><button class="arrival-primary" data-arrival-action="please">Ask for the key politely ↗</button>`;}
    if(dialogue==='host-thanks'){person='ASHA · YOUR HOST';title='A little word of thanks.';body=`<p>The key is yours. Thank Asha for helping you settle in.</p>${this.phrase('thanks')}<button class="arrival-primary" data-arrival-action="thanks">Say thank you ↗</button>`;}
    if(dialogue==='porter-teach'){person='BIREN · YOUR PORTER';title='Which suitcase is yours?';body=`<p>“I’ve got two cases. Let’s find yours.”</p>${ticket}<p>For the question <strong>“Is this your suitcase?”</strong>, answer with:</p><div class="arrival-answers"><div class="arrival-phrase"><strong lang="ne">हो</strong><span class="arrival-roman">ho</span><small>Yes, it is</small></div><div class="arrival-phrase"><strong lang="ne">होइन</strong><span class="arrival-roman">hoina</span><small>No, it isn’t</small></div></div><p class="arrival-context-note">These are answers to an identification question. Nepali uses different forms for some other kinds of “yes/no” questions.</p><button class="arrival-primary" data-arrival-action="show-red">Let’s find my suitcase ↗</button>`;}
    if(dialogue==='porter-red'||dialogue==='porter-blue'){person='BIREN · YOUR PORTER';title='“Is this your suitcase?”';body=`<p>${dialogue==='porter-red'?'Biren holds up a red case with a plain tag.':'Biren now shows you the blue case with the yellow sun tag.'}</p>${ticket}<div class="arrival-answers"><button data-arrival-action="answer-yes"><strong lang="ne">हो</strong><span class="arrival-roman">ho</span><small>Yes, it is</small></button><button data-arrival-action="answer-no"><strong lang="ne">होइन</strong><span class="arrival-roman">hoina</span><small>No, it isn’t</small></button></div>`;}
    if(dialogue==='neighbor-greet'){person='LILA · YOUR NEIGHBOR';title='Another familiar face.';body=`<p>Lila notices you and waves. Use the greeting you tried with Asha.</p><div class="arrival-answers"><button data-arrival-action="neighbor-hello"><strong lang="ne">नमस्ते</strong><span class="arrival-roman">namaste</span><small>Hello</small></button><button data-arrival-action="neighbor-wrong"><strong lang="ne">धन्यवाद</strong><span class="arrival-roman">dhanyawaad</span><small>Thank you</small></button></div>`;}
    if(dialogue==='neighbor-help'){person='LILA · YOUR NEIGHBOR';title='A small helping hand.';body=`<p>“Namaste! My parcel slipped beside the bench. Could you bring it over?”</p><p>Pick up the small wrapped parcel, then come back to Lila. You can help before or after settling into your room.</p><button class="arrival-primary" data-arrival-action="close">I’ll take a look ↗</button>`;this.scene?.react('neighbor','point',this.pose);}
    if(dialogue==='review'){title='The words you’ve used.';const learned=(Object.keys(arrivalPhrases) as (keyof typeof arrivalPhrases)[]).filter(key=>key==='hello'?this.state.greeted:key==='please'?this.state.requestedKey:key==='thanks'?this.state.thanked:key==='no'?this.state.rejectedWrongCase:this.state.acceptedOwnCase);body=learned.length?`<div class="arrival-review-grid">${learned.map(key=>this.phrase(key)).join('')}</div><p>Meet people in the courtyard to use these words again.</p>`:'<p>Asha will help you begin. Your words will appear here as you use them.</p>';body+='<button class="arrival-primary" data-arrival-action="close">Back to the courtyard ↗</button>';}
    this.modal.innerHTML=`<header><span class="arrival-eyebrow">${person}</span><button class="arrival-quiet" data-arrival-action="close">Back to courtyard</button></header><h2 id="arrival-dialogue-title" tabindex="-1">${title}</h2>${body}<p role="status" aria-live="polite"></p>`;this.layoutConversation();this.modal.querySelector<HTMLElement>('#arrival-dialogue-title')!.focus({preventScroll:true});
  }
  private information(person:string,title:string,text:string){this.dialogue='information';this.setPhase('talking');this.modal.hidden=false;this.modal.innerHTML=`<header><span class="arrival-eyebrow">${person}</span></header><h2 id="arrival-dialogue-title" tabindex="-1">${title}</h2><p>${text}</p><button class="arrival-primary" data-arrival-action="close">Back to the courtyard ↗</button>`;this.layoutConversation();this.modal.querySelector<HTMLElement>('#arrival-dialogue-title')!.focus({preventScroll:true});}
  private layoutConversation=()=>{if(this.phase==='talking')this.app.style.setProperty('--arrival-conversation-height',`${Math.max(140,innerHeight-this.modal.getBoundingClientRect().height-28)}px`);};
  private closeDialogue(){this.dialogue=undefined;this.modal.hidden=true;this.modal.replaceChildren();this.setPhase('explore');this.focusWorld();}
  private giveParcel(){this.setState('return-parcel');this.scene?.returnParcel(this.pose);this.closeDialogue();this.pending=true;this.say('Lila reaches for her parcel.');this.later(900,()=>{this.pending=false;this.information('LILA · YOUR NEIGHBOR','“धन्यवाद!”','“Thank you! That was kind of you.” You recognize the phrase you used with Asha.');});}
  /** Where the player goes after this chapter: straight into chapter 2 once it is built, otherwise the journey map. */
  private nextStep(){
    const next=nextLevel('moving-in')!,website=import.meta.env.BASE_URL==='/game/';
    if(next.implemented)return{ready:true,next,href:levelHref(next,website),label:`Start chapter ${String(next.chapter).padStart(2,'0')} ↗`};
    return{ready:false,next,href:website?'/map/index.html':`?level=${next.route}`,label:'Back to your journey ↗'};
  }
  private finish(){
    if(!this.state.bagHome||this.completed)return;this.completed=true;this.setPhase('complete');this.updateJournal();let saved=false;
    try{saved=completeLevel(localStorage,'moving-in');}catch{/* Completion is still visible without storage. */}
    const step=this.nextStep(),chapter=String(step.next.chapter).padStart(2,'0');
    const words=(Object.keys(arrivalPhrases) as (keyof typeof arrivalPhrases)[]).map(key=>`<li><strong lang="ne">${arrivalPhrases[key].word}</strong><span class="arrival-roman" lang="ne-Latn">${arrivalPhrases[key].roman}</span></li>`).join('');
    const upNext=step.ready?`<strong>${step.next.title}</strong><span>${step.next.subtitle}</span>`:`<strong>Chapter ${chapter} is on its way</strong><span>Your progress is saved. You’ll pick up right here when it opens.</span>`;
    const overlay=this.app.querySelector<HTMLElement>('#arrival-overlay')!;overlay.hidden=false;
    overlay.innerHTML=`<article class="arrival-card arrival-complete"><span class="arrival-spark" aria-hidden="true">✓</span><p class="arrival-eyebrow">CHAPTER 01 · COMPLETE</p><h2 id="arrival-title">Welcome home.</h2><p>You greeted Asha, asked politely, said thanks, and found your own suitcase.</p><ul class="arrival-words" aria-label="Five phrases you used">${words}</ul><p class="arrival-stats"><strong>Five phrases used · ${this.misses} ${this.misses===1?'retry':'retries'}</strong> · ${this.state.parcelReturned?'You also helped Lila.':'Lila’s parcel is optional practice.'}</p><div class="arrival-next"><small>UP NEXT · CHAPTER ${chapter}</small>${upNext}</div><a class="arrival-primary" href="${step.href}">${step.label}</a><div class="arrival-card-actions"><button class="arrival-quiet" data-arrival-action="explore">Keep exploring</button><button class="arrival-quiet" data-arrival-action="restart">Replay chapter</button></div><p class="arrival-small">${saved?'Progress saved on this browser.':'Progress saving is unavailable. You can still replay this lesson.'}</p></article>`;
    overlay.querySelector<HTMLAnchorElement>('a')!.focus({preventScroll:true});
  }
  private click=(event:MouseEvent)=>{
    const button=event.target instanceof Element?event.target.closest<HTMLButtonElement>('button'):null;if(!button||button.disabled)return;
    const action=button.dataset.arrivalAction;
    if(button.id==='arrival-restart'||action==='restart'){this.reset();return;}
    if(button.id==='arrival-reading'){this.reading=!this.reading;this.app.dataset.readingHelp=String(this.reading);button.setAttribute('aria-pressed',String(this.reading));this.layoutConversation();return;}
    if(action==='begin'){this.app.querySelector<HTMLElement>('#arrival-overlay')!.hidden=true;this.setPhase('explore');this.say('Walk up to Asha. Press E or tap the interaction button to say hello.');this.focusWorld();return;}
    if(action==='explore'&&this.completed){this.app.querySelector<HTMLElement>('#arrival-overlay')!.hidden=true;this.pose={x:0,z:-3.2,yaw:Math.PI,pitch:0};this.scene?.returnToCourt(this.pose);this.setPhase('explore');this.say('Welcome home. You can still visit your neighbors.');this.focusWorld();return;}
    if(action==='close'&&!this.pending){this.closeDialogue();return;}
    if(action==='review'&&!this.pending&&this.phase==='explore'){this.showDialogue('review');return;}
    if(button===this.talk){this.interact();return;}
    if(this.pending)return;
    const move=button.dataset.arrivalMove;
    if(move&&event.detail===0&&this.phase==='explore'){if(move==='turnleft'||move==='turnright')this.pose.yaw+=(move==='turnleft'?1:-1)*.4;else{const f=move==='forward'?1:move==='backward'?-1:0,s=move==='right'?1:move==='left'?-1:0;this.pose=walkArrival(this.pose,(-Math.sin(this.pose.yaw)*f+Math.cos(this.pose.yaw)*s)*.65,(-Math.cos(this.pose.yaw)*f-Math.sin(this.pose.yaw)*s)*.65,this.scene?.people());}this.scene?.setPose(this.pose);return;}
    if(action==='hello'&&this.dialogue==='host-greet'){this.setState('greet');this.scene?.react('host','hello',this.pose);this.showDialogue('host-please');}
    if(action==='please'&&this.dialogue==='host-please'){this.setState('please');this.scene?.offerKey(this.pose);this.closeDialogue();this.pending=true;this.say('Asha takes the key from her hook and offers it on the table.');this.later(900,()=>{this.keyReady=true;this.pending=false;this.say('Your key is on the table. Pick it up.');});}
    if(action==='thanks'&&this.dialogue==='host-thanks'){this.setState('thanks');this.scene?.react('host','nod',this.pose);this.closeDialogue();this.say('“You’re very welcome.” Biren is waiting beside the luggage cart.');}
    if(action==='show-red'&&this.dialogue==='porter-teach'){this.scene?.showCase(false,this.pose);this.closeDialogue();this.pending=true;this.say('Biren lifts the first suitcase from the cart.');this.later(900,()=>{this.pending=false;this.showDialogue('porter-red');});}
    if((action==='answer-yes'||action==='answer-no')&&(this.dialogue==='porter-red'||this.dialogue==='porter-blue')){
      const correct=this.dialogue==='porter-red'?action==='answer-no':action==='answer-yes';
      if(!correct){this.misses++;this.scene?.react('porter','shake',this.pose);this.modal.querySelector('[role=status]')!.textContent='Compare the luggage ticket. Your case is blue with a yellow sun tag. Try again.';return;}
      if(this.dialogue==='porter-red'){this.setState('no');this.scene?.showCase(true,this.pose);this.closeDialogue();this.pending=true;this.say('“No, it isn’t. Let’s try the other one.” Biren swaps the cases.');this.later(900,()=>{this.pending=false;this.showDialogue('porter-blue');});}
      else{this.setState('yes');this.scene?.bringCase(this.pose);this.closeDialogue();this.pending=true;this.say('“Yes, that’s yours!” Biren carries your case off the cart.');this.later(1850,()=>{this.scene?.dropCase();this.later(350,()=>{this.pending=false;this.bagReady=true;this.say('Biren has set your suitcase down. Pick it up and bring it home.');});});}
    }
    if(action==='neighbor-wrong'&&this.dialogue==='neighbor-greet'){this.misses++;this.modal.querySelector('[role=status]')!.textContent='That means thank you. Begin with नमस्ते (namaste), like you did with Asha.';}
    if(action==='neighbor-hello'&&this.dialogue==='neighbor-greet'){this.setState('neighbor-greet');this.scene?.react('neighbor','hello',this.pose);if(this.state.parcelHeld)this.giveParcel();else this.showDialogue('neighbor-help');}
  };
  private clearInput=()=>{this.keys.clear();this.drag=undefined;};
  private keyDown=(event:KeyboardEvent)=>{if(event.key==='Escape'&&this.dialogue&&!this.pending){event.preventDefault();this.closeDialogue();return;}if(this.phase!=='explore'||this.pending||event.target instanceof HTMLElement&&event.target.closest('input,textarea,select'))return;const key=event.key.toLowerCase();if(event.target instanceof HTMLElement&&event.target.closest('button')&&(key===' '||key==='enter'))return;if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){event.preventDefault();this.keys.add(key);}if((key==='e'||key===' ')&&!event.repeat){event.preventDefault();this.interact();}};
  private keyUp=(event:KeyboardEvent)=>this.keys.delete(event.key.toLowerCase());
  private pointerDown=(event:PointerEvent)=>{if(this.phase!=='explore'||this.pending||event.button!==0)return;const target=event.target instanceof Element?event.target:null,button=target?.closest<HTMLButtonElement>('[data-arrival-move]');if(button){event.preventDefault();button.setPointerCapture(event.pointerId);this.keys.add(button.dataset.arrivalMove!);}else if(target===this.scene?.renderer.domElement){this.scene.renderer.domElement.setPointerCapture(event.pointerId);this.drag={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};}};
  private pointerMove=(event:PointerEvent)=>{if(!this.drag||this.drag.id!==event.pointerId||this.phase!=='explore'||this.pending)return;const dx=event.clientX-this.drag.x,dy=event.clientY-this.drag.y;this.pose.yaw-=dx*.004;this.pose.pitch=Math.max(-1.05,Math.min(.6,this.pose.pitch-dy*.003));this.drag.x=event.clientX;this.drag.y=event.clientY;if(Math.abs(dx)+Math.abs(dy)>2)this.drag.moved=true;this.scene?.setPose(this.pose);};
  private pointerUp=(event:PointerEvent)=>{const button=event.target instanceof Element?event.target.closest<HTMLButtonElement>('[data-arrival-move]'):null;if(button){this.keys.delete(button.dataset.arrivalMove!);this.focusWorld();}if(this.drag?.moved)this.ignoreClicksUntil=performance.now()+300;this.drag=undefined;};
  private frame=(now:number)=>{this.raf=requestAnimationFrame(this.frame);const dt=Math.min(.05,this.last?(now-this.last)/1000:0);this.last=now;
    this.app.dataset.arrivalX=this.pose.x.toFixed(3);this.app.dataset.arrivalZ=this.pose.z.toFixed(3);this.app.dataset.arrivalYaw=this.pose.yaw.toFixed(3);
    if(this.phase!=='explore'||this.pending){this.talk.disabled=true;return;}
    const held=(...keys:string[])=>keys.some(key=>this.keys.has(key)),f=Number(held('w','arrowup','forward'))-Number(held('s','arrowdown','backward')),s=Number(held('d','right'))-Number(held('a','left')),turn=Number(held('arrowleft','turnleft'))-Number(held('arrowright','turnright'));
    if(f||s||turn){this.pose.yaw+=turn*1.75*dt;const n=Math.max(1,Math.hypot(f,s));this.pose=walkArrival(this.pose,(-Math.sin(this.pose.yaw)*f+Math.cos(this.pose.yaw)*s)*2.5*dt/n,(-Math.cos(this.pose.yaw)*f-Math.sin(this.pose.yaw)*s)*2.5*dt/n,this.scene?.people());this.scene?.setPose(this.pose);}
    const target=this.nearest();this.talk.disabled=!target;
    const labels:Record<ArrivalTarget,string>={host:'Talk to Asha',porter:'Talk to Biren',neighbor:'Talk to Lila',key:'Pick up your key',suitcase:'Pick up your suitcase',parcel:'Pick up the parcel',door:!this.doorOpen?'Unlock your front door':this.state.bagHeld?'Carry your suitcase inside':'Your front door'};
    this.talk.textContent=target?`${labels[target]} · E`:'Walk closer to meet someone';
    const dot=this.app.querySelector<SVGCircleElement>('#arrival-map-player');if(dot){dot.setAttribute('cx',String((this.pose.x+7)*20));dot.setAttribute('cy',String((this.pose.z+5)*20));}
  };
  private fallback(){this.app.querySelector('#arrival-world')!.innerHTML=`<div class="arrival-fallback"><svg viewBox="0 0 280 240" role="img" aria-label="Courtyard map. Asha near the north doorway, Biren by the luggage cart on the right, Lila on the left."><rect width="280" height="240" rx="10" fill="#ead8ba"/><rect x="123" y="0" width="35" height="15" rx="4" fill="#6d937c"/><text x="140" y="28" text-anchor="middle">YOUR HOME</text><circle cx="140" cy="106" r="17" fill="#82aaa3"/>${Object.entries(arrivalSpots).filter(([id])=>['host','porter','neighbor','parcel'].includes(id)).map(([id,spot])=>`<circle cx="${(spot.x+7)*20}" cy="${(spot.z+5)*20}" r="6" fill="#80769b"/><text x="${(spot.x+7)*20}" y="${(spot.z+5)*20-10}" text-anchor="middle">${id==='host'?'Asha':id==='porter'?'Biren':id==='neighbor'?'Lila':'Parcel'}</text>`).join('')}<circle id="arrival-map-player" cx="140" cy="220" r="6" fill="#d78c4e"/></svg></div>`;}
  private reset(){this.timers.forEach(timer=>clearTimeout(timer));this.timers.clear();this.clearInput();this.pending=false;this.completed=false;this.keyReady=false;this.bagReady=false;this.doorOpen=false;this.state=initialArrival();this.pose=arrivalStart();this.misses=0;this.dialogue=undefined;this.scene?.reset();this.modal.hidden=true;this.modal.replaceChildren();this.updateJournal();this.intro();this.say('A new neighborhood. Your first hello.');}
  dispose(){this.timers.forEach(timer=>clearTimeout(timer));cancelAnimationFrame(this.raf);this.scene?.dispose();this.app.removeEventListener('click',this.click);this.app.removeEventListener('pointerdown',this.pointerDown);this.app.removeEventListener('pointermove',this.pointerMove);this.app.removeEventListener('pointerup',this.pointerUp);this.app.removeEventListener('pointercancel',this.pointerUp);this.app.removeEventListener('lostpointercapture',this.pointerUp);window.removeEventListener('resize',this.layoutConversation);window.removeEventListener('keydown',this.keyDown);window.removeEventListener('keyup',this.keyUp);window.removeEventListener('blur',this.clearInput);document.removeEventListener('visibilitychange',this.clearInput);}
}
export function startMovingIn(){const game=new MovingInGame();if(import.meta.hot)import.meta.hot.dispose(()=>game.dispose());return game;}
