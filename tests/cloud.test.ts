import test from 'node:test';
import assert from 'node:assert/strict';
import { cloudEnabled, mergeSnapshots } from '../src/cloud.ts';

test('cloud sync stays off without Supabase settings', () => {
  assert.equal(cloudEnabled, false);
});

test('merging keeps progress from both this browser and the account', () => {
  const local = { 'wayword.progress.ne.v1': '["moving-in","second-lesson"]', 'wayword.wallet.ne.v1': '2', 'wayword.radio.enabled': 'false' };
  const cloud = { 'wayword.progress.ne.v1': '["moving-in","counting"]', 'wayword.wallet.ne.v1': '5', 'wayword.tracing.ne.v1': '["अ","आ"]' };
  const merged = mergeSnapshots(local, cloud);
  // Lists are combined, so no completed chapter is ever lost.
  assert.deepEqual(JSON.parse(merged['wayword.progress.ne.v1']), ['moving-in', 'second-lesson', 'counting']);
  // Single values: this browser wins.
  assert.equal(merged['wayword.wallet.ne.v1'], '2');
  // Things only the account has are filled in; things only this browser has stay.
  assert.equal(merged['wayword.tracing.ne.v1'], '["अ","आ"]');
  assert.equal(merged['wayword.radio.enabled'], 'false');
});

test('merging tolerates values that are not JSON', () => {
  assert.deepEqual(mergeSnapshots({ 'wayword.map-music': 'on' }, { 'wayword.map-music': 'off' }), { 'wayword.map-music': 'on' });
});
