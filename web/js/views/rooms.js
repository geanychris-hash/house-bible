// Room records: list, detail page with dimensions, finishes, photos, and automatic panels
// (assets, documents, tasks, projects, expenses) that read other tables filtered by room.
import {
  HB, h, fill, loadCss, openForm, mountView, register, link, byName, emptyState, badge, pageHead, panel, thumbStrip,
  fmtLength, sqft, money, fmtDate, norm, toast, encodeFiles, parseFilesValue,
} from './rooms-shared.js';
import { openAddDocuments, docRows } from './documents.js';

loadCss('rooms');

const FLOORS = ['', 'Basement', '1st floor', '2nd floor', '3rd floor', 'Attic', 'Outside'];
const DEFAULT_ROOMS = [
  ['Kitchen', '1st floor'], ['Living room', '1st floor'], ['Dining room', '1st floor'],
  ['Basement', 'Basement'], ['Attic', 'Attic'], ['Garage', 'Outside'], ['Yard', 'Outside'], ['Porch', 'Outside'],
];

export async function editRoom(room, onDone) {
  const fields = [
    { key: 'name', label: 'Name', required: true },
    { key: 'floor', label: 'Floor', type: 'select', options: FLOORS.map(f => [f, f || '(none)']) },
    { key: 'length_in', label: 'Length', type: 'length', help: `Feet and inches, like 12' 6"` },
    { key: 'width_in', label: 'Width', type: 'length' },
    { key: 'height_in', label: 'Ceiling height', type: 'length' },
    { key: 'flooring', label: 'Flooring' },
    { key: 'wall_color', label: 'Wall color' },
    { key: 'paint_notes', label: 'Paint notes', type: 'textarea', help: 'Brand, finish, code, date painted.' },
    { key: 'outlets', label: 'Outlets', type: 'textarea', rows: 2, help: 'Count, where, any that are dead or ungrounded.' },
    { key: 'windows', label: 'Windows', type: 'textarea', rows: 2, help: 'Count, sizes, type.' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
    { key: 'photos', label: 'Photos', type: 'files', parentKind: 'rooms' },
  ];
  return openForm({
    title: room && room.id ? 'Edit room' : 'Add room', fields, values: room || {},
    async onSubmit(out) { const r = await HB.save('rooms', { ...(room || {}), ...out, photos: encodeFiles(out.photos) }); onDone && onDone(r); },
    onDelete: room && room.id ? async () => { await HB.remove('rooms', room.id); location.hash = '#/rooms'; } : null,
  });
}

function dims(r) {
  const parts = [fmtLength(r.length_in), fmtLength(r.width_in)].filter(Boolean);
  const size = parts.length === 2 ? parts.join(' x ') : parts[0] || '';
  const a = sqft(r.length_in, r.width_in);
  return { size, area: a, height: fmtLength(r.height_in) };
}

function setupPanel() {
  const picks = new Map(DEFAULT_ROOMS.map(([n, f]) => [n, { on: true, floor: f }]));
  const bedrooms = h('input', { type: 'number', min: '0', max: '12', value: '3', 'aria-label': 'Bedrooms' });
  const baths = h('input', { type: 'number', min: '0', max: '12', value: '2', 'aria-label': 'Bathrooms' });
  const boxes = DEFAULT_ROOMS.map(([n]) => h('label', { class: 'rec-chip' }, h('input', { type: 'checkbox', checked: true, onchange: e => { picks.get(n).on = e.target.checked; } }), n));
  return panel('Set up rooms', h('div', { class: 'rec-stack' },
    h('p', null, 'Pick the rooms and areas to start with. You can rename, add or remove any of them later.'),
    h('div', { class: 'rec-chips' }, boxes),
    h('div', { class: 'rec-row' }, h('label', null, 'Bedrooms ', bedrooms), h('label', null, 'Bathrooms ', baths)),
    h('button', { class: 'rec-btn rec-primary', type: 'button', onclick: async e => {
      e.target.disabled = true;
      const rows = [];
      const nb = Math.max(0, Math.min(12, Number(bedrooms.value) || 0)), nbath = Math.max(0, Math.min(12, Number(baths.value) || 0));
      for (const [n, v] of picks) if (v.on) rows.push({ name: n, floor: v.floor });
      for (let i = 1; i <= nb; i++) rows.push({ name: nb === 1 ? 'Bedroom' : `Bedroom ${i}`, floor: '2nd floor' });
      for (let i = 1; i <= nbath; i++) rows.push({ name: nbath === 1 ? 'Bathroom' : `Bathroom ${i}`, floor: i === 1 ? '1st floor' : '2nd floor' });
      for (const r of rows) await HB.save('rooms', r);
      toast(`${rows.length} rooms added`);
    } }, 'Create rooms')));
}

function buildList(data) {
  const results = h('div');
  const search = h('input', { type: 'search', class: 'rec-search', placeholder: 'Search rooms', 'aria-label': 'Search rooms' });
  search.addEventListener('input', () => update());
  function update() {
    const rooms = (data.rooms || []).slice().sort((a, b) => FLOORS.indexOf(a.floor) - FLOORS.indexOf(b.floor) || byName()(a, b));
    if (!rooms.length) { results.replaceChildren(setupPanel()); return; }
    const q = norm(search.value);
    const shown = rooms.filter(r => !q || norm([r.name, r.floor, r.flooring, r.wall_color, r.notes].join(' ')).includes(q));
    results.replaceChildren(shown.length ? h('div', { class: 'rec-list' }, shown.map(r => {
      const d = dims(r);
      const na = (data.assets || []).filter(a => a.room === r.id).length;
      const nd = (data.documents || []).filter(x => x.room === r.id).length;
      return h('a', { class: 'rec-item', href: `#/rooms/${r.id}` },
        h('span', { class: 'rec-grow' }, h('span', { class: 'rec-title' }, r.name),
          h('span', { class: 'rec-sub' }, [r.floor, d.size, d.area ? `${d.area} sq ft` : ''].filter(Boolean).join(' / '))),
        na ? badge(`${na} asset${na > 1 ? 's' : ''}`) : null, nd ? badge(`${nd} doc${nd > 1 ? 's' : ''}`) : null);
    })) : emptyState('No rooms match'));
  }
  return {
    node: h('div', { class: 'rec-view' }, pageHead('Rooms',
      h('button', { class: 'rec-btn rec-primary', type: 'button', onclick: () => editRoom(null) }, 'Add room')),
    h('div', { class: 'rec-toolbar' }, search), results),
    refresh: update,
  };
}

function buildDetail(id, data) {
  const body = h('div', { class: 'rec-view' });
  function update() {
    const r = (data.rooms || []).find(x => x.id === id);
    if (!r || Number(r.deleted)) { fill(body, emptyState('Room not found', null, link('#/rooms', 'Back to rooms', 'rec-btn'))); return; }
    const d = dims(r);
    const kv = [];
    const add = (k, v) => { if (v) kv.push(h('dt', null, k), h('dd', null, v)); };
    add('Floor', r.floor);
    add('Size', d.size ? `${d.size}${d.area ? ` (${d.area} sq ft)` : ''}` : '');
    add('Ceiling', d.height);
    add('Flooring', r.flooring);
    add('Wall color', r.wall_color);
    add('Paint notes', r.paint_notes);
    add('Outlets', r.outlets);
    add('Windows', r.windows);
    add('Notes', r.notes);
    const assets = (data.assets || []).filter(a => a.room === id).sort(byName());
    const docs = (data.documents || []).filter(x => x.room === id).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    const tasks = (data.tasks || []).filter(t => t.room === id && Number(t.active) !== 0);
    const projects = (data.projects || []).filter(p => p.room === id);
    const expenses = (data.expenses || []).filter(e => e.room === id).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    const total = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const list = (rows, row, empty) => rows.length ? h('div', { class: 'rec-list' }, rows.map(row)) : h('p', { class: 'rec-muted' }, empty);
    const plain = (title, sub, extra) => h('div', { class: 'rec-item' }, h('span', { class: 'rec-grow' }, h('span', { class: 'rec-title' }, title), h('span', { class: 'rec-sub' }, sub)), extra);
    fill(body, 
      h('div', { class: 'rec-row' }, link('#/rooms', 'All rooms', 'rec-btn rec-small')),
      pageHead(r.name, h('button', { class: 'rec-btn', type: 'button', onclick: () => editRoom(r) }, 'Edit room')),
      kv.length ? h('dl', { class: 'rec-kv' }, kv) : h('p', { class: 'rec-muted' }, 'No details yet. Tap Edit room to add dimensions, flooring and paint.'),
      thumbStrip(parseFilesValue(r.photos), 'Room photo'),
      h('div', { class: 'rec-two' },
        panel('Assets', list(assets, a => h('a', { class: 'rec-item', href: `#/assets/${a.id}` }, h('span', { class: 'rec-grow' }, h('span', { class: 'rec-title' }, a.name), h('span', { class: 'rec-sub' }, [a.kind, a.brand, a.model].filter(Boolean).join(' / ')))), 'Nothing listed in this room.'),
          link('#/assets?room=' + id, 'Assets', 'rec-btn rec-small')),
        panel('Documents', docRows(docs), h('button', { class: 'rec-btn rec-small', type: 'button', onclick: () => openAddDocuments({ room: id }) }, 'Add document')),
        panel('Tasks', list(tasks, t => plain(t.title, [t.category, t.assignee].filter(Boolean).join(' / '))), 'No tasks for this room.'),
        panel('Projects', list(projects, p => plain(p.name, [p.status, p.priority].filter(Boolean).join(' / '))), 'No projects for this room.'),
        panel('Expenses' + (total ? ` (${money(total)})` : ''), list(expenses, e => plain(e.item, [fmtDate(e.date), e.store].filter(Boolean).join(' / '), badge(money(e.amount)))), 'No expenses for this room.')));
  }
  return { node: body, refresh: update };
}

function build(rt, data) {
  const id = (rt.path[0] === 'rooms' || rt.path[0] === 'room') && rt.path[1] ? rt.path[1] : null;
  return id ? buildDetail(id, data) : buildList(data);
}

register({
  id: 'rooms', title: 'Rooms', icon: 'home', order: 30,
  render(container) { return mountView(container, ['rooms', 'assets', 'documents', 'tasks', 'projects', 'expenses'], build); },
});
