import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, '.pages-dist');
const roster = JSON.parse(await readFile(path.join(root, 'data/characters.json'), 'utf8'));
const dataset = JSON.parse(await readFile(path.join(root, 'data/combos-season3.json'), 'utf8'));
if (dataset.season !== 3 || !dataset.combos.length) throw new Error('Valid Season 3 combo data is required.');
for (const character of roster.filter(character => character.available)) {
  if (!/^[a-z0-9-]+$/.test(character.id)) throw new Error('Invalid character file name.');
  JSON.parse(await readFile(path.join(root, `data/${character.id}.json`), 'utf8'));
}
await mkdir(path.join(output, 'data'), { recursive: true });
for (const file of ['index.html', 'styles.css', 'app.js', 'combo-inputs.js', 'service-worker.js', 'manifest.webmanifest',
  'data/characters.json', 'data/combos-season3.json', 'data/combo-guides.json', ...roster.filter(character => character.available).map(character => `data/${character.id}.json`)]) {
  await cp(path.join(root, file), path.join(output, file));
}
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
await writeFile(path.join(output, 'deployment.json'), JSON.stringify({ commit, comboUpdatedAt: dataset.updatedAt }) + '\n');
await writeFile(path.join(output, '.nojekyll'), '');
console.log(`Prepared GitHub Pages artifact for ${commit}; ${roster.length} characters.`);
