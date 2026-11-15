import { test, expect } from '@playwright/test';

test('home, auth, language selection, map and game connect on one origin', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('.hero h1')).toContainText('Play a game.');
  await page.getByRole('link', { name: 'Start your adventure' }).first().click();
  await expect(page).toHaveURL(/\/auth\/\?mode=signup$/);
  await expect(page.locator('#auth-title')).toHaveText('Your story starts here.');
  // The animated page swap must support refresh and browser history as well.
  await page.reload();
  await expect(page.locator('#auth-title')).toHaveText('Your story starts here.');
  await page.getByRole('link', { name: 'Back to the neighborhood' }).click();
  await expect(page.locator('.hero h1')).toBeVisible();
  await page.getByRole('link', { name: 'Log in' }).click();
  await expect(page.locator('#auth-title')).toHaveText('Welcome back.');
  await page.goBack();
  await expect(page.locator('.hero h1')).toBeVisible();
  await page.goForward();
  await expect(page.locator('#auth-title')).toHaveText('Welcome back.');
  await page.getByLabel('Email address').fill('demo@example.com');
  await page.getByLabel('Password', { exact: true }).fill('adventure123');
  await page.locator('#auth-form button[type=submit]').click();
  await expect(page).toHaveURL(/\/languages\/index.html$/);
  await page.locator('input[name="language"][value="ne"]').check();
  await expect(page.locator('#play-mode-dialog')).toBeVisible();
  await page.getByRole('button', { name: /Single player: start learning Nepali/ }).click();
  await expect(page).toHaveURL(/\/map\/index.html$/);
  // Letter tracing is chapter 4 now, so chapter 1 starts straight from the map.
  await page.locator('.journey-level-1 .level-label').getByRole('link', { name: 'Start this quest', exact:false }).click();
  await expect(page).toHaveURL(/\/game\/index.html\?level=moving-in$/);
  await expect(page.getByRole('heading', { name: 'Your first hello.' })).toBeVisible();
  await page.getByRole('link', { name: 'howtohello home' }).click();
  await expect(page).toHaveURL('http://127.0.0.1:4174/');
  await expect(page.locator('.hero h1')).toBeVisible();
  expect(errors).toEqual([]);
});

test('direct route entry and reduced-motion navigation work', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('link', { name: 'Start your adventure' }).first().click();
  await expect(page.locator('#auth-title')).toHaveText('Your story starts here.');
  for (const path of ['/auth/', '/languages/', '/map/', '/game/']) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    if (path === '/auth/') await expect(page.locator('#auth-title')).toHaveText('Welcome back.');
    if (path === '/languages/') await expect(page.locator('#language-form')).toBeVisible();
    if (path === '/map/') await expect(page.locator('.quest-map')).toBeVisible();
    if (path === '/game/') await expect(page.getByRole('heading', { name: 'Your first hello.' })).toBeVisible();
  }
});

test('chapter clicks play once without unlocking map music during navigation', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('wayword.progress.ne.v1', '["moving-in"]');
    Object.defineProperty(AudioContext.prototype, 'resume', {
      configurable: true,
      value() {
        sessionStorage.setItem('map-music-resumes', String(Number(sessionStorage.getItem('map-music-resumes')) + 1));
        return Promise.resolve();
      },
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value() {
        if (this instanceof HTMLMediaElement && this.src.endsWith('/audio/map-node-click.wav')) {
          sessionStorage.setItem('map-node-clicks', String(Number(sessionStorage.getItem('map-node-clicks')) + 1));
        }
        return Promise.resolve();
      },
    });
  });
  await page.goto('/map/');
  await expect.poll(() => page.evaluate(() => Number(sessionStorage.getItem('map-music-resumes')))).toBe(1);
  await page.locator('.journey-level-3 .level-node').dispatchEvent('pointerdown', { button: 0 });
  expect(await page.evaluate(() => Number(sessionStorage.getItem('map-node-clicks')))).toBe(1);
  await expect.poll(() => page.evaluate(() => Number(sessionStorage.getItem('map-music-resumes')))).toBe(2);
  await page.getByRole('link', { name: 'Replay level 1' }).click();
  await expect(page).toHaveURL(/\/game\/index.html\?level=moving-in$/);
  expect(await page.evaluate(() => Number(sessionStorage.getItem('map-node-clicks')))).toBe(2);
  expect(await page.evaluate(() => Number(sessionStorage.getItem('map-music-resumes')))).toBe(2);
});

