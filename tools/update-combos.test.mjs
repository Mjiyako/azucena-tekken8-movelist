import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePage, characterId, mergeSupplemental } from './update-combos.mjs';
import { readFile } from 'node:fs/promises';

const fixture = (patch = 'v3.02', damage = '82 damages') => `
<span class="subtitle">1 combos</span>
<li class="combo-item" id="combo-123">
<span itemprop="character"><a href="/combos-jin/">Jin</a></span>
<span itemprop="author"><strong>A Player</strong></span>
<p class="comboTxt">df,2 ► 1,2 &gt; f,4</p>
<p class="comboBadges"><span class="badge">${patch}</span>
<span class="badge">10 hits</span><span class="badge">${damage}</span>
<span class="badge">Heat</span></p></li>
<div class="pagging"><a rel="next" href="?page=2">Next</a></div>`;

test('extracts notation, damage, conditions, attribution and next page', () => {
  const result = parsePage(fixture(), 'https://tekken8combo.kagewebsite.com/selection-season-3-combo/');
  assert.equal(result.expectedCount, 1);
  assert.equal(result.combos[0].character, 'jin-kazama');
  assert.equal(result.combos[0].damage, 82);
  assert.equal(result.combos[0].hits, 10);
  assert.equal(result.combos[0].notation, 'df,2 ► 1,2 > f,4');
  assert.deepEqual(result.combos[0].conditions, ['Heat']);
  assert.equal(result.combos[0].author, 'A Player');
  assert.equal(result.next, 'https://tekken8combo.kagewebsite.com/selection-season-3-combo/?page=2');
});
test('refuses an older season rather than silently mislabeling it', () => {
  assert.throws(() => parsePage(fixture('v2.00'), 'https://example.com'), /Unexpected patch/);
});
test('refuses missing damage and changed markup', () => {
  assert.throws(() => parsePage(fixture('v3.02', 'unknown'), 'https://example.com'), /invalid combo/);
  assert.throws(() => parsePage('<html>Blocked</html>', 'https://example.com'), /No combos/);
});
test('maps source character aliases to the app roster', () => {
  assert.equal(characterId('jack8'), 'jack-8');
  assert.equal(characterId('jin'), 'jin-kazama');
  assert.equal(characterId('anna'), 'anna');
});
test('supplemental entries survive an upstream refresh and cover the missing characters', async () => {
  const supplemental = JSON.parse(await readFile(new URL('../data/combos-season3-supplemental.json', import.meta.url), 'utf8'));
  const roster = JSON.parse(await readFile(new URL('../data/characters.json', import.meta.url), 'utf8'));
  const primary = [{ id: 'kage-1', character: 'jack8', damage: 67 }];
  const merged = mergeSupplemental(primary, supplemental.combos, roster);
  assert.equal(merged.find(combo => combo.id === 'kage-1').character, 'jack-8');
  for (const id of ['anna', 'armor-king', 'lars', 'leo', 'leroy', 'nina', 'shaheen']) {
    assert.ok(merged.filter(combo => combo.character === id).length >= 2, `${id} needs two routes`);
  }
  assert.throws(() => mergeSupplemental(primary, [{ ...supplemental.combos[0], damage: null }], roster), /Invalid supplemental/);
  assert.throws(() => mergeSupplemental(primary, [{ ...supplemental.combos[0], character: 'bad-id' }], roster), /Invalid supplemental/);
});
