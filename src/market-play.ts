import type { ShopScene } from './scene';
import { numbers } from './numbers';
import { pack } from './pack';
import { completeLevel } from './progression';
import { marketActivities, errandWords, errandNames, pickColors, marketStart, nearbyActivity, walkMarket, readMarketVisits, marketVisitsKey, lostToy, type MarketTask, type MarketActivity, type MarketPose, type ActivityId } from './market-world';
import './market-words.css';

/** A picture for each errand, so the street needs no English labels. */
const icons: Record<ActivityId, string> = { fruit: '🍎', bread: '🥖', flowers: '💐', family: '🧸' };
/** Who you are greeting, in plain words. */
const roles: Record<ActivityId, string> = { fruit: 'Maya the fruit seller', bread: 'Arun the baker', flowers: 'Tara the flower seller', family: 'the family' };
/** Words for things the learner picks by mistake, shown in their own color. */
const wrongColor = { fruit: { word: 'हरियो', roman: 'hariyo', english: 'green' }, flowers: { word: 'सेतो', roman: 'seto', english: 'white' } } as const;
const sr = (text: string) => `<span class="sr-only">${text}</span>`;
/** A Nepali word with its Latin-letter guide and an English gloss that only shows when the learner peeks. */
function word(text: string, roman: string, english: string, attrs = '') {
  return `<span class="live-word" ${attrs}><strong lang="ne">${text}</strong><span class="latin-guide">${roman}</span><small class="gloss">${english}</small></span>`;
}
const dots = (count: number, of = count) => Array.from({ length: Math.max(count, of) }, (_, i) => `<i class="${i < count ? 'on' : ''}"></i>`).join('');

/**
 * Street movement and conversations are independent of the shop's tile lesson.
 * The meaning of each word comes from what happens when you act on it: words light up,
 * paint themselves, count along with you, or move you. English appears only when you peek.
 */
export class MarketExplorer {
  pose: MarketPose = marketStart();
  private keys = new Set<string>();
  private paused = false;
  private raf = 0;
  private last = 0;
  private drag?: { id:number; x:number; y:number; moved:boolean };
  private ignoreClickUntil = 0;
  private conversation?: { activity:MarketActivity; stage:'greet'|'where'|'brief'|'thanks'|'done'; mismatch?:number };
  private tasks=new Map<ActivityId,MarketTask>();
  private activeTask?:ActivityId;
  private greeted=new Set<ActivityId>();
  private wallet=5;
  private taskBoard:HTMLElement;
  private completed = new Set<ActivityId>();
  private tracked: ActivityId = 'fruit';
  private near?: MarketActivity;
  private canvas?: HTMLCanvasElement;
  private prompt: HTMLButtonElement;
  private dialogue: HTMLElement;
  private waypoint: HTMLElement;
  private status: HTMLElement;
  private lastProgress=performance.now();
  private nudged=false;
  private peekTimer?: ReturnType<typeof setTimeout>;
  private colorMet=new Set<ActivityId>();
  private wayKey='';
  private hintBox!:HTMLElement;
  private hintTimer?: ReturnType<typeof setTimeout>;
  private instructionKey='';
  private toastTimer?: ReturnType<typeof setTimeout>;
  /** Teddy errand: 0 walk to the bakery, 1 look behind the planter, 2 pick it up, 3 bring it back. */
  private familyStep=0;

