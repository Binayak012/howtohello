import {test,expect} from '@playwright/test';

for(const phone of[false,true])test(`${phone?'phone':'desktop'}: learn numbers 1–5, fill Lila's basket, name the count and continue to letters`,async({page})=>{
  test.setTimeout(90000);if(phone){await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});}
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem('wayword.progress.ne.v1','["moving-in","second-lesson"]');sessionStorage.setItem('seeded','1');}});
  await page.goto('/?level=counting');
  await expect(page.getByRole('heading',{name:'Counting with Lila.'})).toBeVisible();
  await page.screenshot({path:`test-results/${phone?'phone':'desktop'}-counting-intro.png`});
  await page.getByRole('button',{name:'Learn numbers 1–5'}).click();
  await expect(page.locator('[data-count=start]')).toBeDisabled();
  for(const value of[2,3,4,5]){await page.locator(`[data-number="${value}"]`).click();await expect(page.locator('.count-card .count-apples i')).toHaveCount(value);}
  await page.waitForTimeout(300);await page.screenshot({path:`test-results/${phone?'phone':'desktop'}-counting-study.png`});
  await page.getByRole('button',{name:'Help Lila'}).click();
  // Round 1 asks for तीन (3). Two is a miss; three is accepted.
  await expect(page.locator('.unpack-target')).toContainText('तीन');
  for(let i=0;i<2;i++)await page.getByRole('button',{name:'Add one apple'}).click();
  await page.getByRole('button',{name:'Give Lila the basket'}).click();await expect(page.locator('.unpack-status')).toContainText('दुई');
  await page.getByRole('button',{name:'Add one apple'}).click();await expect(page.locator('.count-basket-number')).toHaveText('3');
  await page.waitForTimeout(500);await page.screenshot({path:`test-results/${phone?'phone':'desktop'}-counting-task.png`});
  await page.getByRole('button',{name:'Give Lila the basket'}).click();
  for(const wanted of[1,4]){
    await expect(page.locator('.count-basket-number')).toHaveText('0',{timeout:4000});
    for(let i=0;i<wanted+1;i++)await page.getByRole('button',{name:'Add one apple'}).click();
    await page.getByRole('button',{name:'Take one apple out'}).click();
    await expect(page.locator('.count-basket-number')).toHaveText(String(wanted));
    await page.getByRole('button',{name:'Give Lila the basket'}).click();
  }
  await expect(page.locator('#app')).toHaveAttribute('data-phase','recall',{timeout:4000});
  await page.waitForTimeout(phone?100:900);await page.screenshot({path:`test-results/${phone?'phone':'desktop'}-counting-recall.png`});
  await page.locator('[data-answer="3"]').click();await expect(page.locator('.unpack-status')).toContainText('Not quite');
  for(const value of[5,2]){await expect(page.locator(`[data-answer="${value}"]`)).toBeEnabled();await page.locator(`[data-answer="${value}"]`).click();}
  await expect(page.locator('#app')).toHaveAttribute('data-phase','complete',{timeout:4000});
  await expect(page.locator('#arrival-overlay')).toContainText('2 retries');
  await expect(page.locator('#arrival-overlay')).toContainText('Your First Letters');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('wayword.progress.ne.v1')??'[]'))).toEqual(['moving-in','second-lesson','counting']);
  const card=await page.locator('.arrival-card').evaluate(element=>({scroll:element.scrollHeight,client:element.clientHeight}));expect(card.scroll).toBeLessThanOrEqual(card.client+1);
  await page.waitForTimeout(900);await page.screenshot({path:`test-results/${phone?'phone':'desktop'}-counting-complete.png`});
  await expect(page.getByRole('link',{name:'Start chapter 04'})).toHaveAttribute('href','?level=letters');
  expect(errors).toEqual([]);
});

test('apples can be tapped in the 3D courtyard',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('wayword.progress.ne.v1','["moving-in","second-lesson"]'));
  await page.goto('/?level=counting');
  await page.getByRole('button',{name:'Learn numbers 1–5'}).click();
  for(const value of[2,3,4,5])await page.locator(`[data-number="${value}"]`).click();
  await page.getByRole('button',{name:'Help Lila'}).click();await page.waitForTimeout(1200);
  // Project the first bench apple to the screen and click it.
  const point=await page.evaluate(()=>{const canvas=document.querySelector('#arrival-world canvas') as HTMLCanvasElement,rect=canvas.getBoundingClientRect();return{x:rect.left,y:rect.top,w:rect.width,h:rect.height};});
  let added=false;
  // Sweep only the open right side; the panel (with its own Add button) covers the left on desktop.
  for(let y=.35;y<=.95&&!added;y+=.03)for(let x=.52;x<=.98&&!added;x+=.03){await page.mouse.click(point.x+point.w*x,point.y+point.h*y);added=(await page.locator('.count-basket-number').textContent())==='1';}
  expect(added).toBe(true);
});

test('counting stays locked until chapter two is complete',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('wayword.progress.ne.v1','["moving-in"]'));
  await page.goto('/?level=counting');
  await expect(page.getByRole('heading',{name:'A little earlier in the story…'})).toBeVisible();
});
