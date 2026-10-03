// Shutoffs and the Emergency screen. Both read only from the local cache, so they work with no network.
import {
  HB, h, fill, loadCss, openForm, mountView, register, refName, byName, emptyState, badge, pageHead, panel, thumbStrip,
  encodeFiles, parseFilesValue, norm,
} from './rooms-shared.js';
import { contactCard } from './contacts.js';

loadCss('rooms');

const TYPES = [['water', 'Water'], ['gas', 'Gas'], ['electric', 'Electric'], ['other', 'Other']];
const TYPE_LABEL = Object.fromEntries(TYPES);

export async function editShutoff(s, onDone) {
  const fields = [
    { key: 'name', label: 'Name', required: true, placeholder: 'Main water shutoff' },
    { key: 'type', label: 'Type', type: 'select', options: TYPES, default: 'water' },
    { key: 'room', label: 'Room', type: 'ref', table: 'rooms' },
    { key: 'location', label: 'Where is it?', type: 'textarea', rows: 2, wide: true, placeholder: 'Basement, left of the boiler, on the front wall' },
    { key: 'how_to', label: 'How to shut it off', type: 'textarea', rows: 4, help: 'Steps, tools needed, which way it turns.' },
    { key: 'photos', label: 'Photos', type: 'files', parentKind: 'rooms' },
  ];
  return openForm({
    title: s && s.id ? 'Edit shutoff' : 'Add shutoff', fields, values: s || {},
    async onSubmit(out) { const r = await HB.save('shutoffs', { ...(s || {}), ...out, photos: encodeFiles(out.photos) }); onDone && onDone(r); },
    onDelete: s && s.id ? async () => { await HB.remove('shutoffs', s.id); } : null,
  });
}

function shutoffCard(s, rooms, { big = false } = {}) {
  const room = refName(rooms, s.room);
  return h('div', { class: 'rec-panel rec-shutoff rec-t-' + s.type },
    h('div', { class: 'rec-row rec-between' },
      h('h3', null, s.name), badge(TYPE_LABEL[s.type] || s.type, s.type === 'gas' ? 'rec-warn' : '')),
    s.location || room ? h('p', { class: big ? 'rec-big-num' : null }, [room, s.location].filter(Boolean).join(': ')) : h('p', { class: 'rec-muted' }, 'Location not recorded yet.'),
    s.how_to ? h('p', { style: 'white-space:pre-wrap' }, s.how_to) : null,
    thumbStrip(parseFilesValue(s.photos), 'Shutoff photo'),
    big ? null : h('div', { class: 'rec-row' }, h('button', { class: 'rec-btn rec-small', type: 'button', onclick: () => editShutoff(s) }, 'Edit')));
}

function buildList(rt, data) {
  const results = h('div');
  const search = h('input', { type: 'search', class: 'rec-search', placeholder: 'Search shutoffs', 'aria-label': 'Search shutoffs' });
  search.addEventListener('input', () => update());
  function update() {
    const all = data.shutoffs || [], rooms = data.rooms || [];
    if (!all.length) {
      results.replaceChildren(emptyState('No shutoffs recorded', 'Find the main water, gas and electric shutoffs, photograph each one, and write how to turn it off. Do this before you need it.',
        h('button', { class: 'rec-btn rec-primary', type: 'button', onclick: () => editShutoff(null) }, 'Add first shutoff')));
      return;
    }
    const q = norm(search.value);
    const shown = all.filter(s => !q || norm([s.name, s.type, s.location, s.how_to].join(' ')).includes(q)).sort((a, b) => TYPES.findIndex(t => t[0] === a.type) - TYPES.findIndex(t => t[0] === b.type) || byName()(a, b));
    results.replaceChildren(h('div', { class: 'rec-list' }, shown.map(s => shutoffCard(s, rooms))));
  }
  return {
    node: h('div', { class: 'rec-view' }, pageHead('Shutoffs',
      h('a', { class: 'rec-btn', href: '#/emergency' }, 'Emergency screen'),
      h('button', { class: 'rec-btn rec-primary', type: 'button', onclick: () => editShutoff(null) }, 'Add shutoff')),
    h('div', { class: 'rec-toolbar' }, search), results),
    refresh: update,
  };
}

const KEY_TRADE = /plumb|electric|gas|heat|hvac|boiler|oil|emergency|utility|utilit|water|steam|fire|police/i;

function buildEmergency(rt, data) {
  const body = h('div', { class: 'rec-view rec-emergency' });
  const netNote = h('p', { class: 'rec-muted' });
  const online = () => (typeof HB.status === 'function' ? HB.status().online : navigator.onLine);
  function update() {
    const shutoffs = (data.shutoffs || []).slice().sort((a, b) => TYPES.findIndex(t => t[0] === a.type) - TYPES.findIndex(t => t[0] === b.type)), rooms = data.rooms || [];
    const contacts = (data.contacts || []).filter(c => KEY_TRADE.test([c.trade, c.name, c.company].join(' '))).sort(byName());
    netNote.textContent = online() ? 'This screen reads from this device, so it also works with no internet.' : 'You are offline. Showing what is saved on this device.';
    const group = type => shutoffs.filter(s => s.type === type);
    const section = (type, title) => {
      const list = group(type);
      return panel(title, list.length ? h('div', { class: 'rec-list' }, list.map(s => shutoffCard(s, rooms, { big: true })))
        : h('p', { class: 'rec-muted' }, `No ${TYPE_LABEL[type].toLowerCase()} shutoff recorded. `, h('a', { href: '#/shutoffs' }, 'Add one')));
    };
    fill(body, 
      pageHead('Emergency'),
      netNote,
      h('div', { class: 'rec-note rec-bad' },
        h('p', null, h('strong', null, 'Smell gas or hear a hiss: '), 'leave the house now. Do not touch switches or use a phone inside. Call 911 from outside. Gas work and boiler work are for a licensed pro only.'),
        h('p', null, h('strong', null, 'Fire, sparks, or burning smell from electrical: '), 'get everyone out and call 911. Main electrical is for a licensed pro.'),
        h('p', null, h('strong', null, 'Burst pipe or flooding: '), 'shut off the main water. If water is near outlets, appliances or the electrical panel, stay clear and call a licensed electrician.')),
      section('water', 'Water shutoff'), section('gas', 'Gas shutoff'), section('electric', 'Electric shutoff'),
      group('other').length ? section('other', 'Other shutoffs') : null,
      panel('Key contacts', contacts.length ? h('div', { class: 'rec-list' }, contacts.map(c => contactCard(c, { editable: false })))
        : h('p', { class: 'rec-muted' }, 'No plumber, electrician, heating or utility contacts yet. ', h('a', { href: '#/contacts' }, 'Add them in Contacts'), ', including the gas and electric company emergency numbers.')));
  }
  return { node: body, refresh: update };
}

register({ id: 'shutoffs', title: 'Shutoffs', icon: 'power', order: 50, render(container) { return mountView(container, ['shutoffs', 'rooms'], buildList); } });
register({ id: 'emergency', title: 'Emergency', icon: 'alert', order: 5, render(container) { return mountView(container, ['shutoffs', 'rooms', 'contacts'], buildEmergency); } });
