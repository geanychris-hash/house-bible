// Shared DOM helpers for the S4 record views (rooms, documents, assets, shutoffs, contacts, steam, sensitive, qr).
// Works against the CONTRACT section 8 interfaces. If core/files.js or core/ui.js do not exist yet,
// it falls back to a local file store (IndexedDB) and its own toast/form, so the views run on the stub data layer.
import * as HB from '../core/data.js';
import { parseLength, fmtLength, parseHash, todayISO, expiryState } from './rooms-units.js';

export { HB };
export * from './rooms-units.js';

async function tryImport(path) { try { return await import(path); } catch { return null; } }
const uiMod = await tryImport('../core/ui.js');
const filesMod = await tryImport('../core/files.js');
const realFiles = filesMod && (filesMod.HBFiles || (filesMod.upload ? filesMod : filesMod.default)) || globalThis.HBFiles || null;
export const usingLocalFiles = !(realFiles && realFiles.upload);

// ---------- DOM ----------
export function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  let value;
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'value') value = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else e.setAttribute(k, v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    e.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  if (value !== undefined) e.value = value;
  return e;
}

export function loadCss(...names) {
  for (const n of names) {
    const href = new URL(`../../css/${n}.css`, import.meta.url).href;
    if (![...document.querySelectorAll('link[rel=stylesheet]')].some(l => l.href === href)) {
      document.head.append(h('link', { rel: 'stylesheet', href }));
    }
  }
}
loadCss('rooms');

export function toast(msg) {
  if (uiMod && typeof uiMod.toast === 'function') return uiMod.toast(msg);
  const t = h('div', { class: 'rec-toast', role: 'status' }, msg);
  document.body.append(t);
  setTimeout(() => t.remove(), 3500);
}

// Two-step confirm that never uses window.confirm. Returns a promise of true/false.
export function confirmDialog(message, { yes = 'Delete', danger = true } = {}) {
  return new Promise(res => {
    const { close } = modal('Please confirm', (close2) => h('div', { class: 'rec-stack' },
      h('p', null, message),
      h('div', { class: 'rec-row rec-end' },
        h('button', { class: 'rec-btn', type: 'button', onclick: () => { res(false); close2(); } }, 'Cancel'),
        h('button', { class: 'rec-btn ' + (danger ? 'rec-danger' : 'rec-primary'), type: 'button', onclick: () => { res(true); close2(); } }, yes))),
      { onClose: () => res(false) });
    void close;
  });
}

