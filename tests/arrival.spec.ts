import {test,expect,type Page} from '@playwright/test';

async function pose(page:Page){return page.locator('#app').evaluate(element=>({x:Number((element as HTMLElement).dataset.arrivalX),z:Number((element as HTMLElement).dataset.arrivalZ),yaw:Number((element as HTMLElement).dataset.arrivalYaw)}));}
async function face(page:Page,x:number,z:number){
  const current=await pose(page),target=Math.atan2(-(x-current.x),-(z-current.z));let delta=Math.atan2(Math.sin(target-current.yaw),Math.cos(target-current.yaw));const viewport=page.viewportSize()!,cx=viewport.width/2,cy=viewport.height*.55;
  while(Math.abs(delta)>.01){const part=Math.sign(delta)*Math.min(.4,Math.abs(delta));await page.mouse.move(cx,cy);await page.mouse.down();await page.mouse.move(cx-part/.004,cy,{steps:3});await page.mouse.up();delta-=part;}
  await page.waitForTimeout(50);
}
async function walkTo(page:Page,x:number,z:number){
  for(let i=0;i<28;i++){const current=await pose(page),distance=Math.hypot(current.x-x,current.z-z);if(distance<.35)return;await face(page,x,z);await page.keyboard.down('w');await page.waitForTimeout(Math.min(850,Math.max(60,(distance-.16)/2.5*1000)));await page.keyboard.up('w');await page.waitForTimeout(35);}
  const current=await pose(page);expect(Math.hypot(current.x-x,current.z-z),JSON.stringify(current)).toBeLessThan(.35);
}
async function hostLesson(page:Page){
  await walkTo(page,-1.8,1.1);await face(page,-1.8,-1);await page.keyboard.press('e');
  await expect(page.locator('.arrival-dialogue')).toContainText('नमस्ते');
  await page.getByRole('button',{name:'Say namaste'}).click();
  await expect(page.locator('.arrival-dialogue')).toContainText('कृपया');
  await page.getByRole('button',{name:'Ask for the key politely'}).click();
  await expect(page.getByRole('button',{name:'Pick up your key',exact:false})).toBeEnabled();await page.keyboard.press('e');
  await expect(page.locator('.arrival-dialogue')).toContainText('धन्यवाद');await page.getByRole('button',{name:'Say thank you'}).click();
}

