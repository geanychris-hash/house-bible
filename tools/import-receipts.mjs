#!/usr/bin/env node
// Imports Chris's receipt history into the House Bible through the Apps Script API (CONTRACT section 4).
//   - tools            <- receipt-import.json "tools"  (status own)
//   - expenses         <- receipts-line-items.csv      (one row per line item, returns are negative)
//   - rooms + paint    <- receipt-import.json "paint"  (note on a placeholder room; the paint can's expense row links to it)
//   - projects (idea)  <- the "project clues" in the Receipts note (Chris confirmed they are all real)
// Inputs are looked up in seed/, then Downloads, then (read-only) the General vault folder.
// Row ids are derived from the content, so running it twice never duplicates anything: rows whose id already
// exists (including soft-deleted ones) are skipped and nothing is overwritten.
//
//   node tools/import-receipts.mjs --dry-run                       (print what would be written, no network)
//   node tools/import-receipts.mjs --url <exec URL> --key <key> [--device name] [--dry-run]
//   (or set HB_URL and HB_KEY in the environment)
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SEED_DIR = path.join(HERE, '..', 'seed');
const DOWNLOADS = path.join(process.env.USERPROFILE || process.env.HOME || '', 'Downloads');
const VAULT_DIR = 'C:\\Users\\geany\\Google Drive Streaming\\My Drive\\Vaults\\Synced\\General\\Areas\\Home Projects\\House Bible';

export const PLACEHOLDER_ROOM = 'Paint: room not yet known';

/** Find an input file: seed/ first, then Downloads, then (read-only) the vault folder. */
export function findInput(name, dirs = [SEED_DIR, DOWNLOADS, VAULT_DIR]) {
  for (const d of dirs) { const p = path.join(d, name); if (fs.existsSync(p)) return p; }
  throw new Error(`Cannot find ${name} in: ${dirs.join(' | ')}`);
}

/** Stable 32-hex id from a content key. */
export const stableId = key => createHash('sha256').update('hb-import:' + key).digest('hex').slice(0, 32);

/** Minimal CSV parser (quoted fields, doubled quotes, CRLF). Returns an array of objects keyed by the header row. */
export function parseCsv(text) {
  const rows = [];
  let row = [], cur = '', q = false;
  const s = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some(v => v !== '')) rows.push(row);
      row = [];
    } else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur); if (row.some(v => v !== '')) rows.push(row); }
  const head = rows.shift() || [];
  return rows.map(r => Object.fromEntries(head.map((k, i) => [k, r[i] ?? ''])));
}

const titleCase = s => s.toLowerCase().replace(/\b([a-z])/g, (m, c) => c.toUpperCase());

/** Rough expense category from the printed item name. Keyword rules only; Chris can edit in the app. */
export function categorize(item, store) {
  const n = item.toLowerCase();
  if (/behr|paint|primer|drop cloth|tray liner|roller|knit|edger|trim painter|caulk|spackle|wood filler|sample/.test(n)) return 'Paint and finish';
  if (/sharkbite|pex|drain|overflow|plumb|fitting|faucet|supply/.test(n)) return 'Plumbing';
  if (/outlet|switch|romex|wire|breaker|electrical/.test(n)) return 'Electrical';
  if (/casing|mdf|panel|plywood|board|shelf|bracket|door|trim|brad|nail|screw|lumber|pine|poplar/.test(n)) return 'Lumber and trim';
  if (/miter|saw|sander|drill|driver|compressor|nailer|vac|clamp|pliers|tape measure|stud finder|pruner|trimmer|battery|hoist|dolly|stand|tool|pry|socket|belt|gas can|brush|light/.test(n)) return 'Tools';
  if (/mold|mildew|pest|spray|clean|cloth|towel/.test(n)) return 'Supplies';
  return store === 'Harbor Freight' ? 'Tools' : 'Supplies';
}

/** Receipt names are ALL CAPS and truncated; make them readable without inventing anything. */
export function tidyItem(name) {
  const s = name.trim();
  return s === s.toUpperCase() ? titleCase(s) : s;
}

