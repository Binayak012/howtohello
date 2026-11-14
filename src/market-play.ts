import type { ShopScene } from './scene';
import { numbers } from './numbers';
import { completeLevel } from './progression';
import { marketActivities, pickColors, marketStart, nearbyActivity, walkMarket, readMarketVisits, marketVisitsKey, lostToy, type MarketTask, type MarketActivity, type MarketPose, type ActivityId } from './market-world';

/** Street movement and conversations are independent of the shop's tile lesson. */
export class MarketExplorer {
  pose: MarketPose = marketStart();
  private keys = new Set<string>();
  private paused = false;
  private raf = 0;
  private last = 0;
  private drag?: { id:number; x:number; y:number; moved:boolean };
  private ignoreClickUntil = 0;
  private conversation?: { activity:MarketActivity; stage:'greet'|'brief'|'thanks'|'done'; message?:string };
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

  constructor(private host: HTMLElement, private scene: ShopScene | undefined, private review:()=>void) {
    try {this.completed=new Set(readMarketVisits(localStorage));}catch{/* Exploration works without storage. */}
    host.hidden=false;host.dataset.mode='roam';
    host.innerHTML=`<aside class="market-journal"><p class="eyebrow">YOUR NEIGHBORHOOD</p><h2>Make yourself at home.</h2><p id="market-progress"></p><details><summary>People to meet</summary><div class="market-destinations">${marketActivities.map(activity=>`<button data-track="${activity.id}"><span>${activity.name}${activity.required?'':' · optional'}</span><small id="visit-${activity.id}">${this.completed.has(activity.id)?'✓ Visited':activity.hint}</small></button>`).join('')}</div></details><button class="market-review" data-market-action="review">Review numbers 1–5</button></aside><div class="market-waypoint" role="status"></div><span class="market-crosshair" aria-hidden="true">+</span><button id="market-talk" class="market-talk" disabled>Approach a neighbor to talk</button><p class="market-roam-status" role="status" aria-live="polite"></p><div class="market-touch" aria-label="Market movement controls"><button data-move="turnleft" aria-label="Look left">↶</button><button data-move="forward" aria-label="Walk forward">↑</button><button data-move="turnright" aria-label="Look right">↷</button><button data-move="left" aria-label="Walk left">←</button><button data-move="backward" aria-label="Walk backward">↓</button><button data-move="right" aria-label="Walk right">→</button></div><p class="market-keys">WASD move · ← → turn · drag to look · E / Space talk</p><section class="market-dialogue" role="dialog" aria-modal="false" aria-labelledby="market-dialogue-title" hidden></section>`;
    this.prompt=host.querySelector('#market-talk')!;this.dialogue=host.querySelector('.market-dialogue')!;
    this.waypoint=host.querySelector('.market-waypoint')!;this.status=host.querySelector('.market-roam-status')!;
    this.taskBoard=document.createElement('aside');this.taskBoard.className='market-task';this.taskBoard.hidden=true;host.append(this.taskBoard);
    try{const saved=Number(localStorage.getItem('wayword.wallet.ne.v1')??5);if(Number.isInteger(saved)&&saved>=0&&saved<=5)this.wallet=saved;}catch{/* Optional wallet persistence. */}
    this.canvas=scene?.renderer.domElement;
    this.canvas?.setAttribute('tabindex','0');
    this.scene?.setMarketPose(this.pose);
    if(scene) {scene.onMarketInteract=id=>{if(performance.now()>this.ignoreClickUntil)this.interact(id);};scene.onMarketItem=id=>{if(performance.now()>this.ignoreClickUntil)this.pickWorldItem(id);};this.completed.forEach(id=>scene.market.markActivity(id,marketActivities.find(activity=>activity.id===id)!.count));}
    host.addEventListener('click',this.click);
    host.addEventListener('pointerdown',this.touchDown);host.addEventListener('pointerup',this.touchUp);host.addEventListener('pointercancel',this.touchUp);host.addEventListener('lostpointercapture',this.touchUp);
    this.canvas?.addEventListener('pointerdown',this.lookDown);this.canvas?.addEventListener('pointermove',this.lookMove);this.canvas?.addEventListener('pointerup',this.lookUp);this.canvas?.addEventListener('pointercancel',this.lookUp);
    window.addEventListener('keydown',this.keyDown);window.addEventListener('keyup',this.keyUp);window.addEventListener('blur',this.clearKeys);document.addEventListener('visibilitychange',this.clearKeys);
    this.updateProgress();this.frame(performance.now());this.focusWorld();
    this.status.textContent=scene?'Choose any neighbor. You can explore in any order.':'Use the movement buttons to explore. Nearby conversations work without WebGL.';
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
    if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(key)){event.preventDefault();this.keys.add(key);}
    if((key==='e'||key===' ')&&!event.repeat){event.preventDefault();this.interact();}
  };
  private keyUp=(event:KeyboardEvent)=>{this.keys.delete(event.key.toLowerCase());};
  private touchDown=(event:PointerEvent)=>{
    const button=event.target instanceof Element?event.target.closest<HTMLButtonElement>('[data-move]'):null;
    if(!button||this.paused||this.conversation)return;
    event.preventDefault();button.setPointerCapture(event.pointerId);this.keys.add(button.dataset.move!);
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
    const label=canPickToy?'Pick up the red teddy · E':this.near?`Talk to ${this.near.name.toLowerCase()} · E`:'Approach a neighbor to talk';
    if(this.prompt.textContent!==label)this.prompt.textContent=label;
    this.prompt.disabled=!this.near&&!canPickToy;
    let activity:{name:string;x:number;z:number}=marketActivities.find(item=>item.id===this.tracked)!;
    if(this.activeTask==='family'&&!this.tasks.get('family')?.carryingToy)activity={...lostToy,name:'Bakery planter'};
    let angle=Math.atan2(-(activity.x-this.pose.x),-(activity.z-this.pose.z))-this.pose.yaw;
    angle=Math.atan2(Math.sin(angle),Math.cos(angle));
    const direction=Math.abs(angle)<.45?['अगाडि','agadi','Ahead']:Math.abs(angle)>2.5?['पछाडि','pachhadi','Behind']:angle>0?['बायाँ','baaya','Left']:['दायाँ','daaya','Right'];
    const waypoint=`<span>${activity.name} · ${Math.round(Math.hypot(activity.x-this.pose.x,activity.z-this.pose.z))} m</span><strong lang="ne">${direction[0]}</strong><small><span class="latin-guide">${direction[1]} · </span>${direction[2]}</small>`;
    if(this.waypoint.innerHTML!==waypoint)this.waypoint.innerHTML=waypoint;
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
    if(button.dataset.track){this.tracked=button.dataset.track as ActivityId;this.status.textContent=`${marketActivities.find(activity=>activity.id===this.tracked)!.hint}. Follow the direction cue.`;this.focusWorld();return;}
    const action=button.dataset.marketAction;
    if(action==='review'){this.review();return;}
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
      if(conversation.activity.id==='family'&&this.tasks.get('family')?.carryingToy){this.activeTask='family';this.deliverTask();return;}
      conversation.stage=this.completed.has(conversation.activity.id)?'done':'brief';this.renderConversation();return;
    }
    if(action==='wrong-greeting'){this.dialogue.querySelector('[role=status]')!.textContent='अगाडि means forward. Greet your neighbor with नमस्ते (namaste), just as you did with Asha on your first day.';return;}
    if(action==='start-task'&&conversation.stage==='brief'){
      const id=conversation.activity.id;
      if(!this.tasks.has(id))this.tasks.set(id,{id,picked:[],coins:0,carryingToy:false});
      this.activeTask=id;this.tracked=id;
      if(id==='fruit'||id==='flowers')this.scene?.market.prepareItems(id);
      this.scene?.market.react(id,id==='family'||id==='flowers'?'point':'pack',this.pose);
      this.closeConversation(false);this.renderTask();return;
    }
    if(action==='thanks'&&conversation.stage==='thanks'){
      this.finishActivity(conversation.activity);conversation.stage='done';this.renderConversation();
    }
  };
  interact(id?:ActivityId){
    if(this.paused||this.conversation)return;
    if(!id&&this.toyNearby()&&!this.completed.has('family')&&!this.tasks.get('family')?.carryingToy){this.pickWorldItem('lost-toy');return;}
    const activity=nearbyActivity(this.pose);
    if(!activity||(id&&activity.id!==id)){this.status.textContent='Walk closer and face the person before talking.';return;}
    this.clearKeys();
    const task=this.tasks.get(activity.id);
    this.activeTask=task?activity.id:this.activeTask;
    if(task&&this.greeted.has(activity.id)&&(task.picked.length||task.coins||task.carryingToy||task.delivered)){this.deliverTask();return;}
    this.conversation={activity,stage:this.greeted.has(activity.id)?this.completed.has(activity.id)?'done':'brief':'greet'};this.host.dataset.mode='conversation';
    this.scene?.market.react(activity.id,'greet',this.pose);
    this.pose.yaw=Math.atan2(-(activity.x-this.pose.x),-(activity.z-this.pose.z));this.pose.pitch=0;this.scene?.setMarketPose(this.pose);this.renderConversation();
  }
  private renderConversation(){
    const conversation=this.conversation!;const {activity,stage}=conversation;const number=numbers[activity.count-1];
    this.dialogue.hidden=false;
    let content=`<header><span class="eyebrow">${activity.person}</span><button class="quiet" data-market-action="leave">Leave conversation</button></header><h2 id="market-dialogue-title" tabindex="-1">${stage==='greet'?'A familiar first word.':stage==='brief'?activity.id==='family'?'A missing friend.':'A little help at the stall.':stage==='thanks'?'Just right. Thank you!':'A little more at home.'}</h2>`;
    if(stage==='greet')content+=`<p>${this.completed.has(activity.id)?'“Good to see you again!”':'Your neighbor smiles. Start with the greeting you learned on your first day.'}</p><div class="market-replies"><button class="primary phrase-reply" data-market-action="greet"><strong lang="ne">नमस्ते</strong><span class="latin-guide">namaste</span><small>Hello</small></button><button class="quiet phrase-reply" data-market-action="wrong-greeting"><strong lang="ne">अगाडि</strong><span class="latin-guide">agadi</span><small>Forward</small></button></div>`;
    else if(stage==='brief'){
      content+=`<p>${conversation.message??activity.request}</p>`;
      if(activity.id==='family')content+='<div class="market-direction-note"><strong lang="ne">दायाँ → पछाडि</strong><span class="latin-guide">daaya → pachhadi</span><small>Face the shop → right toward the bakery → behind the planter</small></div><p>Find the red teddy in the street and bring it back. You can look down and pick it up.</p>';
      else content+=`<div class="market-order-note"><span>${activity.id==='bread'?'THE PRICE · ONE-RUPEE COINS':'THE ORDER'}</span><strong lang="ne">${number.word}</strong><span class="latin-guide">${number.roman}</span><small>${activity.id==='bread'?'rupees':activity.item}</small></div><p>${activity.id==='bread'?'Place coins from your wallet onto the counter, then pay the baker.':'Pick the actual items from the counter, then hand them over.'}</p>`;
      content+=`<button class="primary" data-market-action="start-task">${activity.id==='family'?'I’ll find the teddy ↗':activity.id==='bread'?'Open my coin purse ↗':'Let me help ↗'}</button>`;
    }
    else if(stage==='thanks')content+=`<p>“${activity.done}”</p><div class="market-phrase-tip"><span class="eyebrow">A NEW LITTLE PHRASE</span><strong lang="ne">धन्यवाद</strong><span class="latin-guide">dhanyabaad</span><small>Thank you · Use it to thank someone who helps you.</small></div><button class="primary" data-market-action="thanks">Say thank you ↗</button>`;
    else content+=`<p>“${activity.id==='family'?'धन्यवाद! You found the teddy. You made our morning!':'See you around the neighborhood!'}”</p><p class="market-receipt">✓ ${activity.id==='family'?'Toy returned · Greetings & directions practiced':activity.id==='bread'?`Loaf bought · ${this.wallet} rupees left`:`${activity.count} ${activity.item} packed · Greetings & numbers practiced`}</p><button class="primary" data-market-action="leave">Keep exploring ↗</button>`;
    content+='<p role="status" aria-live="polite"></p>';this.dialogue.innerHTML=content;this.dialogue.querySelector<HTMLElement>('#market-dialogue-title')!.focus({preventScroll:true});
  }
  private toyNearby(){
    const dx=lostToy.x-this.pose.x,dz=lostToy.z-this.pose.z,distance=Math.hypot(dx,dz);
    return distance<2.3&&(-Math.sin(this.pose.yaw)*dx-Math.cos(this.pose.yaw)*dz)/Math.max(.01,distance)>.15;
  }
  /** Two pick buttons that show only a color swatch, so the learner must know which color the Nepali word names. */
  private pickButtons(id:'fruit'|'flowers'|ActivityId){
    const colors=pickColors[id as 'fruit'|'flowers'],noun=id==='fruit'?'apple':'flower';
    const button=(kind:'right'|'wrong')=>`<button class="quiet market-swatch-pick" data-market-action="task-pick" data-pick="${kind}" data-task-near aria-label="Pick up a ${kind==='right'?colors.english:colors.otherEnglish} ${noun}"><i style="--swatch:${kind==='right'?colors.hex:colors.other}" aria-hidden="true"></i>Pick up</button>`;
    return id==='fruit'?button('wrong')+button('right'):button('right')+button('wrong');
  }
  private atTask(){return !!this.activeTask&&nearbyActivity(this.pose)?.id===this.activeTask;}
  private renderTask(){
    const task=this.activeTask?this.tasks.get(this.activeTask):undefined;this.taskBoard.hidden=!task;if(!task)return;
    const activity=marketActivities.find(item=>item.id===task.id)!;this.taskBoard.dataset.kind=task.id;
    let content=`<header><span class="eyebrow">${activity.name}</span><button data-market-action="task-pause" class="quiet">Put task aside</button></header><h3>${task.id==='family'?'Bring a friend home.':task.id==='bread'?'Coins on the counter.':'Make it with your hands.'}</h3>`;
    if(task.delivered)content+='<p>Your order is ready. Speak to the vendor to finish the exchange.</p><button class="primary" data-market-action="task-give" data-task-near>Speak to the vendor</button>';
    else if(task.id==='family')content+=task.carryingToy?'<p>You’re holding the red teddy. Take it back to the family.</p><button class="primary" data-market-action="task-give" data-task-near>Return the teddy ↗</button>':'<p>Face the shop. Go <strong>right · दायाँ</strong> toward the bakery. Look <strong>behind · पछाडि</strong> the planter past it.</p><button class="primary" data-market-action="toy-pick">Pick up the red teddy</button>';
    else if(task.id==='bread')content+=`<p>Price: <strong lang="ne">तीन</strong> <span class="latin-guide">(teen)</span> rupees</p><div class="coin-purse" aria-label="Coin purse">${Array.from({length:this.wallet},(_,i)=>`<button class="rupee-coin ${i<task.coins?'is-placed':''}" data-market-action="coin-add" data-task-near data-fixed-disabled="${i<task.coins}" aria-label="Place one rupee" ${i<task.coins?'disabled':''}><span>रू</span><strong>1</strong></button>`).join('')}</div><p id="coin-total">${task.coins} coins on the counter · ${this.wallet-task.coins} in your purse</p><div class="task-buttons"><button class="quiet" data-market-action="coin-remove" data-task-near>Take back a coin</button><button class="primary" data-market-action="task-give" data-task-near>Pay the baker ↗</button></div>`;
    else content+=`<p>Pick <strong lang="ne">${numbers[activity.count-1].word} ${pickColors[task.id].word}</strong> <span class="latin-guide">(${numbers[activity.count-1].roman} ${pickColors[task.id].roman})</span> ${activity.item}${task.id==='flowers'?' from the vase on your left · बायाँ':''}. Click them on the counter or use the buttons.</p><p class="task-inventory" id="picked-total">${task.picked.length} ${activity.item} in your hands</p><div class="task-buttons">${this.pickButtons(task.id)}<button class="quiet" data-market-action="task-return" data-task-near>Put one back</button><button class="primary" data-market-action="task-give" data-task-near>Hand over ↗</button></div>`;
    content+='<p class="task-distance-note">Walk up to the person or counter to act. You can leave and come back.</p>';this.taskBoard.innerHTML=content;
  }
  private pickWorldItem(key?:string){
    if(this.paused||this.conversation)return;
    if(key==='lost-toy'){
      if(!this.toyNearby()||this.completed.has('family'))return;
      const task=this.tasks.get('family')??{id:'family',picked:[],coins:0,carryingToy:false};
      if(task.carryingToy)return;
      if(this.scene&&!this.scene.market.pickToy(this.pose))return;
      task.carryingToy=true;this.tasks.set('family',task);this.activeTask='family';this.tracked='family';
      this.scene?.setMarketCarry('toy');this.status.textContent='You picked up the teddy. Bring it back to the family.';this.renderTask();this.focusWorld();return;
    }
    const task=this.activeTask?this.tasks.get(this.activeTask):undefined;
    if(!task||(task.id!=='fruit'&&task.id!=='flowers')||!this.atTask())return;
    if(task.delivered)return;
    // Distractors teach the color word: say what was picked and what was asked for.
    if(key?.startsWith('flowers-wrong')){this.status.textContent='Those are सेतो (white) flowers, on your right. Tara asked for पहेँलो (yellow) ones from the left vase · बायाँ.';this.scene?.market.react('flowers','point',this.pose);return;}
    if(key?.startsWith('fruit-wrong')){this.status.textContent='That apple is हरियो (green). Maya asked for रातो (red) apples.';this.scene?.market.react('fruit','point',this.pose);return;}
    if(task.picked.length>=5){this.status.textContent='Your hands are full. Hand these over or put one back.';return;}
    const item=key??this.scene?.market.availableItem(task.id)??`${task.id}-${task.picked.length}`;
    if(!item.startsWith(`${task.id}-`)||task.picked.includes(item))return;
    if(this.scene&&!this.scene.market.pickItem(item,this.pose))return;
    task.picked.push(item);this.scene?.setMarketCarry(task.id,task.picked.length);this.scene?.market.react(task.id,'pack',this.pose);
    this.status.textContent=`You picked up ${task.id==='fruit'?'an apple':'a flower'}. ${task.picked.length} in your basket.`;
    this.renderTask();this.focusWorld();
  }
  private returnOne(){
    const task=this.activeTask?this.tasks.get(this.activeTask):undefined;if(!task||!this.atTask()||task.delivered)return;
    const item=task.picked.pop();if(item)this.scene?.market.returnItem(item);
    if(task.id==='fruit'||task.id==='flowers')this.scene?.setMarketCarry(task.id,task.picked.length);
    this.renderTask();this.focusWorld();
  }
  private changeCoins(delta:number){
    const task=this.tasks.get('bread');if(this.activeTask!=='bread'||!task||!this.atTask()||task.delivered)return;
    task.coins=Math.max(0,Math.min(this.wallet,task.coins+delta));this.scene?.market.setCoins(task.coins,this.pose);this.scene?.market.react('bread','receive',this.pose);
    this.renderTask();this.focusWorld();
  }
  private deliverTask(){
    const task=this.activeTask?this.tasks.get(this.activeTask):undefined;if(!task||!this.atTask())return;
    const activity=marketActivities.find(item=>item.id===task.id)!;
    this.clearKeys();
    if(task.id==='family'){
      if(!task.carryingToy){this.status.textContent='Look behind the bakery planter for the red teddy.';return;}
      this.scene?.setMarketCarry(undefined);this.scene?.market.handover('family',this.pose);this.finishActivity(activity);
      this.conversation={activity,stage:'done'};this.host.dataset.mode='conversation';this.renderConversation();return;
    }
    const count=task.id==='bread'?task.coins:task.picked.length;
    if(count!==activity.count){
      this.scene?.market.react(activity.id,'receive',this.pose);
      this.conversation={activity,stage:'brief',message:`“Not quite. ${numbers[activity.count-1].word} means ${activity.count}. You brought ${count}. ${count>activity.count?'Put one back':'Add a little more'}, then try again.”`};
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
    this.updateProgress();this.renderTask();
  }
  private closeConversation(wave=true){
    if(wave&&this.conversation)this.scene?.market.react(this.conversation.activity.id,'bye',this.pose);
    this.conversation=undefined;this.dialogue.hidden=true;this.dialogue.replaceChildren();this.host.dataset.mode='roam';this.clearKeys();this.renderTask();this.focusWorld();
  }
  private updateProgress(){
    const count=marketActivities.filter(activity=>activity.required&&this.completed.has(activity.id)).length;
    this.host.querySelector('#market-progress')!.textContent=count===3?'Finale complete. Keep exploring!':`${count} / 3 stalls visited · Choose any order`;
    this.completed.forEach(id=>{const label=this.host.querySelector(`#visit-${id}`);if(label)label.textContent='✓ Visited · Practice again anytime';});
  }
  dispose(){
    cancelAnimationFrame(this.raf);this.clearKeys();
    window.removeEventListener('keydown',this.keyDown);window.removeEventListener('keyup',this.keyUp);window.removeEventListener('blur',this.clearKeys);document.removeEventListener('visibilitychange',this.clearKeys);
    this.host.removeEventListener('click',this.click);this.host.removeEventListener('pointerdown',this.touchDown);this.host.removeEventListener('pointerup',this.touchUp);this.host.removeEventListener('pointercancel',this.touchUp);this.host.removeEventListener('lostpointercapture',this.touchUp);
    this.canvas?.removeEventListener('pointerdown',this.lookDown);this.canvas?.removeEventListener('pointermove',this.lookMove);this.canvas?.removeEventListener('pointerup',this.lookUp);this.canvas?.removeEventListener('pointercancel',this.lookUp);
    if(this.scene){this.scene.onMarketInteract=undefined;this.scene.onMarketItem=undefined;this.scene.setMarketCarry(undefined);}
    this.host.hidden=true;this.host.replaceChildren();
  }
}
