import { test } from 'node:test';
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
