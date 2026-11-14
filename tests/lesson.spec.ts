import { test, expect, type Page } from '@playwright/test';
import { baseBeats, routeTo, start, step, turn, type Player } from '../src/core';

const keys: Record<string, string> = { left:'ArrowLeft', right:'ArrowRight', forward:'ArrowUp', backward:'ArrowDown', take:'Space' };
async function learn(page: Page, snapshots = false) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name:'Your first little errand.' })).toBeVisible();
  if (snapshots) await page.screenshot({ path:'test-results/story.png' });
  await page.getByRole('button', { name:'Learn the four words' }).click();
  for (const word of ['दायाँ', 'बायाँ', 'अगाडि', 'पछाडि']) await expect(page.locator('.direction-map')).toContainText(word);
  await page.locator('[data-word="backward"]').click();
  await expect(page.locator('#word-explanation')).toContainText('without turning');
  const guide = page.locator('.direction-backward .latin-guide');
  await expect(guide).toHaveText('pachhadi');
  await page.getByRole('switch', { name:'Latin-letter guides' }).click();
  await expect(guide).toBeHidden();
  await expect(page.locator('.direction-backward strong')).toBeVisible();
  await page.getByRole('switch', { name:'Latin-letter guides' }).click();
  await expect(guide).toBeVisible();
  await page.screenshot({ path: snapshots ? 'test-results/word-lesson.png' : 'test-results/word-lesson-small.png' });
  await page.getByRole('button', { name:'Let’s try it in the shop' }).click();
  const words = ['दायाँ', 'बायाँ', 'अगाडि', 'पछाडि'];
  for (let i = 0; i < 4; i++) {
    await expect(page.locator('#pips')).toHaveAttribute('aria-label', `Practice ${i + 1} of 4`);
    await expect(page.locator('#target')).toHaveText(words[i]);
    await page.keyboard.press(['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'][i]);
  }
  await expect(page.locator('#app')).toHaveAttribute('data-phase', 'shop');
  await expect(page.locator('#pronunciation')).toHaveText('baaya');
  await expect(page.locator('#pronunciation')).toBeVisible();
  await page.getByRole('button', { name:'Show Latin-letter guides' }).click();
  await expect(page.locator('#pronunciation')).toBeHidden();
  await page.getByRole('button', { name:'Show Latin-letter guides' }).click();
  await expect(page.locator('#pronunciation')).toBeVisible();
  await expect(page.locator('#position')).toContainText('Tile 4, 7 · Facing N');
}
async function follow(page: Page, player: Player, target: string) {
  const route = routeTo(player, target)!;
  expect(route).not.toBeNull();
  for (const action of route) {
    const count = Number(await page.locator('#basket').getAttribute('data-count'));
    const remaining = Number(await page.locator('#shelf-stock').getAttribute('data-remaining'));
    await page.keyboard.press(keys[action]);
    if (action === 'left') player = turn(player, -1);
    if (action === 'right') player = turn(player, 1);
    if (action === 'forward') player = step(player, false, target === 'exit');
    if (action === 'backward') player = step(player, true, target === 'exit');
    if (action === 'take') {
      await page.keyboard.press('Space');
      await expect(page.locator('#basket')).toHaveAttribute('data-count', String(count + 1));
      await expect(page.locator('#shelf-stock')).toHaveAttribute('data-remaining', String(remaining - 1));
    }
  }
  return player;
}
async function shop(page: Page) {
  let player = start();
  // Walking backward through the entrance before checkout must not end the lesson.
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#position')).toContainText('Tile 4, 7');
  for (let i = 0; i < baseBeats.length; i++) {
    await expect(page.locator('#pips')).toHaveAttribute('aria-label', `Step ${i + 1} of 6`);
    player = await follow(page, player, baseBeats[i].expect);
  }
  await expect(page.locator('#app')).toHaveAttribute('data-phase', 'checkout');
  await expect(page.locator('#basket')).toHaveAttribute('data-count', '4');
  await expect(page.locator('#results')).toBeHidden();
  // Having all items is insufficient: the player must bring them to checkout.
  await page.keyboard.press('Space');
  await expect(page.locator('#app')).toHaveAttribute('data-phase', 'checkout');
  return follow(page, player, 'at:4,3,N');
}

