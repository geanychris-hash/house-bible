// Utility bills (gas, oil, electric, water): simple trend and year-over-year compare.
import { registerView } from '../core/router.js';
import { HB, HBui, h, panel, btn, chip, empty, tabBar, money, money0, fmtDate, todayISO, cap, MONTH_NAMES, ensureCss, watchTables } from './projects-common.js';
import { UTILITY_KINDS, utilityTrend, yearOverYear } from '../core/plan.js';

const UNITS = { gas: 'therms', oil: 'gallons', electric: 'kWh', water: 'gallons', other: '' };

export function editBill(b, defaults = {}, onDone = () => {}) {
  HBui.openForm({
    title: b ? 'Edit bill' : 'Add bill',
    values: b || { date: todayISO(), kind: 'gas', unit: UNITS[defaults.kind || 'gas'], ...defaults },
    fields: [
      { k: 'kind', label: 'Kind', type: 'select', options: UTILITY_KINDS },
      { k: 'date', label: 'Bill or delivery date', type: 'date' },
      { k: 'amount', label: 'Amount ($)', type: 'number' },
      { k: 'usage', label: 'Usage (optional)', type: 'number' },
      { k: 'unit', label: 'Unit', placeholder: 'therms, gallons, kWh' },
      { k: 'notes', label: 'Notes', type: 'textarea' },
    ],
    onSave: async out => {
      if (out.amount == null || out.amount === '') { HBui.toast('Enter the amount'); return false; }
      if (!out.date) { HBui.toast('Pick a date'); return false; }
      await HB.save('utilities', { ...(b ? { id: b.id } : {}), ...out });
      onDone();
    },
    onDelete: b ? async () => { await HB.remove('utilities', b.id); onDone(); } : null,
  });
}

const svgNS = 'http://www.w3.org/2000/svg';
/* Bar chart of the latest bills. Uses CSS variables so light and dark both work. */
function trendChart(points) {
  const W = 320, H = 90, pad = 4, n = points.length;
  const max = Math.max(...points.map(p => p.amount), 1);
  const bw = (W - pad * 2) / n;
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 's5-chart'); svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Last ${n} bills, from ${money0(points[0].amount)} to ${money0(points[n - 1].amount)}`);
  points.forEach((p, i) => {
    const bh = Math.max(2, (p.amount / max) * (H - 14));
    const r = document.createElementNS(svgNS, 'rect');
    r.setAttribute('x', pad + i * bw + 1); r.setAttribute('y', H - bh); r.setAttribute('width', Math.max(2, bw - 2)); r.setAttribute('height', bh); r.setAttribute('rx', 2);
    const t = document.createElementNS(svgNS, 'title'); t.textContent = `${fmtDate(p.date)}: ${money0(p.amount)}`; r.append(t);
    svg.append(r);
  });
  return svg;
}
const pctText = x => x == null ? '' : (x >= 0 ? '+' : '') + Math.round(x * 100) + '%';
const chg = x => x == null ? null : chip(pctText(x), x > 0.05 ? 'warn' : x < -0.05 ? 'good' : '');

registerView({
  id: 'utilities', title: 'Utilities', icon: 'flame', order: 47,
  render(container) {
    ensureCss();
    const st = { kind: 'gas' };
    const draw = async () => {
      const all = await HB.list('utilities');
      const have = k => all.some(r => r.kind === k);
      const trend = utilityTrend(all, st.kind);
      const yoy = yearOverYear(all, st.kind);
      const recent = trend.slice(-12);
      const yoyRows = yoy.months.filter(m => m.cur != null || m.prev != null);
      const unit = trend.find(r => r.unit)?.unit || '';
      container.replaceChildren(h('div', { class: 's5-list' },
        panel(null, btn('Add bill', () => editBill(null, { kind: st.kind, unit: UNITS[st.kind] }, draw), 'primary')),
        tabBar(UTILITY_KINDS.map(k => [k, cap(k) + (have(k) ? '' : '')]), st.kind, k => { st.kind = k; draw(); }),
        !trend.length ? empty(`No ${st.kind} bills yet.`) : h('div', { class: 's5-list' },
          panel('Last ' + recent.length + ' bills', null, trendChart(recent),
            h('div', { class: 's5-row spread s5-top' }, h('span', { class: 's5-muted' }, 'Average ' + money0(recent.reduce((s, r) => s + r.amount, 0) / recent.length)), h('span', { class: 's5-muted' }, `Latest ${money0(recent[recent.length - 1].amount)}`))),
          yoy.year ? panel(`${yoy.year} compared with ${yoy.year - 1}`, null, yoyRows.length ? h('div', { class: 's5-list' }, yoyRows.map(m => h('div', { class: 's5-item' },
            h('div', { class: 's5-row spread' }, h('span', { class: 's5-title' }, MONTH_NAMES[m.month - 1]), chg(m.pct)),
            h('span', { class: 's5-muted s5-mono' }, `${yoy.year}: ${m.cur != null ? money0(m.cur) : 'no bill'}    ${yoy.year - 1}: ${m.prev != null ? money0(m.prev) : 'no bill'}`)))) : empty('No bills to compare.')) : null,
          panel('All bills', null, h('div', { class: 's5-list' }, trend.slice().reverse().map(r => h('div', { class: 's5-item s5-click', tabindex: '0', role: 'button', onclick: () => editBill(r, {}, draw), onkeydown: e => { if (e.key === 'Enter') editBill(r, {}, draw); } },
            h('div', { class: 's5-row spread' }, h('span', { class: 's5-title' }, fmtDate(r.date)), h('strong', { class: 's5-mono' }, money0(r.amount))),
            h('div', { class: 's5-row s5-muted' }, r.usage ? `${r.usage} ${r.unit || unit}` : '', r.perUnit ? ` (${money(r.perUnit)} each)` : '', chg(r.pct), r.notes || ''))))))));
    };
    draw();
    return watchTables(container, ['utilities'], draw);
  },
});
