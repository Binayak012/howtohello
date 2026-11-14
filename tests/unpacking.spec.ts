import {test,expect} from '@playwright/test';

for(const phone of[false,true])test(`${phone?'phone':'desktop'}: learn five colors, unpack by color, answer the check and continue to the shop`,async({page})=>{
  test.setTimeout(90000);if(phone){await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});}
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem('wayword.progress.ne.v1','["moving-in"]');sessionStorage.setItem('seeded','1');}});
  await page.goto('/?level=second-lesson');
  await expect(page.getByRole('heading',{name:'Unpack your suitcase.'})).toBeVisible();
  await page.getByRole('button',{name:'Learn five colors'}).click();
  await expect(page.locator('#app')).toHaveAttribute('data-phase','study');
  await expect(page.locator('[data-unpack=start]')).toBeDisabled();
  for(const word of['निलो','पहेँलो','हरियो','सेतो'])await page.locator('.unpack-swatches button',{hasText:word}).click();
  await page.waitForTimeout(300);await page.screenshot({path:`test-results/${phone?'phone':'desktop'}-unpack-study.png`});
  await page.getByRole('button',{name:'Start unpacking'}).click();
  // First request is green: a wrong pick is explained, then each item is found by its color.
  await expect(page.locator('.unpack-target')).toContainText('हरियो');
  await page.locator('[data-item=shirt]').click();await expect(page.locator('.unpack-status')).toContainText('रातो');
  await page.screenshot({path:`test-results/${phone?'phone':'desktop'}-unpack-task.png`});
  for(const item of['sweater','shirt','towel','trousers','scarf']){await page.locator(`[data-item=${item}]`).click();await expect(page.locator(`[data-item=${item}]`)).toHaveCount(0,{timeout:4000});}
  await expect(page.locator('#app')).toHaveAttribute('data-phase','check');
  await page.waitForTimeout(phone?100:900);await page.screenshot({path:`test-results/${phone?'phone':'desktop'}-unpack-check.png`});
  await page.locator('[data-answer=yellow]').click();await expect(page.locator('.unpack-status')).toContainText('Not quite');
  for(const color of['white','green','red']){await expect(page.locator(`[data-answer=${color}]`)).toBeEnabled();await page.locator(`[data-answer=${color}]`).click();}
  await expect(page.locator('#app')).toHaveAttribute('data-phase','complete');
  await expect(page.locator('#arrival-overlay')).toContainText('2 retries');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('wayword.progress.ne.v1')??'[]'))).toEqual(['moving-in','second-lesson']);
  const card=await page.locator('.arrival-card').evaluate(element=>({scroll:element.scrollHeight,client:element.clientHeight}));expect(card.scroll).toBeLessThanOrEqual(card.client+1);
  await page.waitForTimeout(900);await page.screenshot({path:`test-results/${phone?'phone':'desktop'}-unpack-complete.png`});
  expect(errors).toEqual([]);
  await page.getByRole('link',{name:'Start chapter 03'}).click();
  await expect(page).toHaveURL(/level=counting$/);await expect(page.getByRole('heading',{name:'Counting with Lila.'})).toBeVisible();
});

test('chapter two stays locked until Your First Hello is complete',async({page})=>{
  await page.goto('/?level=second-lesson');
  await expect(page.getByRole('heading',{name:'A little earlier in the story…'})).toBeVisible();
});
