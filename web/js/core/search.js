// Global search: a command palette over the local cache (CONTRACT section 8, G1).
// Open with "/" or Ctrl/Cmd+K, or the header Search button. Works offline: it only reads HB.list.
// The matcher is ported from legacy/v1 finder.js (lowercase, split on spaces, every word must appear)
// and extended with field weights so a name hit outranks a notes hit.
// The matcher section is pure (no DOM, no storage) so node --test can import this file.

/* ---------- what is searched ---------- */
// `sensitive` and `settings` are deliberately absent: secret notes must never be indexed.
export const SEARCH_TABLES = [
  { table: 'rooms', label: 'Rooms', title: 'name', sub: ['floor', 'flooring', 'wall_color'], fields: ['name', 'floor', 'flooring', 'wall_color', 'paint_notes', 'notes'], route: r => 'rooms/' + r.id },
  { table: 'assets', label: 'Assets', title: 'name', sub: ['kind', 'brand', 'model'], fields: ['name', 'brand', 'model', 'serial', 'kind', 'location', 'fuel', 'notes'], route: r => 'assets/' + r.id },
  { table: 'shutoffs', label: 'Shutoffs', title: 'name', sub: ['type', 'location'], fields: ['name', 'type', 'location', 'how_to'], route: () => 'shutoffs' },
  { table: 'tasks', label: 'Tasks', title: 'title', sub: ['category', 'subject'], fields: ['title', 'category', 'subject', 'why', 'how'], route: () => 'maintenance' },
  { table: 'consumables', label: 'Supplies', title: 'name', sub: ['spec'], fields: ['name', 'spec', 'notes'], route: () => 'consumables' },
  { table: 'documents', label: 'Documents', title: 'title', sub: ['kind', 'tags'], fields: ['title', 'tags', 'notes', 'kind'], route: r => 'documents/' + r.id },
  { table: 'contacts', label: 'Contacts', title: 'name', sub: ['trade', 'company', 'phone'], fields: ['name', 'trade', 'company', 'phone', 'email', 'notes'], route: () => 'contacts' },
  { table: 'projects', label: 'Projects', title: 'name', sub: ['status', 'season'], fields: ['name', 'status', 'season', 'notes'], route: r => 'projects/' + r.id },
  { table: 'materials', label: 'Materials', title: 'item', sub: ['qty', 'unit'], fields: ['item', 'unit'], route: r => (r.project ? 'projects/' + r.project : 'projects') },
  { table: 'tools', label: 'Tools', title: 'name', sub: ['category', 'brand', 'model'], fields: ['name', 'category', 'brand', 'model', 'notes', 'location', 'lent_to'], route: () => 'tools' },
];

const MAX_PER_GROUP = 6;
const MAX_TOTAL = 40;

