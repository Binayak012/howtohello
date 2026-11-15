import {test,expect} from '@playwright/test';

const throughCounting='["moving-in","second-lesson","counting"]';

for(const width of [1280,390])test(`Chapter 4 vowel practice at ${width}px completes the letters chapter and leads to the shop`,async({page})=>{
  test.setTimeout(180000);
  await page.setViewportSize({width,height:844});
  await page.emulateMedia({reducedMotion:'reduce'});
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(progress=>{if(!sessionStorage.getItem('seeded')){localStorage.setItem('wayword.progress.ne.v1',progress);sessionStorage.setItem('seeded','1');}},throughCounting);
  await page.goto('/unit/');
  await expect(page.locator('.door-story')).toContainText('SET 01');
  await expect(page.locator('.writing-tutorial')).toBeVisible();
  await page.locator('#tutorial-skip').click();
  for(const [index,letter]of ['अ','आ','इ','ई','उ'].entries()){
    await expect(page.locator('#trace-title')).toContainText(letter);
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
    await page.locator('#trace-check').click();
    if(index<4){
      await expect(page.locator('#trace-check')).toContainText('Next letter');
      await page.locator('#trace-check').click();
    }
  }
  // Finishing the first five vowels completes story chapter 04 and opens the shop.
  await expect(page.getByRole('heading',{name:'Set complete. Nicely done.'})).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('wayword.progress.ne.v1')!))).toEqual(['moving-in','second-lesson','counting','letters']);
  await expect(page.getByRole('link',{name:'Start chapter 05'})).toHaveAttribute('href','/game/index.html?level=shop');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/letters-complete-${width}.png`});
  await page.getByRole('link',{name:'Start chapter 05'}).click();
  await expect(page).toHaveURL(/level=shop$/);
  await expect(page.locator('#app')).not.toHaveAttribute('data-phase','locked');
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

test('pencil sound follows movement, stops when still or lifted, and yields to pronunciation',async({page})=>{
  await page.addInitScript(()=>{
    const createBufferSource=AudioContext.prototype.createBufferSource;
    Object.defineProperty(AudioContext.prototype,'createBufferSource',{configurable:true,value(){
      sessionStorage.setItem('pencil-starts',String(Number(sessionStorage.getItem('pencil-starts'))+1));
      return createBufferSource.call(this);
    }});
    const stop=AudioBufferSourceNode.prototype.stop;
    Object.defineProperty(AudioBufferSourceNode.prototype,'stop',{configurable:true,value(when?:number){
      sessionStorage.setItem('pencil-stops',String(Number(sessionStorage.getItem('pencil-stops'))+1));
      return stop.call(this,when);
    }});
    Object.defineProperty(HTMLMediaElement.prototype,'play',{configurable:true,value(){
      return Promise.resolve();
    }});
  });
  await page.goto('/unit/');
  await page.locator('#tutorial-skip').click();
  const board=await page.locator('#trace-ink').boundingBox();
  await page.mouse.move(board!.x+80,board!.y+90);
  await page.mouse.down();
  await page.mouse.move(board!.x+105,board!.y+105);
  await expect.poll(()=>page.evaluate(()=>Number(sessionStorage.getItem('pencil-starts')))).toBe(1);
  await expect.poll(()=>page.evaluate(()=>Number(sessionStorage.getItem('pencil-stops')))).toBeGreaterThanOrEqual(1);
  await page.mouse.move(board!.x+130,board!.y+115);
  await expect.poll(()=>page.evaluate(()=>Number(sessionStorage.getItem('pencil-starts')))).toBe(2);
  await page.mouse.up();
  await expect.poll(()=>page.evaluate(()=>Number(sessionStorage.getItem('pencil-stops')))).toBeGreaterThanOrEqual(2);
  await page.locator('#hear-letter').click();
  await expect(page.locator('#hear-letter')).toHaveClass(/is-speaking/);
  await page.mouse.move(board!.x+70,board!.y+80);
  await page.mouse.down();
  await page.mouse.move(board!.x+110,board!.y+100);
  await page.mouse.up();
  expect(await page.evaluate(()=>Number(sessionStorage.getItem('pencil-starts')))).toBe(2);
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

test('with local storage blocked, the letters page still lets the learner trace',async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}});
  });
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/unit/');
  await expect(page.locator('.writing-tutorial')).toBeVisible();
  await page.locator('#tutorial-skip').click();
  await expect(page.locator('#trace-check')).toBeVisible();
  expect(errors).toEqual([]);
});
