import { test, expect, type Page } from '@playwright/test';

async function pose(page:Page){return page.locator('#market-roam').evaluate(element=>({x:Number((element as HTMLElement).dataset.marketX),z:Number((element as HTMLElement).dataset.marketZ),yaw:Number((element as HTMLElement).dataset.marketYaw)}));}
async function face(page:Page,x:number,z:number){
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  const current=await pose(page);let delta=Math.atan2(-(x-current.x),-(z-current.z))-current.yaw;delta=Math.atan2(Math.sin(delta),Math.cos(delta));
  while(Math.abs(delta)>.01){const part=Math.sign(delta)*Math.min(.5,Math.abs(delta));await page.mouse.move(640,390);await page.mouse.down();await page.mouse.move(640-part/.004,390,{steps:3});await page.mouse.up();delta-=part;}
  await page.waitForTimeout(60);
}
async function walkTo(page:Page,x:number,z:number){
  for(let attempt=0;attempt<35;attempt++){
    const current=await pose(page),distance=Math.hypot(current.x-x,current.z-z);if(distance<.35)return;
    await face(page,x,z);await page.keyboard.down('w');await page.waitForTimeout(Math.min(1000,Math.max(70,(distance-.15)/2.8*1000)));await page.keyboard.up('w');await page.waitForTimeout(40);
  }
}

test('learners can greet Maya in their own words; the AI neighbor decides when it counts',async({page})=>{
  test.setTimeout(90000);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>{localStorage.setItem('wayword.progress.ne.v1','["little-shop"]');localStorage.setItem('wayword.numbers.ne.v1','true');});
  // A stand-in for the AI: English is gently refused, Nepali in Latin letters is accepted.
  const asked:Record<string,unknown>[]=[];
  await page.route('**/api/shopkeeper',async route=>{
    const body=route.request().postDataJSON() as Record<string,unknown>;asked.push(body);
    const ok=/namaste|hunchha|huncha/i.test(String(body.message));
    await route.fulfill({json:ok
      ?{nepali:'नमस्ते! स्वागत छ।',roman:'namaste! swaagat chha.',english:'Hello! Welcome.',tip:'',success:true}
      :{nepali:'हजुर?',roman:'hajur?',english:'Pardon?',tip:'Try saying hello in Nepali: namaste.',success:false}});
  });
  await page.goto('/?level=market&ai');
  await expect(page.locator('#market-roam')).toBeVisible();
  await walkTo(page,1.2,10.5);await walkTo(page,11.2,10.5);await walkTo(page,11.2,7.8);
  await face(page,11.2,5.35);await page.keyboard.press('e');
  const input=page.getByRole('textbox',{name:'Or say it in your own words'});
  await expect(input).toBeVisible();

  // Typing in English: Maya answers in character with a tip, and the step does not advance.
  await input.fill('hello');await input.press('Enter');
  await expect(page.locator('.ai-line')).toContainText('हजुर?');
  await expect(page.locator('.ai-tip')).toContainText('namaste');
  await expect(page.locator('.market-dialogue')).toHaveAttribute('data-stage','greet');
  await page.screenshot({path:'test-results/market-ai-tip.png'});

  // Typing namaste counts as greeting her: the conversation moves on exactly like tapping नमस्ते.
  await page.getByRole('textbox',{name:'Or say it in your own words'}).fill('namaste');
  await page.getByRole('textbox',{name:'Or say it in your own words'}).press('Enter');
  await expect(page.locator('.market-dialogue')).toHaveAttribute('data-stage','brief');
  await expect(page.locator('.ai-line')).toContainText('स्वागत');
  await page.screenshot({path:'test-results/market-ai-greeted.png'});

  // Agreeing in her language starts the errand.
  await page.getByRole('textbox',{name:'Or say it in your own words'}).fill('huncha');
  await page.getByRole('textbox',{name:'Or say it in your own words'}).press('Enter');
  await expect(page.locator('#market-roam')).toHaveAttribute('data-mode','roam');
  await expect(page.locator('.market-task [data-kind=number]')).toContainText('दुई');

  // The neighbor is told how the learner is doing, so it can adapt its support.
  expect(asked[0]).toMatchObject({neighbor:'fruit',stage:'greet',message:'hello',mistakes:0});
  expect(asked[1]).toMatchObject({stage:'greet',message:'namaste',mistakes:1});
  expect((asked[1].history as unknown[]).length).toBe(2);
});

test('without an AI key, typing hides itself and the word buttons still work',async({page})=>{
  test.setTimeout(90000);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>{localStorage.setItem('wayword.progress.ne.v1','["little-shop"]');localStorage.setItem('wayword.numbers.ne.v1','true');});
  await page.route('**/api/shopkeeper',route=>route.fulfill({status:503,json:{error:'not-configured'}}));
  await page.goto('/?level=market&ai');
  await walkTo(page,1.2,10.5);await walkTo(page,11.2,10.5);await walkTo(page,11.2,7.8);
  await face(page,11.2,5.35);await page.keyboard.press('e');
  const input=page.getByRole('textbox',{name:'Or say it in your own words'});
  await input.fill('namaste');await input.press('Enter');
  await expect(page.locator('.ai-status')).toContainText('isn’t set up');
  await expect(input).toBeHidden();
  await page.getByRole('button',{name:'Hello',exact:false}).click();
  await expect(page.locator('.market-dialogue')).toHaveAttribute('data-stage','brief');
});