/* ---------- matcher (pure) ---------- */
export function normalize(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
export function words(q) { return normalize(q).split(/\s+/).filter(Boolean); }

// Score one record against already-split query words. 0 = no match. Every word must hit some field.
export function scoreRecord(spec, row, qWords, extra = '') {
  if (!qWords.length || Number(row.deleted)) return 0;
  const hay = spec.fields.map(f => normalize(row[f]));
  const titleIdx = spec.fields.indexOf(spec.title);
  const extraN = normalize(extra);
  let total = 0;
  for (const w of qWords) {
    let best = 0;
    for (let i = 0; i < hay.length; i++) {
      const at = hay[i].indexOf(w);
      if (at < 0) continue;
      let s = i === titleIdx ? 10 : 4;
      if (at === 0 || /[^a-z0-9]/.test(hay[i][at - 1])) s += 3;       // start of a word
      if (hay[i] === w) s += 4;                                         // exact field
      if (s > best) best = s;
    }
    if (!best && extraN.includes(w)) best = 1;                          // e.g. the room name
    if (!best) return 0;
    total += best;
  }
  return total;
}

// data: { table: row[] }. Returns groups [{ spec, items:[{row, score}], total }] in SEARCH_TABLES order.
export function searchData(data, query, { perGroup = MAX_PER_GROUP, limit = MAX_TOTAL } = {}) {
  const qWords = words(query);
  if (!qWords.length) return [];
  const rooms = new Map((data.rooms || []).filter(r => !Number(r.deleted)).map(r => [r.id, r.name]));
  const groups = [];
  let shown = 0;
  for (const spec of SEARCH_TABLES) {
    const hits = [];
    for (const row of data[spec.table] || []) {
      const s = scoreRecord(spec, row, qWords, rooms.get(row.room) || '');
      if (s) hits.push({ row, score: s });
    }
    if (!hits.length) continue;
    hits.sort((a, b) => b.score - a.score || String(a.row[spec.title]).localeCompare(String(b.row[spec.title])));
    const take = Math.max(0, Math.min(perGroup, limit - shown));
    shown += Math.min(take, hits.length);
    if (take) groups.push({ spec, items: hits.slice(0, take), total: hits.length });
  }
  return groups;
}

export function subtitle(spec, row, roomName) {
  const bits = spec.sub.map(f => row[f]).filter(v => v !== '' && v != null);
  if (roomName) bits.push(roomName);
  return bits.join(' / ');
}

/* ---------- palette (DOM) ---------- */
let overlay = null, input = null, listEl = null, statusEl = null, opener = null;
let flat = [], active = -1, data = null, rooms = new Map(), token = 0;
let H = null, HB = null, nav = null;

function el(tag, attrs, ...kids) { return H(tag, attrs, ...kids); }

function highlight(text, qWords) {
  const s = String(text == null ? '' : text);
  if (!qWords.length) return [s];
  const n = normalize(s);
  if (n.length !== s.length) return [s];                              // normalize changed length: skip highlight
  const marks = [];
  for (const w of qWords) { let i = n.indexOf(w); while (i >= 0) { marks.push([i, i + w.length]); i = n.indexOf(w, i + w.length); } }
  if (!marks.length) return [s];
  marks.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const m of marks) { const last = merged[merged.length - 1]; if (last && m[0] <= last[1]) last[1] = Math.max(last[1], m[1]); else merged.push([...m]); }
  const out = []; let pos = 0;
  for (const [a, b] of merged) { if (a > pos) out.push(s.slice(pos, a)); out.push(el('mark', null, s.slice(a, b))); pos = b; }
  if (pos < s.length) out.push(s.slice(pos));
  return out;
}

function setActive(i, scroll = true) {
  active = flat.length ? (i + flat.length) % flat.length : -1;
  flat.forEach((f, k) => f.node.setAttribute('aria-selected', k === active ? 'true' : 'false'));
  if (active >= 0) {
    input.setAttribute('aria-activedescendant', flat[active].node.id);
    if (scroll) flat[active].node.scrollIntoView({ block: 'nearest' });
  } else input.removeAttribute('aria-activedescendant');
}

function go(item) {
  const route = item.spec.route(item.row);
  close(false);
  nav(route);
}

function draw() {
  const q = input.value;
  const qWords = words(q);
  flat = [];
  listEl.replaceChildren();
  if (!data) { statusEl.textContent = 'Loading...'; return; }
  if (!qWords.length) { statusEl.textContent = 'Type to search rooms, assets, tasks, documents, contacts, projects and tools.'; setActive(-1); return; }
  const groups = searchData(data, q);
  if (!groups.length) { statusEl.textContent = `Nothing found for "${q.trim()}".`; setActive(-1); return; }
  const count = groups.reduce((n, g) => n + g.total, 0);
  statusEl.textContent = `${count} result${count === 1 ? '' : 's'}`;
  for (const g of groups) {
    const gid = 'hbs-g-' + g.spec.table;
    const rows = g.items.map(({ row }) => {
      const id = 'hbs-r-' + flat.length;
      const sub = subtitle(g.spec, row, rooms.get(row.room));
      const node = el('li', { id, role: 'option', class: 'hbs-item', 'aria-selected': 'false',
        onmousemove: () => { const k = flat.findIndex(f => f.node === node); if (k !== active) setActive(k, false); },
        onclick: () => go({ spec: g.spec, row }) },
        el('span', { class: 'hbs-title' }, ...highlight(row[g.spec.title] || '(no name)', qWords)),
        sub ? el('span', { class: 'hbs-sub' }, sub) : null);
      flat.push({ node, spec: g.spec, row });
      return node;
    });
    listEl.append(el('li', { role: 'presentation', class: 'hbs-group' },
      el('div', { class: 'hbs-head', id: gid }, g.spec.label, g.total > g.items.length ? el('span', { class: 'hbs-more' }, ` ${g.items.length} of ${g.total}`) : null),
      el('ul', { role: 'group', 'aria-labelledby': gid, class: 'hbs-rows' }, ...rows)));
  }
  setActive(0);
}

