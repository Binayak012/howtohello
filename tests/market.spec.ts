import { test, expect } from '@playwright/test';

test('market stays behind the closed door, opens across the shop, and has purposeful street activity', async ({ page }) => {
  await page.goto('/');
  const layout = await page.evaluate(async () => {
    const { ShopScene } = await import('/src/scene.ts');
    document.getElementById('app')!.style.display = 'none';
    const host = document.createElement('div'); host.style.cssText = 'position:fixed;inset:0'; document.body.append(host);
    const shop = new ShopScene(host, () => {}); (window as any).marketPreview = shop;
    shop.setPlayer({ col:4, row:7, facing:'S' }, true);
    shop.collectPackedBag();
    const hidden = !shop.market.root.visible && !shop.thresholdGlow.visible && shop.exitDoor.rotation.y === 0;
    const streetAngle = shop.market.root.rotation.y;
    shop.market.update(0, 0, false);
    const residents = shop.market.root.children.filter(child => child.userData.role);
    const positions = residents.map(person => [person.position.x, person.position.z]);
    shop.market.update(5, .5, false);
    const stationary = residents.every((person, i) => person.position.x === positions[i][0] && person.position.z === positions[i][1]);
    const roles = [...new Set(residents.map(person => person.userData.role))];
    const ages = [...new Set(residents.map(person => person.userData.age))];
    const footpaths = shop.market.root.children.filter(child => child.name === 'raised-footpath').length;
    return { hidden, streetAngle, stationary, roles, ages, footpaths };
  });
  expect(layout.hidden).toBe(true); expect(layout.streetAngle).toBeCloseTo(Math.PI / 2);
  expect(layout.stationary).toBe(true); expect(layout.footpaths).toBe(2);
  expect(layout.roles).toEqual(expect.arrayContaining(['vendor', 'shopper', 'parent', 'child', 'elder']));
  expect(layout.ages).toEqual(expect.arrayContaining(['child', 'adult', 'elder']));
  await page.screenshot({ path:'test-results/closed-shop-door.png' });
  await page.evaluate(() => (window as any).marketPreview.walkIntoMarket(() => {}));
  await page.waitForTimeout(800);
  await page.screenshot({ path:'test-results/door-sunlight.png' });
  await page.waitForTimeout(6500);
  await page.screenshot({ path:'test-results/perpendicular-market.png' });
  const arrival = await page.evaluate(() => {
    const shop = (window as any).marketPreview;
    const bicycle = shop.market.root.getObjectByName('delivery-bicycle');
    shop.market.update(3, .3, false);
    const before = bicycle.position.z; shop.market.update(8, .9, false);
    const after = bicycle.position.z;
    shop.finishDeparture();
    const result = { visible: shop.market.root.visible, glow: shop.thresholdGlow.visible, bikeMoved: after > before, yaw: shop.camera.rotation.y };
    shop.resetStock();
    result.visible = result.visible && !shop.market.root.visible;
    shop.dispose(); return result;
  });
  expect(arrival.visible).toBe(true); expect(arrival.glow).toBe(true); expect(arrival.bikeMoved).toBe(true);
  expect(arrival.yaw).toBeGreaterThan(Math.PI * 1.4);
});
