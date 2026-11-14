import { test, expect, type Page } from '@playwright/test';

async function pose(page:Page){return page.locator('#market-roam').evaluate(element=>({x:Number((element as HTMLElement).dataset.marketX),z:Number((element as HTMLElement).dataset.marketZ),yaw:Number((element as HTMLElement).dataset.marketYaw)}));}
async function face(page:Page,x:number,z:number){
  // Conversation actions can turn the camera; let the public pose settle first.
  await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
  const current=await pose(page);const desired=Math.atan2(-(x-current.x),-(z-current.z));
  let delta=Math.atan2(Math.sin(desired-current.yaw),Math.cos(desired-current.yaw));
  while(Math.abs(delta)>.01){
    const part=Math.sign(delta)*Math.min(.5,Math.abs(delta));
    await page.mouse.move(640,390);await page.mouse.down();await page.mouse.move(640-part/.004,390,{steps:3});await page.mouse.up();
    delta-=part;
  }
  await page.waitForTimeout(60);
}
async function walkTo(page:Page,x:number,z:number){
  const start=await pose(page);
  for(let attempt=0;attempt<35;attempt++){
    const current=await pose(page),distance=Math.hypot(current.x-x,current.z-z);
    if(distance<.35)return;
    await face(page,x,z);await page.keyboard.down('w');
    await page.waitForTimeout(Math.min(1000,Math.max(70,(distance-.15)/2.8*1000)));
    await page.keyboard.up('w');await page.waitForTimeout(40);
  }
  const current=await pose(page);
  expect(Math.hypot(current.x-x,current.z-z),`Walk to ${x},${z} from ${JSON.stringify(start)} ended at ${JSON.stringify(current)}`).toBeLessThan(.35);
}
async function startTask(page:Page,x:number,z:number,action:string){
  await face(page,x,z);await page.keyboard.press('e');
  const dialogue=page.locator('.market-dialogue');await expect(dialogue).toBeVisible();
  await expect(page.getByRole('button',{name:'Choose 1',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Forward',exact:false}).click();
  await expect(dialogue.locator('[role=status]')).toContainText('Greet your neighbor');
  await page.getByRole('button',{name:'Hello',exact:false}).click();
  await page.getByRole('button',{name:action,exact:false}).click();
  await expect(page.locator('#market-roam')).toHaveAttribute('data-mode','roam');
}
async function thankAndLeave(page:Page,id:string){
  await expect(page.locator('.market-dialogue')).toContainText('धन्यवाद');
  await page.getByRole('button',{name:'Say thank you'}).click();
  await page.screenshot({path:`test-results/market-conversation-${id}.png`});
  await page.getByRole('button',{name:'Keep exploring'}).click();
}

test('the fruit stall is a real color test: green apples are rejected, red ones accepted',async({page})=>{
  test.setTimeout(120000);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>{localStorage.setItem('wayword.progress.ne.v1','["little-shop"]');localStorage.setItem('wayword.numbers.ne.v1','true');});
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/?level=market');
  await expect(page.locator('#market-roam')).toBeVisible();
  await walkTo(page,1.2,10.5);await walkTo(page,11.2,10.5);await walkTo(page,11.2,7.8);await startTask(page,11.2,5.35,'Let me help');
  await expect(page.locator('.market-task')).toContainText('दुई रातो');
  await page.screenshot({path:'test-results/market-color-test.png'});
  await page.getByRole('button',{name:'Pick up a green apple',exact:true}).click();
  await expect(page.locator('.market-roam-status')).toContainText('हरियो');
  await expect(page.locator('#picked-total')).toContainText('0 apples');
  for(let i=0;i<2;i++)await page.getByRole('button',{name:'Pick up a red apple',exact:true}).click();
  await expect(page.locator('#picked-total')).toContainText('2 apples');
  await page.getByRole('button',{name:'Hand over',exact:false}).click();await thankAndLeave(page,'fruit-color');
  expect(errors).toEqual([]);
});

test('walk to neighbors, pick real items, pay coins and find the child’s toy',async({page})=>{
  test.setTimeout(210000);
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>{localStorage.setItem('wayword.progress.ne.v1','["little-shop"]');localStorage.setItem('wayword.numbers.ne.v1','true');});
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/?level=market');
  await expect(page.locator('#market-roam')).toBeVisible();
  await expect(page.getByRole('button',{name:'Approach a neighbor to talk'})).toBeDisabled();
  await page.screenshot({path:'test-results/free-market.png'});
  await walkTo(page,3.3,8.9);await startTask(page,5.2,7.55,'I’ll find the teddy');
  await expect(page.locator('.market-task')).toContainText('behind');
  // Leave the family task open and buy a loaf on the way to the planter.
  await walkTo(page,-9.2,9.6);await walkTo(page,-9.2,7.8);await startTask(page,-9.2,5.35,'Open my coin purse');
  for(let i=0;i<2;i++)await page.locator('[data-market-action="coin-add"]:not(:disabled)').first().click();
  await expect(page.locator('#coin-total')).toContainText('2 coins');
  await page.getByRole('button',{name:'Pay the baker'}).click();
  await expect(page.locator('.market-dialogue')).toContainText('You brought 2');
  await page.getByRole('button',{name:'Open my coin purse'}).click();
  await page.locator('[data-market-action="coin-add"]:not(:disabled)').first().click();
  await page.screenshot({path:'test-results/market-coins.png'});
  await page.getByRole('button',{name:'Pay the baker'}).click();await thankAndLeave(page,'bread');
  expect(await page.evaluate(()=>localStorage.getItem('wayword.wallet.ne.v1'))).toBe('2');
  await page.keyboard.press('e');await page.getByRole('button',{name:'Keep exploring'}).click();
  expect(await page.evaluate(()=>localStorage.getItem('wayword.wallet.ne.v1'))).toBe('2');
  await walkTo(page,-9.2,9.6);await walkTo(page,-14.4,9.2);await face(page,-14.4,7.8);
  await page.keyboard.press('e');
  await expect(page.locator('.market-task')).toContainText('You’re holding the red teddy');
  await page.screenshot({path:'test-results/market-found-toy.png'});
  await walkTo(page,-14.4,9.6);await walkTo(page,3.3,9.6);await walkTo(page,3.3,8.9);await face(page,5.2,7.55);await page.keyboard.press('e');
  await expect(page.locator('.market-dialogue')).toContainText('Toy returned');
  await page.getByRole('button',{name:'Keep exploring'}).click();
  await walkTo(page,-3.15,10.5);await walkTo(page,-3.15,20.6);await startTask(page,-2.4,22.65,'Let me help');
  // Aim at the right-hand vase and click its real flower mesh.
  await face(page,-1.83,21.95);await page.waitForTimeout(350);
  // Project the actual visible flower rather than estimating its screen position
  // from rounded player coordinates and a hard-coded camera height.
  const target=await page.evaluate(async()=>{
    const {scene}=await import('/src/shop-game.ts');
    const flower=scene!.market.root.children.find(object=>object.userData.marketItem==='flowers-wrong-1')!;
    const bloom=flower.children[1];
    const point=bloom.getWorldPosition(bloom.position.clone()).project(scene!.camera);
    const rect=scene!.renderer.domElement.getBoundingClientRect();
    return{x:rect.left+(point.x+1)*rect.width/2,y:rect.top+(1-point.y)*rect.height/2};
  });
  await page.screenshot({path:'test-results/market-flower-target.png'});
  await page.mouse.click(target.x,target.y);
  await expect(page.locator('.market-roam-status')).toContainText('on your right');
  await page.getByRole('button',{name:'Pick up a white flower',exact:true}).click();await expect(page.locator('.market-roam-status')).toContainText('सेतो');
  for(let i=0;i<4;i++)await page.getByRole('button',{name:'Pick up a yellow flower',exact:true}).click();
  await expect(page.locator('#picked-total')).toContainText('4 flowers');
  await page.getByRole('button',{name:'Hand over',exact:false}).click();await thankAndLeave(page,'flowers');
  await walkTo(page,11.2,10.5);await walkTo(page,11.2,7.8);await startTask(page,11.2,5.35,'Let me help');
  await expect(page.locator('.market-task')).toContainText('रातो');
  await page.getByRole('button',{name:'Pick up a green apple',exact:true}).click();await expect(page.locator('.market-roam-status')).toContainText('हरियो');await expect(page.locator('#picked-total')).toContainText('0 apples');
  for(let i=0;i<3;i++)await page.getByRole('button',{name:'Pick up a red apple',exact:true}).click();
  await page.getByRole('button',{name:'Hand over',exact:false}).click();
  await expect(page.locator('.market-dialogue')).toContainText('You brought 3');
  await page.getByRole('button',{name:'Let me help'}).click();
  await page.getByRole('button',{name:'Put one back',exact:true}).click();
  await page.getByRole('button',{name:'Hand over',exact:false}).click();await thankAndLeave(page,'fruit');
  await expect(page.locator('#market-progress')).toHaveText('Finale complete. Keep exploring!');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('wayword.progress.ne.v1')!))).toEqual(['little-shop','next-adventure']);
  const previous=await pose(page);await page.keyboard.down('s');await page.waitForTimeout(350);await page.keyboard.up('s');
  const current=await pose(page);expect(Math.hypot(current.x-previous.x,current.z-previous.z)).toBeGreaterThan(.5);
  await page.getByRole('button',{name:'Review numbers 1–5'}).click();
  const frozen=await pose(page);await page.keyboard.down('w');await page.waitForTimeout(250);await page.keyboard.up('w');expect(await pose(page)).toEqual(frozen);
  await page.getByRole('button',{name:'Back to market',exact:true}).click();
  await expect(page.locator('#market-roam')).toBeVisible();
  await page.getByRole('button',{name:'Start over'}).click();await expect(page.locator('#market-roam')).toBeHidden();
  await expect(page.locator('#app')).toHaveAttribute('data-phase','story');
  expect(errors).toEqual([]);
});
