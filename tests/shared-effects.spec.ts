import {expect,test,type Page} from '@playwright/test';

type EffectCounts={steps:number};

async function countFootsteps(page:Page){
  await page.evaluate(async()=>{
    const {EffectsController}=await import('/src/effects.ts');
    const original=EffectsController.prototype.footstep;
    (window as typeof window&{__sharedEffectCounts?:EffectCounts}).__sharedEffectCounts={steps:0};
    EffectsController.prototype.footstep=function(){
      (window as typeof window&{__sharedEffectCounts:EffectCounts}).__sharedEffectCounts.steps++;
      original.call(this);
    };
  });
}

async function steps(page:Page){
  return page.evaluate(()=>(window as typeof window&{__sharedEffectCounts:EffectCounts}).__sharedEffectCounts.steps);
}

test('courtyard footsteps follow translation and stop for standing or turning',async({page})=>{
  await page.addInitScript(()=>{
    const starts:{offset:number;duration?:number}[]=[];
    (window as typeof window&{__audioStarts?:typeof starts}).__audioStarts=starts;
    const original=AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start=function(when=0,offset=0,duration?:number){
      starts.push({offset,duration});
      return duration===undefined?original.call(this,when,offset):original.call(this,when,offset,duration);
    };
  });
  await page.goto('/?level=moving-in');
  await page.getByRole('button',{name:'Step into the courtyard'}).click();
  await countFootsteps(page);

  await page.keyboard.down('w');await page.waitForTimeout(80);await page.keyboard.up('w');
  expect(await steps(page)).toBe(1);
  const footstepStart=await page.evaluate(()=>(window as typeof window&{__audioStarts:{offset:number;duration?:number}[]}).__audioStarts.find(start=>start.offset>.3));
  expect(footstepStart?.offset).toBeCloseTo(.372,3);
  expect(footstepStart?.duration).toBeCloseTo(.16,3);

  const stopped=await steps(page);await page.waitForTimeout(650);expect(await steps(page)).toBe(stopped);
  for(let i=0;i<2;i++){await page.keyboard.down('w');await page.waitForTimeout(80);await page.keyboard.up('w');await page.waitForTimeout(180);}
  expect(await steps(page)).toBe(stopped+2);
  const beforeContinuous=await steps(page);
  await page.keyboard.down('w');await page.waitForTimeout(1150);await page.keyboard.up('w');
  expect(await steps(page)).toBeGreaterThanOrEqual(beforeContinuous+3);
  await page.keyboard.down('ArrowLeft');await page.waitForTimeout(400);await page.keyboard.up('ArrowLeft');
  const afterWalking=await steps(page);await page.waitForTimeout(250);expect(await steps(page)).toBe(afterWalking);
});

test('blocked courtyard movement does not schedule footsteps',async({page})=>{
  await page.goto('/?level=moving-in');
  await page.getByRole('button',{name:'Step into the courtyard'}).click();
  await countFootsteps(page);
  await page.keyboard.down('s');await page.waitForTimeout(600);await page.keyboard.up('s');
  const atBoundary=await steps(page);
  expect(atBoundary).toBeGreaterThan(0);
  await page.keyboard.down('s');await page.waitForTimeout(450);await page.keyboard.up('s');
  expect(await steps(page)).toBe(atBoundary);
});

test('market footsteps stop while standing, turning, and the number review is open',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>{
    localStorage.setItem('wayword.progress.ne.v1','["little-shop"]');
    localStorage.setItem('wayword.numbers.ne.v1','true');
  });
  await page.goto('/?level=market');
  await expect(page.locator('#market-roam')).toBeVisible();
  await countFootsteps(page);

  await page.keyboard.down('w');await page.waitForTimeout(650);await page.keyboard.up('w');
  expect(await steps(page)).toBeGreaterThan(0);

  const stopped=await steps(page);await page.waitForTimeout(650);expect(await steps(page)).toBe(stopped);
  await page.keyboard.down('ArrowLeft');await page.waitForTimeout(400);await page.keyboard.up('ArrowLeft');
  expect(await steps(page)).toBe(stopped);

  await page.getByRole('button',{name:'Review numbers 1–5'}).click();
  await page.keyboard.down('w');await page.waitForTimeout(400);await page.keyboard.up('w');
  expect(await steps(page)).toBe(stopped);
});