test('map music recovers on map interaction and closes during same-page navigation', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(AudioContext.prototype, 'resume', {
      configurable: true,
      value() {
        sessionStorage.setItem('music-resumes', String(Number(sessionStorage.getItem('music-resumes')) + 1));
        return Promise.resolve();
      },
    });
    const close = AudioContext.prototype.close;
    Object.defineProperty(AudioContext.prototype, 'close', {
      configurable: true,
      value() {
        sessionStorage.setItem('music-closes', String(Number(sessionStorage.getItem('music-closes')) + 1));
        return close.call(this);
      },
    });
  });
  await page.goto('/map/');
  await expect.poll(() => page.evaluate(() => Number(sessionStorage.getItem('music-resumes')))).toBe(1);
  await page.locator('.map-terrain').dispatchEvent('pointerdown', { button: 0 });
  await expect.poll(() => page.evaluate(() => Number(sessionStorage.getItem('music-resumes')))).toBe(2);
  await page.evaluate(() => {
    history.pushState({}, '', '/languages/index.html');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.locator('#language-form')).toBeVisible();
  await expect.poll(() => page.evaluate(() => Number(sessionStorage.getItem('music-closes')))).toBeGreaterThan(0);
});

test('the unlocked market opens its number introduction from the map', async ({ page }) => {
  await page.emulateMedia({ reducedMotion:'reduce' });
  await page.addInitScript(() => {
    localStorage.setItem('wayword.progress.ne.v1', '["little-shop"]');
    // The website asks for the first five vowels before the shop and the finale.
    localStorage.setItem('wayword.tracing.ne.v1', JSON.stringify(['अ','आ','इ','ई','उ']));
  });
  await page.goto('/map/');
  await page.locator('.journey-current-quest').getByRole('link', { name:'Play the finale', exact:false }).click();
  await expect(page).toHaveURL(/\/game\/index.html\?level=market$/);
  await expect(page.locator('#app')).toHaveAttribute('data-phase', 'market');
  await expect(page.locator('.finale-topics li')).toHaveCount(4);
  await page.getByRole('button', { name:'Start exploring' }).click();
  await expect(page.locator('#market-roam')).toHaveAttribute('data-mode', 'roam');
});

test('counting leads to the letters chapter on the tracing page', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('wayword.progress.ne.v1', '["moving-in","second-lesson","counting"]'));
  await page.goto('/map/');
  await expect(page.locator('.journey-level-4 a.level-node')).toHaveAttribute('href','/unit/index.html');
  await expect(page.locator('.journey-level-5 .level-node')).toBeDisabled();
  await page.goto('/game/?level=letters');
  await expect(page).toHaveURL(/\/unit\/index.html$/);
  await expect(page.locator('.writing-tutorial')).toBeVisible();
});

test('chapter one completion opens chapter two and keeps the later chapters in order', async ({ page }) => {
  await page.emulateMedia({ reducedMotion:'reduce' });
  await page.addInitScript(() => localStorage.setItem('wayword.progress.ne.v1', '["moving-in"]'));
  for (const width of [1280,390]) {
    await page.setViewportSize({width,height:844});
    await page.goto('/map/');
    await expect(page.locator('.map-level')).toHaveCount(6);
    await expect(page.locator('.journey-level-1 .level-label')).toContainText('COMPLETE');
    await expect(page.locator('.journey-level-2 a.level-node')).toHaveAttribute('href','/game/index.html?level=second-lesson');
    await expect(page.locator('.journey-level-2 .level-label')).toContainText('Unpack Your Suitcase');
    for (const level of [3,4,5,6]) await expect(page.locator(`.journey-level-${level} .level-node`)).toBeDisabled();
    await expect(page.locator('.journey-level-3 .level-label')).toContainText('Counting with Lila');
    await expect(page.locator('.journey-level-4 .level-label')).toContainText('Your First Letters');
    await expect(page.locator('.journey-level-5 .level-label')).toContainText('CHAPTER 05');
    await expect(page.locator('.journey-level-6 .level-label')).toContainText('FINALE');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const ctaBounds=await page.locator('.journey-current-quest>.button').boundingBox();
    expect(ctaBounds!.y+ctaBounds!.height).toBeLessThanOrEqual(844);
    await page.screenshot({path:`test-results/journey-map-${width}.png`,fullPage:true});
  }
  // The shop needs the first five vowels traced first, so it sends you to the tracing page.
  await page.goto('/game/?level=shop');
  await expect(page).toHaveURL(/\/unit\/index.html$/);
  await page.goto('/game/?level=second-lesson');
  await expect(page.getByRole('heading',{name:'Unpack your suitcase.'})).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('wayword.progress.ne.v1')!))).toEqual(['moving-in']);
});
