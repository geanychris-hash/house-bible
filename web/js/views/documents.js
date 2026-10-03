// Documents vault: upload, browse, search, filter, expiring-soon, open and download.
import {
  HB, h, loadCss, toast, openForm, modal, Files, fileThumb, mountView, register, route, link, refName, byName,
  emptyState, badge, expiryBadge, pageHead, panel, lsGet, lsSet, KIND_LABELS, norm, splitTags, baseName, fmtDate,
  expiryState, asIds,
} from './rooms-shared.js';

loadCss('documents');

const KINDS = Object.keys(KIND_LABELS);
const state = { q: '', kind: '', room: '', asset: '', view: lsGet('hb.docs.view', 'grid') };

// ---------- shared helpers other views use ----------
export function docMatches(d, q, names = {}) {
  if (!q) return true;
  const hay = [d.title, d.tags, d.notes, names.room, names.asset].map(norm).join(' ');
  return q.split(/\s+/).filter(Boolean).every(w => hay.includes(norm(w)));
}

// Metadata form for new documents. preset: {room, asset, project, kind}. Resolves after save.
export async function openAddDocuments(preset = {}, onSaved) {
  const fields = [
    { key: 'files', label: 'Files or photos', type: 'files', parentKind: 'documents', accept: 'image/*,application/pdf', required: true },
    { key: 'title', label: 'Title', help: 'Leave blank to use each file name.', wide: true },
    { key: 'kind', label: 'Kind', type: 'select', options: KINDS.map(k => [k, KIND_LABELS[k]]), default: preset.kind || 'other' },
    { key: 'room', label: 'Room', type: 'ref', table: 'rooms' },
    { key: 'asset', label: 'Asset', type: 'ref', table: 'assets' },
    { key: 'project', label: 'Project', type: 'ref', table: 'projects' },
    { key: 'tags', label: 'Tags', help: 'Comma separated.' },
    { key: 'expires', label: 'Expires', type: 'date' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ];
  return openForm({
    title: 'Add documents', fields, submitLabel: 'Add', values: preset,
    async onSubmit(out, controls) {
      const names = controls.files.names || {};
      const single = out.files.length === 1;
      const created = [];
      for (const fileId of out.files) {
        const title = (single && out.title) || (out.title && !single ? `${out.title} ${created.length + 1}` : baseName(names[fileId]) || 'Document');
        const row = await HB.save('documents', {
          title, kind: out.kind, file: fileId, room: out.room, asset: out.asset, project: out.project,
          tags: out.tags, expires: out.expires, notes: out.notes,
        });
        created.push(row);
      }
      if (out.asset) {
        const a = await HB.get('assets', out.asset);
        if (a) await HB.save('assets', { id: a.id, docs: JSON.stringify([...new Set([...asIds(a.docs), ...created.map(c => c.id)])]) });
      }
      toast(created.length === 1 ? 'Document added' : `${created.length} documents added`);
      onSaved && onSaved(created);
    },
  });
}

export async function editDocument(doc, onDone) {
  const fields = [
    { key: 'title', label: 'Title', required: true, wide: true },
    { key: 'kind', label: 'Kind', type: 'select', options: KINDS.map(k => [k, KIND_LABELS[k]]) },
    { key: 'file', label: 'File (replace)', type: 'files', multiple: false, parentKind: 'documents', accept: 'image/*,application/pdf' },
    { key: 'room', label: 'Room', type: 'ref', table: 'rooms' },
    { key: 'asset', label: 'Asset', type: 'ref', table: 'assets' },
    { key: 'project', label: 'Project', type: 'ref', table: 'projects' },
    { key: 'tags', label: 'Tags' },
    { key: 'expires', label: 'Expires', type: 'date' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ];
  return openForm({
    title: 'Edit document', fields, values: { ...doc, file: doc.file ? [doc.file] : [] },
    async onSubmit(out) {
      await HB.save('documents', { ...doc, ...out, file: out.file[0] || doc.file });
      onDone && onDone();
    },
    async onDelete() { await HB.remove('documents', doc.id); onDone && onDone(true); },
  });
}

export async function openDocument(id, onChange) {
  const doc = await HB.get('documents', id);
  if (!doc || Number(doc.deleted)) return toast('That document is not here any more.');
  const [rooms, assets] = await Promise.all([HB.list('rooms'), HB.list('assets')]);
  const exp = expiryState(doc.expires);
  const kv = [];
  const add = (k, v) => { if (v) kv.push(h('dt', null, k), h('dd', null, v)); };
  add('Kind', KIND_LABELS[doc.kind] || doc.kind);
  if (doc.room) add('Room', link(`#/rooms/${doc.room}`, refName(rooms, doc.room)));
  if (doc.asset) add('Asset', link(`#/assets/${doc.asset}`, refName(assets, doc.asset)));
  if (doc.expires) add('Expires', `${fmtDate(doc.expires)}${exp.state === 'expired' || exp.state === 'soon' ? ' (' + exp.text.toLowerCase() + ')' : ''}`);
  add('Tags', splitTags(doc.tags).join(', '));
  add('Notes', doc.notes);
  modal(doc.title || 'Document', close => h('div', { class: 'rec-stack' },
    doc.file ? h('div', { class: 'rec-doc-preview' }, fileThumb(doc.file, { label: 'Open file', cls: 'rec-bigthumb' })) : h('p', { class: 'rec-muted' }, 'No file attached.'),
    h('dl', { class: 'rec-kv' }, kv),
    h('div', { class: 'rec-row' },
      doc.file ? h('button', { class: 'rec-btn rec-primary', type: 'button', onclick: () => Files.open(doc.file) }, 'Open') : null,
      doc.file ? h('button', { class: 'rec-btn', type: 'button', onclick: () => Files.download(doc.file, doc.title) }, 'Download') : null,
      h('button', { class: 'rec-btn', type: 'button', onclick: () => { close(); editDocument(doc, onChange); } }, 'Edit'))));
}

// Compact list rows used by room, asset and project panels.
export function docRows(docs, onChange) {
  if (!docs.length) return h('p', { class: 'rec-muted' }, 'No documents yet.');
  return h('div', { class: 'rec-list' }, docs.map(d => h('button', { type: 'button', class: 'rec-item', onclick: () => openDocument(d.id, onChange) },
    d.file ? fileThumb(d.file, { label: KIND_LABELS[d.kind] || 'File', onclick: e => { e.stopPropagation(); openDocument(d.id, onChange); } }) : null,
    h('span', { class: 'rec-grow' }, h('span', { class: 'rec-title' }, d.title), h('span', { class: 'rec-sub' }, KIND_LABELS[d.kind] || d.kind)),
    expiryBadge(d.expires))));
}

// ---------- the view ----------
function build(rt, data) {
  const q = rt.query || {};
  if (q.room !== undefined) state.room = q.room;
  if (q.asset !== undefined) state.asset = q.asset;
  if (q.kind !== undefined) state.kind = q.kind;
  const openId = rt.path[0] === 'documents' && rt.path[1] ? rt.path[1] : (rt.path[0] === 'document' ? rt.path[1] : null);

  const results = h('div');
  const expiring = h('div');
  const search = h('input', { type: 'search', class: 'rec-search', placeholder: 'Search title, tags, notes', 'aria-label': 'Search documents', value: state.q });
  const kindSel = h('select', { 'aria-label': 'Filter by kind' });
  const roomSel = h('select', { 'aria-label': 'Filter by room' });
  const assetSel = h('select', { 'aria-label': 'Filter by asset' });
  const viewBtn = h('button', { type: 'button', class: 'rec-btn rec-small', onclick: () => { state.view = state.view === 'grid' ? 'list' : 'grid'; lsSet('hb.docs.view', state.view); update(); } });

  const fillSel = (sel, label, opts, cur) => {
    sel.replaceChildren(h('option', { value: '' }, label), ...opts.map(([v, t]) => h('option', { value: v, selected: v === cur }, t)));
    sel.value = opts.some(([v]) => v === cur) ? cur : '';
  };
  search.addEventListener('input', () => { state.q = search.value; update(true); });
  kindSel.addEventListener('change', () => { state.kind = kindSel.value; update(true); });
  roomSel.addEventListener('change', () => { state.room = roomSel.value; update(true); });
  assetSel.addEventListener('change', () => { state.asset = assetSel.value; update(true); });

  const onChange = () => { /* subscription refreshes */ };
  function update(skipSelects) {
    const docs = data.documents || [], rooms = data.rooms || [], assets = data.assets || [];
    if (!skipSelects) {
      fillSel(kindSel, 'All kinds', KINDS.map(k => [k, KIND_LABELS[k]]), state.kind);
      fillSel(roomSel, 'All rooms', rooms.slice().sort(byName()).map(r => [r.id, r.name]), state.room);
      fillSel(assetSel, 'All assets', assets.slice().sort(byName()).map(a => [a.id, a.name]), state.asset);
    }
    viewBtn.textContent = state.view === 'grid' ? 'List view' : 'Grid view';
    const nameOf = d => ({ room: refName(rooms, d.room), asset: refName(assets, d.asset) });
    const shown = docs.filter(d => (!state.kind || d.kind === state.kind) && (!state.room || d.room === state.room) &&
      (!state.asset || d.asset === state.asset || asIds((assets.find(a => a.id === state.asset) || {}).docs).includes(d.id)) &&
      docMatches(d, state.q, nameOf(d))).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    const soon = docs.filter(d => d.expires && expiryState(d.expires, 60).state !== 'ok' && expiryState(d.expires, 60).state !== 'none')
      .sort((a, b) => String(a.expires).localeCompare(String(b.expires)));
    expiring.replaceChildren(...(soon.length ? [panel('Expiring soon', docRows(soon, onChange))] : []));

    if (!docs.length) {
      results.replaceChildren(emptyState('No documents yet', 'Add manuals, receipts, permits, the closing file and photos. PDFs and photos both work.',
        h('button', { class: 'rec-btn rec-primary', type: 'button', onclick: () => openAddDocuments({ room: state.room, asset: state.asset }) }, 'Add your first document')));
      return;
    }
    if (!shown.length) { results.replaceChildren(emptyState('Nothing matches', 'Try fewer words or clear the filters.')); return; }
    const count = h('p', { class: 'rec-muted' }, `${shown.length} of ${docs.length} documents`);
    const body = state.view === 'grid'
      ? h('div', { class: 'rec-grid' }, shown.map(d => h('div', { class: 'rec-card', role: 'button', tabindex: '0', onclick: () => openDocument(d.id, onChange), onkeydown: e => { if (e.key === 'Enter') openDocument(d.id, onChange); } },
        d.file ? fileThumb(d.file, { label: KIND_LABELS[d.kind] || 'File', onclick: e => { e.stopPropagation(); openDocument(d.id, onChange); } }) : h('span', { class: 'rec-thumb' }, 'No file'),
        h('span', { class: 'rec-title' }, d.title),
        h('span', { class: 'rec-sub' }, [KIND_LABELS[d.kind] || d.kind, nameOf(d).room, nameOf(d).asset].filter(Boolean).join(' / ')),
        expiryBadge(d.expires))))
      : docRows(shown, onChange);
    results.replaceChildren(count, body);
  }

  const node = h('div', { class: 'rec-view rec-docs' },
    pageHead('Documents',
      h('button', { class: 'rec-btn rec-primary', type: 'button', onclick: () => openAddDocuments({ room: state.room, asset: state.asset }) }, 'Add files or photos')),
    expiring,
    h('div', { class: 'rec-toolbar' }, search, kindSel, roomSel, assetSel, viewBtn),
    results);
  let opened = false;
  return { node, refresh() { update(); if (openId && !opened) { opened = true; openDocument(openId, onChange); } } };
}

register({
  id: 'documents', title: 'Documents', icon: 'file', order: 20,
  render(container) { return mountView(container, ['documents', 'rooms', 'assets'], build); },
});
