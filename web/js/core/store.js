// Storage adapter. The sync engine only talks to this tiny interface so tests can run in Node
// with the in-memory version, and the browser uses IndexedDB.
//   adapter.open()                 -> Promise
//   adapter.getAll(store)          -> Promise<value[]>
//   adapter.get(store, key)        -> Promise<value|undefined>
//   adapter.batch([{store,key,value} | {store,key,del:true}]) -> Promise  (atomic)
import { TABLES } from './schema.js';

// One object store per table, plus these.
export const EXTRA_STORES = ['outbox', 'meta', 'blobs', 'uploads'];
export const ALL_STORES = [...TABLES, ...EXTRA_STORES];

const clone = v => (v === undefined || v instanceof Blob ? v : (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v))));

export function createMemoryAdapter() {
  const data = new Map(ALL_STORES.map(s => [s, new Map()]));
  return {
    kind: 'memory',
    async open() {},
    async getAll(store) { return [...data.get(store).values()].map(clone); },
    async get(store, key) { return clone(data.get(store).get(key)); },
    async batch(ops) {
      for (const op of ops) {
        if (op.del) data.get(op.store).delete(op.key);
        else data.get(op.store).set(op.key, clone(op.value));
      }
    },
  };
}

export function createIdbAdapter(name = 'house-bible-v2') {
  let dbp = null;
  const open = () => dbp || (dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of ALL_STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
  const done = tx => new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('transaction aborted'));
  });
  const reqP = r => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  return {
    kind: 'indexeddb',
    async open() { await open(); },
    async getAll(store) { const db = await open(); return reqP(db.transaction(store).objectStore(store).getAll()); },
    async get(store, key) { const db = await open(); return reqP(db.transaction(store).objectStore(store).get(key)); },
    async batch(ops) {
      if (!ops.length) return;
      const db = await open();
      const names = [...new Set(ops.map(o => o.store))];
      const tx = db.transaction(names, 'readwrite');
      for (const op of ops) {
        const os = tx.objectStore(op.store);
        if (op.del) os.delete(op.key); else os.put(op.value, op.key);
      }
      await done(tx);
    },
  };
}

let shared = null;
// Default adapter: IndexedDB in browsers, memory elsewhere (Node tests that import data.js directly).
export function defaultAdapter() {
  if (!shared) shared = typeof indexedDB !== 'undefined' ? createIdbAdapter() : createMemoryAdapter();
  return shared;
}
