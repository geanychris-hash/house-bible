// Reports: improvement-cost tally (tax basis, resale) and a printable insurance and resale inventory.
import { registerView } from '../core/router.js';
import * as HBFiles from '../core/files.js';
import { HB, h, panel, btn, empty, tabBar, money0, fmtDate, ensureCss, idMap, csvEscape, downloadText, watchTables } from './projects-common.js';
import { lifespanSection, insuranceSection } from './reports-forecast.js';
import { improvementsByYear, bigPurchases, matchAssetCost, parseJson, num0 } from '../core/plan.js';

/* Load thumbnails after the DOM exists; a missing photo never breaks the report. */
function thumbs(ids) {
  const box = h('span', { class: 's5-thumbs' });
  (Array.isArray(ids) ? ids : []).slice(0, 4).forEach(id => {
    const img = h('img', { alt: '', width: 80, height: 80, loading: 'lazy' });
    box.append(img);
    Promise.resolve(HBFiles.thumbUrl(id)).then(u => { img.src = u; }).catch(() => img.remove());
  });
  return box;
}

registerView({
  id: 'reports', title: 'Reports', icon: 'file', order: 48,
  render(container) {
    ensureCss();
    const st = { tab: 'improve', threshold: 250 };
    const draw = async () => {
      const [expenses, projects, assets, rooms, tasks] = await Promise.all(['expenses', 'projects', 'assets', 'rooms', 'tasks'].map(t => HB.list(t)));
      const pNames = idMap(projects), rNames = idMap(rooms);
      const fdata = { assets, expenses, projects, rooms, tasks };
      const life = lifespanSection(fdata), insure = insuranceSection(fdata);
      if (st.tab === 'lifespan' && !life) st.tab = 'improve';
      let body;
      if (st.tab === 'improve') {
        const r = improvementsByYear(expenses, projects);
        const csv = () => downloadText('capital-improvements.csv', ['date,item,store,amount,project'].concat(r.years.flatMap(y => y.rows).map(x => [x.date, x.item, x.store, x.amount, pNames.get(x.project) || ''].map(csvEscape).join(','))).join('\n'));
        body = h('div', { class: 's5-list' },
          panel('Improvement costs', h('div', { class: 's5-row s5-noprint' }, btn('Print', () => window.print(), 'small'), r.count ? btn('Download CSV', csv, 'small') : null),
            h('p', { class: 's5-muted' }, 'Expenses marked capital improvement, by year. Keep receipts: this total can raise your tax basis when you sell. Ask a tax pro what qualifies.'),
            h('div', { class: 's5-stat' }, h('b', null, money0(r.total)), h('span', null, `${r.count} expense${r.count === 1 ? '' : 's'} in total`))),
          r.years.length ? r.years.slice().reverse().map(y => panel(y.key || 'No date', h('strong', { class: 's5-mono' }, money0(y.total)),
            h('div', { class: 's5-list' }, y.rows.map(x => h('div', { class: 's5-item' },
              h('div', { class: 's5-row spread' }, h('span', { class: 's5-title' }, x.item), h('span', { class: 's5-mono' }, money0(x.amount))),
              h('span', { class: 's5-muted' }, [fmtDate(x.date), x.store, pNames.get(x.project)].filter(Boolean).join(' - ')))))))
            : panel(null, null, empty('No capital improvements yet. Mark an expense as a capital improvement and it shows up here.')));
      } else if (st.tab === 'lifespan') {
        body = life;
      } else {
        const big = bigPurchases(expenses, st.threshold);
        const csv = () => downloadText('inventory.csv', ['name,kind,room,brand,model,serial,installed,cost'].concat(assets.map(a => { const c = matchAssetCost(a, expenses); return [a.name, a.kind, rNames.get(a.room) || '', a.brand, a.model, a.serial, a.install_date, c ? c.amount : ''].map(csvEscape).join(','); })).join('\n'));
        body = h('div', { class: 's5-list' },
          panel('Insurance and resale inventory', h('div', { class: 's5-row s5-noprint' }, btn('Print', () => window.print(), 'small'), assets.length ? btn('Download CSV', csv, 'small') : null),
            h('p', { class: 's5-muted' }, 'Systems, appliances and fixtures with photos, plus big purchases. Cost is a best guess from the expense with the matching name.'),
            h('label', { class: 's5-row s5-noprint' }, h('span', { class: 's5-muted' }, 'Big purchase is at least $'),
              h('input', { type: 'number', value: st.threshold, min: 0, 'aria-label': 'Big purchase threshold', class: 's5-narrow', onchange: e => { st.threshold = num0(e.target.value); draw(); } }))),
          panel('Assets', null, assets.length ? h('div', { class: 's5-list' }, assets.slice().sort((a, b) => String(a.name).localeCompare(String(b.name))).map(a => {
            const c = matchAssetCost(a, expenses);
            return h('div', { class: 's5-item s5-inv' },
              h('div', { class: 's5-row spread' }, h('span', { class: 's5-title' }, a.name), h('span', { class: 's5-mono' }, c ? money0(c.amount) : '')),
              h('span', { class: 's5-muted' }, [a.kind, rNames.get(a.room), [a.brand, a.model].filter(Boolean).join(' '), a.serial ? 'Serial ' + a.serial : '', a.install_date ? 'Installed ' + fmtDate(a.install_date) : ''].filter(Boolean).join(' - ')),
              thumbs(parseJson(a.photos, [])));
          })) : empty('No assets recorded yet.')),
          panel('Big purchases', null, big.length ? h('div', { class: 's5-list' }, big.map(x => h('div', { class: 's5-item' },
            h('div', { class: 's5-row spread' }, h('span', { class: 's5-title' }, x.item), h('span', { class: 's5-mono' }, money0(x.amount))),
            h('span', { class: 's5-muted' }, [fmtDate(x.date), x.store, rNames.get(x.room)].filter(Boolean).join(' - '))))) : empty('No purchases at or above that amount.')),
          insure);
      }
      container.replaceChildren(h('div', { class: 's5-list s5-report' }, h('div', { class: 's5-noprint' }, tabBar([['improve', 'Improvement costs'], ['inventory', 'Inventory'], ...(life ? [['lifespan', 'Lifespan']] : [])], st.tab, k => { st.tab = k; draw(); })), body));
    };
    draw();
    return watchTables(container, ['expenses', 'projects', 'assets', 'rooms', 'tasks'], draw);
  },
});
