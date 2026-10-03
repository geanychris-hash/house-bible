// Materials per project and the cross-project shopping list.
import { HB, h, panel, btn, chip, empty, banner, inp, money, money0, ensureCss, copyText } from './projects-common.js';
import { bestPrice, lineTotal, materialsEstimate, isOn, STORES, searchURL, shopping } from '../core/plan.js';

const link = (store, item) => h('a', { href: searchURL(store, item || ''), target: '_blank', rel: 'noopener' }, store === 'Home Depot' ? 'HD' : 'HF');
const short = s => s === 'Home Depot' ? 'HD' : s === 'Harbor Freight' ? 'HF' : 'Other';

/* One card per material so it works on a phone. Edits save on change. redraw() re-renders the page. */
export function materialsSection(project, materials, redraw) {
  ensureCss();
  const mine = materials.filter(m => m.project === project.id).sort((a, b) => String(a.item).localeCompare(String(b.item)));
  const save = (m, patch, re) => HB.save('materials', { id: m.id, ...patch }).then(() => re && redraw());
  const card = m => {
    const b = bestPrice(m);
    return h('div', { class: 's5-mat' + (isOn(m.have) ? ' have' : ''), 'data-id': m.id },
      h('div', { class: 's5-mat-top' },
        inp(m.item, v => save(m, { item: v }, true), { label: 'Item', ph: 'Item' }),
        h('label', { class: 's5-check' }, h('input', { type: 'checkbox', checked: isOn(m.have) ? true : null, onchange: e => save(m, { have: e.target.checked ? 1 : 0 }, true) }), 'Have'),
        h('button', { class: 's5-btn small', type: 'button', 'aria-label': 'Remove ' + (m.item || 'material'), onclick: () => HB.remove('materials', m.id).then(redraw) }, '×')),
      h('div', { class: 's5-mat-nums' },
        h('label', null, 'Qty', inp(m.qty, v => save(m, { qty: v }, true), { type: 'number', label: 'Quantity' })),
        h('label', null, 'Unit', inp(m.unit, v => save(m, { unit: v }), { label: 'Unit', ph: 'ea' })),
        h('label', null, 'Home Depot $', inp(m.price_hd, v => save(m, { price_hd: v }, true), { type: 'number', label: 'Home Depot price' })),
        h('label', null, 'Harbor Fr. $', inp(m.price_hf, v => save(m, { price_hf: v }, true), { type: 'number', label: 'Harbor Freight price' })),
        h('label', null, 'Other $', inp(m.price_other, v => save(m, { price_other: v }, true), { type: 'number', label: 'Other price' }))),
      h('div', { class: 's5-row s5-mat-foot' },
        b ? chip(`Best ${short(b.store)} ${money(lineTotal(m))}`, 'acc') : chip('No price yet'),
        h('span', { class: 's5-muted' }, 'Search:'), link('Home Depot', m.item), link('Harbor Freight', m.item)));
  };
  const add = async () => {
    const row = await HB.save('materials', { project: project.id, item: '', qty: 1, unit: '', have: 0 });
    await redraw();
    document.querySelector(`[data-id="${row.id}"] input`)?.focus();
  };
  return panel('Materials', btn('Add material', add, 'small primary'),
    mine.length ? h('div', { class: 's5-list' }, mine.map(card)) : empty('No materials yet.'),
    h('div', { class: 's5-row spread s5-foot' },
      h('span', { class: 's5-muted' }, 'Lowest price per item. Items marked Have are left out.'),
      h('strong', { class: 's5-mono' }, 'Estimate ' + money0(materialsEstimate(mine)))));
}

/* Shopping list across all open projects, grouped by cheapest store. */
export function shoppingView(projects, materials) {
  ensureCss();
  const sh = shopping(projects, materials);
  const order = STORES.concat(['No price yet']);
  const stores = Object.keys(sh.byStore).sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const text = () => stores.map(st => st + '\n' + sh.byStore[st].map(r => `- ${r.item || '(unnamed)'} x${r.qty}${r.best ? ' @ ' + money(r.best.price) : ''}`).join('\n')).join('\n\n') + `\n\nEstimated total: ${money0(sh.total)}`;
  const kids = [banner('Prices are typed in by hand. Tap a store link to check the price, then enter what you find in the material.')];
  if (!sh.rows.length) kids.push(empty('Nothing to buy. Add materials inside a project.'));
  stores.forEach(store => {
    const rows = sh.byStore[store];
    kids.push(panel(store, chip(money0(rows.reduce((s, r) => s + r.total, 0)), 'acc'),
      h('div', { class: 's5-list' }, rows.map(r => h('div', { class: 's5-item' },
        h('div', { class: 's5-row spread' }, h('span', { class: 's5-title' }, r.item || '(unnamed)'), h('span', { class: 's5-mono' }, r.best ? money(r.total) : '')),
        h('div', { class: 's5-muted' }, `${r.qty}${r.unit ? ' ' + r.unit : ''}${r.best ? ' at ' + money(r.best.price) : ''} for ${r.project}`),
        h('div', { class: 's5-row' }, link('Home Depot', r.item), link('Harbor Freight', r.item)))))));
  });
  kids.push(panel('Estimated total', sh.rows.length ? btn('Copy list', () => copyText(text()), 'small') : null,
    h('div', { class: 's5-stat' }, h('b', null, money0(sh.total)), h('span', null, 'Materials not marked Have'))));
  return h('div', { class: 's5-list' }, kids);
}