for (const phone of [false, true]) {
  test(`${phone ? 'phone' : 'desktop'}: learn four words, shop, scan, collect, and walk outside`, async ({ page }) => {
    if (phone) await page.setViewportSize({ width:390, height:844 });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await learn(page, !phone);
    if (phone) await page.screenshot({ path:'test-results/phone-practice.png' });
    let player = await shop(page);
    await page.getByRole('button', { name:'Place items', exact:true }).click();
    await expect(page.locator('#app')).toHaveAttribute('data-phase', 'scanning');
    await expect(page.locator('#results')).toBeHidden();
    await expect(page.getByRole('button', { name:'Step forward', exact:true })).toBeDisabled();
    await expect(page.locator('#checkout-status')).toHaveAttribute('data-scanned', '1');
    await page.screenshot({ path:`test-results/${phone ? 'phone' : 'desktop'}-checkout.png` });
    await expect(page.locator('#app')).toHaveAttribute('data-phase', 'collect', { timeout:12000 });
    await expect(page.locator('#checkout-status')).toHaveAttribute('data-scanned', '4');
    await expect(page.locator('#results')).toBeHidden();
    if (!phone) await page.screenshot({ path:'test-results/packed-bag.png' });
    await page.getByRole('button', { name:'Pick up bag', exact:true }).click();
    await expect(page.locator('#app')).toHaveAttribute('data-phase', 'exit');
    await expect(page.locator('#basket')).toContainText('Carrying your packed shopping');
    await expect(page.locator('#results')).toBeHidden();
    // Restore scene focus after clicking the contextual action.
    player = await follow(page, player, 'exit');
    expect(player.row).toBe(9);
    await expect(page.locator('#app')).toHaveAttribute('data-phase', 'complete');
    await expect(page.locator('#results')).toContainText('Your first errand. Done.');
    await expect(page.locator('#results')).toContainText('8 first-try successes');
    await page.screenshot({ path:`test-results/${phone ? 'phone' : 'desktop'}-complete.png` });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
    await page.getByRole('button', { name:'Play the story again' }).click();
    await expect(page.locator('#app')).toHaveAttribute('data-phase', 'story');
    await expect(page.locator('#basket')).toHaveAttribute('data-count', '0');
  });
}

test('restart during scanning cancels packing and restores all shelf units', async ({ page }) => {
  await learn(page);
  await shop(page);
  await page.getByRole('button', { name:'Place items', exact:true }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-phase', 'scanning');
  await page.getByRole('button', { name:'Start over' }).click();
  await expect(page.locator('#app')).toHaveAttribute('data-phase', 'story');
  await page.waitForTimeout(6000);
  await expect(page.locator('#app')).toHaveAttribute('data-phase', 'story');
  await expect(page.locator('#basket')).toHaveAttribute('data-count', '0');
  await expect(page.locator('#checkout-status')).toBeHidden();
});

test('individual units and checkout visuals reset without shrinking the shopkeeper', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    const { ShopScene } = await import('/src/scene.ts');
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;width:300px;height:300px;left:-500px;top:0'; document.body.append(host);
    const shop = new ShopScene(host, () => {});
    const units = [...shop.units.values()], unit = units[0];
    shop.takeUnit(unit.name);
    const hidden = units.filter(unit => !unit.visible).length;
    shop.beginCheckout([unit.name], () => {}, () => {});
    shop.resetStock();
    const restored = units.every(unit => unit.visible) && !shop.packedBag.visible && !shop.checkout;
    shop.setPlayer({ col:4, row:3, facing:'N' }, true);
    const distance = shop.camera.position.distanceTo(shop.keeper!.position);
    shop.dispose(); host.remove();
    return { hidden, restored, distance };
  });
  expect(result.hidden).toBe(1); expect(result.restored).toBe(true); expect(result.distance).toBeGreaterThan(2.5);
});
