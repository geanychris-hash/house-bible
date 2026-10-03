// UI helpers (CONTRACT section 8): h(), openModal(), openForm(), toast(), confirm().
// Ported from legacy/v1/js/util.js and extended with ref, files, bool and json-list fields.
import * as HB from './data.js';

export function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  let value;
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k === 'value') value = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
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

/* ---------- toast ---------- */
let toastTimer;
export function toast(msg) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = h('div', { class: 'toast', role: 'status' }, msg);
  document.body.append(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 2800);
}

/* ---------- modal with focus handling ----------
   Focus moves into the dialog, Tab stays inside it, Escape closes it, and focus goes back to
   whatever opened it. */
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
const modalStack = [];
export function openModal(title, bodyBuilder, { onClose } = {}) {
  const opener = document.activeElement;
  const titleId = 'm_' + Math.random().toString(36).slice(2, 8);
  const box = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': titleId, tabindex: '-1' });
  const ov = h('div', { class: 'overlay', onmousedown: e => { if (e.target === ov) close(); } }, box);
  let closed = false;
  const onKey = e => {
    if (modalStack[modalStack.length - 1] !== ov) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    const f = [...box.querySelectorAll(FOCUSABLE)].filter(el => el.offsetParent !== null || el === document.activeElement);
    if (!f.length) { e.preventDefault(); box.focus(); return; }
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === box)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  function close(result) {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    const i = modalStack.indexOf(ov); if (i >= 0) modalStack.splice(i, 1);
    ov.remove();
    if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus();
    if (onClose) onClose(result);
  }
  box.append(h('h2', { id: titleId }, title), bodyBuilder(close));
  document.body.append(ov);
  modalStack.push(ov);
  document.addEventListener('keydown', onKey);
  const first = box.querySelector('input:not([type=hidden]),select,textarea');
  (first || box).focus();
  return close;
}

/* ---------- confirm: resolves true or false ---------- */
export function confirm(msg, { yes = 'Yes', no = 'Cancel', danger = false } = {}) {
  return new Promise(resolve => {
    let answer = false;
    openModal('Please confirm', close => h('div', { class: 'list' },
      h('p', null, msg),
      h('div', { class: 'row spread' },
        h('button', { class: 'btn', type: 'button', onclick: () => close() }, no),
        h('button', { class: 'btn ' + (danger ? 'danger' : 'primary'), type: 'button', onclick: () => { answer = true; close(); } }, yes))),
      { onClose: () => resolve(answer) });
  });
}

/* ---------- files field: photo/document picker ----------
   Value is an array of file ids (multi) or a single id string (multi:false).
   Uploads go through HBFiles (loaded lazily to avoid a circular import). */
async function filesModule() { return import('./files.js'); }

function filesField(f, initial) {
  const multi = f.multi !== false && f.type !== 'file';
  let ids = Array.isArray(initial) ? [...initial] : (initial ? [initial] : []);
  const wrap = h('div', { class: 'photos' });
  const input = h('input', { type: 'file', multiple: multi, accept: f.accept || (f.docs ? '*/*' : 'image/*'), class: 'visually-hidden', tabindex: '-1' });
  if (f.capture) input.setAttribute('capture', f.capture);
  const status = h('span', { class: 'muted', role: 'status' });
  const draw = async () => {
    wrap.replaceChildren();
    const files = await filesModule();
    for (const id of ids) {
      const img = h('img', { class: 'thumb', alt: 'attached file', loading: 'lazy' });
      files.thumbUrl(id).then(u => { img.src = u; }).catch(() => {});
      wrap.append(h('span', { class: 'ph' }, img,
        h('button', { type: 'button', class: 'x', 'aria-label': 'Remove file', onclick: () => { ids = ids.filter(x => x !== id); draw(); } }, '×')));
    }
    wrap.append(h('button', { type: 'button', class: 'btn small', onclick: () => input.click() }, ids.length && !multi ? 'Replace' : (f.docs ? 'Add file' : 'Add photo')), status);
  };
  input.addEventListener('change', async () => {
    const files = await filesModule();
    const picked = [...input.files];
    input.value = '';
    for (const file of picked) {
      status.textContent = 'Saving ' + file.name + '...';
      try {
        const res = await files.upload(file, f.parentKind || 'general');
        ids = multi ? [...ids, res.fileId] : [res.fileId];
      } catch (e) { toast('Could not add ' + file.name); }
    }
    status.textContent = '';
    draw();
  });
  draw();
  const el = h('div', { class: 'filesfield' }, wrap, input);
  return { el, get: () => (multi ? ids : (ids[0] || '')) };
}

