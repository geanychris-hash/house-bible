// Shared helpers for the S5 views (projects, materials, expenses, tools, utilities, reports).
import * as HB from '../core/data.js';
import * as HBui from '../core/ui.js';

export { HB, HBui };
export const h = HBui.h;

const loaded = new Set();
/* Load web/css/<name> once, relative to this module so GitHub Pages project sites work. */
export function ensureCss(name = 'projects.css') {
  if (loaded.has(name) || typeof document === 'undefined') return;
  loaded.add(name);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('../../css/' + name, import.meta.url).href;
  document.head.append(link);
}

export const money = n => (n == null || n === '' || Number.isNaN(Number(n))) ? '' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const money0 = n => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const fmtDate = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? `${MONTH_NAMES[+m[2] - 1]} ${+m[3]}, ${m[1]}` : ''; };
export const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const cap = s => s ? s[0].toUpperCase() + s.slice(1) : '';

export const panel = (title, actions, ...kids) => h('section', { class: 's5-panel' },
  (title || actions) ? h('header', null, title ? h('h2', null, title) : h('span'), actions ? h('div', { class: 's5-row' }, actions) : null) : null, ...kids);
export const btn = (label, fn, cls = '') => h('button', { class: 's5-btn ' + cls, type: 'button', onclick: fn }, label);
export const empty = msg => h('p', { class: 's5-muted' }, msg);
export const chip = (t, cls = '') => t ? h('span', { class: 's5-chip ' + cls }, t) : null;
export const banner = (msg, bad) => h('div', { class: 's5-banner' + (bad ? ' bad' : '') }, msg);
export const tabBar = (items, current, onPick) => h('div', { class: 's5-tabs', role: 'tablist' },
  items.map(([k, l]) => h('button', { role: 'tab', type: 'button', 'aria-selected': String(k === current), onclick: () => onPick(k) }, l)));

/* Text or number input that calls onchange when the user commits a value. */
export function inp(val, onchange, o = {}) {
  return h('input', {
    value: val ?? '', type: o.type || 'text', step: o.type === 'number' ? 'any' : null, class: o.cls || '', placeholder: o.ph || '',
    inputmode: o.type === 'number' ? 'decimal' : null, 'aria-label': o.label || null,
    onchange: e => onchange(o.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value),
  });
}
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); HBui.toast('Copied'); } catch { HBui.toast('Copy failed. Select the text and copy by hand.'); }
}
export function downloadText(name, text, type = 'text/csv') {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' })), download: name });
  document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

/* Re-render when a table changes, unless the user is typing in the container. */
export function watchTables(container, tables, draw) {
  let t;
  const unsubs = tables.map(tb => HB.subscribe(tb, () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const a = document.activeElement;
      if (a && container.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
      draw();
    }, 250);
  }));
  return () => { clearTimeout(t); unsubs.forEach(u => u && u()); };
}
export const byName = (a, b) => String(a.name || '').localeCompare(String(b.name || ''));
export const idMap = (rows, key = 'name') => new Map(rows.map(r => [r.id, r[key]]));
export const csvEscape = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
