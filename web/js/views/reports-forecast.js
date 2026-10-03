// Reports sections for lifespan forecast (gap 3) and insurance value (gap 4). Owned by G3.
// Both are synchronous and take data = { assets, expenses, projects, rooms, tasks } (arrays from HB.list).
// Return a DOM node, or null when there is nothing to show. reports.js adds a "Lifespan" tab only when
// lifespanSection() returns a node, and appends insuranceSection() to the Inventory tab when it returns a node.
import * as HBFiles from '../core/files.js';
import { h, panel, btn, chip, money0, idMap } from './projects-common.js';
import { lifespanForecast, insuranceInventory, parseJson } from '../core/plan.js';

const SOURCE = { replacement: 'Replacement value', purchase: 'Purchase price', expense: 'Guess from expenses' };

function thumbs(photos) {
  const ids = parseJson(photos, []);
  const box = h('span', { class: 's5-thumbs' });
  (Array.isArray(ids) ? ids : []).slice(0, 4).forEach(id => {
    const img = h('img', { alt: '', width: 80, height: 80, loading: 'lazy' });
    box.append(img);
    Promise.resolve(HBFiles.thumbUrl(id)).then(u => { img.src = u; }).catch(() => img.remove());
  });
  return box;
}

export function lifespanSection(data) {
  const f = lifespanForecast(data.assets || [], new Date().getFullYear());
  if (!f.rows.length && !f.missing.length) return null;
  const when = r => r.past ? `Past due by ${-r.remaining} year${r.remaining === -1 ? '' : 's'}` : r.remaining === 0 ? 'Due this year' : `${r.remaining} year${r.remaining === 1 ? '' : 's'} left`;
  const rooms = idMap(data.rooms || []);
  return h('div', { class: 's5-list' },
    panel('Replacement forecast', h('div', { class: 's5-row s5-noprint' }, btn('Print', () => window.print(), 'small')),
      h('p', { class: 's5-muted' }, 'Install year plus expected life, from the Assets pages. These are your own estimates, not guarantees. Gas, flue and main electrical work is always a licensed pro.'),
      h('div', { class: 's5-stats' },
        h('div', { class: 's5-stat' }, h('b', null, String(f.flagged)), h('span', null, 'due in 3 years or less')),
        h('div', { class: 's5-stat' }, h('b', null, String(f.pastDue)), h('span', null, 'past due')),
        h('div', { class: 's5-stat' }, h('b', null, money0(f.reserve)), h('span', null, 'to set aside per year'))),
      h('p', { class: 's5-muted' }, 'Set-aside is each replace cost divided by the years left (at least 1), for assets that have a replace cost.')),
    f.rows.length ? panel('By time left', null, h('div', { class: 's5-list' }, f.rows.map(r => h('div', { class: 's5-item' },
      h('div', { class: 's5-row spread' },
        h('a', { class: 's5-title', href: `#/assets/${r.asset.id}` }, r.asset.name),
        r.past ? chip(when(r), 'bad') : r.flag ? chip(when(r), 'warn') : chip(when(r))),
      h('span', { class: 's5-muted' }, [`Installed ${r.year}`, `${r.life} year life`, `due ${r.dueYear}`, rooms.get(r.asset.room),
        r.cost ? `replace ${money0(r.cost)}, set aside ${money0(r.perYear)} per year` : 'no replace cost'].filter(Boolean).join(' - ')))))) : null,
    f.missing.length ? panel('Needs an install year', null,
      h('p', { class: 's5-muted' }, 'These have an expected life but no 4-digit year in Install date, so they are left out of the forecast.'),
      h('div', { class: 's5-list' }, f.missing.map(m => h('a', { class: 's5-item', href: `#/assets/${m.asset.id}` }, m.asset.name)))) : null);
}

export function insuranceSection(data) {
  const assets = data.assets || [];
  if (!assets.length) return null;
  const inv = insuranceInventory(assets, data.expenses || []);
  const rooms = idMap(data.rooms || []);
  return h('div', { class: 's5-list' },
    panel('Insured values', h('div', { class: 's5-row s5-noprint' }, btn('Print', () => window.print(), 'small')),
      h('p', { class: 's5-muted' }, 'Replacement value first, then purchase price, then a guess from a matching expense. Photos and serial numbers are included for a claim.'),
      h('div', { class: 's5-stat' }, h('b', null, money0(inv.total)), h('span', null, `total insured value${inv.unvalued ? `, ${inv.unvalued} item${inv.unvalued === 1 ? '' : 's'} without a value` : ''}`))),
    panel('Items with values', null, h('div', { class: 's5-list' }, inv.rows.map(r => {
      const a = r.asset;
      return h('div', { class: 's5-item s5-inv' },
        h('div', { class: 's5-row spread' }, h('span', { class: 's5-title' }, a.name), h('span', { class: 's5-mono' }, r.value != null ? money0(r.value) : 'No value')),
        h('span', { class: 's5-muted' }, [a.kind, rooms.get(a.room), [a.brand, a.model].filter(Boolean).join(' '), a.serial ? 'Serial ' + a.serial : '', r.source ? SOURCE[r.source] : ''].filter(Boolean).join(' - ')),
        thumbs(a.photos));
    }))));
}
