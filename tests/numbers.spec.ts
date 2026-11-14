import { test, expect } from '@playwright/test';

for (const phone of [false, true]) {
  test(`${phone ? 'phone' : 'desktop'}: the finale opens on a four-topic review, and numbers stay reviewable while exploring`, async ({ page }) => {
    if (phone) await page.setViewportSize({ width:390, height:844 });
    await page.emulateMedia({ reducedMotion:'reduce' });
    await page.addInitScript(() => localStorage.setItem('wayword.progress.ne.v1', '["little-shop"]'));
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('/?level=market');
    await expect(page.locator('#app')).toHaveAttribute('data-phase', 'market');
    // Numbers are taught in chapter 3; the finale reviews greetings, colors, numbers and directions.
    await expect(page.locator('#market-arrival')).toContainText('CHAPTER 06 · FINALE');
    await expect(page.locator('.finale-topics li')).toHaveCount(4);
    await page.screenshot({ path:`test-results/${phone ? 'phone' : 'desktop'}-finale-review.png` });
    await page.getByRole('button', { name:'Start exploring' }).click();
    await expect(page.locator('#market-roam')).toHaveAttribute('data-mode','roam');
    await page.getByRole('button', { name:'Review numbers 1–5' }).click();
    const lesson = page.locator('#numbers-lesson');
    await expect(lesson).toHaveAttribute('data-stage', 'learn');
    await expect(page.getByRole('button', { name:'Hand over basket' })).toHaveCount(0);
    // Opening the last number alone must not bypass the introduction.
    await page.getByRole('button', { name:'Learn five', exact:true }).click();
    await expect(page.locator('.number-help')).toContainText('2 of 5 explored');
    await expect(page.getByRole('button', { name:'Let’s try the numbers' })).toHaveCount(0);
    const words = ['एक', 'दुई', 'तीन', 'चार', 'पाँच'];
    for (const [i, word] of words.entries()) {
      await page.locator(`[data-number-index="${i}"]`).click();
      await expect(page.locator('.number-study .number-word')).toHaveText(word);
      await expect(page.locator('.number-study .count-fruit')).toHaveCount(i + 1);
    }
    await page.getByRole('button', { name:'Show Latin-letter guides' }).click();
    await expect(page.locator('.number-study .latin-guide')).toBeHidden();
    await page.getByRole('button', { name:'Show Latin-letter guides' }).click();
    await expect(page.locator('.number-study .latin-guide')).toBeVisible();
    await page.screenshot({ path:`test-results/${phone ? 'phone' : 'desktop'}-numbers-learn.png` });
    await page.getByRole('button', { name:'Let’s try the numbers' }).click();
    await expect(lesson).toHaveAttribute('data-stage', 'check');
    await page.getByRole('button', { name:'Answer 1', exact:true }).click();
    await expect(page.locator('.numbers-feedback')).toContainText('Not quite');
    await expect(page.locator('.number-round')).toContainText('1 / 5');
    for (const value of [3, 1, 5, 2, 4]) {
      await page.getByRole('button', { name:`Answer ${value}`, exact:true }).click();
      await page.locator('#number-next').click();
    }
    await expect(lesson).toHaveAttribute('data-stage', 'done');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('wayword.progress.ne.v1')!))).toEqual(['little-shop']);
    await page.getByRole('button', { name:'Explore the market' }).click();
    await expect(lesson).toBeHidden();
    await expect(page.locator('#market-roam')).toBeVisible();
    await expect(page.locator('#market-roam')).toHaveAttribute('data-mode','roam');
    const before=Number(await page.locator('#market-roam').getAttribute('data-market-x'));
    if(phone){const box=(await page.getByRole('button',{name:'Walk forward',exact:true}).boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.waitForTimeout(450);await page.mouse.up();}
    else{await page.keyboard.down('w');await page.waitForTimeout(450);await page.keyboard.up('w');}
    expect(Number(await page.locator('#market-roam').getAttribute('data-market-x'))).toBeGreaterThan(before+.5);
    await page.reload();
    await expect(page.locator('#market-roam')).toHaveAttribute('data-mode','roam', { timeout:15000 });
    await page.getByRole('button', { name:'Start over' }).click();
    await expect(lesson).toBeHidden();
    await expect(page.locator('#app')).toHaveAttribute('data-phase', 'story');
    expect(errors).toEqual([]);
  });
}

test('a fresh learner cannot skip the shop through the market resume URL', async ({ page }) => {
  await page.goto('/?level=market');
  await expect(page.locator('#app')).toHaveAttribute('data-phase', 'locked');
  await expect(page.getByRole('link',{name:'Play Your First Hello'})).toBeVisible();
});
