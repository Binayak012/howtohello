import {test,expect} from '@playwright/test';

for(const width of [1280,390])test(`Basic tracing at ${width}px unlocks the four-chapter story`,async({page})=>{
  test.setTimeout(90000);
  await page.setViewportSize({width,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.addInitScript(()=>{
    const createOscillator=AudioContext.prototype.createOscillator;
    Object.defineProperty(AudioContext.prototype,'createOscillator',{configurable:true,value(){
      sessionStorage.setItem('trace-mistake-voices',String(Number(sessionStorage.getItem('trace-mistake-voices'))+1));
      return createOscillator.call(this);
    }});
    Object.defineProperty(HTMLMediaElement.prototype,'play',{configurable:true,value(){
      if(this instanceof HTMLMediaElement&&this.src.endsWith('/audio/trace-success.wav'))sessionStorage.setItem('trace-success-count',String(Number(sessionStorage.getItem('trace-success-count'))+1));
      if(this instanceof HTMLMediaElement&&this.src.endsWith('/audio/trace-complete.wav'))sessionStorage.setItem('trace-complete-count',String(Number(sessionStorage.getItem('trace-complete-count'))+1));
      return Promise.resolve();
    }});
  });
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/game/');
  await expect(page).toHaveURL(/\/unit\/index.html$/);
  await expect(page.locator('.writing-tutorial')).toBeVisible();
  await page.locator('#tutorial-skip').click();
  await page.locator('#trace-check').click();
  await expect(page.locator('#trace-check')).toContainText('Check letter');
  await expect(page.locator('#trace-feedback')).toHaveText('Stay a little closer to the pale letter. Clear your strokes and try again.');
  expect(await page.evaluate(()=>localStorage.getItem('wayword.unit.ne.basic.v1'))).toBeNull();
  expect(await page.evaluate(()=>Number(sessionStorage.getItem('trace-success-count')))).toBe(0);
  expect(await page.evaluate(()=>Number(sessionStorage.getItem('trace-complete-count')))).toBe(0);
  expect(await page.evaluate(()=>Number(sessionStorage.getItem('trace-mistake-voices')))).toBe(2);
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
    if(index<4){
      await expect(page.locator('#trace-feedback')).toHaveText('Nice! That letter is your next piece of the passcode.');
      await expect(page.locator(`[data-code="${index}"]`)).toHaveClass(/is-earned/);
      expect(await page.evaluate(()=>Number(sessionStorage.getItem('trace-success-count')))).toBe(index+1);
      expect(await page.evaluate(()=>Number(sessionStorage.getItem('trace-complete-count')))).toBe(0);
      expect(await page.evaluate(()=>Number(sessionStorage.getItem('trace-mistake-voices')))).toBe(2);
      if(index===0){
        await page.setViewportSize({width:width===1280?1279:391,height:844});
        expect(await page.evaluate(()=>Number(sessionStorage.getItem('trace-success-count')))).toBe(1);
        await page.setViewportSize({width,height:844});
      }
      await expect(page.locator('#trace-check')).toContainText('Next letter');
      await page.locator('#trace-check').click();
    }else{
      await expect(page.getByRole('heading',{name:'Welcome to Basic.'})).toBeVisible();
      expect(await page.evaluate(()=>Number(sessionStorage.getItem('trace-success-count')))).toBe(4);
      expect(await page.evaluate(()=>Number(sessionStorage.getItem('trace-complete-count')))).toBe(1);
      await expect(page.locator('.unit-portal')).toHaveClass(/is-open/);
      await expect(page.locator('.unit-portal')).toHaveClass(/is-final-highlight/);
      await expect(page.locator('.door-confetti')).toHaveCount(0);
    }
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
  for(const clip of ['trace-success','trace-complete']){
    const response=await request.get(`/audio/${clip}.wav`);
    expect(response.ok()).toBe(true);
    expect((await response.body()).subarray(0,4).toString()).toBe('RIFF');
  }
});

test('pronunciation defers the generated try-again cue',async({page})=>{
  await page.addInitScript(()=>{
    const createOscillator=AudioContext.prototype.createOscillator;
    Object.defineProperty(AudioContext.prototype,'createOscillator',{configurable:true,value(){
      sessionStorage.setItem('try-again-voices',String(Number(sessionStorage.getItem('try-again-voices'))+1));
      return createOscillator.call(this);
    }});
    Object.defineProperty(HTMLMediaElement.prototype,'play',{configurable:true,value(){
      if(this instanceof HTMLMediaElement&&this.src.includes('/audio/ne/')){
        (window as Window&{__activePronunciation?:HTMLMediaElement}).__activePronunciation=this;
      }
      return Promise.resolve();
    }});
  });
  await page.goto('/unit/');
  await page.locator('#tutorial-skip').click();
  await page.locator('#hear-letter').click();
  await expect(page.locator('#hear-letter')).toHaveClass(/is-speaking/);
  await page.locator('#trace-check').click();
  await expect(page.locator('#trace-feedback')).toHaveText('Stay a little closer to the pale letter. Clear your strokes and try again.');
  expect(await page.evaluate(()=>Number(sessionStorage.getItem('try-again-voices')))).toBe(0);
  await page.evaluate(()=>(window as Window&{__activePronunciation?:HTMLMediaElement}).__activePronunciation?.dispatchEvent(new Event('ended')));
  await expect.poll(()=>page.evaluate(()=>Number(sessionStorage.getItem('try-again-voices')))).toBe(2);
});

test('the keyboard alternative celebrates once only after the valid passcode and yields to pronunciation',async({page})=>{
  await page.addInitScript(()=>{
    const log=(event:string)=>{const events=JSON.parse(sessionStorage.getItem('trace-audio-events')??'[]');events.push(event);sessionStorage.setItem('trace-audio-events',JSON.stringify(events));};
    Object.defineProperty(HTMLMediaElement.prototype,'play',{configurable:true,value(){
      if(this instanceof HTMLMediaElement){
        if(this.src.includes('/audio/ne/'))log('pronunciation-play');
        if(this.src.endsWith('/audio/trace-success.wav'))log('success-play');
        if(this.src.endsWith('/audio/trace-complete.wav'))log('complete-play');
      }
      return Promise.resolve();
    }});
    Object.defineProperty(HTMLMediaElement.prototype,'pause',{configurable:true,value(){
      if(this instanceof HTMLMediaElement&&this.src.includes('/audio/ne/'))log('pronunciation-pause');
    }});
  });
  await page.goto('/unit/');
  await page.locator('#tutorial-skip').click();
  await page.getByText('Use a keyboard instead',{exact:true}).click();
  await page.getByLabel('Enter the five letters in order').fill('अ आ इ उ ई');
  await page.getByRole('button',{name:'Unlock Basic',exact:false}).click();
  await expect(page.locator('#trace-feedback')).toContainText('Use the five letters in this order');
  expect(await page.evaluate(()=>JSON.parse(sessionStorage.getItem('trace-audio-events')??'[]').filter((event:string)=>event.includes('success')||event.includes('complete')))).toEqual([]);
  await page.locator('#hear-letter').click();
  await page.getByLabel('Enter the five letters in order').fill('अ आ इ ई उ');
  await page.getByRole('button',{name:'Unlock Basic',exact:false}).click();
  await expect(page.getByRole('heading',{name:'Welcome to Basic.'})).toBeVisible();
  await expect(page.locator('.door-confetti i')).toHaveCount(18);
  const events=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('trace-audio-events')??'[]') as string[]);
  expect(events.filter(event=>event==='success-play')).toHaveLength(0);
  expect(events.filter(event=>event==='complete-play')).toHaveLength(1);
  expect(events.indexOf('pronunciation-pause')).toBeLessThan(events.indexOf('complete-play'));
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