async function loadData() {
  const my = ++token;
  const entries = await Promise.all(SEARCH_TABLES.map(async s => [s.table, await HB.list(s.table).catch(() => [])]));
  if (my !== token || !overlay) return;
  data = Object.fromEntries(entries);
  rooms = new Map((data.rooms || []).map(r => [r.id, r.name]));
  draw();
}

function onKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
  if (e.key === 'ArrowDown') { e.preventDefault(); setActive(active + 1); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(active - 1); }
  else if (e.key === 'Enter') { e.preventDefault(); if (active >= 0) go(flat[active]); }
  else if (e.key === 'Tab') { e.preventDefault(); input.focus(); }    // keep focus inside the dialog
}

export function open() {
  if (overlay) { input.focus(); input.select(); return; }
  opener = document.activeElement;
  input = el('input', { type: 'search', class: 'hbs-input', placeholder: 'Search the house...', 'aria-label': 'Search the house',
    role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'hbs-list', 'aria-autocomplete': 'list', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'go', oninput: draw });
  statusEl = el('div', { class: 'hbs-status muted', role: 'status', 'aria-live': 'polite' });
  listEl = el('ul', { id: 'hbs-list', class: 'hbs-list', role: 'listbox', 'aria-label': 'Search results' });
  const box = el('div', { class: 'hbs-box', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Search' },
    el('div', { class: 'hbs-bar' }, input, el('button', { type: 'button', class: 'btn small hbs-close', 'aria-label': 'Close search', onclick: () => close(true) }, 'Close')),
    statusEl, listEl,
    el('div', { class: 'hbs-foot muted' }, 'Up/down to move, Enter to open, Esc to close'));
  overlay = el('div', { class: 'hbs-overlay', onmousedown: e => { if (e.target === overlay) close(true); }, onkeydown: onKey }, box);
  document.body.append(overlay);
  document.body.classList.add('hbs-open');
  data = null; flat = []; active = -1;
  draw();
  input.focus();
  loadData();
}

export function close(restoreFocus = true) {
  if (!overlay) return;
  token++;
  overlay.remove(); overlay = null; input = null; listEl = null; statusEl = null; flat = []; active = -1; data = null;
  document.body.classList.remove('hbs-open');
  if (restoreFocus && opener && opener.isConnected && typeof opener.focus === 'function') opener.focus();
  opener = null;
}

function typingTarget(t) {
  if (!t || !t.tagName) return false;
  return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName);
}

// Called once from app.js. Imports are dynamic so the pure matcher above loads in node tests.
export async function initSearch() {
  const [ui, data_, router] = await Promise.all([import('./ui.js'), import('./data.js'), import('./router.js')]);
  H = ui.h; HB = data_; nav = router.navigate;
  const cssHref = new URL('../../css/search.css', import.meta.url).href;
  if (!document.querySelector(`link[href="${cssHref}"]`)) document.head.append(el('link', { rel: 'stylesheet', href: cssHref }));
  const btn = document.getElementById('searchbtn');
  if (btn) btn.addEventListener('click', open);
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') { e.preventDefault(); open(); return; }
    if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey && !overlay && !typingTarget(e.target) && !document.querySelector('.modal, .mt-overlay, dialog[open]')) { e.preventDefault(); open(); }
  });
}
