import { readFile, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { applyCreatorOverrides, creatorReviews } from './creator-overrides.mjs';
import { hasDatasetChanged } from './update-combos.mjs';
import { refreshCreatorData } from './refresh-creator-data.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const policy = JSON.parse(await readFile(path.join(root, 'data/combo-source-policy.json'), 'utf8'));
if (!policy.allowCommunitySourceImports) { await refreshCreatorData(); process.exit(0); }
const readJson = async file => JSON.parse(await readFile(path.join(root, file), 'utf8'));
const roster = await readJson('data/characters.json');
const previous = await readJson('data/combos-season3.json');
const overrides = await readJson('data/creator-combo-overrides.json');
const combos = applyCreatorOverrides(previous.combos, overrides, roster);
const coverage = roster.map(character => ({ id: character.id, name: character.name,
  count: combos.filter(combo => combo.character === character.id).length }));
const next = { ...previous, updatedAt: new Date().toISOString(),
  sources: [...new Set([...previous.sources, ...creatorReviews(overrides).map(([, review]) => review.videoUrl)])], combos, coverage };
if (hasDatasetChanged(previous, next)) {
  const file = path.join(root, 'data/combos-season3.json');
  await writeFile(`${file}.bak`, JSON.stringify(previous, null, 2) + '\n');
  await writeFile(`${file}.tmp`, JSON.stringify(next, null, 2) + '\n');
  await rename(`${file}.tmp`, file);
  console.log(`Applied complete creator reviews for ${Object.keys(overrides.characters).length} characters.`);
} else console.log('No creator combo changes.');