test('tap feedback can be muted independently and persists across chapters',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('wayword.progress.ne.v1','["moving-in","second-lesson","little-shop"]'));
  await page.goto('/?level=shop');
  await page.evaluate(async()=>{
    const {EffectsController}=await import('/src/effects.ts'),original=EffectsController.prototype.tap;
    (window as typeof window&{__tapCount?:number}).__tapCount=0;
    EffectsController.prototype.tap=function(){
      (window as typeof window&{__tapCount:number}).__tapCount++;
      original.call(this);
    };
  });
  const tapToggle=page.getByRole('button',{name:'Mute tap sounds'});
  const radio=page.locator('#radio-toggle');

  await page.getByRole('button',{name:'Say namaste to the shopkeeper'}).click();
  expect(await page.evaluate(()=>(window as typeof window&{__tapCount:number}).__tapCount)).toBe(1);
  await tapToggle.click();
  await expect(page.getByRole('button',{name:'Turn tap sounds on'})).toHaveText('Tap: Off');
  expect(await radio.getAttribute('aria-pressed')).toBe('true');

  const mutedCount=await page.evaluate(()=>(window as typeof window&{__tapCount:number}).__tapCount);
  await page.getByRole('button',{name:'Learn the four words'}).click();
  expect(await page.evaluate(()=>(window as typeof window&{__tapCount:number}).__tapCount)).toBe(mutedCount);
  await radio.click();
  await expect(radio).toHaveAttribute('aria-pressed','false');
  expect(await page.evaluate(()=>(window as typeof window&{__tapCount:number}).__tapCount)).toBe(mutedCount);

  await page.reload();
  await expect(page.getByRole('button',{name:'Turn tap sounds on'})).toHaveText('Tap: Off');
  await page.goto('/?level=second-lesson');
  await expect(page.getByRole('button',{name:'Turn tap sounds on'})).toHaveText('Tap: Off');
  await page.getByRole('button',{name:'Turn tap sounds on'}).click();
  await expect(page.getByRole('button',{name:'Mute tap sounds'})).toHaveText('Tap: On');
});

test('object bumps play once on contact, need separation, and skip when speech is busy',async({page})=>{
  type BumpProbe={plays:number;busySkipped:number};
  await page.goto('/?level=moving-in');
  await page.getByRole('button',{name:'Step into the courtyard'}).click();
  await page.evaluate(async()=>{
    const {EffectsController}=await import('/src/effects.ts');
    const probe=(window as typeof window&{__bumpProbe?:BumpProbe}).__bumpProbe={plays:0,busySkipped:0};
    const original=EffectsController.prototype.noteBump;
    EffectsController.prototype.noteBump=function(kind){
      const before=this.bumpAt as number;
      original.call(this,kind);
      if((this.bumpAt as number)!==before)probe.plays++;
    };
  });

  await page.keyboard.down('s');
  await page.waitForTimeout(1000);
  await page.keyboard.up('s');
  const afterContact=await page.evaluate(()=>(window as typeof window&{__bumpProbe:BumpProbe}).__bumpProbe.plays);
  expect(afterContact).toBe(1);

  await page.keyboard.down('s');
  await page.waitForTimeout(700);
  await page.keyboard.up('s');
  expect(await page.evaluate(()=>(window as typeof window&{__bumpProbe:BumpProbe}).__bumpProbe.plays)).toBe(1);

  await page.keyboard.down('w');
  await page.waitForTimeout(450);
  await page.keyboard.up('w');
  await page.waitForTimeout(2100);

  await page.evaluate(async()=>{
    const {EffectsController}=await import('/src/effects.ts');
    const probe=(window as typeof window&{__bumpProbe:BumpProbe}).__bumpProbe;
    const original=EffectsController.prototype.noteBump;
    EffectsController.prototype.noteBump=function(kind){
      this.setSpeechBusy(true);
      const before=this.bumpAt as number;
      original.call(this,kind);
      if(kind==='object'&&(this.bumpAt as number)===before)probe.busySkipped++;
      this.setSpeechBusy(false);
    };
  });
  await page.keyboard.down('s');
  await page.waitForTimeout(700);
  await page.keyboard.up('s');
  const probe=await page.evaluate(()=>(window as typeof window&{__bumpProbe:BumpProbe}).__bumpProbe);
  expect(probe.plays).toBe(1);
  expect(probe.busySkipped).toBeGreaterThan(0);
});

test('shop blocked forward steps report an object bump',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('wayword.progress.ne.v1','["moving-in","second-lesson"]'));
  await page.goto('/?level=shop');
  await page.getByRole('button',{name:'Say namaste to the shopkeeper'}).click();
  await page.getByRole('button',{name:'Learn the four words'}).click();
  await page.getByRole('button',{name:'Let’s try it in the shop'}).click();
  for(const key of['ArrowRight','ArrowLeft','ArrowUp','ArrowDown']){
    await page.keyboard.press(key);
    await page.waitForTimeout(700);
  }
  await expect(page.locator('#app')).toHaveAttribute('data-phase','shop');
  await page.evaluate(async()=>{
    const {EffectsController}=await import('/src/effects.ts');
    (window as typeof window&{__shopBumpPlays?:number}).__shopBumpPlays=0;
    const original=EffectsController.prototype.noteBump;
    EffectsController.prototype.noteBump=function(kind){
      const before=this.bumpAt as number;
      original.call(this,kind);
      if((this.bumpAt as number)!==before)(window as typeof window&{__shopBumpPlays:number}).__shopBumpPlays++;
    };
  });
  // Face south into the entrance wall / door lock and press forward until blocked.
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  for(let i=0;i<4;i++)await page.keyboard.press('ArrowUp');
  expect(await page.evaluate(()=>(window as typeof window&{__shopBumpPlays:number}).__shopBumpPlays)).toBeGreaterThan(0);
  const afterFirst=await page.evaluate(()=>(window as typeof window&{__shopBumpPlays:number}).__shopBumpPlays);
  await page.keyboard.press('ArrowUp');
  expect(await page.evaluate(()=>(window as typeof window&{__shopBumpPlays:number}).__shopBumpPlays)).toBe(afterFirst);
});
