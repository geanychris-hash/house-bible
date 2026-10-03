// Mock of the Apps Script web app (CONTRACT section 4) plus a static file server for web/.
// No dependencies. Data lives in web/dev/data.json (git-ignored); uploaded files in web/dev/files/.
//
//   node web/dev/mock-server.mjs            -> http://localhost:8787/  (app)  and  /exec  (API)
//   MOCK_KEY=secret PORT=9000 node web/dev/mock-server.mjs
//
// Default key is "dev". The special key "slow" behaves like the real key but answers after 800 ms.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TABLES } from '../js/core/schema.js';
import { listViews } from './gen-views.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png',
  '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };

export function createMockServer({ dataFile = path.join(here, 'data.json'), filesDir = path.join(here, 'files'), key = 'dev', serveStatic = true } = {}) {
  let db = { rev: 0, tables: {}, files: {}, changelog: [] };
  try { db = JSON.parse(fs.readFileSync(dataFile, 'utf8')); } catch { /* fresh */ }
  for (const t of TABLES) db.tables[t] = db.tables[t] || {};
  db.files = db.files || {};
  db.changelog = db.changelog || [];
  const persist = () => { if (dataFile) { try { fs.writeFileSync(dataFile, JSON.stringify(db)); } catch { /* ignore */ } } };

  function handle(body) {
    if (body.key !== key) return { ok: false, error: 'auth', message: 'Wrong key' };
    switch (body.action) {
      case 'ping': return { ok: true, serverTime: Date.now(), schemaVersion: 1 };
      case 'pull': {
        const since = Number(body.since) || 0;
        const all = [];
        for (const t of TABLES) for (const r of Object.values(db.tables[t])) if (r.rev > since) all.push([t, r]);
        all.sort((a, b) => a[1].rev - b[1].rev);
        const page = all.slice(0, 2000);
        const tables = {};
        for (const [t, r] of page) (tables[t] = tables[t] || []).push(r);
        return { ok: true, rev: db.rev, tables, more: all.length > 2000 };
      }
      case 'push': {
        const changes = Array.isArray(body.changes) ? body.changes.slice(0, 200) : [];
        const results = [];
        for (const { table, row } of changes) {
          if (!TABLES.includes(table) || !row || !row.id) { results.push({ table, id: row && row.id, status: 'error', row: null }); continue; }
          const cur = db.tables[table][row.id];
          if (cur && Number(cur.updatedAt) >= Number(row.updatedAt)) { results.push({ table, id: row.id, status: 'stale', row: cur }); continue; }
          const saved = { ...row, rev: ++db.rev };
          // mimic the Sheet: json/files come back as text sometimes
          db.tables[table][row.id] = saved;
          db.changelog.push({ rev: saved.rev, table, id: row.id, updatedBy: row.updatedBy || body.device || '', at: Date.now() });
          results.push({ table, id: row.id, status: 'accepted', row: saved });
        }
        persist();
        return { ok: true, results };
      }
      case 'upload': {
        if (!body.dataBase64) return { ok: false, error: 'bad_request', message: 'no data' };
        const fileId = 'f' + Math.random().toString(16).slice(2, 12) + Date.now().toString(16);
        const size = Buffer.from(body.dataBase64, 'base64').length;
        db.files[fileId] = { name: body.name, mime: body.mime, size, parentKind: body.parentKind };
        try { fs.mkdirSync(filesDir, { recursive: true }); fs.writeFileSync(path.join(filesDir, fileId), Buffer.from(body.dataBase64, 'base64')); } catch { /* ignore */ }
        persist();
        return { ok: true, fileId, name: body.name, mime: body.mime, size };
      }
      case 'file':
      case 'thumb': {
        const meta = db.files[body.fileId];
        if (!meta) return { ok: false, error: 'not_found', message: 'No such file' };
        let data = '';
        try { data = fs.readFileSync(path.join(filesDir, body.fileId)).toString('base64'); } catch { /* ignore */ }
        return body.action === 'file' ? { ok: true, name: meta.name, mime: meta.mime, dataBase64: data } : { ok: true, mime: meta.mime, dataBase64: data };
      }
      case 'syncCalendar': return { ok: true, created: 0, updated: 0, removed: 0 };
      case 'testAlert': return { ok: true };
      case 'history': {
        const limit = Math.min(500, Math.max(1, Math.floor(Number(body.limit) || 100)));
        if (body.table && !TABLES.includes(body.table)) return { ok: false, error: 'bad_request', message: 'Unknown table' };
        const entries = [];
        for (let i = db.changelog.length - 1; i >= 0 && entries.length < limit; i--) {
          const e = db.changelog[i];
          if (body.table && e.table !== body.table) continue;
          if (body.id && e.id !== String(body.id)) continue;
          entries.push(e);
        }
        return { ok: true, entries };
      }
      default: return { ok: false, error: 'bad_action', message: 'Unknown action' };
    }
  }

  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS' };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
    if (req.method === 'POST') {
      let raw = '';
      req.on('data', c => { raw += c; });
      req.on('end', () => {
        let body = {};
        try { body = JSON.parse(raw); } catch { /* ignore */ }
        const slow = body.key === 'slow';
        if (slow) body.key = key;
        const out = handle(body);
        const send = () => { res.writeHead(200, { ...cors, 'Content-Type': 'application/json' }); res.end(JSON.stringify(out)); };
        if (slow) setTimeout(send, 800); else send();
      });
      return;
    }
    if (!serveStatic) { res.writeHead(404, cors); return res.end('not found'); }
    // Static files from web/. /js/core/views.json is computed live so new view files show up at once.
    let p = decodeURIComponent(url.pathname);
    if (p === '/js/core/views.json') {
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify(listViews(webRoot)));
    }
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(webRoot, p);
    if (!file.startsWith(webRoot) || file.startsWith(path.join(webRoot, 'dev', 'files'))) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404, cors); return res.end('not found'); }
      res.writeHead(200, { ...cors, 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(buf);
    });
  });
  return { server, handle, db: () => db };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 8787;
  const key = process.env.MOCK_KEY || 'dev';
  const { server } = createMockServer({ key });
  server.listen(port, '127.0.0.1', () => {
    console.log(`House Bible mock server: http://localhost:${port}/`);
    console.log(`API URL to paste in Connect: http://localhost:${port}/exec   key: ${key}`);
  });
}
