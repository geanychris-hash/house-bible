// Printable QR labels for assets and shutoffs. Assets link to #/asset/<id>, shutoffs to the Emergency screen.
import {
  HB, h, loadCss, mountView, register, emptyState, pageHead, panel, refName, byName, lsGet, lsSet, toast,
} from './rooms-shared.js';
import { qrSvg } from './qr-encoder.js';

loadCss('rooms', 'qr');

const defaultBase = () => location.origin + location.pathname.replace(/[^/]*$/, '') ;
const joinBase = (base, hash) => String(base || '').replace(/#.*$/, '').replace(/\/?$/, '/') + hash;

function label(item, base) {
  const url = joinBase(base, item.kind === 'shutoff' ? '#/emergency' : `#/asset/${item.id}`);
  const wrap = h('div', { class: 'rec-label' });
  try { wrap.innerHTML = qrSvg(url, { scale: 3, margin: 2 }); } catch (e) { wrap.append(h('span', { class: 'rec-error' }, 'Link too long')); }
  wrap.append(h('div', { class: 'rec-label-text' }, h('strong', null, item.name), h('span', null, item.sub || '')));
  return wrap;
}

function build(rt, data) {
  const base = h('input', { type: 'text', value: lsGet('hb.qr.base', defaultBase()), 'aria-label': 'App address', inputmode: 'url' });
  const sheet = h('div', { class: 'rec-labels' });
  const picks = h('div', { class: 'rec-list' });
  const selected = new Set();
  let seeded = false;
  const items = () => [
    ...(data.shutoffs || []).map(s => ({ kind: 'shutoff', id: s.id, name: s.name, sub: [refName(data.rooms, s.room), s.location].filter(Boolean).join(': ') })),
    ...(data.assets || []).slice().sort(byName()).map(a => ({ kind: 'asset', id: a.id, name: a.name, sub: [refName(data.rooms, a.room), a.location].filter(Boolean).join(': ') })),
  ];
  function drawSheet() {
    lsSet('hb.qr.base', base.value);
    const chosen = items().filter(i => selected.has(i.id));
    sheet.replaceChildren(...chosen.map(i => label(i, base.value)));
  }
  function update() {
    const all = items();
    if (!seeded) { all.forEach(i => selected.add(i.id)); seeded = true; }
    if (!all.length) { picks.replaceChildren(emptyState('Nothing to label yet', 'Add assets and shutoffs first.')); sheet.replaceChildren(); return; }
    picks.replaceChildren(...all.map(i => h('label', { class: 'rec-item' },
      h('input', { type: 'checkbox', checked: selected.has(i.id), onchange: e => { e.target.checked ? selected.add(i.id) : selected.delete(i.id); drawSheet(); } }),
      h('span', { class: 'rec-grow' }, h('span', { class: 'rec-title' }, i.name), h('span', { class: 'rec-sub' }, (i.kind === 'shutoff' ? 'Shutoff' : 'Asset') + (i.sub ? ' / ' + i.sub : ''))))));
    drawSheet();
  }
  base.addEventListener('input', drawSheet);
  const print = () => {
    if (!sheet.children.length) { toast('Select at least one label.'); return; }
    const root = h('div', { class: 'rec-print-root' }, sheet.cloneNode(true));
    document.body.append(root); document.body.classList.add('rec-printing');
    const done = () => { root.remove(); document.body.classList.remove('rec-printing'); window.removeEventListener('afterprint', done); };
    window.addEventListener('afterprint', done);
    window.print();
    setTimeout(() => { if (document.body.classList.contains('rec-printing') && !matchMedia('print').matches) done(); }, 1500);
  };
  return {
    node: h('div', { class: 'rec-view rec-qr' },
      pageHead('QR labels', h('button', { class: 'rec-btn rec-primary rec-noprint', type: 'button', onclick: print }, 'Print labels')),
      h('p', { class: 'rec-muted rec-noprint' }, 'Stick a label on each asset or shutoff. Scanning it opens the app on that item. Assets open their page; shutoffs open the Emergency screen.'),
      panel('App address', h('div', { class: 'rec-stack' }, base,
        h('small', { class: 'rec-muted' }, 'The address you open the app at, up to the last slash. It is remembered on this device. Check that a scan opens the right page before printing a full sheet.'))),
      panel('Labels to print', picks),
      sheet),
    refresh: update,
  };
}

register({ id: 'qr', title: 'QR labels', icon: 'qr', order: 90, render(container) { return mountView(container, ['assets', 'shutoffs', 'rooms'], build); } });
