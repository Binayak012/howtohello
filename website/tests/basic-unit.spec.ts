import {test,expect} from '@playwright/test';

for(const width of [1280,390])test(`Basic tracing at ${width}px unlocks the four-chapter story`,async({page})=>{
  test.setTimeout(90000);
  await page.setViewportSize({width,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/game/');
  await expect(page).toHaveURL(/\/unit\/index.html$/);
  await expect(page.locator('.writing-tutorial')).toBeVisible();
  await page.locator('#tutorial-skip').click();
  await page.locator('#trace-check').click();
  await expect(page.locator('#trace-check')).toContainText('Check letter');
  expect(await page.evaluate(()=>localStorage.getItem('wayword.unit.ne.basic.v1'))).toBeNull();
  for(const [index,letter]of ['अ','आ','इ','ई','उ'].entries()){
    await expect(page.locator('#trace-title')).toContainText(letter);
    await expect(page.locator('#hear-letter')).toHaveAttribute('aria-label',`Hear ${letter} pronounced in Nepali`);
    const strokes=await page.locator('.writing-demo-paths path').evaluateAll(paths=>paths.map(element=>{
      const path=element as SVGPathElement,length=path.getTotalLength(),matrix=path.getScreenCTM()!;
      return Array.from({length:Math.ceil(length/4)+1},(_,i)=>{
        const local=path.getPointAtLength(Math.min(length,i*4));
        const point=new DOMPoint(local.x,local.y).matrixTransform(matrix);
        return{x:point.x,y:point.y};
      });
    }));
    for(const stroke of strokes){
      await page.mouse.move(stroke[0].x,stroke[0].y);await page.mouse.down();
      for(const point of stroke.slice(1))await page.mouse.move(point.x,point.y);
      await page.mouse.up();
    }
    if(index===0)await page.screenshot({path:`test-results/basic-tracing-${width}.png`});
    await page.locator('#trace-check').click();
    await expect(page.locator('#trace-check')).toContainText(index===4?'Unlock Basic':'Next letter');
    await page.locator('#trace-check').click();
  }
  await expect(page.getByRole('heading',{name:'Welcome to Basic.'})).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem('wayword.unit.ne.basic.v1'))).toBe('unlocked');
  expect(await page.evaluate(()=>localStorage.getItem('wayword.progress.ne.v1'))).toBeNull();
  await page.getByRole('button',{name:'Step inside',exact:false}).click();
  await expect(page.locator('.basic-lessons li')).toHaveCount(4);
  await expect(page.locator('.basic-lessons .lesson-lock')).toHaveCount(3);
  await expect(page.locator('.basic-lessons li').nth(0)).toContainText('Your First Hello');
  await expect(page.locator('.basic-lessons li').nth(1).getByRole('button')).toBeDisabled();
  await expect(page.locator('.basic-lessons li').nth(2)).toContainText('The Little Shop');
  await expect(page.locator('.basic-lessons li').nth(3)).toContainText('FINALE');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/basic-story-${width}.png`,fullPage:true});
  await page.reload();
  await expect(page.locator('.basic-lessons')).toBeVisible();
  await page.locator('.basic-lessons').getByRole('link',{name:'Let’s play',exact:false}).click();
  await expect(page.getByRole('heading',{name:'Your first hello.'})).toBeVisible();
  expect(errors).toEqual([]);
});

test('all five bundled pronunciation recordings are served',async({request})=>{
  for(const clip of ['a','aa','i','ii','u']){
    const response=await request.get(`/audio/ne/${clip}.wav`);
    expect(response.ok()).toBe(true);
    expect((await response.body()).subarray(0,4).toString()).toBe('RIFF');
  }
});

test('the Basic unlock can use session storage when local storage is blocked',async({page})=>{
  await page.addInitScript(()=>{
    sessionStorage.setItem('wayword.unit.ne.basic.v1','unlocked');
    Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}});
  });
  await page.goto('/unit/');
  await expect(page.locator('.basic-lessons')).toBeVisible();
  await page.locator('.basic-lessons').getByRole('link',{name:'Let’s play',exact:false}).click();
  await expect(page.getByRole('heading',{name:'Your first hello.'})).toBeVisible();
});
