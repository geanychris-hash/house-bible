// Files (CONTRACT section 8): upload with image downscale, offline queue, thumbnail cache,
// open/download. Cache and queue live in IndexedDB (stores "blobs" and "uploads").
//
// Offline uploads get a placeholder id "pending-<uuid>". Rows may store that id right away; on the
// next sync the queued upload is sent and every row that references the placeholder is rewritten
// with the real Drive id (see flushUploads, registered as a sync hook).
import * as HB from './data.js';
import { TABLES, fileFields } from './schema.js';

const adapter = HB.adapterInstance;
const MAX_PX = 1600;
const QUALITY = 0.82;
const isPending = id => typeof id === 'string' && id.startsWith('pending-');

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}
function base64ToBlob(b64, mime) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime || 'application/octet-stream' });
}

// Scale an image so its longest side is at most 1600 px and re-encode as JPEG 0.82.
// Anything that is not a decodable image (PDF, HEIC the browser cannot read) goes up unchanged.
export async function downscale(file) {
  if (!file.type || !file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_PX / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale)), hgt = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = hgt;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, hgt);     // JPEG has no transparency
    ctx.drawImage(bmp, 0, 0, w, hgt);
    if (bmp.close) bmp.close();
    const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', QUALITY));
    return blob || file;
  } catch { return file; }
}

const jpegName = n => (/\.jpe?g$/i.test(n) ? n : n.replace(/\.[^.]+$/, '') + '.jpg');

export async function upload(file, parentKind = 'general') {
  const isImg = file.type && file.type.startsWith('image/') && file.type !== 'image/gif' && file.type !== 'image/svg+xml';
  const blob = await downscale(file);
  const converted = blob !== file && blob.type === 'image/jpeg';
  const name = converted ? jpegName(file.name || 'photo.jpg') : (file.name || (isImg ? 'photo.jpg' : 'file'));
  const mime = blob.type || file.type || 'application/octet-stream';
  const queue = async () => {
    const id = 'pending-' + HB_newId();
    await adapter.batch([
      { store: 'blobs', key: id, value: { blob, name, mime } },
      { store: 'uploads', key: id, value: { id, name, mime, parentKind, size: blob.size, queuedAt: Date.now() } },
    ]);
    return { fileId: id, name, mime, size: blob.size, pending: true };
  };
  await HB.init();
  if (navigator.onLine === false) return queue();
  try {
    const res = await HB.callApi('upload', { name, mime, dataBase64: await blobToBase64(blob), parentKind });
    await adapter.batch([{ store: 'blobs', key: res.fileId, value: { blob, name, mime } }]);
    return { fileId: res.fileId, name: res.name || name, mime: res.mime || mime, size: res.size || blob.size };
  } catch (e) {
    if (e && (e.code === 'network' || e.code === 'not_configured')) return queue();
    throw e;
  }
}
const HB_newId = () => HB.newId();

// Send queued uploads, then swap placeholder ids for real ids in every row that uses them.
let flushing = null;
export function flushUploads() {
  if (!flushing) flushing = (async () => {
    const queued = await adapter.getAll('uploads');
    if (!queued.length) return 0;
    const map = new Map();
    for (const u of queued.sort((a, b) => a.queuedAt - b.queuedAt)) {
      const rec = await adapter.get('blobs', u.id);
      if (!rec) { await adapter.batch([{ store: 'uploads', key: u.id, del: true }]); continue; }
      const res = await HB.callApi('upload', { name: u.name, mime: u.mime, dataBase64: await blobToBase64(rec.blob), parentKind: u.parentKind });
      map.set(u.id, res.fileId);
      await adapter.batch([
        { store: 'blobs', key: res.fileId, value: rec },
        { store: 'uploads', key: u.id, del: true },
      ]);
    }
    if (map.size) await rewriteReferences(map);
    return map.size;
  })().finally(() => { flushing = null; });
  return flushing;
}
const swap = (v, map) => (Array.isArray(v) ? v.map(x => map.get(x) || x) : (map.get(v) || v));
async function rewriteReferences(map) {
  for (const table of TABLES) {
    const fields = fileFields(table);
    if (!fields.length) continue;
    for (const row of await HB.list(table, { includeDeleted: true })) {
      const patch = {};
      for (const f of fields) {
        const cur = row[f];
        const next = swap(cur, map);
        if (JSON.stringify(next) !== JSON.stringify(cur)) patch[f] = next;
      }
      if (Object.keys(patch).length) await HB.save(table, { id: row.id, ...patch });
    }
  }
}
HB.addSyncHook(flushUploads);

const urlCache = new Map();
const GENERIC_ICON = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="8" fill="#d6eaed"/><path d="M20 12h17l9 9v31H20z" fill="none" stroke="#0f6a78" stroke-width="3" stroke-linejoin="round"/><path d="M37 12v9h9" fill="none" stroke="#0f6a78" stroke-width="3"/></svg>');

// Object URL for a small preview. Cached in IndexedDB, so it also works offline for files seen before.
export async function thumbUrl(fileId) {
  if (!fileId) return GENERIC_ICON;
  if (urlCache.has(fileId)) return urlCache.get(fileId);
  await HB.init();
  let rec = await adapter.get('blobs', 'thumb:' + fileId);
  if (!rec) rec = await adapter.get('blobs', fileId);   // pending upload or a file we just sent
  if (!rec) {
    try {
      const res = await HB.callApi('thumb', { fileId });
      rec = { blob: base64ToBlob(res.dataBase64, res.mime), mime: res.mime };
      await adapter.batch([{ store: 'blobs', key: 'thumb:' + fileId, value: rec }]);
    } catch { return GENERIC_ICON; }
  }
  const url = rec.blob.type && rec.blob.type.startsWith('image/') ? URL.createObjectURL(rec.blob) : GENERIC_ICON;
  urlCache.set(fileId, url);
  return url;
}

// Fetch the full file (or use the local copy) and open it in a new tab; falls back to a download.
export async function open(fileId) {
  await HB.init();
  let rec = await adapter.get('blobs', fileId);
  if (!rec) {
    const res = await HB.callApi('file', { fileId });
    rec = { blob: base64ToBlob(res.dataBase64, res.mime), name: res.name, mime: res.mime };
    await adapter.batch([{ store: 'blobs', key: fileId, value: rec }]);
  }
  const url = URL.createObjectURL(rec.blob);
  const a = document.createElement('a');
  a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.download = '';
  const viewable = /^(image\/|application\/pdf|text\/)/.test(rec.blob.type);
  if (viewable) a.removeAttribute('download'); else a.download = rec.name || 'file';
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export async function pendingCount() { return (await adapter.getAll('uploads')).length; }
