import { test, expect, type Page } from '@playwright/test';
import { baseBeats, routeTo, start, step, turn, type Player } from '../src/core';

const keys: Record<string, string> = { left:'ArrowLeft', right:'ArrowRight', forward:'ArrowUp', backward:'ArrowDown', take:'Space' };
/** Step 2 of the lesson: a wrong answer is explained and the word comes back; then all four are answered. */
async function passQuiz(page: Page) {
  await page.locator('#lesson-next').click();
  await expect(page.getByRole('heading', { name:'Which way?' })).toBeVisible();
  const opposite: Record<string, string> = { left:'right', right:'left', forward:'backward', backward:'forward' };
  const first = (await page.locator('#quiz-word').getAttribute('data-expect'))!;
  await page.locator(`[data-answer="${opposite[first]}"]`).click();
  await expect(page.locator('#quiz-feedback')).toContainText('That way is');
  await expect(page.locator('.quiz-score i')).toHaveCount(5);
  for (let i = 0; i < 5; i++) {
    const answer = (await page.locator('#quiz-word').getAttribute('data-expect'))!;
    await page.keyboard.press(keys[answer]);
    await expect(page.locator('.quiz-score i.done')).toHaveCount(i + 1);
  }
  await page.getByRole('button', { name:'Let’s try it in the shop' }).click();
}
async function learn(page: Page, snapshots = false) {
  await page.addInitScript(()=>localStorage.setItem('wayword.progress.ne.v1','["moving-in","second-lesson","counting","letters"]'));
  await page.goto('/?level=shop');
  await expect(page.getByRole('heading', { name:'Your first little errand.' })).toBeVisible();
  if (snapshots) await page.screenshot({ path:'test-results/story.png' });
  await page.getByRole('button', { name:'Say namaste to the shopkeeper' }).click();
  await page.getByRole('button', { name:'Learn the four words' }).click();
  for (const word of ['दायाँ', 'बायाँ', 'अगाडि', 'पछाडि']) await expect(page.locator('.direction-map')).toContainText(word);
  // Step 1: every word has to be tried before the quick check opens.
  await expect(page.locator('#lesson-next')).toBeDisabled();
  for (const word of ['right', 'left', 'forward']) await page.locator(`[data-word="${word}"]`).click();
  await expect(page.locator('#lesson-next')).toBeDisabled();
  await page.locator('[data-word="backward"]').click();
  await expect(page.locator('#word-explanation')).toContainText('without turning');
  const guide = page.locator('.direction-backward .latin-guide');
  await expect(guide).toHaveText('pachhadi');
  await page.getByRole('switch', { name:'Latin-letter guides' }).click();
  await expect(guide).toBeHidden();
  await expect(page.locator('.direction-backward strong')).toBeVisible();
  await page.getByRole('switch', { name:'Latin-letter guides' }).click();
  await expect(guide).toBeVisible();
  const nepali = page.locator('.direction-backward strong');
  await page.getByRole('switch', { name:'Nepali script' }).click();
  await expect(nepali).toBeHidden();
  await expect(page.locator('.direction-backward .word-meaning')).toBeVisible();
  await page.getByRole('switch', { name:'Nepali script' }).click();
  await expect(nepali).toBeVisible();
  await page.screenshot({ path: snapshots ? 'test-results/word-lesson.png' : 'test-results/word-lesson-small.png' });
  await passQuiz(page);
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
  await page.getByRole('button', { name:'Hide Nepali script' }).click();
  await expect(page.locator('#target')).toBeHidden();
  await page.getByRole('button', { name:'Show Nepali script' }).click();
  await expect(page.locator('#target')).toBeVisible();
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
    if (!phone) {
      await page.evaluate(async () => {
        const { effects } = await import('/src/shop-game.ts');
        const counts = { footsteps:0, bags:0, reactions:0, fruit:0, bottles:0, scans:0, complete:0 };
        const footstep = effects.footstep.bind(effects), bagRustle = effects.bagRustle.bind(effects), reaction = effects.shopkeeperReaction.bind(effects);
        const fruit = effects.fruitPickup.bind(effects), bottle = effects.bottlePickup.bind(effects), scan = effects.barcodeScan.bind(effects), complete = effects.levelComplete.bind(effects);
        effects.footstep = () => { counts.footsteps++; footstep(); };
        effects.bagRustle = () => { counts.bags++; bagRustle(); };
        effects.shopkeeperReaction = () => { counts.reactions++; reaction(); };
        effects.fruitPickup = () => { counts.fruit++; fruit(); };
        effects.bottlePickup = () => { counts.bottles++; bottle(); };
        effects.barcodeScan = () => { counts.scans++; scan(); };
        effects.levelComplete = () => { counts.complete++; complete(); };
        (window as typeof window & { __effectCounts?: typeof counts }).__effectCounts = counts;
      });
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('ArrowRight');
      expect(await page.evaluate(() => (window as typeof window & { __effectCounts?: { footsteps:number } }).__effectCounts?.footsteps)).toBe(0);
    }
    if (phone) await page.screenshot({ path:'test-results/phone-practice.png' });
    let player = await shop(page);
    if (!phone) {
      const counts = await page.evaluate(() => (window as typeof window & { __effectCounts?: { footsteps:number; bags:number; fruit:number; bottles:number } }).__effectCounts);
      expect(counts?.footsteps).toBeGreaterThan(0);
      expect(counts?.bags).toBe(2);
      expect(counts?.fruit).toBe(1);
      expect(counts?.bottles).toBe(1);
    }
    await page.getByRole('button', { name:'Place items', exact:true }).click();
    await expect(page.locator('#app')).toHaveAttribute('data-phase', 'scanning');
    await expect(page.locator('#results')).toBeHidden();
    await expect(page.getByRole('button', { name:'Step forward', exact:true })).toBeDisabled();
    await expect(page.locator('#checkout-status')).toHaveAttribute('data-scanned', /[1-4]/);
    await page.screenshot({ path:`test-results/${phone ? 'phone' : 'desktop'}-checkout.png` });
    await expect(page.locator('#app')).toHaveAttribute('data-phase', 'collect', { timeout:12000 });
    await expect(page.locator('#checkout-status')).toHaveAttribute('data-scanned', '4');
    if (!phone) expect(await page.evaluate(() => (window as typeof window & { __effectCounts?: { scans:number } }).__effectCounts?.scans)).toBe(4);
    await expect(page.locator('#results')).toBeHidden();
    if (!phone) await page.screenshot({ path:'test-results/packed-bag.png' });
    await page.getByRole('button', { name:'Pick up bag', exact:true }).click();
    await expect(page.locator('#app')).toHaveAttribute('data-phase', 'exit');
    if (!phone) expect(await page.evaluate(() => (window as typeof window & { __effectCounts?: { bags:number } }).__effectCounts?.bags)).toBe(4);
    await expect(page.locator('#basket')).toContainText('Carrying your packed shopping');
    await expect(page.locator('#results')).toBeHidden();
    // Restore scene focus after clicking the contextual action.
    player = await follow(page, player, 'door');
    expect(player.row).toBe(7);
    expect(player.facing).toBe('S');
    await expect(page.locator('#app')).toHaveAttribute('data-phase', 'complete');
    await expect(page.locator('#results')).toContainText('Your first errand. Done.');
    await expect(page.locator('#results')).toContainText('8 first-try successes');
    await expect(page.locator('.completion-medal')).toBeVisible();
    await expect(page.locator('.completion-sparks i')).toHaveCount(16);
    if (!phone) expect(await page.evaluate(() => (window as typeof window & { __effectCounts?: { reactions:number } }).__effectCounts?.reactions)).toBe(3);
    if (!phone) expect(await page.evaluate(() => (window as typeof window & { __effectCounts?: { complete:number } }).__effectCounts?.complete)).toBe(1);
    await page.waitForTimeout(750);
    expect(await page.evaluate(async () => !(await import('/src/shop-game.ts')).radio.sound?.isPlaying)).toBe(true);
    await expect(page.locator('#market-journey')).toBeHidden();
    await expect(page.locator('#market-arrival')).toBeHidden();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('wayword.progress.ne.v1') ?? '[]'))).toEqual(['moving-in','second-lesson','counting','letters','little-shop']);

    await page.screenshot({ path:`test-results/${phone ? 'phone' : 'desktop'}-complete.png` });
    // The closed-door completion stays put until the learner chooses Next level.
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('#position')).toContainText('Tile 4, 7');
    await expect(page.getByRole('button', { name:'Step forward', exact:true })).toBeDisabled();
    await expect(page.locator('#next-level')).toBeFocused();
    await expect(page.locator('.next-chapter')).toContainText('The Morning Market');
    if (phone) await page.getByRole('button', { name:'Step outside to the market' }).click();
    else await page.keyboard.press('Enter');
    await expect(page.locator('#app')).toHaveAttribute('data-phase', 'departing');
    await expect(page.locator('#results')).toBeHidden();
    await page.waitForTimeout(5400);
    await page.screenshot({ path:`test-results/${phone ? 'phone' : 'desktop'}-market.png` });
    if (phone) await page.getByRole('button', { name:'Continue', exact:false }).click();
    await expect(page.locator('#app')).toHaveAttribute('data-phase', 'market', { timeout:15000 });
    await expect(page.locator('#results')).toBeHidden();
    await expect(page.locator('#market-title')).toHaveText('Good morning, neighbor!');
    await expect(page.getByRole('button', { name:'Start exploring' })).toBeVisible();
    await expect(page.locator('.finale-topics li')).toHaveCount(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
    await page.getByRole('button', { name:'Replay the shop', exact:true }).click();
    await expect(page.locator('#app')).toHaveAttribute('data-phase', 'story');
    await expect(page.locator('#basket')).toHaveAttribute('data-count', '0');
  });
}

