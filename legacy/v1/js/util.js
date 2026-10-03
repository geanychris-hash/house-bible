/* Utilities: DOM helper, dates, recurrence, zip writer, download/copy, inch parsing. */
const $ = (s, el = document) => el.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);

function h(tag, attrs, ...kids) {
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

/* ---------- dates (local, ISO yyyy-mm-dd) ---------- */
const pad = n => String(n).padStart(2, '0');
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const todayISO = () => iso(new Date());
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = s => { if (!s) return ''; const d = parseISO(s); return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; };
const money = n => (n == null || n === '' || isNaN(n)) ? '' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ---------- recurrence ----------
   rule: {type:'yearly'} | {type:'monthly', interval:n} | {type:'weekly', from:'MM-DD', to:'MM-DD'} */
function occurrences(task, fromISO, toISO) {
  const out = [], r = task.rule, start = task.start;
  const lo = parseISO(fromISO), hi = parseISO(toISO), s0 = parseISO(start);
  if (r.type === 'yearly') {
    for (let y = lo.getFullYear(); y <= hi.getFullYear(); y++) {
      const d = new Date(y, s0.getMonth(), s0.getDate());
      if (d >= s0 && d >= lo && d <= hi) out.push(iso(d));
    }
  } else if (r.type === 'monthly') {
    const n = r.interval || 1;
    for (let k = 0; k < 600; k++) {
      const d = new Date(s0.getFullYear(), s0.getMonth() + k * n, s0.getDate());
      if (d > hi) break;
      if (d >= lo) out.push(iso(d));
    }
  } else if (r.type === 'weekly') {
    const [fm, fd] = r.from.split('-').map(Number), [tm, td] = r.to.split('-').map(Number);
    for (let y = lo.getFullYear() - 1; y <= hi.getFullYear(); y++) {
      const begin = new Date(y, fm - 1, fd);
      const endY = tm < fm ? y + 1 : y;
      const end = new Date(endY, tm - 1, td);
      for (let d = begin; d <= end; d = addDays(d, 7)) {
        if (d >= s0 && d >= lo && d <= hi) out.push(iso(d));
      }
    }
  }
  return out.sort();
}
const GRACE = { yearly: 45, monthly: 20, weekly: 6 };
/* returns {state:'over'|'due'|'upcoming'|'none', date, days} */
function taskStatus(task, today = todayISO()) {
  const from = iso(addDays(parseISO(today), -400)), to = iso(addDays(parseISO(today), 800));
  const occ = occurrences(task, from, to);
  const past = occ.filter(d => d <= today), future = occ.filter(d => d > today);
  const lastDone = (task.done || []).slice().sort().pop();
  const cur = past.pop();
  if (cur && (!lastDone || lastDone < cur)) {
    const age = daysBetween(cur, today), grace = GRACE[task.rule.type] || 30;
    if (age <= grace) return { state: age > 7 && task.rule.type !== 'weekly' ? 'over' : 'due', date: cur, days: -age };
  }
  const nx = future[0];
  return nx ? { state: 'upcoming', date: nx, days: daysBetween(today, nx) } : { state: 'none' };
}
function ruleText(r) {
  if (r.type === 'yearly') return 'Every year';
  if (r.type === 'monthly') return r.interval === 1 ? 'Every month' : `Every ${r.interval} months`;
  return `Weekly, ${r.from} to ${r.to}`;
}

/* ---------- inches parser: "34", "34.5", "3/4", "1 1/2", '34"' ---------- */
function parseInches(v) {
  if (typeof v === 'number') return v;
  if (v == null) return NaN;
  const s = String(v).trim().replace(/["”]|in\b/g, '').trim();
  if (!s) return NaN;
  const m = s.match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);
  if (m) return (m[1] ? +m[1] : 0) + (+m[2]) / (+m[3]);
  return Number(s);
}
function fmtIn(n) {
  if (isNaN(n)) return '';
  const whole = Math.floor(n + 1e-9), frac = n - whole;
  const sixteenths = Math.round(frac * 16);
  if (sixteenths === 0) return `${whole}"`;
  if (sixteenths === 16) return `${whole + 1}"`;
  let a = sixteenths, b = 16;
  while (a % 2 === 0) { a /= 2; b /= 2; }
  return `${whole ? whole + ' ' : ''}${a}/${b}"`;
}

/* ---------- download / copy / zip ---------- */
function download(name, content, type = 'text/plain') {
  try {
    const blob = content instanceof Blob ? content : new Blob([content], { type: type + ';charset=utf-8' });
    const a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    toast(`Download started: ${name}. If nothing appears, use Copy instead.`);
  } catch (e) { toast('Download blocked here. Use Copy instead.'); }
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('Copied'); return true; }
  catch (e) {
    const ta = h('textarea', { style: 'position:fixed;opacity:0' }); ta.value = text; document.body.append(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (_) { }
    ta.remove(); toast(ok ? 'Copied' : 'Copy failed'); return ok;
  }
}
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
/* files: [{name, content(string)}] -> Blob (zip, stored) */
function makeZip(files) {
  const enc = new TextEncoder(), parts = [], central = []; let offset = 0;
  const now = new Date(), dt = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF;
  const dd = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;
  for (const f of files) {
    const name = enc.encode(f.name), data = f.bytes || enc.encode(f.content), crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
    lh.setUint16(10, dt, true); lh.setUint16(12, dd, true); lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
    parts.push(lh.buffer, name, data);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
    ch.setUint16(12, dt, true); ch.setUint16(14, dd, true); ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    central.push(ch.buffer, name);
    offset += 30 + name.length + data.length;
  }
  let csize = 0; central.forEach(c => csize += c.byteLength);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
  end.setUint32(12, csize, true); end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end.buffer], { type: 'application/zip' });
}

