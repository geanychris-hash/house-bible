// Lists the view modules present in web/js/views/ and writes web/js/core/views.json, which the
// app reads at start so it never requests a view file that does not exist (no 404s in the console).
// Run: node web/dev/gen-views.mjs   (tools/deploy-pages.ps1 and the mock server do this for you)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export function listViews(webRoot = path.resolve(here, '..')) {
  const dir = path.join(webRoot, 'js', 'views');
  let files = [];
  try { files = fs.readdirSync(dir); } catch { /* no views yet */ }
  return files.filter(f => f.endsWith('.js')).sort().map(f => f.slice(0, -3));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const webRoot = path.resolve(here, '..');
  const out = path.join(webRoot, 'js', 'core', 'views.json');
  const list = listViews(webRoot);
  fs.writeFileSync(out, JSON.stringify(list, null, 1) + '\n');
  console.log(`views.json: ${list.length} view(s): ${list.join(', ') || '(none)'}`);
}
