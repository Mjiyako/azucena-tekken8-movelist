import * as cheerio from 'cheerio';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { applyCreatorOverrides } from './creator-overrides.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = 'https://tekken8combo.kagewebsite.com/selection-season-3-combo/';
const clean = value => value.replace(/\s+/g, ' ').trim();
export const characterId = slug => ({ jin: 'jin-kazama', jack8: 'jack-8' }[slug] || slug);

export function hasDatasetChanged(previous, next) {
  const canonical = value => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') return Object.fromEntries(
      Object.keys(value).sort().map(key => [key, canonical(value[key])])
    );
    return value;
  };
  const comparable = document => {
    if (!document) return null;
    const { updatedAt, ...content } = document;
    return canonical({ ...content,
      combos: [...(content.combos || [])].sort((a, b) => a.id.localeCompare(b.id)),
      coverage: [...(content.coverage || [])].sort((a, b) => a.id.localeCompare(b.id)),
      sources: [...(content.sources || [])].sort(),
    });
  };
  return JSON.stringify(comparable(previous)) !== JSON.stringify(comparable(next));
}

export function mergeSupplemental(primary, supplemental, roster) {
  const allowed = new Set(roster.map(character => character.id));
  const records = new Map(primary.map(combo => [combo.id, { ...combo, character: characterId(combo.character) }]));
  for (const combo of supplemental) {
    if (!combo.id?.startsWith('reference-') || records.has(combo.id) || !allowed.has(combo.character)
      || !Number.isInteger(combo.damage) || combo.damage <= 0 || !combo.notation?.trim()
      || !combo.sourceUrl?.startsWith('https://') || !combo.seasonEvidence?.trim()
      || combo.season !== 3 || !Array.isArray(combo.conditions)
      || (combo.hits !== null && (!Number.isInteger(combo.hits) || combo.hits <= 0))) {
      throw new Error(`Invalid supplemental combo: ${combo.id || 'missing ID'}`);
    }
    records.set(combo.id, combo);
  }
  return [...records.values()].sort((a, b) => a.character.localeCompare(b.character) || b.damage - a.damage);
}

export function parsePage(html, pageUrl) {
  const $ = cheerio.load(html);
  const combos = [];
  $('.combo-item').each((_, element) => {
    const item = $(element);
    const badges = item.find('.comboBadges .badge').map((_, badge) => clean($(badge).text())).get();
    const patch = badges.find(text => /^v\d/.test(text)) || '';
    // Only explicitly versioned Season 3 records qualify.
    if (!/^v3\./.test(patch)) throw new Error(`Unexpected patch ${patch} on ${pageUrl}`);
    const characterLink = item.find('[itemprop="character"] a');
    const slug = characterLink.attr('href')?.match(/combos-([^/]+)/)?.[1];
    const id = item.attr('id')?.match(/^combo-(\d+)$/)?.[1];
    const notation = clean(item.find('.comboTxt').text());
    const damage = Number(badges.find(text => /^\d+ damages?$/.test(text))?.match(/\d+/)?.[0]);
    const hits = Number(badges.find(text => /^\d+ hits?$/.test(text))?.match(/\d+/)?.[0]);
    if (!slug || !id || !notation || !Number.isInteger(damage) || damage <= 0 || !Number.isInteger(hits) || hits <= 0) {
      throw new Error(`Source markup changed: invalid combo on ${pageUrl}`);
    }
    combos.push({ id: `kage-${id}`, character: characterId(slug),
      characterName: clean(characterLink.text()), notation, damage, hits, patch,
      conditions: badges.filter(text => !/^v\d|^\d+ (hits?|damages?)$/.test(text)),
      author: clean(item.find('[itemprop="author"] strong').text()),
      sourceUrl: `https://tekken8combo.kagewebsite.com/combo/${id}` });
  });
  if (!combos.length) throw new Error(`No combos found at ${pageUrl}; existing data kept.`);
  const next = $('.pagging a[rel="next"]').attr('href');
  const expectedCount = Number($('.subtitle').text().match(/(\d+) combos/)?.[1]);
  return { combos, next: next ? new URL(next, pageUrl).href : null, expectedCount };
}

async function request(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000),
        headers: { 'User-Agent': 'TekkenBookComboUpdater/1.0 (personal reference)' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
      return await response.text();
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
    }
  }
}

export async function update({ dryRun = false } = {}) {
  const roster = JSON.parse(await readFile(path.join(ROOT, 'data/characters.json'), 'utf8'));
  const records = new Map(), visited = new Set();
  let url = SOURCE, expectedCount;
  while (url) {
    const parsedUrl = new URL(url);
    if (parsedUrl.origin !== new URL(SOURCE).origin || parsedUrl.pathname !== new URL(SOURCE).pathname || visited.has(url) || visited.size >= 100) {
      throw new Error(`Invalid or looping pagination: ${url}`);
    }
    visited.add(url);
    console.log(`Reading page ${visited.size}: ${url}`);
    const page = parsePage(await request(url), url);
    expectedCount ??= page.expectedCount;
    for (const record of page.combos) records.set(record.id, record);
    url = page.next;
    if (url) await new Promise(resolve => setTimeout(resolve, 1200));
  }
  if (!expectedCount || records.size !== expectedCount) throw new Error(`Expected ${expectedCount} records, received ${records.size}. Source may have changed during download; retry. Existing data kept.`);
  const supplemental = JSON.parse(await readFile(path.join(ROOT, 'data/combos-season3-supplemental.json'), 'utf8'));
  const overrides = JSON.parse(await readFile(path.join(ROOT, 'data/creator-combo-overrides.json'), 'utf8'));
  const combos = applyCreatorOverrides(mergeSupplemental([...records.values()], supplemental.combos, roster), overrides, roster);
  const coverage = roster.map(character => ({ id: character.id, name: character.name,
    count: combos.filter(combo => combo.character === character.id).length }));
  const document = { schemaVersion: 1, season: 3, source: SOURCE,
    updatedAt: new Date().toISOString(), pageCount: visited.size,
    primaryCount: records.size, supplementalCount: supplemental.combos.length,
    sources: [SOURCE, ...new Set([...supplemental.combos.map(combo => combo.sourceUrl),
      ...Object.values(overrides.characters).map(review => review.videoUrl)])], combos, coverage };
  const missing = coverage.filter(character => !character.count).map(character => character.name);
  console.log(`${combos.length} combos; ${coverage.length - missing.length}/${coverage.length} app characters covered.`);
  if (missing.length) console.log(`No verified Season 3 entries: ${missing.join(', ')}`);
  const target = path.join(ROOT, 'data/combos-season3.json');
  let previous;
  try { previous = JSON.parse(await readFile(target, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!hasDatasetChanged(previous, document)) {
    console.log('No combo data changes. Existing file and update timestamp kept.');
    return previous;
  }
  if (!dryRun) {
    await mkdir(path.dirname(target), { recursive: true });
    // Preserve the previous complete dataset; replace only after every page validates.
    try { await writeFile(`${target}.bak`, await readFile(target)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    await writeFile(`${target}.tmp`, JSON.stringify(document, null, 2) + '\n');
    await rename(`${target}.tmp`, target);
    console.log(`Updated ${target}`);
  }
  return document;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  update({ dryRun: process.argv.includes('--dry-run') }).catch(error => {
    console.error(error.message); process.exitCode = 1;
  });
}
