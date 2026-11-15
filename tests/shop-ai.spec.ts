import { test, expect, type Page } from '@playwright/test';

async function reachShop(page:Page){
  await page.addInitScript(()=>localStorage.setItem('wayword.progress.ne.v1','["moving-in","second-lesson","counting","letters"]'));
  await page.goto('/?level=shop&ai');
  await page.getByRole('button',{name:/Hear नमस्ते pronounced/}).click();
  await page.getByRole('button',{name:'Learn the four words'}).click();
  for(const word of['right','left','forward','backward'])await page.locator(`[data-word="${word}"]`).click();
  await page.locator('#lesson-next').click();
  const keys:Record<string,string>={left:'ArrowLeft',right:'ArrowRight',forward:'ArrowUp',backward:'ArrowDown'};
  while(await page.locator('#begin').isHidden()){
    const done=await page.locator('.quiz-score i.done').count();
    await page.keyboard.press(keys[(await page.locator('#quiz-word').getAttribute('data-expect'))!]);
    await page.waitForFunction(count=>document.querySelectorAll('.quiz-score i.done').length>count||!document.querySelector('#begin')?.hasAttribute('hidden'),done);
  }
  await page.getByRole('button',{name:'Let’s try it in the shop'}).click();
  const steps=['ArrowRight','ArrowLeft','ArrowUp','ArrowDown'];
  for(let i=0;i<4;i++){await expect(page.locator('#pips')).toHaveAttribute('aria-label',`Practice ${i+1} of 4`);await page.keyboard.press(steps[i]);}
  await expect(page.locator('#app')).toHaveAttribute('data-phase','shop');
}

test('learners can ask the shopkeeper the way; the game supplies the true directions',async({page})=>{
  const asked:Record<string,any>[]=[];
  await page.route('**/api/shopkeeper',async route=>{
    const body=route.request().postDataJSON();asked.push(body);
    const nepali=/kahaa|कहाँ/.test(body.message);
    await route.fulfill({json:{nepali:'झोला तपाईंको बायाँ छ।',roman:'jhola tapaaiko baayaa chha.',english:'The bags are on your left.',tip:nepali?'':'Next time try: jhola kahaa chha?',success:nepali}});
  });
  await reachShop(page);
  await expect(page.getByRole('button',{name:'Ask the way'})).toBeVisible();
  await page.getByRole('button',{name:'Ask the way'}).click();
  const input=page.getByRole('textbox',{name:'Your question'});
  await expect(input).toBeFocused();
  // Arrow keys type in the box instead of walking.
  const before=await page.locator('#position').textContent();
  await input.fill('where is the bag');await page.keyboard.press('ArrowLeft');await input.press('Enter');
  await expect(page.locator('.ask-answer')).toContainText('बायाँ');
  await expect(page.locator('.ask-tip')).toContainText('kahaa chha');
  expect(await page.locator('#position').textContent()).toBe(before);
  // The shopkeeper hears where everything really is from the player's spot (4,7 facing north).
  expect(asked[0]).toMatchObject({neighbor:'shop',stage:'ask',shop:{want:'bag',places:{counter:['forward'],door:['backward'],bag:['left'],book:['right']}}});
  await input.fill('jhola kahaa chha?');await input.press('Enter');
  await expect(page.locator('.ask-answer')).toHaveAttribute('data-success','true');
  expect(asked[1].history).toHaveLength(2);
  await page.screenshot({path:'test-results/shop-ask-the-way.png'});
  await page.keyboard.press('Escape');
  await expect(page.locator('#ask-panel')).toBeHidden();
  // Walking works again once the panel is closed.
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#position')).toContainText('Facing W');
});

test('without an AI key the Ask button disappears and Hint still helps',async({page})=>{
  await page.route('**/api/shopkeeper',route=>route.fulfill({status:503,json:{error:'not-configured'}}));
  await reachShop(page);
  await page.getByRole('button',{name:'Ask the way'}).click();
  await page.getByRole('textbox',{name:'Your question'}).fill('chiya kahaa chha?');
  await page.getByRole('textbox',{name:'Your question'}).press('Enter');
  await expect(page.locator('#ask-status')).toContainText('isn’t set up');
  await expect(page.getByRole('button',{name:'Ask the way'})).toBeHidden();
  await expect(page.locator('#ask-panel')).toBeHidden({timeout:5000});
  await expect(page.getByRole('button',{name:'Get a hint'})).toBeEnabled();
});
