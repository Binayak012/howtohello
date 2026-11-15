import {expect,test,type Page} from '@playwright/test';

async function pose(page:Page){
  return page.locator('#market-roam').evaluate(element=>({
    x:Number((element as HTMLElement).dataset.marketX),
    z:Number((element as HTMLElement).dataset.marketZ),
    yaw:Number((element as HTMLElement).dataset.marketYaw),
  }));
}

async function face(page:Page,x:number,z:number){
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  const current=await pose(page);
  const desired=Math.atan2(-(x-current.x),-(z-current.z));
  let delta=Math.atan2(Math.sin(desired-current.yaw),Math.cos(desired-current.yaw));
  while(Math.abs(delta)>.01){
    const part=Math.sign(delta)*Math.min(.5,Math.abs(delta));
    await page.mouse.move(640,390);await page.mouse.down();await page.mouse.move(640-part/.004,390,{steps:3});await page.mouse.up();
    delta-=part;
  }
  await page.waitForTimeout(60);
}

async function walkTo(page:Page,x:number,z:number){
  for(let attempt=0;attempt<35;attempt++){
    const current=await pose(page),distance=Math.hypot(current.x-x,current.z-z);
    if(distance<.35)return;
    await face(page,x,z);await page.keyboard.down('w');
    await page.waitForTimeout(Math.min(1000,Math.max(70,(distance-.15)/2.8*1000)));
    await page.keyboard.up('w');await page.waitForTimeout(40);
  }
  const current=await pose(page);
  expect(Math.hypot(current.x-x,current.z-z)).toBeLessThan(.35);
}

async function trackClips(page:Page){
  await page.addInitScript(()=>{
    const plays:string[]=[];
    (window as typeof window&{__pronunciationPlays?:string[]}).__pronunciationPlays=plays;
    const note=(url:string)=>{
      const speaker=url.match(/\/ne\/speakers\/([^/]+)\/([^/?#]+)\.wav/);
      if(speaker){plays.push(`${speaker[1]}:${speaker[2]}`);return;}
      const shared=url.match(/\/ne\/([^/?#]+)\.wav/);
      if(shared)plays.push(`player:${shared[1]}`);
    };
    const original=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(...args){
      if(this instanceof HTMLMediaElement&&/\/assets\/audio\/ne\//.test(this.src))note(this.src);
      return original.apply(this,args as []);
    };
    const fetchOriginal=window.fetch.bind(window);
    window.fetch=async(input,init)=>{
      const url=typeof input==='string'?input:input instanceof Request?input.url:String(input);
      if(/\/assets\/audio\/ne\//.test(url)&&url.endsWith('.wav'))note(url);
      return fetchOriginal(input,init);
    };
  });
}

function plays(page:Page){
  return page.evaluate(()=>(window as typeof window&{__pronunciationPlays:string[]}).__pronunciationPlays);
}

test('market neighbors pronounce namaste, replies, and thank-yous',async({page})=>{
  test.setTimeout(90000);
  await page.emulateMedia({reducedMotion:'reduce'});
  await trackClips(page);
  await page.addInitScript(()=>{
    localStorage.setItem('wayword.progress.ne.v1','["little-shop"]');
    localStorage.setItem('wayword.numbers.ne.v1','true');
  });
  await page.goto('/?level=market');
  await expect(page.locator('#market-roam')).toBeVisible();

  await walkTo(page,1.2,10.5);await walkTo(page,11.2,10.5);await walkTo(page,11.2,7.8);
  await face(page,11.2,5.35);await page.keyboard.press('e');
  await expect(page.locator('.market-dialogue')).toBeVisible();
  // NPC greeting uses Maya’s voice, not the player’s shared Chitwan clip.
  await expect.poll(async()=>(await plays(page)).some(clip=>clip==='maya:namaste')).toBe(true);

  await page.getByRole('button',{name:'Forward',exact:false}).click();
  await expect.poll(async()=>(await plays(page)).includes('player:agadi')).toBe(true);

  await page.getByRole('button',{name:'Hello',exact:false}).click();
  await expect.poll(async()=>(await plays(page)).includes('player:namaste')).toBe(true);

  await page.getByRole('button',{name:'Thank you',exact:true}).click();
  await expect.poll(async()=>(await plays(page)).includes('player:dhanyabaad')).toBe(true);

  await page.getByRole('button',{name:'Let me help',exact:false}).click();
  await expect.poll(async()=>(await plays(page)).includes('player:hunchha')).toBe(true);

  const heard=await plays(page);
  expect(heard.some(clip=>clip.startsWith('maya:'))).toBe(true);
  expect(heard.some(clip=>clip.startsWith('player:'))).toBe(true);
});
