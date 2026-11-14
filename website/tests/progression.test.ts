import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completedLevels, completeLevel, isUnlocked } from '../../src/progression.ts';

function store() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}
test('only the first quest starts unlocked; completing it unlocks only the next', () => {
  const storage = store();
  assert.equal(isUnlocked('moving-in', []), true);
  assert.equal(isUnlocked('little-shop', []), false);
  assert.equal(isUnlocked('next-adventure', []), false);
  assert.equal(completeLevel(storage, 'next-adventure'), false);
  assert.equal(completeLevel(storage, 'moving-in'), true);
  assert.equal(isUnlocked('second-lesson',completedLevels(storage)),true);
  assert.equal(isUnlocked('little-shop',completedLevels(storage)),false);
  assert.equal(completeLevel(storage,'little-shop'),false);
  assert.equal(completeLevel(storage,'second-lesson'),true);
  assert.equal(isUnlocked('little-shop',completedLevels(storage)),true);
  assert.equal(completeLevel(storage,'little-shop'),true);
  assert.equal(isUnlocked('next-adventure', completedLevels(storage)), true);
  completeLevel(storage, 'little-shop');
  assert.deepEqual(completedLevels(storage), ['moving-in','second-lesson','little-shop']);
});
test('invalid or inaccessible storage never crashes the map', () => {
  assert.deepEqual(completedLevels({ getItem: () => '{broken', setItem() {} }), []);
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  assert.deepEqual(completedLevels(blocked), []);
  assert.equal(completeLevel(blocked, 'moving-in'), false);
});

test('legacy shop and market achievements retain access without inventing earlier completions',()=>{
  const storage=store();storage.setItem('wayword.progress.ne.v1','["little-shop","next-adventure"]');
  assert.deepEqual(completedLevels(storage),['little-shop','next-adventure']);
  assert.equal(isUnlocked('little-shop',completedLevels(storage)),true);
  assert.equal(isUnlocked('next-adventure',completedLevels(storage)),true);
  assert.equal(isUnlocked('second-lesson',completedLevels(storage)),false);
  assert.equal(completeLevel(storage,'moving-in'),true);
  assert.deepEqual(completedLevels(storage),['moving-in','little-shop','next-adventure']);
});
