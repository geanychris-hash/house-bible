#!/usr/bin/env node
// Loads seed/tasks.json into the House Bible through the Apps Script API (CONTRACT section 4).
// Skips any seed_key that already exists in `tasks` (including soft-deleted rows), so running it again
// never duplicates tasks or overwrites edits.
//
//   node tools/load-seed.mjs --url <exec URL> --key <shared key> [--device Chris-laptop] [--dry-run]
//   (or set HB_URL and HB_KEY in the environment)
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SEED_FILE = path.join(HERE, '..', 'seed', 'tasks.json');

export function loadSeed(file = SEED_FILE) { return JSON.parse(fs.readFileSync(file, 'utf8')); }

/** Rows to create: seed tasks whose seed_key is not already present in `existing` task rows. */
export function planSeed(existing, seed, now = Date.now(), device = 'seed-loader') {
  const have = new Set(existing.map(r => r.seed_key).filter(Boolean));
  const fresh = [];
  for (const t of seed) {
    if (!t.seed_key) throw new Error('seed task without seed_key: ' + t.title);
    if (have.has(t.seed_key)) continue;
    have.add(t.seed_key);
    fresh.push({
      ...t,
      rule: typeof t.rule === 'string' ? t.rule : JSON.stringify(t.rule),
      id: randomUUID().replace(/-/g, ''), updatedAt: now, updatedBy: device, deleted: 0,
    });
  }
  return fresh;
}

async function call(url, key, device, action, extra = {}) {
  const res = await fetch(url, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ key, device, action, ...extra }) });
  const j = await res.json();
  if (!j.ok) throw new Error(`${action} failed: ${j.error || res.status} ${j.message || ''}`);
  return j;
}

export async function run({ url, key, device = 'seed-loader', dryRun = false, seedFile = SEED_FILE, log = console.log }) {
  const seed = loadSeed(seedFile);
  await call(url, key, device, 'ping');
  const existing = [];
  let since = 0;
  for (let i = 0; i < 1000; i++) {
    const j = await call(url, key, device, 'pull', { since });
    existing.push(...((j.tables && j.tables.tasks) || []));
    if (!j.more) break;
    since = j.rev;
  }
  const fresh = planSeed(existing, seed, Date.now(), device);
  log(`${seed.length} seed tasks, ${seed.length - fresh.length} already present, ${fresh.length} to add.`);
  if (dryRun || !fresh.length) return { added: 0, planned: fresh.length };
  let added = 0;
  for (let i = 0; i < fresh.length; i += 200) {
    const chunk = fresh.slice(i, i + 200);
    const j = await call(url, key, device, 'push', { changes: chunk.map(row => ({ table: 'tasks', row })) });
    added += j.results.filter(r => r.status === 'accepted').length;
  }
  log(`Added ${added} tasks.`);
  return { added, planned: fresh.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2);
  const arg = n => { const i = a.indexOf('--' + n); return i >= 0 ? a[i + 1] : undefined; };
  const url = arg('url') || process.env.HB_URL, key = arg('key') || process.env.HB_KEY;
  if (!url || !key) { console.error('Usage: node tools/load-seed.mjs --url <exec URL> --key <shared key> [--device name] [--dry-run]'); process.exit(2); }
  run({ url, key, device: arg('device') || 'seed-loader', dryRun: a.includes('--dry-run') })
    .catch(e => { console.error(e.message); process.exit(1); });
}