/* ---------- json-list field ----------
   Editable list. Without itemFields it is a list of strings; with itemFields
   ([{k,label,type}]) it is a list of objects, e.g. steps: [{k:'t',label:'Step'},{k:'d',type:'bool',label:'Done'}]. */
function jsonListField(f, initial) {
  let items = Array.isArray(initial) ? initial.map(x => (typeof x === 'object' && x !== null ? { ...x } : x)) : [];
  const box = h('div', { class: 'jsonlist' });
  const simple = !f.itemFields;
  const draw = () => {
    box.replaceChildren();
    items.forEach((it, i) => {
      const cells = simple
        ? [h('input', { type: 'text', 'aria-label': f.label + ' ' + (i + 1), value: it ?? '', oninput: e => { items[i] = e.target.value; } })]
        : f.itemFields.map(sf => sf.type === 'bool'
          ? h('label', { class: 'inline' }, h('input', { type: 'checkbox', checked: !!Number(it[sf.k]), onchange: e => { it[sf.k] = e.target.checked ? 1 : 0; } }), sf.label)
          : h('input', { type: sf.type === 'number' ? 'number' : 'text', step: sf.type === 'number' ? 'any' : null, placeholder: sf.label, 'aria-label': sf.label + ' ' + (i + 1), value: it[sf.k] ?? '',
            oninput: e => { it[sf.k] = sf.type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value; } }));
      box.append(h('div', { class: 'row nowrap jl-row' }, cells,
        h('button', { type: 'button', class: 'btn small', 'aria-label': 'Remove item ' + (i + 1), onclick: () => { items.splice(i, 1); draw(); } }, '×')));
    });
    box.append(h('button', { type: 'button', class: 'btn small', onclick: () => { items.push(simple ? '' : Object.fromEntries(f.itemFields.map(sf => [sf.k, sf.type === 'bool' ? 0 : '']))); draw(); const ins = box.querySelectorAll('.jl-row'); const last = ins[ins.length - 1]; if (last) last.querySelector('input').focus(); } }, f.addLabel || 'Add'));
  };
  draw();
  return { el: box, get: () => (simple ? items.filter(x => String(x).trim() !== '') : items.filter(o => Object.values(o).some(v => v !== '' && v !== null && v !== 0))) };
}

/* ---------- ref field: select from another table ---------- */
function refField(f, id, initial) {
  const sel = h('select', { id }, h('option', { value: '' }, '(none)'));
  const labelOf = r => r[f.labelKey || 'name'] || r.title || r.label || r.id;
  HB.list(f.table).then(rows => {
    rows.sort((a, b) => String(labelOf(a)).localeCompare(String(labelOf(b))));
    for (const r of rows) sel.append(h('option', { value: r.id }, labelOf(r)));
    sel.value = initial || '';
    if (initial && sel.value !== initial) { sel.append(h('option', { value: initial }, '(missing item)')); sel.value = initial; }
  });
  return { el: sel, get: () => sel.value };
}

/* ---------- openForm ----------
   fields: [{k,label,type,...}] with type one of
     text (default) | textarea | date | time | number | select | bool | ref | files | file | json-list
   select: options as ['a','b'] or [{value,label}] or a function returning either
   ref: {table, labelKey?}       files/file: {parentKind, docs?, accept?, multi?}
   json-list: {itemFields?, addLabel?}
   onSave(values) may be async; return false to keep the form open. */
