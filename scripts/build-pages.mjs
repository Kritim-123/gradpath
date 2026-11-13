import {mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist', 'pages');
const assets = [
  'app.js', 'data.js', 'mock-university.js', 'community.js', 'matching.js', 'journeys.js', 'navigation.js', 'navigation.css', 'openalex.js', 'papers.js', 'papers.css',
  'styles.css', 'community.css', 'favicon.svg', 'mark.svg', 'wordmark.svg',
];

// Export only the public demo. The Worker, API, database, and hosting settings
// remain source code and are never included in the Pages artifact.
function relativeAssets(text) {
  for (const asset of assets) {
    for (const quote of ['"', "'"]) {
      text = text.replaceAll(`${quote}/${asset}${quote}`, `${quote}./${asset}${quote}`);
    }
  }
  return text;
}

await mkdir(output, {recursive: true});
const allowed = new Set(['index.html', '.nojekyll', ...assets]);
for (const entry of await readdir(output)) {
  if (!allowed.has(entry)) {
    throw new Error(`Unexpected file in Pages output: ${entry}. Use a clean dist/pages directory.`);
  }
}

const shell = relativeAssets(await readFile(path.join(root, 'app', 'shell.html'), 'utf8'));
for (const match of shell.matchAll(/(?:src|href)=["']\.\/([^"']+)["']/g)) {
  if (!assets.includes(match[1])) throw new Error(`Unlisted asset: ${match[1]}`);
}
if (/(?:src|href)=["']\/(?!\/)/.test(shell)) {
  throw new Error('Root-relative assets would break the GitHub Pages project URL.');
}

for (const asset of assets) {
  const content = await readFile(path.join(root, 'public', asset), 'utf8');
  await writeFile(path.join(output, asset), relativeAssets(content));
}
await writeFile(path.join(output, 'index.html'), shell);
await writeFile(path.join(output, '.nojekyll'), '');
console.log(`Exported ${allowed.size} public demo files to ${output}`);
