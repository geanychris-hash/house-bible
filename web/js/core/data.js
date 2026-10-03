// Data layer (CONTRACT section 8): local-first rows in IndexedDB, an outbox of pending changes,
// and push/pull sync with the Apps Script server (CONTRACT section 4).
//
// Reads always come from the local cache. Writes go to the cache and the outbox at once, then a
// debounced sync pushes them. Conflict rule is the server's: larger updatedAt wins (tie: server).
import { TABLES, normalizeRow } from './schema.js';
import { defaultAdapter } from './store.js';
import { createApi, ApiError } from './api.js';
import * as auth from './auth.js';

const PUSH_BATCH = 200;
const DEBOUNCE_MS = 2000;
const POLL_MS = 60000;
const BACKOFF_BASE_MS = 5000;
const BACKOFF_MAX_MS = 300000;

export const newId = () => globalThis.crypto.randomUUID().replace(/-/g, '');

export function createEngine({
  adapter, api, device = () => 'unknown', now = () => Date.now(),
  online = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false),
  setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = t => clearTimeout(t),
  beforeInit = async () => {}, isConfigured = () => true,
} = {}) {
  const rows = new Map(TABLES.map(t => [t, new Map()]));
  const outbox = new Map();            // "table/id" -> {table,id,row,attempts,lastError}
  const meta = { rev: 0, lastSync: null };
  const subs = new Map();              // table -> Set(fn)
  const statusSubs = new Set();
  const hooks = new Set();
  let ready = null;
  let syncing = null;
  let timer = null;
  let failures = 0;
  let nextAutoAt = 0;
  let lastError = null;                // {code,message}
  let authFailed = false;

  const okey = (t, id) => t + '/' + id;
  const need = t => { if (!rows.has(t)) throw new Error('Unknown table: ' + t); return rows.get(t); };

  function init() {
    if (!ready) {
      ready = (async () => {
        await adapter.open();
        await beforeInit();
        for (const t of TABLES) for (const r of await adapter.getAll(t)) rows.get(t).set(r.id, r);
        for (const e of await adapter.getAll('outbox')) outbox.set(okey(e.table, e.id), e);
        const m = await adapter.get('meta', 'sync');
        if (m) Object.assign(meta, m);
      })();
    }
    return ready;
  }

  function visible(table, includeDeleted) {
    const all = [...need(table).values()];
    return (includeDeleted ? all : all.filter(r => !Number(r.deleted))).map(r => ({ ...r }));
  }
  function emit(table) {
    const set = subs.get(table);
    if (!set || !set.size) return;
    const list = visible(table, false);
    for (const fn of [...set]) { try { fn(list); } catch (e) { console.error('subscriber failed', e); } }
  }
  function status() {
    return {
      online: online(), pending: outbox.size, lastSync: meta.lastSync, syncing: !!syncing,
      error: lastError, authFailed, failures,
    };
  }
  function emitStatus() { const s = status(); for (const fn of [...statusSubs]) { try { fn(s); } catch (e) { console.error(e); } } }

  // ---- reads ----
  async function list(table, { includeDeleted = false } = {}) { await init(); return visible(table, includeDeleted); }
  async function get(table, id) { await init(); const r = need(table).get(id); return r ? { ...r } : null; }

  // ---- writes ----
  async function save(table, partial) {
    await init();
    const map = need(table);
    const id = partial.id || newId();
    const prev = map.get(id);
    const t = Math.max(now(), prev ? (Number(prev.updatedAt) || 0) + 1 : 0);
    const row = { deleted: 0, ...prev, ...partial, id, updatedAt: t, updatedBy: device() };
    map.set(id, row);
    const entry = { table, id, row, attempts: 0, lastError: null };
    outbox.set(okey(table, id), entry);
    await adapter.batch([{ store: table, key: id, value: row }, { store: 'outbox', key: okey(table, id), value: entry }]);
    emit(table); emitStatus(); requestSync(DEBOUNCE_MS);
    return { ...row };
  }
  async function remove(table, id) {
    await init();
    if (!need(table).get(id)) return;
    await save(table, { id, deleted: 1 });
  }
  function subscribe(table, fn) {
    need(table);
    if (!subs.has(table)) subs.set(table, new Set());
    subs.get(table).add(fn);
    return () => subs.get(table).delete(fn);
  }
  function onStatus(fn) { statusSubs.add(fn); return () => statusSubs.delete(fn); }
  function addSyncHook(fn) { hooks.add(fn); return () => hooks.delete(fn); }

  // ---- sync ----
  // Merge helpers (pure with respect to the engine maps; unit tested).
  function applyPushResult(entry, result) {
    const { table, id } = entry;
    const server = result.row ? normalizeRow(table, result.row) : null;
    const k = okey(table, id);
    const changedSince = outbox.get(k) !== entry;      // user edited again while the push was in flight
    const ops = [];
    if (server) {
      if (!changedSince) { rows.get(table).set(id, server); ops.push({ store: table, key: id, value: server }); }
      else if (result.status === 'accepted') {
        // keep the newer local edit, just learn the server rev
        const cur = rows.get(table).get(id);
        if (cur) { cur.rev = server.rev; ops.push({ store: table, key: id, value: cur }); }
      }
    }
    if (!changedSince) { outbox.delete(k); ops.push({ store: 'outbox', key: k, del: true }); }
    return ops;
  }
  function applyPulled(table, serverRows) {
    const ops = []; let n = 0;
    for (const raw of serverRows) {
      const server = normalizeRow(table, raw);
      const local = rows.get(table).get(server.id);
      const k = okey(table, server.id);
      const entry = outbox.get(k);
      if (entry && entry.row.updatedAt > server.updatedAt) continue;   // our pending edit is newer; it will win on push
      if (local && local.rev === server.rev && !entry) continue;
      if (entry) { outbox.delete(k); ops.push({ store: 'outbox', key: k, del: true }); }   // server version is newer: drop ours
      rows.get(table).set(server.id, server);
      ops.push({ store: table, key: server.id, value: server });
      n++;
    }
    return { ops, n };
  }

  async function doSync() {
    const errors = []; let pushed = 0, pulled = 0;
    const touched = new Set();
    try {
      for (const hook of [...hooks]) { try { await hook(); } catch (e) { errors.push(String(e.message || e)); } }
      // push
      while (outbox.size) {
        const batch = [...outbox.values()].slice(0, PUSH_BATCH);
        const res = await api('push', { changes: batch.map(e => ({ table: e.table, row: e.row })) });
        const byKey = new Map((res.results || []).map(r => [okey(r.table, r.id), r]));
        const ops = [];
        let progressed = 0;
        for (const entry of batch) {
          const r = byKey.get(okey(entry.table, entry.id));
          if (r && (r.status === 'accepted' || r.status === 'stale')) {
            ops.push(...applyPushResult(entry, r)); touched.add(entry.table); pushed++; progressed++;
          } else {
            entry.attempts++; entry.lastError = (r && r.status) || 'no result';
            errors.push(`${entry.table}: ${entry.lastError}`);
            ops.push({ store: 'outbox', key: okey(entry.table, entry.id), value: entry });
          }
        }
        await adapter.batch(ops);
        if (!progressed) break;                       // avoid spinning on a server that rejects everything
      }
      // pull
      let since = meta.rev;
      for (let page = 0; page < 1000; page++) {
        const res = await api('pull', { since });
        let maxRev = since;
        const ops = [];
        for (const [table, list] of Object.entries(res.tables || {})) {
          if (!rows.has(table)) continue;
          for (const r of list) maxRev = Math.max(maxRev, Number(r.rev) || 0);
          const { ops: o, n } = applyPulled(table, list);
          if (n) { touched.add(table); pulled += n; }
          ops.push(...o);
        }
        const next = res.more ? maxRev : Math.max(maxRev, Number(res.rev) || 0);
        meta.rev = Math.max(meta.rev, next);
        ops.push({ store: 'meta', key: 'sync', value: { ...meta } });
        await adapter.batch(ops);
        if (!res.more || next <= since) break;
        since = next;
      }
      meta.lastSync = now();
      await adapter.batch([{ store: 'meta', key: 'sync', value: { ...meta } }]);
      failures = 0; lastError = null; nextAutoAt = 0;
      if (errors.length) lastError = { code: 'partial', message: errors[0] };
    } catch (e) {
      const code = e instanceof ApiError ? e.code : 'error';
      const message = e instanceof ApiError ? e.message : String(e.message || e);
      errors.push(message);
      lastError = { code, message };
      if (code === 'auth') authFailed = true;
      if (code !== 'not_configured') {
        failures++;
        nextAutoAt = now() + Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** (failures - 1));
      }
    }
    for (const t of touched) emit(t);
    return { pushed, pulled, errors };
  }

  // Manual sync: ignores backoff. Concurrent callers share one run.
  async function syncNow() {
    await init();
    if (syncing) return syncing;
    authFailed = authFailed && !!lastError && lastError.code === 'auth';
    syncing = doSync().finally(() => { syncing = null; emitStatus(); });
    emitStatus();
    return syncing;
  }

  // Automatic sync: respects backoff, auth failure and offline state.
  function requestSync(delay = 0) {
    if (timer) clearTimer(timer);
    timer = setTimer(async () => {
      timer = null;
      if (!online() || authFailed) return;
      const wait = nextAutoAt - now();
      if (wait > 0) { requestSync(wait); return; }
      if (!isConfigured()) return;
      await syncNow();
    }, delay);
  }
  function resetBackoff() { failures = 0; nextAutoAt = 0; authFailed = false; lastError = null; emitStatus(); }

  return { init, list, get, save, remove, subscribe, onStatus, addSyncHook, syncNow, requestSync, resetBackoff, status, refreshStatus: emitStatus,
    _internals: { rows, outbox, meta } };
}

