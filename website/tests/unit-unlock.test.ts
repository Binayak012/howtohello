import { test } from 'node:test';
import { vowelOrder } from '../../src/vowel-curriculum.ts';
import { writingLessons } from '../src/writing-strokes.ts';
import { vowelSounds } from '../src/letter-pronunciation.ts';
import { tracedLetters, saveTracedLetter, tracingComplete, canAccessLesson, canPracticeSet } from '../../src/tracing-progress.ts';
import assert from 'node:assert/strict';
import { evaluateTrace, isBasicUnlocked, saveBasicUnlock, validPasscode } from '../../src/unit-unlock.ts';

test('passcode requires all five vowels in order and accepts whitespace', () => {
  assert.equal(validPasscode('अ आ इ ई उ'), true);
  assert.equal(validPasscode('अआइईउ'), true);
  assert.equal(validPasscode('अआइई'), false);
  assert.equal(validPasscode('आअइईउ'), false);
  assert.equal(validPasscode('aaieu'), false);
});
test('unlock persists explicitly and fails safely if storage is blocked', () => {
  let value: string | null = null;
  const storage = { getItem: () => value, setItem: (_key: string, next: string) => { value = next; } };
  assert.equal(isBasicUnlocked(storage), false);
  assert.equal(saveBasicUnlock(storage), true);
  assert.equal(isBasicUnlocked(storage), true);
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  assert.equal(isBasicUnlocked(blocked), false);
  assert.equal(saveBasicUnlock(blocked), false);
});
test('tracing accepts a close complete trace and rejects empty, partial, or scribbled input', () => {
  const width = 80, height = 80;
  function pixels(predicate: (x: number, y: number) => boolean) {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      if (predicate(x, y)) data[(y * width + x) * 4 + 3] = 255;
    }
    return data;
  }
  const target = pixels((x, y) => x >= 35 && x <= 43 && y >= 12 && y <= 68);
  const closeTrace = pixels((x, y) => x >= 38 && x <= 45 && y >= 13 && y <= 66);
  assert.equal(evaluateTrace(target, closeTrace, width, height).accepted, true);
  assert.equal(evaluateTrace(target, pixels(() => false), width, height).accepted, false);
  assert.equal(evaluateTrace(target, pixels((x, y) => x >= 35 && x <= 43 && y >= 12 && y <= 20), width, height).accepted, false);
  assert.equal(evaluateTrace(target, pixels(() => true), width, height).accepted, false);
  assert.equal(evaluateTrace(target, pixels(x => x < 10), width, height).accepted, false);
});

// The new side quest stores genuine per-letter traces separately from old unlocks.
test('writing practice resumes distinct letters and does not inherit demo door unlocks', () => {
  const data = new Map<string,string>([['wayword.unit.ne.basic.v1','unlocked']]);
  const storage = {getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};
  assert.deepEqual(tracedLetters(storage), []);
  assert.equal(tracingComplete(storage), false);
  saveTracedLetter(storage,'अ'); saveTracedLetter(storage,'अ'); saveTracedLetter(storage,'ई');
  assert.deepEqual(tracedLetters(storage), ['अ','ई']);
  assert.equal(tracingComplete(storage), false);
  for(const letter of ['आ','इ','उ'] as const) saveTracedLetter(storage,letter);
  assert.equal(tracingComplete(storage), true);
});
test('writing progress ignores malformed data and blocked storage', () => {
  assert.deepEqual(tracedLetters({getItem:()=>'{',setItem:()=>{}}), []);
  assert.deepEqual(tracedLetters({getItem:()=>JSON.stringify(['अ','अ','unknown']),setItem:()=>{}}), ['अ']);
  const blocked = {getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}};
  assert.equal(tracingComplete(blocked), false);
  assert.equal(saveTracedLetter(blocked,'अ'), false);
});

test('writing prerequisites start at Lesson 5 and require a separate set for Lesson 9', () => {
  const data = new Map<string,string>();
  const storage = {getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};
  assert.equal(canAccessLesson(1,[]),true);
  assert.equal(canAccessLesson(4,[storage]),true);
  assert.equal(canAccessLesson(5,[storage]),false);
  for (const letter of ['अ','आ','इ','ई','उ']) saveTracedLetter(storage,letter);
  assert.equal(canAccessLesson(5,[storage]),true);
  assert.equal(canAccessLesson(8,[storage]),true);
  assert.equal(canAccessLesson(9,[storage]),false);
  assert.equal(saveTracedLetter(storage,'अ','second-five'),false);
  assert.equal(tracingComplete(storage,'second-five'),false);
  for (const letter of ['ऊ','ए','ऐ','ओ']) saveTracedLetter(storage,letter,'second-five');
  assert.equal(canAccessLesson(9,[storage]),false);
  saveTracedLetter(storage,'औ','second-five');
  assert.equal(canAccessLesson(9,[storage]),true);
  assert.equal(tracingComplete(storage,'extra-vowels'),false);
});

test('the full chart has matching teaching guides and pronunciation entries in order', () => {
  assert.deepEqual(vowelOrder,['अ','आ','इ','ई','उ','ऊ','ए','ऐ','ओ','औ','अं','अः','ऋ','ॠ']);
  assert.deepEqual(writingLessons.map(lesson=>lesson.letter),vowelOrder);
  assert.deepEqual(vowelSounds.map(sound=>sound.letter),vowelOrder);
  assert.deepEqual(vowelSounds.slice(0,5).map(sound=>sound.clip),['a','aa','i','ii','u']);
  assert.ok(vowelSounds.slice(5).every(sound=>sound.clip===null));
});
test('the four extra vowels save independently and need all four for completion', () => {
  const data=new Map<string,string>();
  const storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};
  for(const letter of ['अं','अः','ऋ']) saveTracedLetter(storage,letter,'extra-vowels');
  assert.equal(tracingComplete(storage,'extra-vowels'),false);
  saveTracedLetter(storage,'ॠ','extra-vowels');
  assert.equal(tracingComplete(storage,'extra-vowels'),true);
  assert.deepEqual(tracedLetters(storage),[]);
  assert.equal(canAccessLesson(5,[storage]),false);
});

test('later writing sets require their completed story lesson and ignore trace-only progress', () => {
  const data=new Map<string,string>();
  const storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};
  assert.equal(canPracticeSet('first-five',[]),true);
  assert.equal(canPracticeSet('second-five',[storage]),false);
  for(const letter of ['अ','आ','इ','ई','उ']) saveTracedLetter(storage,letter);
  assert.equal(canPracticeSet('second-five',[storage]),false);
  // Chapter 4 of the six-chapter story is Your First Letters.
  data.set('wayword.progress.ne.v1',JSON.stringify(['moving-in','second-lesson','counting']));
  assert.equal(canPracticeSet('second-five',[storage]),false);
  data.set('wayword.progress.ne.v1',JSON.stringify(['moving-in','second-lesson','counting','letters']));
  assert.equal(canPracticeSet('second-five',[storage]),true);
  assert.equal(canPracticeSet('extra-vowels',[storage]),false);
  assert.equal(canPracticeSet('second-five',[]),false);
});
