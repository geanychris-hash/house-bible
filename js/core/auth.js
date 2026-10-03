// Connection settings: Apps Script URL, shared key, device label. Stored in IndexedDB
// (store "meta", key "config") on this device only. The key is never logged.
import { defaultAdapter } from './store.js';
import { createApi } from './api.js';

let config = null;
let loaded = null;
const listeners = new Set();

export function loadConfig(adapter = defaultAdapter()) {
  if (!loaded) {
    loaded = adapter.open().then(() => adapter.get('meta', 'config')).then(c => { config = c || null; return config; })
      .catch(() => { config = null; return null; });
  }
  return loaded;
}
export const getConfig = () => config;
export const isConfigured = () => !!(config && config.url && config.key);
export const deviceLabel = () => (config && config.device) || 'unknown';
export function onConfigChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export function normalizeUrl(u) {
  const s = String(u || '').trim();
  if (!/^https?:\/\/\S+$/i.test(s)) return '';
  return s;
}

export async function saveConfig({ url, key, device }, adapter = defaultAdapter()) {
  const next = { url: normalizeUrl(url), key: String(key || '').trim(), device: String(device || '').trim() };
  if (!next.url || !next.key || !next.device) throw new Error('Fill in all three fields');
  await adapter.open();
  await adapter.batch([{ store: 'meta', key: 'config', value: next }]);
  config = next; loaded = Promise.resolve(next);
  listeners.forEach(fn => fn(next));
  return next;
}

export async function clearConfig(adapter = defaultAdapter()) {
  await adapter.open();
  await adapter.batch([{ store: 'meta', key: 'config', del: true }]);
  config = null; loaded = Promise.resolve(null);
  listeners.forEach(fn => fn(null));
}

// Try a ping with values that are not saved yet.
export async function testConnection({ url, key, device }, fetchImpl) {
  const api = createApi({ getConfig: () => null, fetchImpl });
  return api('ping', {}, { url: normalizeUrl(url), key: String(key || '').trim(), device: String(device || '').trim() });
}

// Setup link: <app url>#/connect?u=<exec url>&k=<key>
// SECURITY TRADEOFF: the shared key is inside this link, so anyone who sees the link can use the
// app's data. Send it privately (a direct message, not a group or public post). The Connect screen
// removes the key from the address bar as soon as it reads it, so it does not stay in history.
export function parseSetupQuery(query) {
  return { url: query.u || '', key: query.k || '' };
}
export function buildSetupLink(base, { url, key }) {
  const q = new URLSearchParams({ u: url, k: key });
  return `${base}#/connect?${q.toString()}`;
}
