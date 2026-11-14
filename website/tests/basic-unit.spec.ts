import {test,expect} from '@playwright/test';

const throughCounting='["moving-in","second-lesson","counting"]';

for(const width of [1280,390])test(`Chapter 4 tracing at ${width}px completes the letters chapter and leads to the shop`,async({page})=>{
  test.setTimeout(90000);
  await page.setViewportSize({width,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(progress=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem('wayword.progress.ne.v1',progress);sessionStorage.setItem('seeded','1');}},throughCounting);
  await page.goto('/unit/');
  await expect(page.locator('.door-story')).toContainText('CHAPTER 04');
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
    await expect(page.locator('#trace-check')).toContainText(index===4?'Finish chapter 04':'Next letter');
    await page.locator('#trace-check').click();
  }
  await expect(page.getByRole('heading',{name:'Five letters, written.'})).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('wayword.progress.ne.v1')!))).toEqual(['moving-in','second-lesson','counting','letters']);
  await expect(page.getByRole('link',{name:'Start chapter 05'})).toHaveAttribute('href','/game/index.html?level=shop');
  await page.screenshot({path:`test-results/letters-complete-${width}.png`});
  await page.getByRole('button',{name:'See your journey'}).click();
  await expect(page.locator('.basic-lessons li')).toHaveCount(6);
  await expect(page.locator('.basic-lessons .lesson-lock')).toHaveCount(1);
  await expect(page.locator('.basic-lessons li').nth(3)).toContainText('Your First Letters');
  await expect(page.locator('.basic-lessons li').nth(5)).toContainText('FINALE');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/basic-story-${width}.png`,fullPage:true});
  await page.reload();
  await page.locator('.basic-lessons li').nth(4).getByRole('link').click();
  await expect(page).toHaveURL(/level=shop$/);
  await expect(page.locator('#app')).not.toHaveAttribute('data-phase','locked');
  expect(errors).toEqual([]);
});

test('the letters chapter stays locked until Counting with Lila is complete',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('wayword.progress.ne.v1','["moving-in","second-lesson"]'));
  await page.goto('/unit/');
  await expect(page.getByRole('heading',{name:'A little earlier in the story…'})).toBeVisible();
  await expect(page.locator('.writing-tutorial')).toHaveCount(0);
});

test('all five bundled pronunciation recordings are served',async({request})=>{
  for(const clip of ['a','aa','i','ii','u']){
    const response=await request.get(`/audio/ne/${clip}.wav`);
    expect(response.ok()).toBe(true);
    expect((await response.body()).subarray(0,4).toString()).toBe('RIFF');
  }
});

test('with local storage blocked, the letters page still lets the learner trace',async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}});
  });
  await page.goto('/unit/');
  await expect(page.locator('.writing-tutorial')).toBeVisible();
  await page.locator('#tutorial-skip').click();
  await page.getByText('Use a keyboard instead',{exact:true}).click();
  await page.getByLabel('Enter the five letters in order').fill('अ आ इ ई उ');
  await page.getByRole('button',{name:'Finish chapter 04',exact:false}).click();
  await expect(page.getByRole('heading',{name:'Five letters, written.'})).toBeVisible();
  await expect(page.locator('.door-success')).toContainText('Progress saving is unavailable');
});
