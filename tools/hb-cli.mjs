#!/usr/bin/env node
// House Bible CLI. Node 18+, no dependencies.
// Usage: node tools/hb-cli.mjs <command> [options]
//   ping
//   pull   [--since N] [--table NAME]          (follows "more" pages; prints JSON)
//   push   --table NAME --json '{...}'          (id and updatedAt filled in if missing)
//   push   --file changes.json                  ([{table,row},...])
//   upload --file PATH [--kind documents]       (rooms|assets|documents|general)
//   file   --id FILEID [--out PATH]
//   thumb  --id FILEID [--out PATH]
//   sync-calendar | test-alert
// Options: --url URL --key KEY --device NAME. Or env HB_URL, HB_KEY, HB_DEVICE.
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, extname } from 'node:path';
import { randomUUID } from 'node:crypto';

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp', '.pdf': 'application/pdf', '.txt': 'text/plain', '.csv': 'text/csv', '.json': 'application/json' };

export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[k] = true;
      else { out[k] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

/* POST text/plain JSON; fetch follows Apps Script's 302 to the echo URL by default. */
export async function api(url, key, device, body) {
  const res = await fetch(url, {
    method: 'POST', redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ key, device, ...body }),
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { throw new Error(`Not JSON (HTTP ${res.status}): ${text.slice(0, 200)}`); }
}

export async function pullAll(url, key, device, since = 0) {
  const tables = {};
  let rev = since;
  for (;;) {
    const r = await api(url, key, device, { action: 'pull', since: rev });
    if (!r.ok) return r;
    for (const [t, rows] of Object.entries(r.tables)) (tables[t] ||= []).push(...rows);
    rev = r.rev;
    if (!r.more) return { ok: true, rev, tables };
  }
}

function fillRow(row) {
  return { id: randomUUID().replace(/-/g, ''), updatedAt: Date.now(), ...row };
}

export async function main(argv, env = process.env, log = console.log) {
  const args = parseArgs(argv);
  const cmd = args._[0];
  const url = args.url || env.HB_URL, key = args.key || env.HB_KEY, device = args.device || env.HB_DEVICE || 'hb-cli';
  if (!cmd || args.help) { log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 14).map((l) => l.replace(/^\/\/ ?/, '')).join('\n')); return 0; }
  if (!url || !key) { log('Need --url and --key (or HB_URL and HB_KEY).'); return 2; }
  const show = (r) => { log(JSON.stringify(r, null, 2)); return r.ok ? 0 : 1; };
  const save = (r, out, fallback) => {
    if (!r.ok) return show(r);
    const name = typeof out === 'string' ? out : fallback;
    writeFileSync(name, Buffer.from(r.dataBase64, 'base64'));
    log(`wrote ${name} (${r.mime})`);
    return 0;
  };

  switch (cmd) {
    case 'ping': return show(await api(url, key, device, { action: 'ping' }));
    case 'pull': {
      const r = await pullAll(url, key, device, Number(args.since || 0));
      if (r.ok && typeof args.table === 'string') r.tables = { [args.table]: r.tables[args.table] || [] };
      return show(r);
    }
    case 'push': {
      let changes;
      if (args.file) changes = JSON.parse(readFileSync(args.file, 'utf8')).map((c) => ({ table: c.table, row: fillRow(c.row) }));
      else if (args.table && args.json) changes = [{ table: args.table, row: fillRow(JSON.parse(args.json)) }];
      else { log('push needs --table and --json, or --file'); return 2; }
      return show(await api(url, key, device, { action: 'push', changes }));
    }
    case 'upload': {
      if (!args.file) { log('upload needs --file'); return 2; }
      const buf = readFileSync(args.file);
      return show(await api(url, key, device, {
        action: 'upload', name: basename(args.file), mime: MIME[extname(args.file).toLowerCase()] || 'application/octet-stream',
        dataBase64: buf.toString('base64'), parentKind: typeof args.kind === 'string' ? args.kind : 'general',
      }));
    }
    case 'file': return save(await api(url, key, device, { action: 'file', fileId: args.id }), args.out, 'hb-file.bin');
    case 'thumb': return save(await api(url, key, device, { action: 'thumb', fileId: args.id }), args.out, 'hb-thumb.bin');
    case 'sync-calendar': return show(await api(url, key, device, { action: 'syncCalendar' }));
    case 'test-alert': return show(await api(url, key, device, { action: 'testAlert' }));
    default: log(`Unknown command: ${cmd}`); return 2;
  }
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/g, '/')}`).href) {
  main(process.argv.slice(2)).then((c) => { process.exitCode = c; }, (e) => { console.error(e.message); process.exitCode = 1; });
}