test('radio is positional, keyboard controlled, persistent, and single-sourced across restarts', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('wayword.progress.ne.v1','["little-shop"]');
    if (!sessionStorage.getItem('radio-test-started')) {
      localStorage.removeItem('wayword.radio.enabled');
      sessionStorage.setItem('radio-test-started', 'true');
    }
  });
  await page.goto('/?level=shop');
  const toggle = page.getByRole('button', { name:'Turn radio off' });
  await expect(toggle).toHaveAttribute('data-state', 'on', { timeout:15000 });
  expect(await page.evaluate(async () => (await import('/src/shop-game.ts')).radio.sound?.isPlaying)).toBe(false);
  await page.getByRole('button', { name:'Say namaste to the shopkeeper' }).click();
  await page.getByRole('button', { name:'Learn the four words' }).click();
  expect(await page.evaluate(async () => (await import('/src/shop-game.ts')).radio.sound?.isPlaying)).toBe(false);
  for (const word of ['right', 'left', 'forward', 'backward']) await page.locator(`[data-word="${word}"]`).click();
  await passQuiz(page);
  await expect.poll(() => page.evaluate(async () => (await import('/src/shop-game.ts')).radio.sound?.isPlaying)).toBe(true);
  const audio = await page.evaluate(async () => {
    const { radio, scene } = await import('/src/shop-game.ts');
    const sound = radio.sound;
    return {
      positional: !!sound && 'panner' in sound,
      listenerOnCamera: radio.listener?.parent === scene?.camera,
      sourceOnRadio: sound?.parent === scene?.radioAnchor,
      sourceCount: scene?.radioAnchor.children.filter(child => child === sound).length,
      playing: sound?.isPlaying,
      refDistance: sound && 'panner' in sound ? sound.getRefDistance() : 0,
      rolloff: sound && 'panner' in sound ? sound.getRolloffFactor() : 0,
      distanceModel: sound && 'panner' in sound ? sound.getDistanceModel() : '',
      maxDistance: sound && 'panner' in sound ? sound.getMaxDistance() : 0,
      maxVolume: sound?.gain.gain.value,
    };
  });
  expect(audio).toMatchObject({ positional:true, listenerOnCamera:true, sourceOnRadio:true, sourceCount:1, playing:true, refDistance:.8, rolloff:1, distanceModel:'linear', maxDistance:7 });
  expect(audio.maxVolume).toBeLessThanOrEqual(.24);

  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name:'Turn radio on' })).toHaveAttribute('aria-pressed', 'false');
  await page.reload();
  await expect(page.getByRole('button', { name:'Turn radio on' })).toHaveAttribute('data-state', 'off');
  await page.getByRole('button', { name:'Turn radio on' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name:'Turn radio off' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name:'Start over' }).click({ force:true });
  await page.getByRole('button', { name:'Start over' }).click({ force:true });
  expect(await page.evaluate(async () => {
    const { radio, scene } = await import('/src/shop-game.ts');
    return scene?.radioAnchor.children.filter(child => child === radio.sound).length;
  })).toBe(1);
});

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
  await page.addInitScript(()=>localStorage.setItem('wayword.progress.ne.v1','["little-shop"]'));
  await page.goto('/?level=shop');await expect(page.locator('#app')).toHaveAttribute('data-phase','story');
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
    let arrivals = 0;
    shop.walkIntoMarket(() => arrivals++);
    shop.finishDeparture(); shop.finishDeparture();
    const arrived = shop.arrived && arrivals === 1 && shop.camera.position.z > 7 && shop.camera.position.z < 9;
    shop.resetStock();
    const journeyReset = !shop.arrived && !shop.departure;
    shop.walkIntoMarket(() => arrivals++); shop.resetStock();
    const cancelled = !shop.departure && arrivals === 1;
    shop.reducedMotion = true;
    shop.walkIntoMarket(() => arrivals++);
    const reducedArrival = shop.arrived && !shop.departure && arrivals === 2;
    shop.dispose(); host.remove();
    return { hidden, restored, distance, arrived, journeyReset, cancelled, reducedArrival };
  });
  expect(result.hidden).toBe(1); expect(result.restored).toBe(true); expect(result.distance).toBeGreaterThan(2.5);
  expect(result.arrived).toBe(true); expect(result.journeyReset).toBe(true);
  expect(result.cancelled).toBe(true); expect(result.reducedArrival).toBe(true);
});
