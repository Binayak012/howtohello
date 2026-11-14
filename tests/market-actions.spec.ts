import {test,expect} from '@playwright/test';

test('NPCs move and gesture, picked objects leave the counter, and the teddy changes the child',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('wayword.progress.ne.v1','["little-shop"]'));
  await page.goto('/?level=shop');await expect(page.locator('#app')).toHaveAttribute('data-phase','story');
  const result=await page.evaluate(async()=>{
    const {ShopScene}=await import('/src/scene.ts');
    const host=document.createElement('div');host.style.cssText='position:fixed;inset:0;z-index:20';document.body.append(host);
    const shop=new ShopScene(host,()=>{});shop.reducedMotion=false;shop.finishDeparture();
    const market=shop.market;
    const vendor=market.root.children.find((object:any)=>object.userData.role==='vendor'&&object.userData.activityId==='bread')!;
    const initialZ=vendor.position.z;
    const customer=market.root.children.find((object:any)=>object.userData.forActivity==='bread')!;const customerZ=customer.position.z;
    market.react('bread','pack',{x:-9.2,z:7.8});
    await new Promise(resolve=>setTimeout(resolve,450));
    market.update(1,1,false);
    const stepped=Math.abs(vendor.position.z-initialZ)>.15;
    const steppedAside=Math.abs(customer.position.z-customerZ)>.15;
    market.prepareItems('fruit');
    const apple=market.root.getObjectByName('pick-fruit-0')!;
    const before=apple.visible;
    const picked=market.pickItem('fruit-0',{x:11.2,z:7.8});
    const hidden=!apple.visible;market.returnItem('fruit-0');const returned=apple.visible;
    market.setCoins(3,{x:-9.2,z:7.8});
    const coinCount=market.root.getObjectsByProperty('name','counter-coin-1').length+market.root.getObjectsByProperty('name','counter-coin-2').length+market.root.getObjectsByProperty('name','counter-coin-3').length;
    const teddy=market.root.getObjectByName('lost-red-teddy')!;
    const toyPicked=market.pickToy({x:-14.4,z:9.2})&&!teddy.visible;
    market.handover('family',{x:3.3,z:8.9});market.markActivity('family',1);market.update(2,1,false);
    const child=market.root.children.find((object:any)=>object.userData.role==='child')!;
    const tears=child.getObjectByName('cry-tear-left')!.visible;
    const smiling=Math.abs(child.getObjectByName('mouth')!.rotation.z-Math.PI)<.01;
    shop.dispose();host.remove();return{stepped,steppedAside,before,picked,hidden,returned,coinCount,toyPicked,tears,smiling};
  });
  expect(result.stepped).toBe(true);expect(result.steppedAside).toBe(true);expect(result.before&&result.picked&&result.hidden&&result.returned).toBe(true);
  expect(result.coinCount).toBeGreaterThanOrEqual(3);expect(result.toyPicked).toBe(true);expect(result.tears).toBe(false);expect(result.smiling).toBe(true);
});
