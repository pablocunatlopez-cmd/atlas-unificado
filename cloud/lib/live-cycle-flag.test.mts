import test from 'node:test';
import assert from 'node:assert/strict';
import {liveCycleNote, readLiveCycleFlag} from './live-cycle-flag.ts';

test('readLiveCycleFlag defaults to false and accepts explicit truthy values', () => {
  assert.equal(readLiveCycleFlag(null), false);
  assert.equal(readLiveCycleFlag({}), false);
  assert.equal(readLiveCycleFlag({ATLAS_LIVE_CYCLE_ENABLED: '0'}), false);
  assert.equal(readLiveCycleFlag({ATLAS_LIVE_CYCLE_ENABLED: 'false'}), false);
  assert.equal(readLiveCycleFlag({ATLAS_LIVE_CYCLE_ENABLED: '1'}), true);
  assert.equal(readLiveCycleFlag({ATLAS_LIVE_CYCLE_ENABLED: 'true'}), true);
  assert.equal(readLiveCycleFlag({ATLAS_LIVE_CYCLE_ENABLED: 'YES'}), true);
  assert.equal(readLiveCycleFlag({ATLAS_LIVE_CYCLE_ENABLED: true}), true);
});

test('liveCycleNote distinguishes enabled vs disabled', () => {
  assert.match(liveCycleNote(false), /desactivado/i);
  assert.match(liveCycleNote(true), /habilitado/i);
});
