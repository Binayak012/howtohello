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
  await page.locator('#language-continue').click();
  await expect(page).toHaveURL(/\/map\/index.html$/);
  await page.getByRole('link', { name: 'Unlock Basic', exact:false }).click();
  await page.locator('#tutorial-skip').click();
  await page.getByText('Use a keyboard instead', {exact:true}).click();
  await page.getByLabel('Enter the five letters in order').fill('अ आ इ ई उ');
  await page.getByRole('button', {name:'Unlock Basic',exact:false}).click();
  await page.getByRole('button', {name:'Step inside',exact:false}).click();
  await page.locator('.basic-lessons').getByRole('link', {name:'Let’s play',exact:false}).click();
  await expect(page).toHaveURL(/\/game\/index.html\?level=moving-in$/);
  await expect(page.getByRole('heading', { name: 'Your first hello.' })).toBeVisible();
  await page.getByRole('link', { name: 'Wayword home' }).click();
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
    if (path === '/game/') {
      await expect(page).toHaveURL(/\/unit\/index.html$/);
      await expect(page.locator('.writing-tutorial')).toBeVisible();
    }
  }
});

test('the map intro plays once and stops before chapter audio can begin', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('wayword.progress.ne.v1', '["moving-in"]');
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value() {
        if (this instanceof HTMLMediaElement && this.src.endsWith('/audio/map-intro.wav')) {
          sessionStorage.setItem('map-intro-plays', String(Number(sessionStorage.getItem('map-intro-plays')) + 1));
        }
        if (this instanceof HTMLMediaElement && this.src.endsWith('/audio/map-node-click.wav')) {
          sessionStorage.setItem('map-node-clicks', String(Number(sessionStorage.getItem('map-node-clicks')) + 1));
        }
        return Promise.resolve();
      },
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      value() {
        if (this instanceof HTMLMediaElement && this.src.endsWith('/audio/map-intro.wav')) {
          sessionStorage.setItem('map-intro-pauses', String(Number(sessionStorage.getItem('map-intro-pauses')) + 1));
        }
      },
    });
  });
  await page.goto('/map/');
  await expect.poll(() => page.evaluate(() => Number(sessionStorage.getItem('map-intro-plays')))).toBe(1);
  await page.locator('.journey-map-intro').click();
  await page.mouse.wheel(0, 300);
  expect(await page.evaluate(() => Number(sessionStorage.getItem('map-intro-plays')))).toBe(1);
  await page.locator('.journey-level-3 .level-node').dispatchEvent('pointerdown', { button: 0 });
  expect(await page.evaluate(() => Number(sessionStorage.getItem('map-node-clicks')))).toBe(1);
  await page.getByRole('link', { name: 'Replay level 1' }).click();
  await expect(page).toHaveURL(/\/game\/index.html\?level=moving-in$/);
  expect(await page.evaluate(() => Number(sessionStorage.getItem('map-node-clicks')))).toBe(2);
  expect(await page.evaluate(() => Number(sessionStorage.getItem('map-intro-pauses')))).toBeGreaterThan(0);
});

test('blocked map audio retries once on the first eligible interaction', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value() {
        if (!(this instanceof HTMLMediaElement) || !this.src.endsWith('/audio/map-intro.wav')) return Promise.resolve();
        const attempts = Number(sessionStorage.getItem('map-intro-attempts')) + 1;
        sessionStorage.setItem('map-intro-attempts', String(attempts));
        return attempts === 1 ? Promise.reject(new DOMException('Autoplay blocked', 'NotAllowedError')) : Promise.resolve();
      },
    });
  });
  await page.goto('/map/');
  await expect.poll(() => page.evaluate(() => Number(sessionStorage.getItem('map-intro-attempts')))).toBe(1);
  await page.locator('.journey-map-intro').click();
  await expect.poll(() => page.evaluate(() => Number(sessionStorage.getItem('map-intro-attempts')))).toBe(2);
  await page.locator('.journey-map-intro').click();
  expect(await page.evaluate(() => Number(sessionStorage.getItem('map-intro-attempts')))).toBe(2);
});

