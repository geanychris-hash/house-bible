// STUB of the data layer (CONTRACT section 8). Lets view sessions (S3-S6) build and test
// before S2's real IndexedDB + sync layer exists. S2 REPLACES this file but must keep
// the same exported names and behavior. localStorage only; no network.
const KEY = 'hb.stub.v1';
const listeners = new Map();
let db = null;

function load() {
  if (db) return db;
  try { db = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { db = {}; }
  return db;
}
function persist() { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* ignore */ } }
function emit(table) { (listeners.get(table) || []).forEach(fn => fn(list_(table))); }
function list_(table, includeDeleted = false) {
  const rows = Object.values(load()[table] || {});
  return includeDeleted ? rows : rows.filter(r => !Number(r.deleted));
}
export const newId = () => crypto.randomUUID().replace(/-/g, '');
export async function list(table, { includeDeleted = false } = {}) { return list_(table, includeDeleted); }
export async function get(table, id) { return (load()[table] || {})[id] || null; }
export async function save(table, partial) {
  const d = load();
  d[table] = d[table] || {};
  const prev = partial.id ? d[table][partial.id] : null;
  const row = { deleted: 0, ...prev, ...partial, id: partial.id || newId(), updatedAt: Date.now(), updatedBy: 'stub' };
  d[table][row.id] = row;
  persist(); emit(table);
  return row;
}
export async function remove(table, id) {
  const d = load();
  const row = (d[table] || {})[id];
  if (row) { row.deleted = 1; row.updatedAt = Date.now(); persist(); emit(table); }
}
export function subscribe(table, fn) {
  if (!listeners.has(table)) listeners.set(table, new Set());
  listeners.get(table).add(fn);
  return () => listeners.get(table).delete(fn);
}
export async function syncNow() { return { pushed: 0, pulled: 0, errors: [] }; }
export function status() { return { online: true, pending: 0, lastSync: null, syncing: false }; }