/* ---------- toast + modal form ---------- */
let toastTimer;
function toast(msg) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = h('div', { class: 'toast', role: 'status' }, msg); document.body.append(t);
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.remove(), 2600);
}
function openModal(title, bodyBuilder) {
  const onKey = e => { if (e.key === 'Escape' && document.body.lastElementChild === ov || (e.key === 'Escape' && ov.isConnected && !document.querySelector('.overlay ~ .overlay'))) close(); };
  const close = () => { document.removeEventListener('keydown', onKey); ov.remove(); };
  const box = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title, tabindex: '-1' });
  const ov = h('div', { class: 'overlay', onmousedown: e => { if (e.target === ov) close(); } }, box);
  box.append(h('h2', null, title), bodyBuilder(close));
  document.body.append(ov);
  document.addEventListener('keydown', onKey);
  const first = box.querySelector('input,select,textarea'); (first || box).focus();
  return close;
}
/* fields: [{k,label,type:text|textarea|date|number|select, options, wide, placeholder}] */
function openForm({ title, fields, values = {}, onSave, onDelete, saveLabel = 'Save' }) {
  return openModal(title, close => {
    const inputs = {};
    const form = h('form', { class: 'form' }, fields.map(f => {
      let el;
      const id = 'f_' + f.k;
      if (f.type === 'photos') el = photosField();
      else if (f.type === 'textarea') el = h('textarea', { id, rows: f.rows || 3, placeholder: f.placeholder || '' });
      else if (f.type === 'select') el = h('select', { id }, (typeof f.options === 'function' ? f.options() : f.options || []).map(o => h('option', { value: o }, o || '(none)')));
      else el = h('input', { id, type: f.type === 'number' ? 'number' : f.type || 'text', step: f.type === 'number' ? 'any' : null, placeholder: f.placeholder || '' });
      const v = values[f.k];
      if (v != null) el.value = v;
      inputs[f.k] = el;
      const ctl = f.scan ? h('div', { class: 'row nowrap' }, el, h('button', { type: 'button', class: 'btn small', onclick: async () => { const c = await scanBarcode(); if (c) el.value = c; } }, 'Scan')) : el;
      return h('div', { class: 'field' + (f.wide || f.type === 'textarea' || f.type === 'photos' ? ' wide' : '') }, h('label', { for: id }, f.label), ctl);
    }));
    const save = () => {
      const out = {}; fields.forEach(f => { let v = inputs[f.k].value; if (f.type === 'number') v = v === '' ? null : Number(v); out[f.k] = f.type === 'photos' ? inputs[f.k].value : v; });
      if (onSave(out) !== false) close();
    };
    form.addEventListener('submit', e => { e.preventDefault(); save(); });
    return h('div', { class: 'list' }, form,
      h('div', { class: 'row spread' },
        onDelete ? h('button', { class: 'btn danger', type: 'button', onclick: () => { onDelete(); close(); } }, 'Delete') : h('span'),
        h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', onclick: close }, 'Cancel'),
          h('button', { class: 'btn primary', type: 'button', onclick: save }, saveLabel))));
  });
}
/* two-step confirm without confirm() */
function confirmBtn(label, onConfirm, cls = 'btn small danger') {
  let armed = false, timer;
  const b = h('button', { class: cls, type: 'button', onclick: () => {
    if (!armed) { armed = true; b.textContent = 'Tap again to confirm'; timer = setTimeout(() => { armed = false; b.textContent = label; }, 3000); }
    else { clearTimeout(timer); onConfirm(); }
  } }, label);
  return b;
}
