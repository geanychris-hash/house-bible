// Consumables: filters, bulbs, batteries, water filter cartridges. Next due is computed, never typed in.
import { registerView } from '../core/router.js';
import { HB, h, ensureCss, todayISO, toast, openModal, field, select, confirmButton } from './maintenance-ui.js';
import { consumableStatus, fmtDate } from '../core/recur.js';

const stateText = (c, s) => {
  if (!s.next) return 'No schedule set';
  if (s.state === 'overdue') return `Overdue by ${-s.days} day${s.days === -1 ? '' : 's'} (${fmtDate(s.next)})`;
  return `Next ${fmtDate(s.next)} (${s.days === 0 ? 'today' : `in ${s.days} day${s.days === 1 ? '' : 's'}`})`;
};

export function render(container) {
  ensureCss('maintenance.css');
  const S = { rows: [], rooms: [], assets: [], q: '' };
  const root = h('div', { class: 'mt-root' });
  container.replaceChildren(root);
  const head = h('div', { class: 'mt-head' },
    h('div', { class: 'mt-head-row' }, h('h1', null, 'Supplies'),
      h('button', { type: 'button', class: 'mt-btn mt-btn-primary', onclick: () => openEdit(null) }, 'Add supply')),
    h('nav', { class: 'mt-links', 'aria-label': 'Related' }, h('a', { href: '#/maintenance' }, 'Back to maintenance')));
  const q = h('input', { type: 'search', placeholder: 'Search supplies', 'aria-label': 'Search supplies' });
  q.addEventListener('input', () => { S.q = q.value; paint(); });
  const body = h('div', { class: 'mt-body' });
  root.append(head, h('div', { class: 'mt-search' }, q), body);

  const replacedToday = async c => {
    const before = { last_replaced: c.last_replaced || '', qty_on_hand: c.qty_on_hand };
    const qty = c.qty_on_hand === '' || c.qty_on_hand == null ? c.qty_on_hand : Math.max(0, Number(c.qty_on_hand) - 1);
    await HB.save('consumables', { ...c, last_replaced: todayISO(), qty_on_hand: qty });
    toast(`Replaced: ${c.name}`, { label: 'Undo', fn: () => HB.save('consumables', { ...c, ...before }) });
  };

  function card(c) {
    const s = consumableStatus(c, todayISO());
    const low = s.low || s.state !== 'ok';
    const roomName = (S.rooms.find(r => r.id === c.room) || {}).name;
    return h('article', { class: `mt-card ${s.state === 'overdue' ? 'mt-overdue' : s.state === 'due' || s.low ? 'mt-due' : 'mt-upcoming'}` },
      h('div', { class: 'mt-card-main', role: 'button', tabindex: '0', onclick: () => openEdit(c), onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEdit(c); } } },
        h('div', { class: 'mt-card-title' }, c.name),
        h('div', { class: 'mt-card-sub' }, [c.spec, roomName, c.qty_on_hand !== '' && c.qty_on_hand != null ? `${c.qty_on_hand} on hand` : ''].filter(Boolean).join(' · ')),
        h('div', { class: 'mt-card-due' }, stateText(c, s), c.last_replaced ? ` · last replaced ${fmtDate(c.last_replaced)}` : ''),
        s.low ? h('span', { class: 'mt-badge mt-badge-warn' }, 'Out of stock') : null),
      h('button', { type: 'button', class: 'mt-btn mt-btn-primary mt-done', 'aria-label': `Replaced today: ${c.name}`, onclick: () => replacedToday(c) }, low ? 'Replaced' : 'Replaced today'));
  }

  function paint() {
    const words = S.q.toLowerCase().split(/\s+/).filter(Boolean);
    const rows = S.rows.filter(c => !Number(c.deleted) && words.every(w => [c.name, c.spec, c.notes].join(' ').toLowerCase().includes(w)));
    const withS = rows.map(c => ({ c, s: consumableStatus(c, todayISO()) }));
    const need = withS.filter(x => x.s.low || x.s.state !== 'ok').sort((a, b) => (a.s.days ?? 9999) - (b.s.days ?? 9999));
    if (!S.rows.some(c => !Number(c.deleted))) {
      body.replaceChildren(h('div', { class: 'mt-empty' }, h('h2', null, 'No supplies yet'), h('p', null, 'Add things you replace on a schedule: furnace or range hood filters, water filter cartridges, smoke alarm batteries, bulbs. Write the size or model so you can reorder.')));
      return;
    }
    body.replaceChildren(
      need.length ? h('section', { class: 'mt-section mt-sec-due' }, h('h2', null, 'Low or due', h('span', { class: 'mt-count' }, need.length)), need.map(x => card(x.c))) : h('p', { class: 'mt-allclear' }, 'Nothing is low or due.'),
      h('section', { class: 'mt-section' }, h('h2', null, 'All supplies', h('span', { class: 'mt-count' }, rows.length)),
        withS.sort((a, b) => a.c.name.localeCompare(b.c.name)).map(x => card(x.c))));
  }

  function openEdit(c) {
    const isNew = !c;
    openModal(isNew ? 'Add supply' : 'Edit supply', close => {
      const name = h('input', { type: 'text', value: c ? c.name : '', required: true, placeholder: 'e.g. Water filter cartridge' });
      const spec = h('input', { type: 'text', value: c ? c.spec || '' : '', placeholder: 'Size or model, e.g. 16x25x1 MERV 8' });
      const qty = h('input', { type: 'number', min: '0', step: '1', inputmode: 'numeric', value: c && c.qty_on_hand != null ? c.qty_on_hand : '' });
      const interval = h('input', { type: 'number', min: '1', step: '1', inputmode: 'numeric', value: c && c.interval_days ? c.interval_days : '' });
      const last = h('input', { type: 'date', value: c ? c.last_replaced || '' : '', max: todayISO() });
      const room = select([['', '(none)'], ...S.rooms.map(r => [r.id, r.name])], c ? c.room || '' : '');
      const asset = select([['', '(none)'], ...S.assets.map(a => [a.id, a.name])], c ? c.asset || '' : '');
      const notes = h('textarea', { rows: 2 }, c ? c.notes || '' : '');
      const err = h('p', { class: 'mt-error', role: 'alert' });
      const form = h('form', { class: 'mt-form', onsubmit: async e => {
        e.preventDefault();
        if (!name.value.trim()) { err.textContent = 'Give it a name.'; return; }
        await HB.save('consumables', { ...(c || {}), name: name.value.trim(), spec: spec.value.trim(), qty_on_hand: qty.value === '' ? '' : Number(qty.value),
          interval_days: interval.value === '' ? '' : Number(interval.value), last_replaced: last.value, room: room.value, asset: asset.value, notes: notes.value.trim() });
        toast('Saved'); close();
      } },
        field('Name', name), field('Size or model', spec), field('On hand', qty, 'How many spares you have'),
        field('Replace every (days)', interval, '90 = every 3 months, 365 = yearly'), field('Last replaced', last),
        field('Room', room), field('Goes with (appliance or system)', asset), field('Notes', notes), err,
        h('div', { class: 'mt-actions mt-wrap' },
          !isNew && confirmButton('Delete', async () => { await HB.remove('consumables', c.id); toast('Deleted'); close(); }),
          h('span', { class: 'mt-spacer' }),
          h('button', { type: 'button', class: 'mt-btn', onclick: close }, 'Cancel'),
          h('button', { type: 'submit', class: 'mt-btn mt-btn-primary' }, 'Save')));
      return form;
    });
  }

  const unsubs = [
    HB.subscribe('consumables', r => { S.rows = r; paint(); }),
    HB.subscribe('rooms', r => { S.rooms = r; }),
    HB.subscribe('assets', r => { S.assets = r; }),
  ];
  Promise.all([HB.list('consumables'), HB.list('rooms'), HB.list('assets')]).then(([c, r, a]) => { S.rows = c; S.rooms = r; S.assets = a; paint(); });
  return () => unsubs.forEach(u => u());
}

registerView({ id: 'consumables', title: 'Supplies', icon: 'package', order: 12, render });
