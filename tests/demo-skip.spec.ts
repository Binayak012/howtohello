import { test, expect } from '@playwright/test';

test('the corner demo skipper jumps to any chapter and unlocks the ones before it', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?level=moving-in');
  const skip = page.getByRole('button', { name: 'Skip to a chapter (demo)' });
  await expect(skip).toBeVisible();
  await expect(page.locator('.demo-skip [aria-current=page]')).toContainText('Your First Hello');
  await skip.click();
  await page.getByRole('link', { name: /The Little Shop/ }).click();
  await expect(page.getByRole('heading', { name: 'Your first little errand.' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('wayword.progress.ne.v1')!))).toEqual(['moving-in', 'second-lesson', 'counting', 'letters']);
  // Arrow keys in the open menu must not move the player.
  await page.getByRole('button', { name: 'Skip to a chapter (demo)' }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Skip to a chapter (demo)' }).click();
  await page.getByRole('link', { name: /The Morning Market/ }).click();
  await expect(page.locator('#market-title')).toHaveText('Good morning, neighbor!');
  await page.getByRole('button', { name: 'Skip to a chapter (demo)' }).click();
  await page.getByRole('link', { name: /Counting with Lila/ }).click();
  await expect(page).toHaveURL(/level=counting/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('wayword.progress.ne.v1')!))).toEqual(['moving-in', 'second-lesson']);
  expect(errors).toEqual([]);
});
