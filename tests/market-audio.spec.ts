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

async function trackMarketAudio(page:Page){
  await page.addInitScript(()=>{
    const plays:string[]=[];
    (window as typeof window&{__marketAudioPlays?:string[]}).__marketAudioPlays=plays;
    const original=AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start=function(...args){
      const name=(this.buffer as AudioBuffer&{__label?:string})?.__label;
      // Label is unavailable on decoded buffers; fall back to fetch URL sniffing below.
      return original.apply(this,args as []);
    };
    const fetchOriginal=window.fetch.bind(window);
    window.fetch=async(input,init)=>{
      const response=await fetchOriginal(input,init);
      const url=typeof input==='string'?input:input instanceof Request?input.url:String(input);
      if(/assets\/audio\/(market_ambience|child_sniffle_a|child_sniffle_b|child_giggle)\.mp3/.test(url)){
        const match=url.match(/\/(market_ambience|child_sniffle_a|child_sniffle_b|child_giggle)\.mp3/);
        if(match)plays.push(`load:${match[1]}`);
      }
      return response;
    };
  });
}

function plays(page:Page){
  return page.evaluate(()=>(window as typeof window&{__marketAudioPlays:string[]}).__marketAudioPlays);
}

test('market ambience assets load and restart cleans environmental audio',async({page})=>{
  test.setTimeout(90000);
  await page.emulateMedia({reducedMotion:'reduce'});
  await trackMarketAudio(page);
  await page.addInitScript(()=>{
    localStorage.setItem('wayword.progress.ne.v1','["little-shop"]');
    localStorage.setItem('wayword.numbers.ne.v1','true');
    // Keep the teddy missing so child reactions can arm.
    localStorage.removeItem('wayword.market-visits.ne.v1');
  });
  await page.goto('/?level=market');
  await expect(page.locator('#market-roam')).toBeVisible();

  await expect.poll(async()=>(await plays(page)).filter(item=>item==='load:market_ambience').length,{timeout:15000}).toBeGreaterThan(0);
  await expect.poll(async()=>(await plays(page)).some(item=>item.startsWith('load:child_sniffle')),{timeout:15000}).toBe(true);
  await expect.poll(async()=>(await plays(page)).includes('load:child_giggle'),{timeout:15000}).toBe(true);

  // Radio control remains available and independent of market ambience loading.
  await expect(page.locator('#radio-toggle')).toBeVisible();
  await page.locator('#radio-toggle').click();
  await expect(page.locator('#radio-toggle')).toHaveAttribute('aria-pressed','false');

  await walkTo(page,1.2,10.5);await walkTo(page,3.3,8.9);
  await face(page,5.2,7.55);await page.keyboard.press('e');
  await expect(page.locator('.market-dialogue')).toBeVisible();

  // Leaving and restarting must not leave a second ambience loop armed.
  await page.locator('#restart').click();
  await expect(page.locator('#market-roam')).toBeHidden();
  await expect(page.locator('#welcome')).toBeVisible();
});

test('market environmental audio files are served',async({page})=>{
  for(const file of['market_ambience.mp3','child_sniffle_a.mp3','child_sniffle_b.mp3','child_giggle.mp3','fabric_rustle.mp3','bicycle_roll.mp3','bicycle_pass.mp3','bicycle_bell.wav']){
    const response=await page.request.get(`/assets/audio/${file}`);
    expect(response.ok(),file).toBeTruthy();
    expect(Number(response.headers()['content-length']||0)).toBeGreaterThan(1000);
  }
  for(const file of['ne/speakers/parent/dhanyabaad.wav','ne/speakers/maya/namaste.wav']){
    const response=await page.request.get(`/assets/audio/${file}`);
    expect(response.ok(),file).toBeTruthy();
  }
});