  constructor(private host: HTMLElement, private scene: ShopScene | undefined, private review:()=>void) {
    try {this.completed=new Set(readMarketVisits(localStorage));}catch{/* Exploration works without storage. */}
    host.hidden=false;host.dataset.mode='roam';host.dataset.peek='false';
    host.innerHTML=`<aside class="market-journal word-strip" aria-label="What to do now"><p class="eyebrow" id="market-step-count"></p><p class="market-instruction" id="market-instruction" aria-live="polite"></p><p id="market-progress" class="sr-only"></p><div class="errand-chips">${marketActivities.map(activity=>`<button data-track="${activity.id}" aria-pressed="false" aria-label="${errandNames[activity.id]}: ${activity.name}${activity.required?'':' (optional)'}" ${activity.required?'':'data-optional="true"'}><span class="chip-icon" aria-hidden="true">${icons[activity.id]}</span><span class="chip-word" lang="ne">${errandWords[activity.id].replace(' teddy','')}</span><i class="chip-done" aria-hidden="true">✓</i></button>`).join('')}</div></aside><aside class="market-help" aria-label="Help"><div class="market-hint" role="status" hidden><p id="market-hint-text"></p><button class="hint-close" data-market-action="hint-close" aria-label="Close hint">✕</button></div><div class="strip-tools"><button class="help-main" data-market-action="peek" aria-label="Hint"><span aria-hidden="true">💡</span> Hint</button><button data-market-action="face-target" aria-label="Turn me toward it" title="Turn toward your goal">🧭</button><button class="strip-review" data-market-action="review" aria-label="Review numbers 1–5" title="Review numbers">१–५</button></div></aside><div class="market-waypoint" aria-hidden="true"><span class="wp-icon"></span><span class="cue-arrow"><i>↑</i></span><span class="wp-word"><strong lang="ne"></strong><span class="latin-guide"></span><small class="gloss"></small></span></div><span class="market-crosshair" aria-hidden="true">+</span><button id="market-talk" class="market-talk" disabled aria-label="Approach a neighbor to talk"></button><p class="market-roam-status" role="status" aria-live="polite"></p><div class="word-toast" role="status" aria-live="polite" hidden></div><div class="market-touch" aria-label="Market movement controls"><button data-move="turnleft" aria-label="Look left">↶</button><button data-move="forward" aria-label="Walk forward">↑</button><button data-move="turnright" aria-label="Look right">↷</button><button data-move="left" aria-label="Walk left">←</button><button data-move="backward" aria-label="Walk backward">↓</button><button data-move="right" aria-label="Walk right">→</button></div><p class="market-keys"><kbd>W A S D</kbd> walk · <kbd>← →</kbd> turn · <kbd>E</kbd> talk</p><section class="market-dialogue word-bubble" role="dialog" aria-modal="false" aria-labelledby="market-dialogue-title" hidden></section>`;
    this.prompt=host.querySelector('#market-talk')!;this.dialogue=host.querySelector('.market-dialogue')!;
    this.waypoint=host.querySelector('.market-waypoint')!;this.status=host.querySelector('.market-roam-status')!;this.hintBox=host.querySelector('.market-hint')!;
    this.taskBoard=document.createElement('aside');this.taskBoard.className='market-task word-tray';this.taskBoard.hidden=true;host.append(this.taskBoard);
    try{const saved=Number(localStorage.getItem('wayword.wallet.ne.v1')??5);if(Number.isInteger(saved)&&saved>=0&&saved<=5)this.wallet=saved;}catch{/* Optional wallet persistence. */}
    this.canvas=scene?.renderer.domElement;
    this.canvas?.setAttribute('tabindex','0');
    this.scene?.setMarketPose(this.pose);
    if(scene) {scene.onMarketInteract=id=>{if(performance.now()>this.ignoreClickUntil)this.interact(id);};scene.onMarketItem=id=>{if(performance.now()>this.ignoreClickUntil)this.pickWorldItem(id);};this.completed.forEach(id=>scene.market.markActivity(id,marketActivities.find(activity=>activity.id===id)!.count));}
    host.addEventListener('click',this.click);
    host.addEventListener('pointerdown',this.touchDown);host.addEventListener('pointerup',this.touchUp);host.addEventListener('pointercancel',this.touchUp);host.addEventListener('lostpointercapture',this.touchUp);
    this.canvas?.addEventListener('pointerdown',this.lookDown);this.canvas?.addEventListener('pointermove',this.lookMove);this.canvas?.addEventListener('pointerup',this.lookUp);this.canvas?.addEventListener('pointercancel',this.lookUp);
    window.addEventListener('keydown',this.keyDown);window.addEventListener('keyup',this.keyUp);window.addEventListener('blur',this.clearKeys);document.addEventListener('visibilitychange',this.clearKeys);
    this.tracked=this.nextErrand()??'fruit';this.markTracked();
    this.updateProgress();this.frame(performance.now());this.focusWorld();
  }
  private focusWorld(){if(this.canvas)this.canvas.focus({preventScroll:true});else this.prompt.focus({preventScroll:true});}
  setPaused(paused:boolean){this.paused=paused;this.clearKeys();this.host.hidden=paused;if(!paused)this.focusWorld();}
  private clearKeys=()=>{this.keys.clear();this.drag=undefined;};
  private keyDown=(event:KeyboardEvent)=>{
    if(this.paused)return;
    if(event.key==='Escape'&&this.conversation){event.preventDefault();this.closeConversation();return;}
    if(this.conversation || event.target instanceof HTMLElement && event.target.closest('input,textarea,select,summary'))return;
    const key=event.key.toLowerCase();
    if(event.target instanceof HTMLElement&&event.target.closest('button')&&(key===' '||key==='enter'))return;
    if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){event.preventDefault();this.keys.add(key);this.host.dataset.moved='true';}
    if((key==='e'||key===' ')&&!event.repeat){event.preventDefault();this.interact();}
    if(key==='h'&&!event.repeat)this.showHint();
  };
  private keyUp=(event:KeyboardEvent)=>{this.keys.delete(event.key.toLowerCase());};
  private touchDown=(event:PointerEvent)=>{
    const button=event.target instanceof Element?event.target.closest<HTMLButtonElement>('[data-move]'):null;
    if(!button||this.paused||this.conversation)return;
    event.preventDefault();button.setPointerCapture(event.pointerId);this.keys.add(button.dataset.move!);this.host.dataset.moved='true';
  };
  private touchUp=(event:PointerEvent)=>{const button=event.target instanceof Element?event.target.closest<HTMLButtonElement>('[data-move]'):null;if(button){this.keys.delete(button.dataset.move!);this.focusWorld();}};
  private lookDown=(event:PointerEvent)=>{if(this.paused||this.conversation||event.button!==0)return;this.canvas?.setPointerCapture(event.pointerId);this.drag={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};};
  private lookMove=(event:PointerEvent)=>{
    if(!this.drag||this.drag.id!==event.pointerId||this.paused)return;
    const dx=event.clientX-this.drag.x,dy=event.clientY-this.drag.y;
    this.pose.yaw-=dx*.004;this.pose.pitch=Math.max(-1.1,Math.min(.6,this.pose.pitch-dy*.003));
    this.drag.x=event.clientX;this.drag.y=event.clientY;if(Math.abs(dx)+Math.abs(dy)>2)this.drag.moved=true;
    this.scene?.setMarketPose(this.pose);
  };
  private lookUp=()=>{if(this.drag?.moved)this.ignoreClickUntil=performance.now()+300;this.drag=undefined;};
  private frame=(now:number)=>{
    this.raf=requestAnimationFrame(this.frame);
    const dt=Math.min(.05,this.last?(now-this.last)/1000:0);this.last=now;
    if(this.paused||this.conversation)return;
    const down=(...keys:string[])=>keys.some(key=>this.keys.has(key));
    const forward=Number(down('w','arrowup','forward'))-Number(down('s','arrowdown','backward'));
    const strafe=Number(down('d','right'))-Number(down('a','left'));
    const turn=Number(down('arrowleft','turnleft'))-Number(down('arrowright','turnright'));
    if(forward||strafe||turn){
      this.pose.yaw+=turn*1.75*dt;
      const norm=Math.max(1,Math.hypot(forward,strafe));
      const dx=(-Math.sin(this.pose.yaw)*forward+Math.cos(this.pose.yaw)*strafe)*2.8*dt/norm;
      const dz=(-Math.cos(this.pose.yaw)*forward-Math.sin(this.pose.yaw)*strafe)*2.8*dt/norm;
      this.pose=walkMarket(this.pose,dx,dz,this.scene?.market.peopleObstacles());this.scene?.setMarketPose(this.pose);
    }
    this.host.dataset.marketX=this.pose.x.toFixed(3);this.host.dataset.marketZ=this.pose.z.toFixed(3);this.host.dataset.marketYaw=this.pose.yaw.toFixed(3);
    this.near=nearbyActivity(this.pose);
    const canPickToy=this.toyNearby()&&!this.completed.has('family')&&!this.tasks.get('family')?.carryingToy;
    const label=canPickToy?'Pick up the red teddy':this.near?`Talk to ${errandNames[this.near.id]}`:'Approach a neighbor to talk';
    if(this.prompt.getAttribute('aria-label')!==label){
      this.prompt.setAttribute('aria-label',label);
      this.prompt.innerHTML=canPickToy?'<kbd>E</kbd> ✋🧸':this.near?`<kbd>E</kbd> <span lang="ne">नमस्ते</span> 🙏`:'';
    }
    this.prompt.disabled=!this.near&&!canPickToy;
    // The direction word sits on the side of the screen where the goal is, with an arrow pointing at it.
    const target=this.target(),way=this.way(target);
    if(way.key!==this.wayKey||this.waypoint.dataset.icon!==target.icon){
      this.wayKey=way.key;this.waypoint.dataset.side=way.side;this.waypoint.dataset.icon=target.icon;
      this.waypoint.querySelector('.wp-icon')!.textContent=target.icon;
      this.waypoint.querySelector('strong')!.textContent=way.words.map(item=>pack.directions[item].text).join(' · ');
      this.waypoint.querySelector('.latin-guide')!.textContent=way.words.map(item=>pack.directions[item].roman).join(' · ');
      this.waypoint.querySelector('.gloss')!.textContent=way.words.map(item=>pack.where[item]).join(', ');
    }
    this.waypoint.querySelector<HTMLElement>('.cue-arrow i')!.style.setProperty('--turn',`${(-way.angle*180/Math.PI).toFixed(1)}deg`);
    this.scene?.setBeacon({x:target.x,y:target.beaconY,z:target.z},target.beaconY<2?1.3:2.8);
    this.renderInstruction();this.updateFamilyStep();
    // When nothing has moved forward for a while, the hint appears by itself.
    const stuck=now-this.lastProgress>25000;
    if(stuck!==this.nudged){this.nudged=stuck;this.host.dataset.stuck=String(stuck);if(stuck)this.showHint();}
    this.taskBoard.querySelectorAll<HTMLButtonElement>('[data-task-near]').forEach(button=>button.disabled=!this.atTask()||button.dataset.fixedDisabled==='true');
    const pickToy=this.taskBoard.querySelector<HTMLButtonElement>('[data-market-action="toy-pick"]');if(pickToy)pickToy.disabled=!this.toyNearby();
  };
  private click=(event:MouseEvent)=>{
    const button=event.target instanceof Element?event.target.closest<HTMLButtonElement>('button'):null;if(!button||button.disabled)return;
    if(button.dataset.move&&event.detail===0&&!this.conversation){
      const move=button.dataset.move;
      if(move==='turnleft'||move==='turnright')this.pose.yaw+=(move==='turnleft'?1:-1)*.4;
      else{const forward=move==='forward'?1:move==='backward'?-1:0,strafe=move==='right'?1:move==='left'?-1:0;this.pose=walkMarket(this.pose,(-Math.sin(this.pose.yaw)*forward+Math.cos(this.pose.yaw)*strafe)*.65,(-Math.cos(this.pose.yaw)*forward-Math.sin(this.pose.yaw)*strafe)*.65,this.scene?.market.peopleObstacles());}
      this.scene?.setMarketPose(this.pose);return;
    }
    if(button.dataset.track){this.tracked=button.dataset.track as ActivityId;this.markTracked();this.progressed();this.focusWorld();return;}
    const action=button.dataset.marketAction;
    if(action==='review'){this.review();return;}
    if(action==='peek'){this.showHint();return;}
    if(action==='hint-close'){this.hideHint();this.focusWorld();return;}
    if(action==='face-target'){const target=this.target();this.pose.yaw=Math.atan2(-(target.x-this.pose.x),-(target.z-this.pose.z));this.pose.pitch=0;this.scene?.setMarketPose(this.pose);this.progressed();this.focusWorld();return;}
    if(button===this.prompt){this.interact();return;}
    if(action==='leave'){this.closeConversation();return;}
    if(action==='task-pick'){this.pickWorldItem(button.dataset.pick==='wrong'&&this.activeTask?`${this.activeTask}-wrong-0`:undefined);return;}
    if(action==='task-return'){this.returnOne();return;}
    if(action==='coin-add'){this.changeCoins(1);return;}
    if(action==='coin-remove'){this.changeCoins(-1);return;}
    if(action==='task-give'){this.deliverTask();return;}
    if(action==='toy-pick'){this.pickWorldItem('lost-toy');return;}
    if(action==='task-pause'){this.activeTask=undefined;this.renderTask();this.scene?.setMarketCarry(undefined);this.focusWorld();return;}
    const conversation=this.conversation;if(!conversation)return;
    if(action==='greet'&&conversation.stage==='greet'){
      this.greeted.add(conversation.activity.id);this.scene?.market.react(conversation.activity.id,'greet',this.pose);
      this.toast('right','That’s right! <b lang="ne">नमस्ते</b> means hello.');
      if(conversation.activity.id==='family'&&this.tasks.get('family')?.carryingToy){this.activeTask='family';this.deliverTask();return;}
      conversation.stage=this.completed.has(conversation.activity.id)?'done':conversation.activity.id==='family'&&!this.tasks.has('family')?'where':'brief';this.renderConversation();return;
    }
    if(action==='where-right'&&conversation.stage==='where'){
      this.toast('right','That’s right! <b lang="ne">पछाडि</b> means behind. The teddy is behind a planter past the bakery.');
      conversation.stage='brief';this.renderConversation();return;
    }
    if(action==='where-wrong'){this.toast('hint','<b lang="ne">अगाडि</b> means in front. Look at the picture: the teddy is hiding behind the plant. Choose <b lang="ne">पछाडि</b>.');this.bump();return;}
    if(action==='wrong-greeting'){
      // अगाडि means forward, so that is exactly what happens: you take a step toward your neighbor.
      const activity=conversation.activity,dx=activity.x-this.pose.x,dz=activity.z-this.pose.z,distance=Math.max(.01,Math.hypot(dx,dz));
      this.pose=walkMarket(this.pose,dx/distance*.35,dz/distance*.35,this.scene?.market.peopleObstacles());this.scene?.setMarketPose(this.pose);
      this.scene?.market.react(activity.id,'point',this.pose);
      this.toast('hint','<b lang="ne">अगाडि</b> means forward, so you stepped forward! To say hello, choose <b lang="ne">नमस्ते</b>.');
      this.bump();return;
    }
    if(action==='wrong-ok'){this.toast('hint','<b lang="ne">धन्यवाद</b> means thank you. To say OK, choose <b lang="ne">हुन्छ</b>.');this.bump();return;}
    if(action==='wrong-thanks'){this.toast('hint','<b lang="ne">नमस्ते</b> means hello. To say thank you, choose <b lang="ne">धन्यवाद</b>.');this.bump();return;}
    if(action==='start-task'&&conversation.stage==='brief'){
      const id=conversation.activity.id;
      this.toast('right','<b lang="ne">हुन्छ</b> means OK. '+(id==='fruit'?'Now pick the apples.':id==='flowers'?'Now pick the flowers.':id==='bread'?'Now put down the coins.':'Now find the teddy.'));
      if(!this.tasks.has(id)){this.tasks.set(id,{id,picked:[],coins:0,carryingToy:false});if(id==='family')this.familyStep=0;}
      this.activeTask=id;this.tracked=id;this.markTracked();
      if(id==='fruit'||id==='flowers')this.scene?.market.prepareItems(id);
      this.scene?.market.react(id,id==='family'||id==='flowers'?'point':'pack',this.pose);
      this.closeConversation(false);this.renderTask();return;
    }
    if(action==='thanks'&&conversation.stage==='thanks'){
      this.toast('right','That’s right! <b lang="ne">धन्यवाद</b> means thank you.');
      this.finishActivity(conversation.activity);conversation.stage='done';this.renderConversation();
    }
  };
  interact(id?:ActivityId){
    if(this.paused||this.conversation)return;
    if(!id&&this.toyNearby()&&!this.completed.has('family')&&!this.tasks.get('family')?.carryingToy){this.pickWorldItem('lost-toy');return;}
    const activity=nearbyActivity(this.pose);
    if(!activity||(id&&activity.id!==id)){this.say(`↑ <span lang="ne">अगाडि</span>${sr(' Walk closer and face the person before talking.')}`);return;}
    this.clearKeys();
    const task=this.tasks.get(activity.id);
    this.activeTask=task?activity.id:this.activeTask;
    if(task&&this.greeted.has(activity.id)&&(task.picked.length||task.coins||task.carryingToy||task.delivered)){this.deliverTask();return;}
    this.progressed();
    this.conversation={activity,stage:this.greeted.has(activity.id)?this.completed.has(activity.id)?'done':'brief':'greet'};this.host.dataset.mode='conversation';
    this.scene?.market.react(activity.id,'greet',this.pose);
    this.pose.yaw=Math.atan2(-(activity.x-this.pose.x),-(activity.z-this.pose.z));this.pose.pitch=0;this.scene?.setMarketPose(this.pose);this.renderConversation();
  }
  /** What each neighbor asks for: Nepali words next to a picture, nothing else. */
  private request(activity:MarketActivity){
    const number=numbers[activity.count-1];
    if(activity.id==='fruit')return `${word(number.word,number.roman,'two','data-kind="number"')} ${word(pickColors.fruit.word,pickColors.fruit.roman,'red','data-kind="color" style="--paint:'+pickColors.fruit.hex+'"')} <span class="bubble-icon">🍎</span>${sr('Two red apples, please.')}`;
    if(activity.id==='bread')return `<span class="bubble-icon">🥖</span> = ${word(number.word,number.roman,'three','data-kind="number"')} <span class="bubble-icon coin-icon">रू</span>${sr('A loaf costs three rupees.')}`;
    if(activity.id==='flowers')return `${word(number.word,number.roman,'four','data-kind="number"')} ${word(pickColors.flowers.word,pickColors.flowers.roman,'yellow','data-kind="color" style="--paint:'+pickColors.flowers.hex+'"')} <span class="bubble-icon">💐</span><span class="bubble-side">← ${word('बायाँ','baaya','from the left vase')}</span>${sr('Four yellow flowers from the left vase.')}`;
    return `<span class="bubble-icon">😢</span> ${word(pickColors.fruit.word,pickColors.fruit.roman,'red','data-kind="color" style="--paint:'+pickColors.fruit.hex+'"')} <span class="bubble-icon">🧸</span><span class="bubble-side">🥖 → 🪴 ${word('पछाडि','pachhadi','behind')}</span>${sr('Our child lost a red teddy. It is behind the planter past the bakery.')}`;
  }
  private renderConversation(){
    const conversation=this.conversation!;const {activity,stage}=conversation;
    this.dialogue.hidden=false;this.dialogue.dataset.stage=stage;this.dialogue.dataset.activity=activity.id;
    let content=`<header><span class="speaker"><span aria-hidden="true">${icons[activity.id]}</span>${errandNames[activity.id]==='Lost teddy'?'Family':errandNames[activity.id]}</span><button class="bubble-close" data-market-action="leave" aria-label="Leave conversation">✕</button></header><div class="bubble-words" id="market-dialogue-title" tabindex="-1">`;
    // The neighbor's line first, then the learner's answer as tappable Nepali words.
    const reply=(action:string,label:string,text:string,roman:string,english:string,extra='')=>`<button class="word-reply" data-market-action="${action}" aria-label="${label}">${word(text,roman,english)}${extra}</button>`;
    let replies='';
    // Alternate the order so the answer is never simply "the first button".
    const pair=(right:string,wrong:string)=>marketActivities.indexOf(activity)%2?wrong+right:right+wrong;
    let task='';
    if(stage==='where'){
      content+=`<span class="bubble-ask">Where is the teddy?</span><span class="behind-scene" aria-hidden="true"><span class="hide-teddy">🧸</span><span class="hide-plant">🪴</span></span>${sr('A picture of a teddy hiding behind a plant.')}`;
      task='Choose the word for where it is:';
      replies=pair(reply('where-right','Behind','पछाडि','pachhadi','behind'),reply('where-wrong','In front','अगाडि','agadi','in front'));
    }else if(stage==='greet'){
      // No spoken line to copy: the task names who to greet, and the learner picks the word.
      content+=`<span class="bubble-ask">Greet ${roles[activity.id]}</span>`;
      replies=pair(reply('greet','Hello','नमस्ते','namaste','hello'),reply('wrong-greeting','Forward','अगाडि','agadi','forward'));
    }else if(stage==='brief'){
      if(conversation.mismatch!==undefined){
        const want=activity.count,have=conversation.mismatch,haveWord=have?numbers[have-1]:undefined;
        content+=`<span class="count-compare" data-want="${want}" data-have="${have}"><span>${word(numbers[want-1].word,numbers[want-1].roman,String(want))}<span class="dots">${dots(want)}</span></span><b aria-hidden="true">≠</b><span>${haveWord?word(haveWord.word,haveWord.roman,String(have)):'<strong>0</strong>'}<span class="dots">${dots(have)}</span></span></span>${sr(`Not quite. You brought ${have}.`)}`;
      }else content+=this.request(activity);
      task=conversation.mismatch!==undefined?'Agree to try again:':activity.id==='family'?'Will you find it? Say OK:':'Will you help? Say OK:';
      replies=pair(reply('start-task',activity.id==='family'?'I’ll find the teddy':activity.id==='bread'?'Open my coin purse':'Let me help','हुन्छ','hunchha','OK'),reply('wrong-ok','Thank you','धन्यवाद','dhanyabaad','thank you'));
    }else if(stage==='thanks'){
      content+=`${word('धन्यवाद!','dhanyabaad','Thank you!')} <span class="bubble-icon">${activity.id==='bread'?'🥖':activity.id==='fruit'?'🍎🍎':'💐'}</span>`;
      task=`Thank ${this.nameOf(activity.id)} back:`;
      replies=pair(reply('thanks','Say thank you','धन्यवाद','dhanyabaad','thank you'),reply('wrong-thanks','Hello','नमस्ते','namaste','hello'));
    }else{
      task='Say goodbye:';
      content+=`<span class="bubble-icon">${activity.id==='family'?'🧸 😊':'😊'}</span> ${word('धन्यवाद!','dhanyabaad','Thank you!')}${sr(activity.id==='family'?'Toy returned.':`${activity.name} done.`)}`;
      replies=`<button class="word-reply" data-market-action="leave" aria-label="Keep exploring"><span class="bubble-icon">👋</span></button>`;
    }
    content+=`</div><p class="bubble-task">${task}</p><div class="market-replies">${replies}</div><p class="bubble-react" role="status" aria-live="polite"></p>`;
    this.dialogue.innerHTML=content;this.dialogue.querySelector<HTMLElement>('#market-dialogue-title')!.focus({preventScroll:true});
    this.renderInstruction();
  }
  private bump(){this.dialogue.dataset.bump='true';setTimeout(()=>delete this.dialogue.dataset.bump,500);}
  private toyNearby(){
    const dx=lostToy.x-this.pose.x,dz=lostToy.z-this.pose.z,distance=Math.hypot(dx,dz);
    return distance<2.3&&(-Math.sin(this.pose.yaw)*dx-Math.cos(this.pose.yaw)*dz)/Math.max(.01,distance)>.15;
  }
  /** Two pick buttons that show only a color swatch, so the learner must know which color the Nepali word names. */
  private pickButtons(id:'fruit'|'flowers'){
    const colors=pickColors[id],noun=id==='fruit'?'apple':'flower';
    const button=(kind:'right'|'wrong')=>`<button class="swatch-pick" data-market-action="task-pick" data-pick="${kind}" data-task-near aria-label="Pick up a ${kind==='right'?colors.english:colors.otherEnglish} ${noun}" style="--swatch:${kind==='right'?colors.hex:colors.other}"><i aria-hidden="true"></i></button>`;
    return id==='fruit'?button('wrong')+button('right'):button('right')+button('wrong');
  }
  private atTask(){return !!this.activeTask&&nearbyActivity(this.pose)?.id===this.activeTask;}
  /** The tray: the words you were asked for light up as your hands match them. */
  private renderTask(){
    const task=this.activeTask?this.tasks.get(this.activeTask):undefined;this.taskBoard.hidden=!task;if(!task)return;
    const activity=marketActivities.find(item=>item.id===task.id)!;this.taskBoard.dataset.kind=task.id;
    const number=numbers[activity.count-1];
    const count=task.id==='bread'?task.coins:task.picked.length;
    const numberMet=count===activity.count;
    const target=task.id==='family'?word(pickColors.fruit.word,pickColors.fruit.roman,'red',`data-kind="color" data-met="${task.carryingToy}" style="--paint:${pickColors.fruit.hex}"`)
      :`${word(number.word,number.roman,activity.count===2?'two':activity.count===3?'three':'four',`data-kind="number" data-met="${numberMet}"`)}${task.id==='bread'?'':` ${word(pickColors[task.id].word,pickColors[task.id].roman,pickColors[task.id].english,`data-kind="color" data-met="${this.colorMet.has(task.id)}" style="--paint:${pickColors[task.id].hex}"`)}`}`;
    const instruction=task.id==='fruit'?'Pick the number of apples Maya asked for, in her color.':task.id==='flowers'?'Pick the number of flowers Tara asked for, in her color, from the vase she pointed to.':task.id==='bread'?'Put down the number of coins Arun asked for.':'Find the red teddy and bring it back:';
    let content=`<p class="tray-task">${instruction}</p><header><span class="tray-icon" aria-hidden="true">${icons[task.id]}</span><span class="tray-target">${target}</span><button data-market-action="task-pause" class="bubble-close" aria-label="Put task aside">✕</button></header>`;
    const counter=(id:string,unit:string)=>`<div class="tray-count" id="${id}" data-count="${count}" data-met="${numberMet}">${count?word(numbers[count-1].word,numbers[count-1].roman,String(count)):'<strong class="zero">·</strong>'}<span class="dots">${dots(count)}</span>${sr(`${count} ${unit}`)}</div>`;
    if(task.delivered)content+=`<div class="task-buttons"><button class="tray-action" data-market-action="task-give" data-task-near aria-label="Speak to the vendor">💬</button></div>`;
    else if(task.id==='family'){
      const steps=this.familySteps();
      content+=`<ol class="tray-steps">${steps.map((step,i)=>`<li data-state="${i<this.familyStep?'done':i===this.familyStep?'now':'todo'}">${step}</li>`).join('')}</ol>`;
      content+=task.carryingToy?`${sr('You’re holding the red teddy. Take it back to the family.')}<div class="task-buttons"><button class="tray-action" data-market-action="task-give" data-task-near aria-label="Return the teddy">🤲</button></div>`:`<div class="task-buttons"><button class="tray-action" data-market-action="toy-pick" aria-label="Pick up the red teddy">✋🧸</button></div>`;
    }
    else if(task.id==='bread')content+=`<div class="coin-purse" aria-label="Coin purse">${Array.from({length:this.wallet},(_,i)=>`<button class="rupee-coin ${i<task.coins?'is-placed':''}" data-market-action="coin-add" data-task-near data-fixed-disabled="${i<task.coins}" aria-label="Place one rupee" ${i<task.coins?'disabled':''}><span>रू</span><strong>1</strong></button>`).join('')}</div>${counter('coin-total','coins')}<div class="task-buttons"><button class="tray-action quiet" data-market-action="coin-remove" data-task-near aria-label="Take back a coin">↩</button><button class="tray-action" data-market-action="task-give" data-task-near aria-label="Pay the baker">🤲</button></div>`;
    else content+=`${counter('picked-total',activity.item)}<div class="task-buttons">${this.pickButtons(task.id)}<button class="tray-action quiet" data-market-action="task-return" data-task-near aria-label="Put one back">↩</button><button class="tray-action" data-market-action="task-give" data-task-near aria-label="Hand over">🤲</button></div>`;
    this.taskBoard.innerHTML=content;
    this.renderInstruction();
  }
  private familySteps(){
    return ['Walk to the bakery 🥖',`Look <b lang="ne">पछाडि</b> (behind) the planter 🪴`,`Pick up the <b lang="ne">रातो</b> 🧸 (press <kbd>E</kbd>)`,'Bring it back to the family 👪'];
  }
  /** Tick off the teddy steps as the player actually does them. */
  private updateFamilyStep(){
    const task=this.tasks.get('family');if(!task||this.completed.has('family'))return;
    const toyDistance=Math.hypot(lostToy.x-this.pose.x,lostToy.z-this.pose.z);
    let step=this.familyStep;
    if(task.carryingToy)step=3;
    else if(toyDistance<3.2)step=Math.max(step,2);
    else if(this.pose.x<-7)step=Math.max(step,1);
    if(step<=this.familyStep)return;
    this.familyStep=step;
    if(step===1)this.toast('right','You’re at the bakery 🥖. Now look <b lang="ne">पछाडि</b> (behind) the planter past it.');
    if(step===2)this.toast('right','There it is, <b lang="ne">पछाडि</b> (behind) the planter! Press <kbd>E</kbd> to pick it up.');
    this.renderTask();
  }
  /** A Nepali number floats up from the tray each time you add something, so counting happens in Nepali. */
  private popCount(count:number){
    if(!count)return;
    const pop=document.createElement('span');pop.className='word-pop';pop.lang='ne';pop.textContent=numbers[count-1].word;
    this.taskBoard.append(pop);setTimeout(()=>pop.remove(),900);
  }
  /** Briefly show the color word for what was actually picked, in that color. */
  private wrongPick(id:'fruit'|'flowers'){
    const wrong=wrongColor[id],right=pickColors[id];
    this.toast('hint',id==='fruit'
      ?`That apple is <b lang="ne" style="color:${right.other}">${wrong.word}</b> (${wrong.english}). <b lang="ne">${right.word}</b> means ${right.english}. Pick a ${right.english} one.`
      :`Those are <b lang="ne">${wrong.word}</b> (${wrong.english}) flowers, on your right (<b lang="ne">दायाँ</b>). <b lang="ne">${right.word}</b> means ${right.english}; they’re on your left (<b lang="ne">बायाँ</b>).`);
    const chip=this.taskBoard.querySelector<HTMLElement>('[data-kind="color"]');
    if(chip){chip.dataset.wrong=wrong.word;chip.style.setProperty('--wrong',pickColors[id].other);setTimeout(()=>delete chip.dataset.wrong,1200);}
  }
  private say(html:string){this.status.innerHTML=html;}
  /** Short feedback that fades: green for a right answer, amber with a hint for a wrong one. */
  private toast(kind:'right'|'hint',html:string){
    const toast=this.host.querySelector<HTMLElement>('.word-toast')!;
    toast.dataset.kind=kind;toast.innerHTML=`${kind==='right'?'<span class="toast-mark" aria-hidden="true">✓</span>':'<span class="toast-mark" aria-hidden="true">💡</span>'}<span>${html}</span>`;
    toast.hidden=false;toast.classList.remove('is-in');void toast.offsetWidth;toast.classList.add('is-in');
    clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>{toast.hidden=true;},kind==='right'?3200:5500);
  }
  private nameOf(id:ActivityId){return id==='family'?'the family':errandNames[id];}
  private pickWorldItem(key?:string){
    if(this.paused||this.conversation)return;
    if(key==='lost-toy'){
      if(!this.toyNearby()||this.completed.has('family'))return;
      const task=this.tasks.get('family')??{id:'family',picked:[],coins:0,carryingToy:false};
      if(task.carryingToy)return;
      if(this.scene&&!this.scene.market.pickToy(this.pose))return;
      task.carryingToy=true;this.familyStep=3;this.progressed();this.tasks.set('family',task);this.activeTask='family';this.tracked='family';this.markTracked();
      this.scene?.setMarketCarry('toy');this.say(`🧸 ✓${sr(' You picked up the teddy. Bring it back to the family.')}`);
      this.toast('right','You found the <b lang="ne">रातो</b> (red) teddy, <b lang="ne">पछाडि</b> (behind) the planter! Bring it back.');this.renderTask();this.focusWorld();return;
    }
    const task=this.activeTask?this.tasks.get(this.activeTask):undefined;
    if(!task||(task.id!=='fruit'&&task.id!=='flowers')||!this.atTask())return;
    if(task.delivered)return;
    if(key?.startsWith('flowers-wrong')){this.wrongPick('flowers');this.scene?.market.react('flowers','point',this.pose);return;}
    if(key?.startsWith('fruit-wrong')){this.wrongPick('fruit');this.scene?.market.react('fruit','point',this.pose);return;}
    if(task.picked.length>=5){this.say(`✋ ${dots(5)}`);return;}
    const item=key??this.scene?.market.availableItem(task.id)??`${task.id}-${task.picked.length}`;
    if(!item.startsWith(`${task.id}-`)||task.picked.includes(item))return;
    if(this.scene&&!this.scene.market.pickItem(item,this.pose))return;
    const firstColor=!this.colorMet.has(task.id);
    task.picked.push(item);this.colorMet.add(task.id);this.progressed();this.countFeedback(task.id,task.picked.length,firstColor);this.scene?.setMarketCarry(task.id,task.picked.length);this.scene?.market.react(task.id,'pack',this.pose);
    this.say('');this.renderTask();this.popCount(task.picked.length);this.focusWorld();
  }
  /** Feedback as the count in your hands changes. */
  private countFeedback(id:ActivityId,count:number,firstColor=false){
    const activity=marketActivities.find(item=>item.id===id)!,want=numbers[activity.count-1],have=count?numbers[count-1]:undefined;
    const noun=id==='bread'?'coins':activity.item;
    if(count===activity.count)this.toast('right',`That’s right! <b lang="ne">${want.word}</b> is ${want.english.toLowerCase()}. Now tap 🤲 to ${id==='bread'?'pay':'hand them over'}.`);
    else if(count>activity.count&&have)this.toast('hint',`That’s <b lang="ne">${have.word}</b> (${have.english.toLowerCase()}) ${noun}. ${this.nameOf(id)} asked for <b lang="ne">${want.word}</b> (${want.english.toLowerCase()}). Tap ↩ to put one back.`);
    else if(firstColor&&(id==='fruit'||id==='flowers'))this.toast('right',`That’s right! <b lang="ne" style="color:${pickColors[id].hex}">${pickColors[id].word}</b> means ${pickColors[id].english}. Keep counting.`);
  }
  private returnOne(){
    const task=this.activeTask?this.tasks.get(this.activeTask):undefined;if(!task||!this.atTask()||task.delivered)return;
    const item=task.picked.pop();if(item)this.scene?.market.returnItem(item);
    if(item)this.countFeedback(task.id,task.picked.length);
    if(task.id==='fruit'||task.id==='flowers')this.scene?.setMarketCarry(task.id,task.picked.length);
    this.renderTask();this.focusWorld();
  }
  private changeCoins(delta:number){
    const task=this.tasks.get('bread');if(this.activeTask!=='bread'||!task||!this.atTask()||task.delivered)return;
    task.coins=Math.max(0,Math.min(this.wallet,task.coins+delta));this.progressed();this.scene?.market.setCoins(task.coins,this.pose);this.scene?.market.react('bread','receive',this.pose);
    this.renderTask();if(delta>0)this.popCount(task.coins);this.countFeedback('bread',task.coins);this.focusWorld();
  }
  private deliverTask(){
    const task=this.activeTask?this.tasks.get(this.activeTask):undefined;if(!task||!this.atTask())return;
    const activity=marketActivities.find(item=>item.id===task.id)!;
    this.clearKeys();
    if(task.id==='family'){
      if(!task.carryingToy){this.say(`<span lang="ne">पछाडि</span> 🪴 🧸${sr(' Look behind the bakery planter for the red teddy.')}`);return;}
      this.scene?.setMarketCarry(undefined);this.scene?.market.handover('family',this.pose);this.finishActivity(activity);
      this.conversation={activity,stage:'done'};this.host.dataset.mode='conversation';this.renderConversation();return;
    }
    const count=task.id==='bread'?task.coins:task.picked.length;
    if(count!==activity.count){
      this.scene?.market.react(activity.id,'receive',this.pose);
      const want=numbers[activity.count-1],have=count?numbers[count-1]:undefined;
      this.toast('hint',`${this.nameOf(activity.id)} asked for <b lang="ne">${want.word}</b> (${want.english.toLowerCase()}). You brought ${have?`<b lang="ne">${have.word}</b> (${have.english.toLowerCase()})`:'none'}. ${count>activity.count?'Put some back with ↩.':'Add more.'}`);
      this.conversation={activity,stage:'brief',mismatch:count};
      this.host.dataset.mode='conversation';this.renderConversation();return;
    }
    if(!task.delivered){
      task.delivered=true;this.scene?.market.handover(activity.id,this.pose);
      this.scene?.setMarketCarry(activity.id==='bread'?'bread':activity.id==='flowers'?'flowers':'fruit',activity.id==='bread'?1:activity.count,this.scene.reducedMotion?0:1800);
    }
    this.conversation={activity,stage:'thanks'};this.host.dataset.mode='conversation';this.renderConversation();
  }
  private finishActivity(activity:MarketActivity){
    if(activity.id==='bread'&&!this.completed.has('bread'))this.wallet=Math.max(0,this.wallet-3);
    this.completed.add(activity.id);this.scene?.market.markActivity(activity.id,activity.id==='bread'?1:activity.count);
    try{localStorage.setItem(marketVisitsKey,JSON.stringify([...this.completed]));localStorage.setItem('wayword.wallet.ne.v1',String(this.wallet));if(marketActivities.filter(item=>item.required).every(item=>this.completed.has(item.id)))completeLevel(localStorage,'next-adventure');}catch{/* Optional browser progress. */}
    this.tasks.delete(activity.id);if(this.activeTask===activity.id)this.activeTask=undefined;
    // Point straight at the next neighbor who still needs help.
    const next=this.nextErrand();if(next){this.tracked=next;this.markTracked();}
    this.progressed();this.updateProgress();this.renderTask();
  }
  private closeConversation(wave=true){
    if(wave&&this.conversation)this.scene?.market.react(this.conversation.activity.id,'bye',this.pose);
    this.conversation=undefined;this.dialogue.hidden=true;this.dialogue.replaceChildren();this.host.dataset.mode='roam';this.clearKeys();this.renderTask();this.focusWorld();this.renderInstruction();
  }
  private updateProgress(){
    const count=marketActivities.filter(activity=>activity.required&&this.completed.has(activity.id)).length;
    this.host.querySelector('#market-progress')!.textContent=count===3?'Finale complete. Keep exploring!':`${count} / 3 stalls visited · Choose any order`;
    this.host.dataset.complete=String(count===3);
    this.host.querySelectorAll<HTMLElement>('[data-track]').forEach(button=>button.dataset.done=String(this.completed.has(button.dataset.track as ActivityId)));
  }
  private nextErrand():ActivityId|undefined{
    return marketActivities.find(activity=>activity.required&&!this.completed.has(activity.id))?.id??marketActivities.find(activity=>!this.completed.has(activity.id))?.id;
  }
  private markTracked(){this.host.querySelectorAll<HTMLElement>('[data-track]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.track===this.tracked)));}
  /** Where the direction word and gold marker point: the tracked neighbor, or the lost teddy while you look for it. */
  private target(){
    const activity=marketActivities.find(item=>item.id===this.tracked)!;
    if(this.tracked==='family'&&!this.completed.has('family')&&this.tasks.has('family')&&!this.tasks.get('family')?.carryingToy){
      if(this.familyStep===0){const bakery=marketActivities.find(item=>item.id==='bread')!;return{icon:'🥖',x:bakery.x,z:bakery.z,beaconY:3.4};}
      return{icon:'🧸',x:lostToy.x,z:lostToy.z,beaconY:1.15};
    }
    return{icon:activity.id==='family'?'👪':icons[activity.id],x:activity.x,z:activity.z,beaconY:3.4};
  }
  /** The Nepali direction for a point, from where you stand and face right now. */
  private way(target:{x:number;z:number}){
    let angle=Math.atan2(-(target.x-this.pose.x),-(target.z-this.pose.z))-this.pose.yaw;
    angle=Math.atan2(Math.sin(angle),Math.cos(angle));
    const degrees=Math.abs(angle)*180/Math.PI,side=angle>0?'left' as const:'right' as const;
    const words:('forward'|'left'|'right'|'backward')[]=degrees<=22.5?['forward']:degrees>=157.5?['backward']:degrees<67.5?['forward',side]:degrees>112.5?['backward',side]:[side];
    return{angle,words,key:words.join('-'),side:words.includes('left')?'left':words.includes('right')?'right':words[0]==='backward'?'behind':'ahead'};
  }
  private progressed(){this.lastProgress=performance.now();this.hideHint();}
  private hideHint(){clearTimeout(this.hintTimer);if(this.hintBox)this.hintBox.hidden=true;}
  /** One plain sentence in the top-left: the very next thing to do. */
  private renderInstruction(){
    const ne=(text:string)=>`<b lang="ne">${text}</b>`;
    const required=marketActivities.filter(activity=>activity.required),done=required.filter(activity=>this.completed.has(activity.id)).length;
    const task=this.activeTask?this.tasks.get(this.activeTask):undefined;
    const person=(id:ActivityId)=>`${id==='family'?'the family':errandNames[id]} ${icons[id]}`;
    let step:string;
    if(this.conversation)step='Tap a Nepali word to answer.';
    else if(task?.delivered)step=`Talk to ${person(task.id)} to finish.`;
    else if(task&&(task.id==='fruit'||task.id==='flowers'))step=this.atTask()?`Pick ${ne(errandWords[task.id])} ${task.id==='fruit'?'apples':'flowers'}, then tap 🤲.`:`Go back to ${person(task.id)}.`;
    else if(task?.id==='bread')step=this.atTask()?`Put ${ne('तीन')} coins down, then tap 🤲.`:`Go back to ${person('bread')}.`;
    else if(task?.id==='family')step=`${this.familySteps()[this.familyStep]}.${this.familyStep<2?' Follow the arrow.':''}`;
    else if(this.toyNearby()&&!this.completed.has('family'))step='Press <kbd>E</kbd> to pick up the 🧸.';
    else if(this.near)step=`Press <kbd>E</kbd> and say ${ne('नमस्ते')}.`;
    else if(done===required.length&&!this.nextErrand())step='🎉 All done! Keep exploring.';
    else step=`Walk to ${person(this.tracked)}. Follow the arrow.`;
    const count=done===required.length?'FINALE COMPLETE':`ERRAND ${Math.min(done+1,required.length)} OF ${required.length}`;
    const key=count+step;if(key===this.instructionKey)return;this.instructionKey=key;
    this.host.querySelector('#market-step-count')!.textContent=count;
    this.host.querySelector('#market-instruction')!.innerHTML=step;
  }
  /** Bottom-left help: what the words mean and exactly what to do, plus every English meaning for a few seconds. */
  private showHint(){
    if(this.paused)return;
    this.peek();
    const task=this.activeTask?this.tasks.get(this.activeTask):undefined;
    const target=this.target(),way=this.way(target);
    const where=`${way.words.map(item=>pack.directions[item].text).join(' · ')} = ${way.words.map(item=>pack.where[item]).join(', ')}`;
    const ne=(text:string)=>`<b lang="ne">${text}</b>`;
    let text:string;
    const stage=this.conversation?.stage;
    if(stage==='where')text=`${ne('पछाडि')} = behind, ${ne('अगाडि')} = in front. In the picture the teddy is behind the plant.`;
    else if(stage==='greet')text=`${ne('नमस्ते')} = hello. Tap ${ne('नमस्ते')} to greet back.`;
    else if(stage==='brief')text=this.conversation?.mismatch!==undefined?`They asked for ${this.conversation.activity.count}. Tap ${ne('हुन्छ')}, then add or take back items with ↩.`:`${ne('हुन्छ')} = OK. Tap it to help.`;
    else if(stage==='thanks')text=`${ne('धन्यवाद')} = thank you. Tap it to say it back.`;
    else if(stage==='done')text='Tap 👋 to say goodbye.';
    else if(task&&(task.id==='fruit'||task.id==='flowers')&&this.atTask()){
      const activity=marketActivities.find(item=>item.id===task.id)!,number=numbers[activity.count-1],color=pickColors[task.id];
      text=`${ne(number.word)} = ${activity.count}, ${ne(color.word)} = ${color.english}. Tap the ${color.english} circle ${activity.count} times, then 🤲.${task.id==='flowers'?` They’re in the left vase (${ne('बायाँ')}).`:''}`;
    }else if(task?.id==='bread'&&this.atTask())text=`${ne('तीन')} = 3. Tap 3 coins, then 🤲.`;
    else if(task?.id==='family'&&!task.carryingToy)text=this.familyStep===0?`First walk to the bakery 🥖. It is ${where}. Tap 🧭 to face it.`:this.familyStep===1?`The teddy is ${ne('पछाडि')} (behind) the planter just past the bakery: ${where}. Walk to the gold marker.`:'Look down at the teddy and press <kbd>E</kbd> to pick it up.';
    else if(task?.id==='family')text='Walk back to the family 👪 and press <kbd>E</kbd>.';
    else if(this.near)text='Press <kbd>E</kbd> to talk.';
    else text=`Your goal is ${where}. Tap 🧭 to face it, then walk forward with <kbd>W</kbd>.`;
    this.hintBox.querySelector('#market-hint-text')!.innerHTML=text;this.hintBox.hidden=false;
    clearTimeout(this.hintTimer);this.hintTimer=setTimeout(()=>this.hideHint(),12000);
  }
  /** Show every English meaning on screen for a few seconds. */
  private peek(){
    this.host.dataset.peek='true';
    clearTimeout(this.peekTimer);this.peekTimer=setTimeout(()=>{this.host.dataset.peek='false';},5000);
    this.focusWorld();
  }
  dispose(){
    cancelAnimationFrame(this.raf);this.clearKeys();clearTimeout(this.peekTimer);clearTimeout(this.hintTimer);
    window.removeEventListener('keydown',this.keyDown);window.removeEventListener('keyup',this.keyUp);window.removeEventListener('blur',this.clearKeys);document.removeEventListener('visibilitychange',this.clearKeys);
    this.host.removeEventListener('click',this.click);this.host.removeEventListener('pointerdown',this.touchDown);this.host.removeEventListener('pointerup',this.touchUp);this.host.removeEventListener('pointercancel',this.touchUp);this.host.removeEventListener('lostpointercapture',this.touchUp);
    this.canvas?.removeEventListener('pointerdown',this.lookDown);this.canvas?.removeEventListener('pointermove',this.lookMove);this.canvas?.removeEventListener('pointerup',this.lookUp);this.canvas?.removeEventListener('pointercancel',this.lookUp);
    if(this.scene){this.scene.onMarketInteract=undefined;this.scene.onMarketItem=undefined;this.scene.setMarketCarry(undefined);}
    this.host.hidden=true;this.host.replaceChildren();
  }
}
