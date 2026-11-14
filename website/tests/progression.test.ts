import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completedLevels, completeLevel, isUnlocked, journey, levelHref, nextLevel } from '../../src/progression.ts';

function store() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
}
test('the six chapters unlock strictly in order', () => {
  const storage = store();
  assert.deepEqual(journey.map(level => level.id), ['moving-in','second-lesson','counting','letters','little-shop','next-adventure']);
  assert.equal(isUnlocked('moving-in', []), true, 'letter tracing no longer gates the first chapter');
  assert.equal(completeLevel(storage, 'next-adventure'), false);
  for (const level of journey) {
    const before = completedLevels(storage);
    for (const later of journey.slice(journey.indexOf(level) + 1)) assert.equal(isUnlocked(later.id, before), false, `${later.id} before ${level.id}`);
    assert.equal(isUnlocked(level.id, before), true);
    assert.equal(completeLevel(storage, level.id), true);
  }
  assert.deepEqual(completedLevels(storage), journey.map(level => level.id));
});
test('next-chapter links follow the journey; letters live on the tracing page', () => {
  assert.equal(nextLevel('second-lesson')?.id, 'counting');
  assert.equal(nextLevel('counting')?.id, 'letters');
  assert.equal(nextLevel('letters')?.id, 'little-shop');
  assert.equal(nextLevel('next-adventure'), undefined);
  assert.equal(levelHref(nextLevel('counting')!, true), '/unit/index.html');
  assert.equal(levelHref(nextLevel('letters')!, true), '/game/index.html?level=shop');
  assert.equal(levelHref(nextLevel('moving-in')!, false), '?level=second-lesson');
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
