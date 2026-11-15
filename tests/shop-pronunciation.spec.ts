import {expect,test,type Page} from '@playwright/test';

/** Our two-step word lesson: try all four words, pass the quick check, then enter the shop. */
async function passWordLesson(page:import('@playwright/test').Page){
  for(const word of['right','left','forward','backward'])await page.locator(`[data-word="${word}"]`).click();
  await page.locator('#lesson-next').click();
  const keys:Record<string,string>={left:'ArrowLeft',right:'ArrowRight',forward:'ArrowUp',backward:'ArrowDown'};
  while(await page.locator('#begin').isHidden()){
    const done=await page.locator('.quiz-score i.done').count();
    await page.keyboard.press(keys[(await page.locator('#quiz-word').getAttribute('data-expect'))!]);
    await page.waitForFunction(count=>document.querySelectorAll('.quiz-score i.done').length>count||!document.querySelector('#begin')?.hasAttribute('hidden'),done);
  }
}

async function openShop(page:Page){
  await page.addInitScript(()=>localStorage.setItem('wayword.progress.ne.v1','["moving-in","second-lesson","counting","letters"]'));
  await page.goto('/?level=shop');
}

async function trackClips(page:Page){
  await page.addInitScript(()=>{
    const plays:string[]=[];
    (window as typeof window&{__pronunciationPlays?:string[]}).__pronunciationPlays=plays;
    const original=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(...args){
      if(this instanceof HTMLMediaElement&&/\/assets\/audio\/ne\/.+\.wav/.test(this.src)){
        const match=this.src.match(/\/ne\/([^/?#]+)\.wav/);
        if(match)plays.push(match[1]);
      }
      return original.apply(this,args as []);
    };
  });
}

function plays(page:Page){
  return page.evaluate(()=>(window as typeof window&{__pronunciationPlays:string[]}).__pronunciationPlays);
}

test('greeting and four direction cards pronounce Nepali words without overlap',async({page})=>{
  await trackClips(page);
  await openShop(page);

  const greeting=page.getByRole('button',{name:/Hear नमस्ते pronounced/});
  await expect(greeting).toBeVisible();
  await greeting.click();
  await expect.poll(async()=>(await plays(page)).filter(clip=>clip==='namaste').length).toBe(1);
  await expect(greeting).toHaveClass(/is-speaking/);

  await greeting.click();
  await expect.poll(async()=>(await plays(page)).filter(clip=>clip==='namaste').length).toBe(2);

  await page.getByRole('button',{name:'Learn the four words'}).click();
  await expect(page.getByRole('heading',{name:'Find your bearings.'})).toBeVisible();

  for(const [label,clip] of[
    ['Hear दायाँ pronounced','daaya'],
    ['Hear बायाँ pronounced','baaya'],
    ['Hear अगाडि pronounced','agadi'],
    ['Hear पछाडि pronounced','pachhadi'],
  ] as const){
    const before=(await plays(page)).filter(name=>name===clip).length;
    await page.getByRole('button',{name:new RegExp(label)}).click();
    await expect.poll(async()=>(await plays(page)).filter(name=>name===clip).length).toBe(before+1);
  }

  const beforeRepeat=(await plays(page)).filter(name=>name==='agadi').length;
  await page.getByRole('button',{name:/Hear अगाडि pronounced/}).click();
  await expect.poll(async()=>(await plays(page)).filter(name=>name==='agadi').length).toBe(beforeRepeat+1);
  expect((await plays(page)).every(clip=>['namaste','daaya','baaya','agadi','pachhadi'].includes(clip))).toBe(true);
});

test('direction cards support keyboard activation and cancel on navigation',async({page})=>{
  await trackClips(page);
  await openShop(page);
  await page.getByRole('button',{name:/Hear नमस्ते pronounced/}).click();
  await page.getByRole('button',{name:'Learn the four words'}).click();

  const forward=page.getByRole('button',{name:/Hear अगाडि pronounced/});
  await forward.focus();
  await page.keyboard.press('Enter');
  await expect.poll(async()=>(await plays(page)).filter(name=>name==='agadi').length).toBeGreaterThan(0);
  await expect(forward).toHaveAttribute('aria-pressed','true');

  await page.keyboard.press(' ');
  await expect.poll(async()=>(await plays(page)).filter(name=>name==='agadi').length).toBeGreaterThanOrEqual(2);

  await passWordLesson(page);
  await page.getByRole('button',{name:'Let’s try it in the shop'}).click();
  await expect(page.locator('#app')).toHaveAttribute('data-phase','practice');
  const afterLeave=await plays(page);
  await page.waitForTimeout(400);
  expect(await plays(page)).toEqual(afterLeave);

  await page.getByRole('button',{name:'Start over'}).click();
  await expect(page.getByRole('button',{name:/Hear नमस्ते pronounced/})).toBeVisible();
});

test('shop pronunciation assets are served for production paths',async({request})=>{
  for(const clip of['namaste','agadi','baaya','daaya','pachhadi']){
    const response=await request.get(`/assets/audio/ne/${clip}.wav`);
    expect(response.ok(),clip).toBeTruthy();
    expect(response.headers()['content-type']??'').toMatch(/audio|wav|octet-stream/i);
  }
});