for(const phone of[false,true])test(`${phone?'phone':'desktop'}: move in through greetings, key handover, suitcase identification and the real door`,async({page})=>{
  test.setTimeout(120000);if(phone)await page.setViewportSize({width:390,height:844});
  if(phone)await page.emulateMedia({reducedMotion:'reduce'});
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await expect(page.getByRole('heading',{name:'Your first hello.',exact:true})).toBeVisible();
  await page.screenshot({path:`test-results/${phone?'phone':'desktop'}-moving-in-intro.png`});
  await page.getByRole('button',{name:'Step into the courtyard'}).click();
  await expect(page.locator('#app')).toHaveAttribute('data-phase','explore');await page.screenshot({path:`test-results/${phone?'phone':'desktop'}-courtyard.png`});
  await hostLesson(page);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('wayword.progress.ne.v1')??'[]'))).toEqual([]);
  await walkTo(page,-4.4,4);await face(page,-4.6,2.2);await page.keyboard.press('e');
  await page.getByRole('button',{name:'Thank you',exact:false}).click();
  await expect(page.locator('.arrival-dialogue [role=status]')).toContainText('Begin with');
  await page.getByRole('button',{name:'Hello',exact:false}).click();await page.getByRole('button',{name:'I’ll take a look'}).click();
  await walkTo(page,-3.6,2.8);await walkTo(page,-3.6,1);await walkTo(page,-4.2,1);await face(page,-5.5,-.6);await page.keyboard.press('e');
  await expect(page.locator('.arrival-pocket')).toContainText('Lila’s parcel');
  await face(page,-4.6,2.2);await page.keyboard.press('e');
  await expect(page.locator('.arrival-dialogue')).toContainText('recognize the phrase');await page.getByRole('button',{name:'Back to the courtyard'}).click();
  await walkTo(page,2.6,3.7);await face(page,4,3.4);await page.keyboard.press('e');
  await expect(page.locator('.arrival-dialogue')).toContainText('identification question');await page.getByRole('button',{name:'Let’s find my suitcase'}).click();
  await expect(page.getByRole('button',{name:'Yes, it is',exact:false})).toBeVisible();
  await page.waitForTimeout(250);await page.screenshot({path:`test-results/${phone?'phone':'desktop'}-suitcase-question.png`});
  await page.getByRole('button',{name:'Yes, it is',exact:false}).click();await expect(page.locator('.arrival-dialogue [role=status]')).toContainText('Try again');
  await page.getByRole('button',{name:'No, it isn’t',exact:false}).click();
  await expect(page.locator('.arrival-dialogue')).toContainText('now shows you the blue');await page.getByRole('button',{name:'No, it isn’t',exact:false}).click();
  await expect(page.locator('.arrival-dialogue [role=status]')).toContainText('Try again');await page.getByRole('button',{name:'Yes, it is',exact:false}).click();
  await expect(page.locator('.arrival-status')).toContainText('Biren has set your suitcase down');await face(page,2.4,1.8);
  await expect(page.getByRole('button',{name:'Pick up your suitcase',exact:false})).toBeEnabled({timeout:7000});await page.keyboard.press('e');
  await expect(page.locator('.arrival-pocket')).toContainText('✓ Your blue suitcase');
  await walkTo(page,1.6,1.7);await walkTo(page,1.6,-3.1);await walkTo(page,0,-3.1);await face(page,0,-4.3);await page.keyboard.press('e');
  await expect(page.getByRole('button',{name:'Carry your suitcase inside',exact:false})).toBeEnabled();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('wayword.progress.ne.v1')??'[]'))).toEqual([]);
  await page.keyboard.press('e');
  if(!phone){await expect(page.locator('#app')).toHaveAttribute('data-phase','arriving');await page.waitForTimeout(2400);await page.screenshot({path:'test-results/desktop-moving-in-arriving.png'});}
  await expect(page.locator('#app')).toHaveAttribute('data-phase','complete',{timeout:7000});
  await expect(page.locator('#arrival-overlay')).toContainText('Five phrases used');await expect(page.locator('#arrival-overlay')).toContainText('You also helped');
  await expect(page.locator('#arrival-overlay')).toContainText('UP NEXT · CHAPTER 02');
  await expect(page.getByRole('link',{name:'Start chapter 02'})).toHaveAttribute('href','?level=second-lesson');
  const card=await page.locator('.arrival-card').evaluate(element=>({scroll:element.scrollHeight,client:element.clientHeight}));expect(card.scroll).toBeLessThanOrEqual(card.client+1);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('wayword.progress.ne.v1')??'[]'))).toEqual(['moving-in']);
  await page.waitForTimeout(900);await page.screenshot({path:`test-results/${phone?'phone':'desktop'}-moving-in-complete.png`});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
  await page.getByRole('button',{name:'Keep exploring'}).click();await expect(page.locator('#app')).toHaveAttribute('data-phase','explore');
  await expect(page.locator('.arrival-journal-next')).toBeVisible();
  await page.getByRole('button',{name:'Start over'}).click();await expect(page.locator('#app')).toHaveAttribute('data-phase','intro');
});

test('restart cancels the in-flight key offer and resets the scene',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Step into the courtyard'}).click();await walkTo(page,-1.8,1.1);await face(page,-1.8,-1);await page.keyboard.press('e');await page.getByRole('button',{name:'Say namaste'}).click();await page.getByRole('button',{name:'Ask for the key politely'}).click();await page.getByRole('button',{name:'Start over'}).click();
  await page.waitForTimeout(1300);await expect(page.locator('#app')).toHaveAttribute('data-phase','intro');await expect(page.locator('.arrival-status')).toHaveText('A new neighborhood. Your first hello.');
  expect(await page.evaluate(()=>localStorage.getItem('wayword.progress.ne.v1'))).toBeNull();
});

test('the courtyard has a usable map fallback without WebGL',async({page})=>{
  await page.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type:string,...args:unknown[]){if(type.startsWith('webgl'))return null;return original.call(this,type,...args as [])} as typeof original;});
  await page.goto('/');await page.getByRole('button',{name:'Step into the courtyard'}).click();await expect(page.locator('.arrival-fallback svg')).toBeVisible();const before=await pose(page);await page.keyboard.down('w');await page.waitForTimeout(400);await page.keyboard.up('w');const after=await pose(page);expect(after.z).toBeLessThan(before.z-.5);
});