// ---------- singleton used by the app ----------
const adapter = defaultAdapter();
const api = createApi({ getConfig: auth.getConfig });
const engine = createEngine({ adapter, api, device: auth.deviceLabel, isConfigured: auth.isConfigured, beforeInit: () => auth.loadConfig(adapter) });

export const list = engine.list;
export const get = engine.get;
export const save = engine.save;
export const remove = engine.remove;
export const subscribe = engine.subscribe;
export const syncNow = engine.syncNow;
export const status = engine.status;
export const onStatus = engine.onStatus;
export const addSyncHook = engine.addSyncHook;
export const init = engine.init;
export const callApi = (action, extra) => api(action, extra);
export const adapterInstance = adapter;

// Called after the connection settings change.
export function reconfigure() { engine.resetBackoff(); engine.requestSync(0); }
auth.onConfigChange(() => reconfigure());

// Browser glue: sync on open, on focus/visible, when back online, and every 60 s while visible.
let autoStarted = false;
export function startAutoSync() {
  if (autoStarted || typeof document === 'undefined') return;
  autoStarted = true;
  const kick = () => { if (document.visibilityState !== 'hidden') { engine.resetBackoff(); engine.requestSync(0); } };
  window.addEventListener('focus', kick);
  document.addEventListener('visibilitychange', kick);
  window.addEventListener('online', kick);
  window.addEventListener('offline', () => engine.refreshStatus());
  setInterval(() => { if (document.visibilityState !== 'hidden') engine.requestSync(0); }, POLL_MS);
  engine.init().then(() => engine.requestSync(0));
}