test('the map sound stays silent while hidden and visibility alone does not start it', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    Object.defineProperty(HTMLMediaElement.prototype, 'play', {
      configurable: true,
      value() {
        sessionStorage.setItem('hidden-map-plays', String(Number(sessionStorage.getItem('hidden-map-plays')) + 1));
        return Promise.resolve();
      },
    });
    Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
      configurable: true,
      value() {
        sessionStorage.setItem('hidden-map-pauses', String(Number(sessionStorage.getItem('hidden-map-pauses')) + 1));
      },
    });
  });
  await page.goto('/map/');
  expect(await page.evaluate(() => Number(sessionStorage.getItem('hidden-map-plays')))).toBe(0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(await page.evaluate(() => Number(sessionStorage.getItem('hidden-map-plays')))).toBe(0);
  await page.locator('.journey-map-intro').click();
  await expect.poll(() => page.evaluate(() => Number(sessionStorage.getItem('hidden-map-plays')))).toBe(1);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  expect(await page.evaluate(() => Number(sessionStorage.getItem('hidden-map-pauses')))).toBeGreaterThan(0);
});

test('the unlocked market opens its number introduction from the map', async ({ page }) => {
  await page.emulateMedia({ reducedMotion:'reduce' });
  await page.addInitScript(() => localStorage.setItem('wayword.progress.ne.v1', '["little-shop"]'));
  await page.goto('/map/');
  await page.getByRole('link', { name:'Learn to count', exact:false }).click();
  await expect(page).toHaveURL(/\/game\/index.html\?level=market$/);
  await expect(page.locator('#app')).toHaveAttribute('data-phase', 'market');
  await page.getByRole('button', { name:'Learn numbers 1–5' }).click();
  await expect(page.locator('#numbers-lesson')).toHaveAttribute('data-stage', 'learn');
  await expect(page.locator('.number-study .number-word')).toHaveText('एक');
});

test('chapter one completion opens chapter two and keeps the later chapters in order', async ({ page }) => {
  await page.emulateMedia({ reducedMotion:'reduce' });
  await page.addInitScript(() => localStorage.setItem('wayword.progress.ne.v1', '["moving-in"]'));
  for (const width of [1280,390]) {
    await page.setViewportSize({width,height:844});
    await page.goto('/map/');
    await expect(page.locator('.journey-level-1 .level-label')).toContainText('COMPLETE');
    await expect(page.locator('.journey-level-2 a.level-node')).toHaveAttribute('href','/game/index.html?level=second-lesson');
    await expect(page.locator('.journey-level-2 .level-label')).toContainText('Unpack Your Suitcase');
    await expect(page.locator('.journey-level-3 .level-node')).toBeDisabled();
    await expect(page.locator('.journey-level-4 .level-node')).toBeDisabled();
    await expect(page.locator('.journey-level-3 .level-label')).toContainText('CHAPTER 03');
    await expect(page.locator('.journey-level-4 .level-label')).toContainText('FINALE');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const mapBounds=await page.locator('.quest-map').boundingBox(),ctaBounds=await page.locator('.journey-level-1 .level-label .button').boundingBox();
    expect(ctaBounds!.y+ctaBounds!.height).toBeLessThan(mapBounds!.y+mapBounds!.height-12);
    await page.screenshot({path:`test-results/journey-map-${width}.png`,fullPage:true});
  }
  await page.goto('/game/?level=shop');
  await expect(page.locator('#app')).toHaveAttribute('data-phase','locked');
  await page.goto('/game/?level=second-lesson');
  await expect(page.getByRole('heading',{name:'Unpack your suitcase.'})).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('wayword.progress.ne.v1')!))).toEqual(['moving-in']);
});
