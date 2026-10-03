// Assets: systems, appliances, fixtures. Model and serial, install date, warranty tracker, manuals from documents.
import {
  HB, h, fill, loadCss, openForm, modal, mountView, register, link, refName, byName, emptyState, badge, expiryBadge, pageHead,
  panel, thumbStrip, norm, fmtDate, toast, encodeFiles, parseFilesValue, asIds, expiryState,
} from './rooms-shared.js';
import { openAddDocuments, docRows } from './documents.js';
import { renderServiceHistory } from './assets-history.js';
import { lifespanFields, valueFields, valueRows } from './assets-values.js';

loadCss('rooms');

const KINDS = [['system', 'System'], ['appliance', 'Appliance'], ['fixture', 'Fixture'], ['other', 'Other'], ['belonging', 'Belonging']];
const KIND_LABEL = Object.fromEntries(KINDS);
const state = { q: '', kind: '', room: '' };

export async function editAsset(asset, onDone, { plate = false } = {}) {
  const fields = [
    ...(plate ? [{ key: 'photos', label: 'Photo of the data plate', type: 'files', parentKind: 'assets', help: 'Take a clear photo, then type the name, model and serial from it. There is no automatic reading.' }] : []),
    { key: 'name', label: 'Name', required: true, placeholder: 'Boiler, dishwasher, water heater' },
    { key: 'kind', label: 'Kind', type: 'select', options: KINDS, default: 'appliance' },
    { key: 'room', label: 'Room', type: 'ref', table: 'rooms' },
    { key: 'location', label: 'Location detail', placeholder: 'Behind the stairs' },
    { key: 'brand', label: 'Brand' },
    { key: 'model', label: 'Model' },
    { key: 'serial', label: 'Serial number' },
    { key: 'fuel', label: 'Fuel / power', placeholder: 'Natural gas, electric' },
    { key: 'install_date', label: 'Install date', type: 'date' },
    { key: 'warranty_expires', label: 'Warranty expires', type: 'date' },
    ...lifespanFields(),
    ...valueFields(),
    { key: 'pro_only', label: 'Licensed pro only (gas, flue, main electrical)', type: 'bool' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
    ...(plate ? [] : [{ key: 'photos', label: 'Photos', type: 'files', parentKind: 'assets' }]),
  ];
  return openForm({
    title: asset && asset.id ? 'Edit asset' : plate ? 'Add from data plate' : 'Add asset', fields, values: asset || {},
    async onSubmit(out) { const r = await HB.save('assets', { ...(asset || {}), ...out, photos: encodeFiles(out.photos) }); onDone && onDone(r); },
    onDelete: asset && asset.id ? async () => { await HB.remove('assets', asset.id); location.hash = '#/assets'; } : null,
  });
}

function attachedDocs(asset, docs) {
  const ids = new Set(asIds(asset.docs));
  return docs.filter(d => d.asset === asset.id || ids.has(d.id))
    .sort((a, b) => (a.kind === 'manual' ? 0 : 1) - (b.kind === 'manual' ? 0 : 1) || String(a.title).localeCompare(String(b.title)));
}

function attachExisting(asset, docs) {
  const have = new Set(attachedDocs(asset, docs).map(d => d.id));
  const options = docs.filter(d => !have.has(d.id));
  if (!options.length) return toast('Every document is already linked. Use "Add manual" to upload a new one.');
  const sel = h('select', { 'aria-label': 'Document' }, options.map(d => h('option', { value: d.id }, d.title)));
  modal('Link a document', close => h('div', { class: 'rec-stack' }, sel,
    h('div', { class: 'rec-row rec-end' }, h('button', { class: 'rec-btn', type: 'button', onclick: close }, 'Cancel'),
      h('button', { class: 'rec-btn rec-primary', type: 'button', onclick: async () => {
        await HB.save('assets', { id: asset.id, docs: JSON.stringify([...new Set([...asIds(asset.docs), sel.value])]) });
        close();
      } }, 'Link'))));
}

function buildList(data) {
  const results = h('div'), warranty = h('div');
  const search = h('input', { type: 'search', class: 'rec-search', placeholder: 'Search name, brand, model, serial', 'aria-label': 'Search assets', value: state.q });
  const kindSel = h('select', { 'aria-label': 'Filter by kind' }), roomSel = h('select', { 'aria-label': 'Filter by room' });
  search.addEventListener('input', () => { state.q = search.value; update(true); });
  kindSel.addEventListener('change', () => { state.kind = kindSel.value; update(true); });
  roomSel.addEventListener('change', () => { state.room = roomSel.value; update(true); });
  const fill = (sel, label, opts, cur) => {
    sel.replaceChildren(h('option', { value: '' }, label), ...opts.map(([v, t]) => h('option', { value: v }, t)));
    sel.value = opts.some(([v]) => v === cur) ? cur : '';
  };
  function update(skip) {
    const assets = data.assets || [], rooms = data.rooms || [];
    if (!skip) { fill(kindSel, 'All kinds', KINDS, state.kind); fill(roomSel, 'All rooms', rooms.slice().sort(byName()).map(r => [r.id, r.name]), state.room); }
    const soon = assets.filter(a => a.warranty_expires && ['soon', 'expired'].includes(expiryState(a.warranty_expires, 90).state))
      .sort((a, b) => String(a.warranty_expires).localeCompare(String(b.warranty_expires)));
    warranty.replaceChildren(...(soon.length ? [panel('Warranties expiring soon', h('div', { class: 'rec-list' }, soon.map(a => row(a, rooms, true))))] : []));
    if (!assets.length) {
      results.replaceChildren(emptyState('No assets yet', 'Add the boiler, water heater, appliances and anything with a model number or a warranty.',
        h('button', { class: 'rec-btn rec-primary', type: 'button', onclick: () => editAsset(null) }, 'Add first asset')));
      return;
    }
    const q = norm(state.q);
    const shown = assets.filter(a => (!state.kind || a.kind === state.kind) && (!state.room || a.room === state.room) &&
      (!q || norm([a.name, a.brand, a.model, a.serial, a.location, a.notes].join(' ')).includes(q))).sort(byName());
    results.replaceChildren(shown.length ? h('div', { class: 'rec-list' }, shown.map(a => row(a, rooms))) : emptyState('Nothing matches'));
  }
  const row = (a, rooms, warr) => h('a', { class: 'rec-item', href: `#/assets/${a.id}` },
    h('span', { class: 'rec-grow' }, h('span', { class: 'rec-title' }, a.name),
      h('span', { class: 'rec-sub' }, [KIND_LABEL[a.kind], refName(rooms, a.room), a.brand, a.model].filter(Boolean).join(' / '))),
    Number(a.pro_only) ? badge('Pro only', 'rec-warn') : null, warr || !a.warranty_expires ? expiryBadge(a.warranty_expires, 90) : null);
  return {
    node: h('div', { class: 'rec-view' }, pageHead('Assets',
      h('button', { class: 'rec-btn', type: 'button', onclick: () => editAsset(null, null, { plate: true }) }, 'Add from data plate photo'),
      h('button', { class: 'rec-btn rec-primary', type: 'button', onclick: () => editAsset(null) }, 'Add asset')),
    warranty, h('div', { class: 'rec-toolbar' }, search, kindSel, roomSel), results),
    refresh: () => update(),
  };
}

function buildDetail(id, data) {
  const body = h('div', { class: 'rec-view' });
  function update() {
    const a = (data.assets || []).find(x => x.id === id);
    if (!a || Number(a.deleted)) { fill(body, emptyState('Asset not found', null, link('#/assets', 'Back to assets', 'rec-btn'))); return; }
    const rooms = data.rooms || [], docs = data.documents || [];
    const kv = [];
    const add = (k, v) => { if (v) kv.push(h('dt', null, k), h('dd', null, v)); };
    add('Kind', KIND_LABEL[a.kind]);
    if (a.room) { kv.push(h('dt', null, 'Room'), h('dd', null, link(`#/rooms/${a.room}`, refName(rooms, a.room)))); }
    add('Location', a.location); add('Brand', a.brand); add('Model', a.model); add('Serial', a.serial); add('Fuel', a.fuel);
    add('Installed', fmtDate(a.install_date));
    if (a.warranty_expires) { kv.push(h('dt', null, 'Warranty'), h('dd', null, fmtDate(a.warranty_expires) + ' ', expiryBadge(a.warranty_expires, 90))); }
    valueRows(a).forEach(([k, v]) => add(k, v));
    add('Notes', a.notes);
    const hist = h('div', { class: 'rec-history' });
    try { Promise.resolve(renderServiceHistory(a, hist)).catch(() => {}); } catch { /* history is optional */ }
    const tasks = (data.tasks || []).filter(t => t.asset === id && Number(t.active) !== 0);
    const cons = (data.consumables || []).filter(c => c.asset === id);
    const mine = attachedDocs(a, docs);
    const plain = (t, s) => h('div', { class: 'rec-item' }, h('span', { class: 'rec-grow' }, h('span', { class: 'rec-title' }, t), h('span', { class: 'rec-sub' }, s)));
    fill(body, 
      h('div', { class: 'rec-row' }, link('#/assets', 'All assets', 'rec-btn rec-small')),
      pageHead(a.name, h('button', { class: 'rec-btn', type: 'button', onclick: () => editAsset(a) }, 'Edit')),
      Number(a.pro_only) ? h('div', { class: 'rec-note rec-bad' }, h('p', null, 'Licensed pro only. Do not repair or adjust this yourself (gas, flue, or main electrical).')) : null,
      h('dl', { class: 'rec-kv' }, kv),
      thumbStrip(parseFilesValue(a.photos), 'Asset photo'),
      h('div', { class: 'rec-two' },
        panel('Manuals and documents', docRows(mine),
          h('button', { class: 'rec-btn rec-small', type: 'button', onclick: () => openAddDocuments({ asset: id, kind: 'manual', room: a.room }) }, 'Add manual'),
          h('button', { class: 'rec-btn rec-small', type: 'button', onclick: () => attachExisting(a, docs) }, 'Link existing')),
        panel('Maintenance tasks', tasks.length ? h('div', { class: 'rec-list' }, tasks.map(t => plain(t.title, t.category))) : h('p', { class: 'rec-muted' }, 'No tasks for this asset.')),
        hist,
        cons.length ? panel('Consumables', h('div', { class: 'rec-list' }, cons.map(c => plain(c.name, [c.spec, c.qty_on_hand != null && c.qty_on_hand !== '' ? `${c.qty_on_hand} on hand` : ''].filter(Boolean).join(' / '))))) : null));
  }
  return { node: body, refresh: update };
}

function build(rt, data) {
  const id = (rt.path[0] === 'assets' || rt.path[0] === 'asset') && rt.path[1] ? rt.path[1] : null;
  if (rt.query && rt.query.room !== undefined) state.room = rt.query.room;
  return id ? buildDetail(id, data) : buildList(data);
}

register({
  id: 'assets', title: 'Assets', icon: 'box', order: 40,
  render(container) { return mountView(container, ['assets', 'rooms', 'documents', 'tasks', 'consumables'], build); },
});