export const PROJECT_CLUES = [
  { key: 'closet-shelving', name: 'Closet shelving', priority: 'Cosmetic', notes: 'From receipts, mid-April 2026: laminated panels, closet shelf brackets, 1x boards, subfloor plywood, mold and mildew spray, pest block. Looks like closet or shelving work. Details still to fill in.' },
  { key: 'bath-plumbing', name: 'Bath drain and tub plumbing', priority: 'Damage', notes: 'From receipts, early May 2026: SharkBite 1/2 in. fittings and demount clip, a bath drain overflow plate. Details still to fill in. Gas, flue or main supply work is a licensed pro job.' },
  { key: 'miter-saw-trim-setup', name: 'Trim carpentry tool setup (miter saw, nailer, compressor)', priority: 'Cosmetic', notes: 'From receipts, late May 2026: miter saw, nailer, compressor, brad nails, bead panel. This is the tool setup for the trim and panel work.' },
  { key: 'room-repaint', name: 'Repaint (Behr Marquee, June 2026)', priority: 'Cosmetic', notes: 'From receipts, mid June 2026: paint samples, two cans of Behr Marquee (matte Ultra Pure White, eggshell deep base), brushes, sanders, wood filler. Room and color name are not on the receipt. In an old house, suspected lead paint before sanding or scraping is a licensed pro question.' },
  { key: 'door-window-trim', name: 'Door and window trim (casing)', priority: 'Cosmetic', notes: 'From receipts, late June 2026: about 54 pieces of 3/4 x 3-7/16 casing. Looks like door or window trim. Details still to fill in.' },
  { key: 'summer-fall-finishing', name: 'Finishing: trim paint, outlet, MDF panels, accordion door', priority: 'Cosmetic', notes: 'From receipts, Jul to Sep 2026: trim painters, an outlet, MDF panels, drop cloth, paint tray liners, a 36 x 80 accordion door (2026-09-19), a pole saw. Details still to fill in.' },
];

const money = n => Math.round(n * 100) / 100;
const isPlaceholder = s => !s || /^\(.*\)$/.test(s);

/**
 * Build the rows to write. `existing` is { tools:[], expenses:[], rooms:[], projects:[] } of rows already on the
 * server. Returns { rows:{table:[row]}, skipped:{table:n}, summary }.
 */
export function planImport({ receipt, csvRows, existing = {}, now = Date.now(), device = 'receipt-import' }) {
  const ids = t => new Set((existing[t] || []).map(r => r.id));
  const names = t => new Set((existing[t] || []).filter(r => !Number(r.deleted)).map(r => String(r.name || '').toLowerCase()));
  const out = { tools: [], expenses: [], rooms: [], projects: [] };
  const skipped = { tools: 0, expenses: 0, rooms: 0, projects: 0 };
  const idSets = Object.fromEntries(Object.keys(out).map(t => [t, ids(t)]));
  const nameSets = Object.fromEntries(Object.keys(out).map(t => [t, names(t)]));
  const base = { updatedAt: now, updatedBy: device, deleted: 0 };
  const add = (table, row, byName) => {
    if (idSets[table].has(row.id) || (byName && nameSets[table].has(String(row.name).toLowerCase()))) { skipped[table]++; return false; }
    idSets[table].add(row.id);
    out[table].push({ ...base, ...row });
    return true;
  };

  for (const t of receipt.tools || []) {
    add('tools', { id: stableId('tool:' + t.name), name: t.name, category: t.category || 'Other', status: t.status || 'own', brand: '', model: '', notes: t.notes || '' }, true);
  }

  // paint: notes go on a placeholder room when the receipt did not name one
  const paint = receipt.paint || [];
  const rooms = new Map();
  for (const p of paint) {
    const unknown = isPlaceholder(p.room);
    const name = unknown ? PLACEHOLDER_ROOM : p.room;
    if (!rooms.has(name)) rooms.set(name, { id: stableId('room:' + name), name, unknown, lines: [] });
    const color = isPlaceholder(p.color) ? 'color name not on receipt' : p.color;
    rooms.get(name).lines.push(`${p.date}: ${p.surface}, ${p.brand}, ${color}, ${p.sheen}. ${p.notes || ''}`.trim());
  }
  const existingRooms = new Map((existing.rooms || []).filter(r => !Number(r.deleted)).map(r => [String(r.name).toLowerCase(), r]));
  for (const r of rooms.values()) {
    const prior = existingRooms.get(r.name.toLowerCase());
    if (prior) { r.id = prior.id; skipped.rooms++; continue; } // never edit an existing room; the expense still links to it
    add('rooms', {
      id: r.id, name: r.name, floor: '', length_in: '', width_in: '', height_in: '', flooring: '', wall_color: '',
      paint_notes: r.lines.join('\n'), outlets: '', windows: '',
      notes: r.unknown ? 'Placeholder for paint bought on receipts that did not name a room. Move the paint note to the right room, then delete this one.' : '',
      photos: '[]',
    });
  }
  const roomForCode = new Map(paint.map(p => [String(p.code), rooms.get(isPlaceholder(p.room) ? PLACEHOLDER_ROOM : p.room)]));

  // expenses: one per CSV line (same-day duplicates get a counter so they stay distinct but stable)
  const seen = new Map();
  for (const r of csvRows) {
    const item = tidyItem(r.item_name);
    const keyBase = `expense:${r.date}|${r.store}|${r.item_number}|${r.line_total}|${r.qty}`;
    const n = (seen.get(keyBase) || 0) + 1;
    seen.set(keyBase, n);
    const room = roomForCode.get(String(r.item_number));
    const notes = [r.location && `${r.store}, ${r.location}`, Number(r.qty) !== 1 ? `qty ${r.qty} at $${r.unit_price}` : '', r.notes, r.item_number && `item ${r.item_number}`].filter(Boolean).join('. ');
    add('expenses', {
      id: stableId(`${keyBase}#${n}`), date: r.date, item, store: r.store, amount: money(Number(r.line_total)),
      category: categorize(item, r.store), project: '', room: room ? room.id : '', receipt: '', capital_improvement: 0, notes,
    });
  }

  for (const c of PROJECT_CLUES) {
    add('projects', {
      id: stableId('project:' + c.key), name: c.name, status: 'idea', priority: c.priority, pro: 0, season: '', budget: '',
      deps: '[]', room: '', notes: c.notes, steps: '[]', parts: '[]', capital_improvement: 0,
    }, true);
  }

  const total = out.expenses.reduce((s, e) => s + e.amount, 0);
  const summary = {
    tools: `${out.tools.length} to add (${skipped.tools} already there)`,
    expenses: `${out.expenses.length} to add (${skipped.expenses} already there), net $${money(total).toFixed(2)}`,
    rooms: `${out.rooms.length} to add (${skipped.rooms} already there)`,
    projects: `${out.projects.length} to add (${skipped.projects} already there)`,
  };
  return { rows: out, skipped, summary };
}

