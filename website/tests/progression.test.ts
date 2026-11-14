import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completedLevels, completeLevel, isUnlocked } from '../../src/progression.ts';

function store() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}
test('only the first quest starts unlocked; completing it unlocks only the next', () => {
  const storage = store();
  assert.equal(isUnlocked('little-shop', []), true);
  assert.equal(isUnlocked('next-adventure', []), false);
  assert.equal(completeLevel(storage, 'next-adventure'), false);
  assert.equal(completeLevel(storage, 'little-shop'), true);
  assert.equal(isUnlocked('next-adventure', completedLevels(storage)), true);
  assert.equal(isUnlocked('hidden-horizon', completedLevels(storage)), false);
  completeLevel(storage, 'little-shop');
  assert.deepEqual(completedLevels(storage), ['little-shop']);
});
test('invalid or inaccessible storage never crashes the map', () => {
  assert.deepEqual(completedLevels({ getItem: () => '{broken', setItem() {} }), []);
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  assert.deepEqual(completedLevels(blocked), []);
  assert.equal(completeLevel(blocked, 'little-shop'), false);
});
