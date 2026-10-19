import { readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyCreatorOverrides } from './creator-overrides.mjs';
import inputs from '../combo-inputs.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = async file => JSON.parse(await readFile(path.join(ROOT, file), 'utf8'));
export function creatorOnly(combos, roster) {
  const allowed = new Set(roster.map(c => c.id));
  const result = combos.filter(c => ['RyzingSol', 'TheFURY'].includes(c.author) && inputs.timestampUrl(c));
  for (const c of result) {
    if (!allowed.has(c.character) || c.season !== 3 || !c.notation?.trim()
      || !Number.isInteger(c.damage) || c.damage <= 0 || !Array.isArray(c.conditions)) throw new Error(`Invalid creator combo ${c.id}`);
  }
  if (new Set(result.map(c => c.id)).size !== result.length) throw new Error('Duplicate creator combo IDs.');
  return result.sort((a,b) => a.character.localeCompare(b.character) || b.damage-a.damage || a.id.localeCompare(b.id));
}
export async function refreshCreatorData({ dryRun = false } = {}) {
  const [roster, references, local, overrides] = await Promise.all([
    read('data/characters.json'), read('data/combos-season3-supplemental.json'),
    read('data/local-video-combos.json'), read('data/creator-combo-overrides.json')]);
  const combos = creatorOnly(applyCreatorOverrides(creatorOnly([...references.combos, ...local.combos], roster), overrides, roster), roster);
  const document = { schemaVersion: 1, season: 3, sourcePolicy: 'creator-videos-only',
    source: 'RyzingSol and TheFURY Season 3 video guides', updatedAt: new Date().toISOString(),
    sources: [...new Set(combos.map(c => c.sourceUrl.split('&t=')[0]))],
    combos, coverage: roster.map(c => ({ id:c.id,name:c.name,count:combos.filter(x=>x.character===c.id).length })) };
  const target = path.join(ROOT, 'data/combos-season3.json');
  const previous = await read('data/combos-season3.json');
  const { updatedAt: before, ...oldContent } = previous;
  const { updatedAt: after, ...newContent } = document;
  if (JSON.stringify(oldContent) === JSON.stringify(newContent)) { console.log('No reviewed creator changes.'); return previous; }
  if (!dryRun) {
    await writeFile(`${target}.bak`, JSON.stringify(previous, null, 2)+'\n');
    await writeFile(`${target}.tmp`, JSON.stringify(document, null, 2)+'\n');
    await rename(`${target}.tmp`, target);
  }
  console.log(`${combos.length} timestamped creator routes; community source imports disabled.`);
  return document;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await refreshCreatorData();