export function openForm({ title, fields, values = {}, onSave, onDelete, saveLabel = 'Save', deleteLabel = 'Delete' }) {
  return openModal(title, close => {
    const getters = {};
    const form = h('form', { class: 'form', novalidate: true });
    const err = h('div', { class: 'form-error', role: 'alert' });
    for (const f of fields) {
      const id = 'f_' + f.k + '_' + Math.random().toString(36).slice(2, 6);
      const v = values[f.k];
      let el, get, wide = !!f.wide;
      const type = f.type || 'text';
      if (type === 'textarea') { el = h('textarea', { id, rows: f.rows || 3, placeholder: f.placeholder || '' }); if (v != null) el.value = v; get = () => el.value; wide = true; }
      else if (type === 'select') {
        const opts = (typeof f.options === 'function' ? f.options() : f.options || []).map(o => (typeof o === 'object' ? o : { value: o, label: o || '(none)' }));
        el = h('select', { id }, opts.map(o => h('option', { value: o.value }, o.label)));
        if (v != null) el.value = v; get = () => el.value;
      } else if (type === 'bool') {
        el = h('input', { id, type: 'checkbox', checked: !!Number(v) }); get = () => (el.checked ? 1 : 0);
      } else if (type === 'ref') { const r = refField(f, id, v); el = r.el; get = r.get; }
      else if (type === 'files' || type === 'file') { const r = filesField(f, v); el = r.el; get = r.get; wide = true; }
      else if (type === 'json-list') { const r = jsonListField(f, v); el = r.el; get = r.get; wide = true; }
      else {
        el = h('input', { id, type: type === 'number' ? 'number' : type, step: type === 'number' ? 'any' : null, inputmode: type === 'number' ? 'decimal' : null, placeholder: f.placeholder || '', autocomplete: 'off' });
        if (v != null) el.value = v;
        get = () => (type === 'number' ? (el.value === '' ? null : Number(el.value)) : el.value);
      }
      getters[f.k] = get;
      const labelEl = (type === 'files' || type === 'file' || type === 'json-list')
        ? h('span', { class: 'lbl', id: id + '_l' }, f.label) : h('label', { for: id }, f.label);
      form.append(h('div', { class: 'field' + (wide ? ' wide' : '') + (type === 'bool' ? ' check' : ''), 'data-k': f.k },
        type === 'bool' ? [el, labelEl] : [labelEl, el]));
    }
    let saving = false;
    const save = async () => {
      if (saving) return;
      const out = {};
      for (const f of fields) out[f.k] = getters[f.k]();
      for (const f of fields) if (f.required && (out[f.k] === '' || out[f.k] == null)) {
        err.textContent = `${f.label} is needed.`;
        const el = form.querySelector(`[data-k="${f.k}"] input,[data-k="${f.k}"] select,[data-k="${f.k}"] textarea`); if (el) el.focus();
        return;
      }
      saving = true;
      try { if ((await onSave(out)) !== false) close(); }
      catch (e) { err.textContent = 'Could not save: ' + (e && e.message || e); }
      finally { saving = false; }
    };
    form.addEventListener('submit', e => { e.preventDefault(); save(); });
    return h('div', { class: 'list' }, form, err,
      h('div', { class: 'row spread' },
        onDelete ? h('button', { class: 'btn danger', type: 'button', onclick: async () => { if (await confirm('Delete this?', { yes: deleteLabel, danger: true })) { await onDelete(); close(); } } }, deleteLabel) : h('span'),
        h('div', { class: 'row' },
          h('button', { class: 'btn', type: 'button', onclick: () => close() }, 'Cancel'),
          h('button', { class: 'btn primary', type: 'button', onclick: save }, saveLabel))));
  });
}

/* Two-step confirm button without a dialog (v1 helper, kept for views that like it). */
export function confirmBtn(label, onConfirm, cls = 'btn small danger') {
  let armed = false, timer;
  const b = h('button', { class: cls, type: 'button', onclick: () => {
    if (!armed) { armed = true; b.textContent = 'Tap again to confirm'; timer = setTimeout(() => { armed = false; b.textContent = label; }, 3000); }
    else { clearTimeout(timer); onConfirm(); }
  } }, label);
  return b;
}

/* ---------- small shared formatters ---------- */
export const money = n => (n == null || n === '' || isNaN(n)) ? '' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pad = n => String(n).padStart(2, '0');
export const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const fmtDate = s => {
  if (!s) return '';
  const [y, m, d] = String(s).split('-').map(Number);
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1] + ` ${d}, ${y}`;
};
