import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyCreatorOverrides } from './creator-overrides.mjs';
const roster = [{ id: 'anna' }, { id: 'jin-kazama' }];
const primary = [{ id: 'kage-1', character: 'anna', damage: 50 }, { id: 'reference-anna-1', character: 'anna', damage: 63 }, { id: 'kage-2', character: 'jin-kazama', damage: 70 }];
const review = () => ({ schemaVersion: 1, season: 3, characters: { anna: {
  author: 'TheFURY', videoUrl: 'https://www.youtube.com/watch?v=HKGx3Syazxw', publishedAt: '2026-08-10', verifiedAt: '2026-10-19', complete: true,
  verificationNotes: 'Season 3 title, complete video reviewed; input overlay and final damage counters checked.',
  combos: [{ id: 'creator-anna-example', character: 'anna', notation: 'df+2 ► 4', damage: 30, hits: 2, conditions: [],
    sourceUrl: 'https://www.youtube.com/watch?v=HKGx3Syazxw&t=12s', videoTimestampSeconds: 12, damageBasis: 'Final combo counter includes launcher.' }]
} } });
test('complete video replaces all old character routes and leaves other characters intact', () => {
  const result = applyCreatorOverrides(primary, review(), roster);
  assert.deepEqual(result.filter(combo => combo.character === 'anna').map(combo => combo.id), ['creator-anna-example']);
  assert.ok(result.some(combo => combo.id === 'kage-2'));
  assert.deepEqual(applyCreatorOverrides(result, review(), roster), result);
});
test('incomplete, mismatched, or missing-damage reviews cannot replace a character', () => {
  let data = review(); data.characters.anna.complete = false;
  assert.throws(() => applyCreatorOverrides(primary, data, roster), /Incomplete/);
  data = review(); data.characters.anna.combos[0].damage = null;
  assert.throws(() => applyCreatorOverrides(primary, data, roster), /Invalid video combo/);
  data = review(); data.characters.anna.combos[0].sourceUrl = 'https://www.youtube.com/watch?v=AAAAAAAAAAA';
  assert.throws(() => applyCreatorOverrides(primary, data, roster), /Invalid video combo/);
  assert.deepEqual(primary.map(combo => combo.id), ['kage-1', 'reference-anna-1', 'kage-2']);
});