async function call(url, key, device, action, extra = {}) {
  const res = await fetch(url, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ key, device, action, ...extra }) });
  const j = await res.json();
  if (!j.ok) throw new Error(`${action} failed: ${j.error || res.status} ${j.message || ''}`);
  return j;
}

export async function run({ url, key, device = 'receipt-import', dryRun = false, log = console.log }) {
  const receipt = JSON.parse(fs.readFileSync(findInput('receipt-import.json'), 'utf8'));
  const csvRows = parseCsv(fs.readFileSync(findInput('receipts-line-items.csv'), 'utf8'));
  const existing = {};
  const live = Boolean(url && key);
  if (live) {
    await call(url, key, device, 'ping');
    let since = 0;
    for (let i = 0; i < 1000; i++) {
      const j = await call(url, key, device, 'pull', { since });
      for (const [t, rows] of Object.entries(j.tables || {})) (existing[t] = existing[t] || []).push(...rows);
      if (!j.more) break;
      since = j.rev;
    }
  } else log('(no --url/--key: assuming an empty House Bible)');
  const plan = planImport({ receipt, csvRows, existing, device });
  for (const [t, s] of Object.entries(plan.summary)) log(`${t}: ${s}`);
  if (dryRun || !live) {
    log('\nDry run, nothing written. First rows of each table:');
    for (const [t, rows] of Object.entries(plan.rows)) for (const r of rows.slice(0, 2)) log(` ${t}: ${JSON.stringify(r)}`);
    return { plan, written: 0 };
  }
  const changes = Object.entries(plan.rows).flatMap(([table, rows]) => rows.map(row => ({ table, row })));
  let written = 0;
  for (let i = 0; i < changes.length; i += 200) {
    const j = await call(url, key, device, 'push', { changes: changes.slice(i, i + 200) });
    written += j.results.filter(r => r.status === 'accepted').length;
  }
  log(`Wrote ${written} of ${changes.length} rows.`);
  return { plan, written };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2);
  const arg = n => { const i = a.indexOf('--' + n); return i >= 0 ? a[i + 1] : undefined; };
  const url = arg('url') || process.env.HB_URL, key = arg('key') || process.env.HB_KEY;
  if (!a.includes('--dry-run') && !(url && key)) {
    console.error('Usage: node tools/import-receipts.mjs --url <exec URL> --key <shared key> [--device name] [--dry-run]\n       node tools/import-receipts.mjs --dry-run');
    process.exit(2);
  }
  run({ url, key, device: arg('device') || 'receipt-import', dryRun: a.includes('--dry-run') }).catch(e => { console.error(e.message); process.exit(1); });
}
