// Expense ledger: category, project, room, store, receipt link, capital-improvement flag, totals.
import { registerView } from '../core/router.js';
import * as HBFiles from '../core/files.js';
import { HB, HBui, h, panel, btn, chip, empty, tabBar, money, money0, fmtDate, todayISO, ensureCss, watchTables, idMap, csvEscape, downloadText } from './projects-common.js';
import { EXPENSE_CATEGORIES, isOn, num0, sumBy, monthOf, yearOf } from '../core/plan.js';

const yn = v => (isOn(v) ? 'Yes' : 'No');

/* Add or edit one expense. defaults prefill a new row (e.g. {project: id}). onDone runs after save or delete. */
export function editExpense(e, defaults = {}, onDone = () => {}) {
  const isNew = !e;
  const v = e ? { ...e, capital_improvement: yn(e.capital_improvement) } : { date: todayISO(), category: 'Materials', capital_improvement: 'No', ...defaults };
  HBui.openForm({
    title: isNew ? 'Add expense' : 'Edit expense',
    values: v,
    fields: [
      { k: 'item', label: 'What was it', wide: true },
      { k: 'amount', label: 'Amount ($)', type: 'number' },
      { k: 'date', label: 'Date', type: 'date' },
      { k: 'store', label: 'Store', placeholder: 'Home Depot' },
      { k: 'category', label: 'Category', type: 'select', options: EXPENSE_CATEGORIES },
      { k: 'project', label: 'Project', type: 'ref', table: 'projects' },
      { k: 'room', label: 'Room', type: 'ref', table: 'rooms' },
      { k: 'contact', label: 'Contractor (optional)', type: 'ref', table: 'contacts' },
      { k: 'receipt', label: 'Receipt (a document)', type: 'ref', table: 'documents', labelKey: 'title' },
      { k: 'capital_improvement', label: 'Capital improvement (adds to home value)', type: 'select', options: ['No', 'Yes'] },
      { k: 'notes', label: 'Notes', type: 'textarea' },
    ],
    onSave: async out => {
      if (!String(out.item || '').trim()) { HBui.toast('Say what it was'); return false; }
      if (out.amount == null || out.amount === '') { HBui.toast('Enter an amount'); return false; }
      await HB.save('expenses', { ...(e ? { id: e.id } : {}), ...out, item: out.item.trim(), capital_improvement: out.capital_improvement === 'Yes' ? 1 : 0 });
      onDone();
    },
    onDelete: e ? async () => { await HB.remove('expenses', e.id); onDone(); } : null,
  });
}

function ledgerRow(x, names, docs, redraw) {
  const doc = x.receipt ? docs.get(x.receipt) : null;
  return h('div', { class: 's5-item s5-click', tabindex: '0', role: 'button', onclick: () => editExpense(x, {}, redraw), onkeydown: ev => { if (ev.key === 'Enter') editExpense(x, {}, redraw); } },
    h('div', { class: 's5-row spread' }, h('span', { class: 's5-title' }, x.item), h('strong', { class: 's5-mono' }, money0(x.amount))),
    h('div', { class: 's5-row' }, h('span', { class: 's5-muted' }, fmtDate(x.date)), chip(x.store), chip(x.category),
      x.project ? chip(names.projects.get(x.project) || 'Project', 'acc') : null, x.room ? chip(names.rooms.get(x.room) || 'Room') : null,
      isOn(x.capital_improvement) ? chip('Capital improvement', 'good') : null,
      doc?.file ? h('button', { class: 's5-btn small', type: 'button', onclick: ev => { ev.stopPropagation(); HBFiles.open(doc.file); } }, 'Receipt') : null));
}

function totalsTable(rows, labelFn) {
  if (!rows.length) return empty('Nothing yet.');
  return h('div', { class: 's5-list' }, rows.map(r => h('div', { class: 's5-item' },
    h('div', { class: 's5-row spread' }, h('span', { class: 's5-title' }, labelFn(r.key)), h('strong', { class: 's5-mono' }, money0(r.total))),
    h('span', { class: 's5-muted' }, `${r.count} expense${r.count === 1 ? '' : 's'}`))));
}

registerView({
  id: 'expenses', title: 'Expenses', icon: 'receipt', order: 45,
  render(container) {
    ensureCss();
    const st = { tab: 'ledger', year: 'all' };
    const draw = async () => {
      const [all, projects, rooms, documents] = await Promise.all(['expenses', 'projects', 'rooms', 'documents'].map(t => HB.list(t)));
      const names = { projects: idMap(projects), rooms: idMap(rooms) };
      const docs = new Map(documents.map(d => [d.id, d]));
      const years = [...new Set(all.map(yearOf).filter(Boolean))].sort().reverse();
      if (st.year !== 'all' && !years.includes(st.year)) st.year = 'all';
      const rows = (st.year === 'all' ? all : all.filter(r => yearOf(r) === st.year)).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
      const total = rows.reduce((s, r) => s + num0(r.amount), 0);
      const capital = rows.filter(r => isOn(r.capital_improvement)).reduce((s, r) => s + num0(r.amount), 0);
      let body;
      if (st.tab === 'ledger') body = rows.length ? h('div', { class: 's5-list' }, rows.map(r => ledgerRow(r, names, docs, draw))) : empty('No expenses yet. Tap Add expense after a purchase.');
      else if (st.tab === 'project') body = totalsTable(sumBy(rows, r => r.project).sort((a, b) => b.total - a.total), k => k ? names.projects.get(k) || 'Deleted project' : 'No project');
      else if (st.tab === 'room') body = totalsTable(sumBy(rows, r => r.room).sort((a, b) => b.total - a.total), k => k ? names.rooms.get(k) || 'Deleted room' : 'No room');
      else if (st.tab === 'month') body = totalsTable(sumBy(rows, monthOf).reverse(), k => k || 'No date');
      else body = totalsTable(sumBy(all, yearOf).reverse(), k => k || 'No date');
      const csv = () => downloadText('expenses.csv', ['date,item,store,amount,category,project,room,capital_improvement,notes']
        .concat(rows.map(r => [r.date, r.item, r.store, r.amount, r.category, names.projects.get(r.project) || '', names.rooms.get(r.room) || '', yn(r.capital_improvement), r.notes].map(csvEscape).join(','))).join('\n'));
      container.replaceChildren(h('div', { class: 's5-list' },
        panel(null, btn('Add expense', () => editExpense(null, {}, draw), 'primary'),
          h('div', { class: 's5-stats' },
            h('div', { class: 's5-stat' }, h('b', null, money0(total)), h('span', null, st.year === 'all' ? 'All time' : st.year)),
            h('div', { class: 's5-stat' }, h('b', null, money0(capital)), h('span', null, 'Capital improvements')))),
        tabBar([['ledger', 'Ledger'], ['project', 'By project'], ['room', 'By room'], ['month', 'By month'], ['year', 'By year']], st.tab, k => { st.tab = k; draw(); }),
        years.length && st.tab !== 'year' ? h('div', { class: 's5-row' }, h('label', { class: 's5-muted' }, 'Year '),
          h('select', { 'aria-label': 'Year', onchange: ev => { st.year = ev.target.value; draw(); } }, ['all', ...years].map(y => h('option', { value: y, selected: y === st.year ? true : null }, y === 'all' ? 'All years' : y))),
          rows.length ? btn('Download CSV', csv, 'small') : null) : null,
        body));
    };
    draw();
    return watchTables(container, ['expenses', 'projects', 'rooms', 'documents'], draw);
  },
});
