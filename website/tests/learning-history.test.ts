import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readLearningHistory, recordLanguageStarted } from '../../src/learning-history.ts';

test('remembers started languages once and resumes the most recent language', () => {
  let value: string | null = null;
  const storage = { getItem: () => value, setItem: (_key: string, next: string) => { value = next; } };
  assert.deepEqual(readLearningHistory(storage), { started: [], lastLanguage: null });
  recordLanguageStarted(storage, 'ne');
  recordLanguageStarted(storage, 'es');
  recordLanguageStarted(storage, 'ne');
  assert.deepEqual(readLearningHistory(storage), { started: ['ne', 'es'], lastLanguage: 'ne' });
});
test('invalid or blocked storage falls back to a new learner', () => {
  const invalid = { getItem: () => '{broken', setItem() {} };
  assert.deepEqual(readLearningHistory(invalid), { started: [], lastLanguage: null });
  const blocked = { getItem() { throw Error('blocked'); }, setItem() { throw Error('blocked'); } };
  assert.doesNotThrow(() => recordLanguageStarted(blocked, 'ne'));
  assert.deepEqual(readLearningHistory(blocked), { started: [], lastLanguage: null });
});
