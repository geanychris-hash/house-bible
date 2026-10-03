import * as HB from '/js/core/data.js';
export function h(tag, attrs, ...kids) {
  const e = document.createElement(tag); let value;
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'value') value = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, ''); else e.setAttribute(k, v);
  }
  for (const c of kids.flat(Infinity)) { if (c == null || c === false) continue; e.append(c.nodeType ? c : document.createTextNode(String(c))); }
  if (value !== undefined) e.value = value; return e;
}
export function toast(m) { const t = h('div', { class: 'toast' }, m); document.body.append(t); setTimeout(() => t.remove(), 2000); }
export const confirm = async () => true;
export async function openForm({ title, fields, values = {}, onSave, onDelete }) {
  const ov = h('div', { class: 'overlay', style: 'position:fixed;inset:0;background:#0008;overflow:auto;z-index:9' });
  const box = h('div', { style: 'background:#fff;color:#000;margin:10px;padding:12px;border-radius:8px', role: 'dialog' }, h('h2', null, title));
  const els = {};
  for (const f of fields) {
    let el;
    if (f.type === 'select') el = h('select', { id: 'f_' + f.k }, f.options.map(o => h('option', { value: o }, o)));
    else if (f.type === 'ref') { const rows = await HB.list(f.table); el = h('select', { id: 'f_' + f.k }, h('option', { value: '' }, '(none)'), rows.map(r => h('option', { value: r.id }, r[f.labelKey || 'name']))); }
    else if (f.type === 'textarea') el = h('textarea', { id: 'f_' + f.k });
    else el = h('input', { id: 'f_' + f.k, type: f.type || 'text' });
    if (values[f.k] != null) el.value = values[f.k];
    els[f.k] = el; box.append(h('div', null, h('label', null, f.label), el));
  }
  const close = () => ov.remove();
  box.append(h('button', { id: 'save', onclick: async () => { const out = {}; fields.forEach(f => { let v = els[f.k].value; if (f.type === 'number') v = v === '' ? null : Number(v); out[f.k] = v; }); if ((await onSave(out)) !== false) close(); } }, 'Save'),
    onDelete ? h('button', { id: 'del', onclick: async () => { await onDelete(); close(); } }, 'Delete') : null, h('button', { onclick: close }, 'Cancel'));
  ov.append(box); document.body.append(ov);
}
