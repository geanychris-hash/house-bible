// Small UI helpers shared by the S3 views (maintenance, consumables, weather alerts).
// Self-contained on purpose: these views only need core/data.js, so they work before S2's ui.js lands.
import * as HB from '../core/data.js';
export { HB };

export function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'selected') e[k] = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else e.setAttribute(k, v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    e.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return e;
}

const pad = n => String(n).padStart(2, '0');
/** Today's date in the phone's local time zone, YYYY-MM-DD. */
export const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const money = n => (n == null || n === '' || isNaN(n)) ? '' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const jsonOf = (v, fallback) => { if (v == null || v === '') return fallback; if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch { return fallback; } };

export function ensureCss(file) {
  const id = 'css-' + file;
  if (document.getElementById(id)) return;
  document.head.append(h('link', { id, rel: 'stylesheet', href: new URL('../../css/' + file, import.meta.url).href }));
}

/** Who is doing this (free text, for the `by` column). */
export function who() {
  try { if (typeof HB.deviceLabel === 'function') return HB.deviceLabel() || ''; } catch { /* ignore */ }
  try { return localStorage.getItem('hb.device') || ''; } catch { return ''; }
}

let toastTimer;
/** toast(msg) or toast(msg, {label, fn}) for an Undo-style button. */
export function toast(msg, action) {
  document.querySelectorAll('.mt-toast').forEach(t => t.remove());
  const t = h('div', { class: 'mt-toast', role: 'status' }, h('span', null, msg),
    action && h('button', { type: 'button', class: 'mt-btn mt-btn-small', onclick: () => { t.remove(); action.fn(); } }, action.label));
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), action ? 6000 : 2800);
}

/** Bottom-sheet on phones, centered dialog on wide screens. build(close) returns the body element. */
export function openModal(title, build) {
  const prevFocus = document.activeElement;
  const close = () => { document.removeEventListener('keydown', onKey); ov.remove(); if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch { /* ignore */ } };
  const onKey = e => { if (e.key === 'Escape' && ov.isConnected && ov === [...document.querySelectorAll('.mt-overlay')].pop()) close(); };
  const box = h('div', { class: 'mt-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title, tabindex: '-1' },
    h('div', { class: 'mt-modal-head' }, h('h2', null, title),
      h('button', { type: 'button', class: 'mt-btn mt-btn-small', 'aria-label': 'Close', onclick: close }, 'Close')));
  const ov = h('div', { class: 'mt-overlay', onmousedown: e => { if (e.target === ov) close(); } }, box);
  box.append(build(close));
  document.body.append(ov);
  document.addEventListener('keydown', onKey);
  const first = box.querySelector('input:not([type=hidden]),select,textarea');
  (first || box).focus({ preventScroll: true });
  return close;
}

export function field(label, control, hint, cls = '') {
  return h('label', { class: 'mt-field ' + cls }, h('span', { class: 'mt-label' }, label), control, hint && h('span', { class: 'mt-hint' }, hint));
}
export const select = (options, value, attrs) => h('select', attrs,
  options.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return h('option', { value: v, selected: String(v) === String(value) }, l); }));

/** Two-tap confirm button (no browser confirm()). */
export function confirmButton(label, onConfirm, cls = 'mt-btn mt-btn-danger') {
  let armed = false, timer;
  const b = h('button', { type: 'button', class: cls, onclick: () => {
    if (!armed) { armed = true; b.textContent = 'Tap again to confirm'; timer = setTimeout(() => { armed = false; b.textContent = label; }, 3500); }
    else { clearTimeout(timer); onConfirm(); }
  } }, label);
  return b;
}

/** Upload picked image files; returns file ids. Falls back gracefully if the files layer is missing. */
export async function uploadPhotos(fileList, parentKind = 'general') {
  const files = [...(fileList || [])];
  if (!files.length) return [];
  let mod;
  try { mod = await import('../core/files.js'); } catch { toast('Photos are not available yet. Saved without the photo.'); return []; }
  const api = mod.HBFiles || mod.default || mod;
  if (!api || typeof api.upload !== 'function') { toast('Photos are not available yet. Saved without the photo.'); return []; }
  const ids = [];
  for (const f of files) {
    try { const r = await api.upload(f, parentKind); if (r && r.fileId) ids.push(r.fileId); }
    catch { toast('One photo could not be saved.'); }
  }
  return ids;
}

/** Call an Apps Script action (testAlert, syncCalendar). S2's data layer is expected to expose api(). */
export async function callApi(action, extra) {
  const fn = HB.api || HB.callApi;
  if (typeof fn !== 'function') throw new Error('Not connected to the server yet.');
  return fn(action, extra);
}