// ---------- modal ----------
export function modal(title, build, { onClose, wide = false } = {}) {
  const prevFocus = document.activeElement;
  let closed = false;
  const overlay = h('div', { class: 'rec-overlay' });
  const box = h('div', { class: 'rec-modal' + (wide ? ' rec-wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title });
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    document.body.classList.remove('rec-noscroll');
    try { prevFocus && prevFocus.focus && prevFocus.focus(); } catch { /* ignore */ }
    onClose && onClose();
  };
  const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey);
  box.append(h('div', { class: 'rec-modal-head' }, h('h2', null, title),
    h('button', { class: 'rec-btn rec-small', type: 'button', 'aria-label': 'Close', onclick: close }, 'Close')));
  const body = h('div', { class: 'rec-modal-body' });
  body.append(build(close));
  box.append(body);
  overlay.append(box);
  document.body.append(overlay);
  document.body.classList.add('rec-noscroll');
  const first = box.querySelector('input:not([type=hidden]):not([type=file]),select,textarea');
  if (first && matchMedia('(pointer:fine)').matches) first.focus();
  return { close, box, body };
}

// ---------- files (HBFiles with a local fallback) ----------
const LOCAL_DB = 'hb.s4.localfiles';
const memFiles = new Map();
let localDbP = null;
function localDb() {
  return localDbP || (localDbP = new Promise((res, rej) => {
    try {
      const r = indexedDB.open(LOCAL_DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('f');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    } catch (e) { rej(e); }
  }));
}
async function localPut(id, rec) {
  memFiles.set(id, rec);
  try {
    const db = await localDb();
    await new Promise((res, rej) => { const tx = db.transaction('f', 'readwrite'); tx.objectStore('f').put(rec, id); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  } catch { /* memory only */ }
}
async function localGet(id) {
  if (memFiles.has(id)) return memFiles.get(id);
  try {
    const db = await localDb();
    return await new Promise((res, rej) => { const r = db.transaction('f').objectStore('f').get(id); r.onsuccess = () => res(r.result || null); r.onerror = () => rej(r.error); });
  } catch { return null; }
}
async function shrinkImage(file, max = 1600) {
  if (!/^image\//.test(file.type) || /svg|gif/.test(file.type)) return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.82));
    return blob || file;
  } catch { return file; }
}
function saveBlob(blob, name) {
  const a = h('a', { href: URL.createObjectURL(blob), download: name || 'file' });
  document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

export const Files = {
  async upload(file, parentKind = 'general') {
    if (!usingLocalFiles) return realFiles.upload(file, parentKind);
    const blob = await shrinkImage(file);
    const fileId = 'local' + crypto.randomUUID().replace(/-/g, '');
    const name = file.name || 'photo.jpg';
    await localPut(fileId, { blob, name, mime: blob.type || file.type || 'application/octet-stream', size: blob.size });
    return { fileId, name, mime: blob.type || file.type, size: blob.size };
  },
  async thumbUrl(fileId) {
    if (!fileId) return null;
    if (!String(fileId).startsWith('local') && !usingLocalFiles) { try { return await realFiles.thumbUrl(fileId); } catch { return null; } }
    const rec = await localGet(fileId);
    return rec && /^image\//.test(rec.mime) ? URL.createObjectURL(rec.blob) : null;
  },
  async open(fileId) {
    if (!String(fileId).startsWith('local') && !usingLocalFiles) return realFiles.open(fileId);
    const rec = await localGet(fileId);
    if (!rec) return toast('File is not on this device.');
    const url = URL.createObjectURL(rec.blob);
    window.open(url, '_blank', 'noopener') || saveBlob(rec.blob, rec.name);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  },
  // Download: uses HBFiles.blob(fileId) when S2 provides it (cross-stream request), else falls back to open().
  async download(fileId, name) {
    if (!String(fileId).startsWith('local') && !usingLocalFiles) {
      if (typeof realFiles.blob === 'function') { const b = await realFiles.blob(fileId); return saveBlob(b, name); }
      return realFiles.open(fileId);
    }
    const rec = await localGet(fileId);
    if (!rec) return toast('File is not on this device.');
    saveBlob(rec.blob, name ? name + extFor(rec) : rec.name);
  },
  async info(fileId) {
    const rec = String(fileId).startsWith('local') ? await localGet(fileId) : null;
    return rec ? { name: rec.name, mime: rec.mime, size: rec.size } : null;
  },
};
const extFor = rec => { const m = String(rec.name || '').match(/\.[A-Za-z0-9]+$/); return m ? m[0] : ''; };

// Thumbnail button. Clicking it calls onclick, or opens the file when none is given.
export function fileThumb(fileId, { onclick, label = 'File', cls = '' } = {}) {
  const btn = h('button', { type: 'button', class: 'rec-thumb ' + cls, 'aria-label': 'Open ' + label },
    h('span', { class: 'rec-thumb-ph' }, label));
  Files.thumbUrl(fileId).then(url => {
    if (url) { btn.replaceChildren(h('img', { src: url, alt: '', loading: 'lazy' })); }
  }).catch(() => { });
  btn.addEventListener('click', onclick || (() => Files.open(fileId)));
  return btn;
}

export function thumbStrip(ids, label = 'Photo') {
  const list = (ids || []).filter(Boolean);
  if (!list.length) return null;
  return h('div', { class: 'rec-photos' }, list.map(id => fileThumb(id, { label })));
}

// File picker widget for forms. .value is an array of file ids. .pending is a promise while uploading.
export function fileWidget({ multiple = true, parentKind = 'general', accept = 'image/*', camera = true, values = [] } = {}) {
  let ids = [...values];
  const names = {};
  let uploading = 0;
  const box = h('div', { class: 'rec-filewidget' });
  const strip = h('div', { class: 'rec-photos' });
  const status = h('span', { class: 'rec-muted' });
  let pendingChain = Promise.resolve();
  const draw = () => {
    strip.replaceChildren(...ids.map(id => h('span', { class: 'rec-ph' },
      fileThumb(id, { label: 'File' }),
      h('button', { type: 'button', class: 'rec-x', 'aria-label': 'Remove', onclick: () => { ids = ids.filter(x => x !== id); draw(); } }, '×'))));
    status.textContent = uploading ? `Uploading ${uploading}…` : '';
  };
  const add = files => {
    for (const f of files) {
      uploading++; draw();
      pendingChain = pendingChain.then(() => Files.upload(f, parentKind)).then(r => {
        names[r.fileId] = r.name;
        ids = multiple ? ids.concat(r.fileId) : [r.fileId];
      }).catch(e => toast('Upload failed: ' + (e && e.message || e))).finally(() => { uploading--; draw(); });
    }
  };
  const input = (cap) => {
    const i = h('input', { type: 'file', accept, class: 'rec-hidden', multiple: multiple && !cap, capture: cap ? 'environment' : null });
    i.addEventListener('change', () => { add([...i.files]); i.value = ''; });
    return i;
  };
  const pick = input(false), cam = camera && /image/.test(accept) ? input(true) : null;
  box.append(strip, h('div', { class: 'rec-row' },
    cam ? h('button', { type: 'button', class: 'rec-btn rec-small', onclick: () => cam.click() }, 'Take photo') : null,
    h('button', { type: 'button', class: 'rec-btn rec-small', onclick: () => pick.click() }, multiple ? 'Choose files' : 'Choose file'), status), pick, cam);
  Object.defineProperty(box, 'value', { get: () => ids.slice(), set: v => { ids = (v || []).slice(); draw(); } });
  Object.defineProperty(box, 'pending', { get: () => pendingChain });
  box.names = names;
  draw();
  return box;
}

// ---------- forms ----------
// field: {key,label,type,options,table,labelKey,required,placeholder,help,rows,wide,parentKind,accept,multiple,camera}
// types: text textarea num date time select ref bool files length(feet and inches -> inches) email tel
export async function openForm({ title, fields, values = {}, submitLabel = 'Save', onSubmit, onDelete, wide = false }) {
  const refData = {};
  await Promise.all(fields.filter(f => f.type === 'ref').map(async f => { refData[f.key] = await HB.list(f.table); }));
  const controls = {};
  const ctx = modal(title, close => {
    const form = h('form', { class: 'rec-form', novalidate: true });
    const err = h('p', { class: 'rec-error', role: 'alert' });
    for (const f of fields) {
      const id = 'f_' + f.key + '_' + Math.random().toString(36).slice(2, 6);
      let el;
      const v = values[f.key];
      if (f.type === 'textarea') el = h('textarea', { id, rows: f.rows || 3, placeholder: f.placeholder || '' });
      else if (f.type === 'select') el = h('select', { id }, (f.options || []).map(o => {
        const [val, lab] = Array.isArray(o) ? o : [o, o || '(none)'];
        return h('option', { value: val }, lab);
      }));
      else if (f.type === 'ref') {
        const rows = (refData[f.key] || []).slice().sort((a, b) => String(a[f.labelKey || 'name']).localeCompare(String(b[f.labelKey || 'name'])));
        el = h('select', { id }, h('option', { value: '' }, '(none)'), rows.map(r => h('option', { value: r.id }, r[f.labelKey || 'name'] || '(unnamed)')));
      } else if (f.type === 'bool') el = h('input', { id, type: 'checkbox' });
      else if (f.type === 'files') el = fileWidget({ multiple: f.multiple !== false, parentKind: f.parentKind, accept: f.accept || 'image/*', camera: f.camera !== false });
      else if (f.type === 'length') el = h('input', { id, type: 'text', inputmode: 'text', placeholder: f.placeholder || `e.g. 12' 6"`, autocomplete: 'off' });
      else el = h('input', { id, type: f.type === 'num' ? 'number' : (f.type || 'text'), step: f.type === 'num' ? 'any' : null, inputmode: f.type === 'num' ? 'decimal' : null, placeholder: f.placeholder || '' });
      if (f.type === 'bool') el.checked = !!Number(v);
      else if (f.type === 'files') el.value = Array.isArray(v) ? v : (parseFilesValue(v));
      else if (f.type === 'length') el.value = v != null && v !== '' ? fmtLength(v) : '';
      else if (v != null && v !== '') el.value = v;
      else if (f.default != null) el.value = typeof f.default === 'function' ? f.default() : f.default;
      controls[f.key] = el;
      form.append(h('div', { class: 'rec-field' + (f.wide || f.type === 'textarea' || f.type === 'files' ? ' rec-fw' : '') + (f.type === 'bool' ? ' rec-check' : '') },
        f.type === 'bool' ? h('label', { for: id }, el, ' ', f.label) : [h('label', { for: id }, f.label + (f.required ? ' *' : '')), el],
        f.help ? h('small', { class: 'rec-muted' }, f.help) : null));
    }
    const readValues = () => {
      const out = {};
      for (const f of fields) {
        const el = controls[f.key];
        let val;
        if (f.type === 'bool') val = el.checked ? 1 : 0;
        else if (f.type === 'files') val = el.value;
        else if (f.type === 'num') val = el.value === '' ? '' : Number(el.value);
        else if (f.type === 'length') { const p = parseLength(el.value); val = el.value.trim() === '' ? '' : p; }
        else val = (el.value || '').trim();
        out[f.key] = val;
      }
      return out;
    };
    const submit = async () => {
      err.textContent = '';
      for (const f of fields) {
        const el = controls[f.key];
        if (f.type === 'length' && el.value.trim() && isNaN(parseLength(el.value))) { err.textContent = `${f.label}: could not read that length. Try 12' 6" or 150.`; el.focus(); return; }
      }
      const pend = fields.filter(f => f.type === 'files').map(f => controls[f.key].pending);
      saveBtn.disabled = true; saveBtn.textContent = 'Saving…';
      try {
        await Promise.all(pend);
        const out = readValues();
        for (const f of fields) {
          if (f.required && (out[f.key] === '' || out[f.key] == null || (Array.isArray(out[f.key]) && !out[f.key].length))) {
            err.textContent = `${f.label} is required.`; return;
          }
        }
        const r = await onSubmit(out, controls);
        if (r !== false) close();
      } catch (e) { err.textContent = 'Could not save: ' + (e && e.message || e); }
      finally { saveBtn.disabled = false; saveBtn.textContent = submitLabel; }
    };
    const saveBtn = h('button', { class: 'rec-btn rec-primary', type: 'submit' }, submitLabel);
    form.addEventListener('submit', e => { e.preventDefault(); submit(); });
    form.append(err, h('div', { class: 'rec-row rec-between rec-fw' },
      onDelete ? h('button', { class: 'rec-btn rec-danger', type: 'button', onclick: async () => { if (await confirmDialog('Delete this? It can be restored from the Sheet.')) { await onDelete(); close(); } } }, 'Delete') : h('span'),
      h('div', { class: 'rec-row' }, h('button', { class: 'rec-btn', type: 'button', onclick: close }, 'Cancel'), saveBtn)));
    return form;
  }, { wide });
  return ctx;
}
export const encodeFiles = ids => JSON.stringify((ids || []).filter(Boolean));
export function parseFilesValue(v) {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string' && v) { try { const a = JSON.parse(v); if (Array.isArray(a)) return a; } catch { /* a bare id */ } return [v]; }
  return [];
}

// ---------- view plumbing ----------
export const route = () => parseHash(location.hash);
export const link = (hash, text, cls = '') => h('a', { href: hash, class: cls }, text);

// build(route, api) -> { node, refresh() }. Rebuilds on hashchange, calls refresh() when listed tables change.
export function mountView(container, tables, build) {
  let alive = true, timer = null, cur = null, token = 0;
  const cache = {};
  const load = async () => { await Promise.all(tables.map(async t => { cache[t] = await HB.list(t); })); return cache; };
  const rebuild = async () => {
    const t = ++token;
    try {
      await load();
      if (!alive || t !== token) return;
      cur = build(route(), cache);
      container.replaceChildren(cur.node);
      cur.refresh && cur.refresh();
    } catch (e) {
      console.error(e);
      container.replaceChildren(h('p', { class: 'rec-error' }, 'Something went wrong: ' + e.message));
    }
  };
  const onData = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => { if (!alive) return; await load(); cur && cur.refresh && cur.refresh(); }, 40);
  };
  const unsubs = tables.map(t => HB.subscribe(t, onData));
  window.addEventListener('hashchange', rebuild);
  rebuild();
  return () => { alive = false; clearTimeout(timer); unsubs.forEach(u => u && u()); window.removeEventListener('hashchange', rebuild); };
}

// Register a view with the S2 router. In the harness or before S2 lands, it is queued on window.__hbViews.
export async function register(def) {
  const r = await tryImport('../core/router.js');
  if (r && typeof r.registerView === 'function') r.registerView(def);
  else (window.__hbViews = window.__hbViews || []).push(def);
}

// ---------- small UI parts ----------
export const fill = (el, ...kids) => el.replaceChildren(...kids.flat(Infinity).filter(k => k != null && k !== false));
export const refName = (rows, id, key = 'name') => { const r = (rows || []).find(x => x.id === id); return r ? (r[key] || '(unnamed)') : ''; };
export const byName = (key = 'name') => (a, b) => String(a[key] || '').localeCompare(String(b[key] || ''));
export const emptyState = (title, body, action) => h('div', { class: 'rec-empty' }, h('strong', null, title), body ? h('p', { class: 'rec-muted' }, body) : null, action || null);
export const badge = (text, kind = '') => h('span', { class: 'rec-badge ' + kind }, text);
export function expiryBadge(dateStr, windowDays = 60) {
  const s = expiryState(dateStr, windowDays);
  if (s.state === 'none') return null;
  return badge(s.text, s.state === 'expired' ? 'rec-bad' : s.state === 'soon' ? 'rec-warn' : '');
}
export function pageHead(title, ...actions) {
  return h('div', { class: 'rec-head' }, h('h1', null, title), h('div', { class: 'rec-row' }, actions));
}
export function panel(title, body, ...actions) {
  return h('section', { class: 'rec-panel' }, h('div', { class: 'rec-row rec-between' }, h('h3', null, title), h('div', { class: 'rec-row' }, actions)), body);
}
export const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch { return d; } };
export const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };
export const KIND_LABELS = { manual: 'Manual', receipt: 'Receipt', permit: 'Permit', inspection: 'Inspection', closing: 'Closing', warranty: 'Warranty', insurance: 'Insurance', photo: 'Photo', other: 'Other' };
export { todayISO };
