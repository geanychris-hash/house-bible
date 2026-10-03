// Month-grid calendar for the maintenance screen. Pure DOM; fed already-filtered {task, st} items.
import { h, todayISO } from './maintenance-ui.js';
import { occurrences, addDays, parseRule } from '../core/recur.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const pad = n => String(n).padStart(2, '0');

/** date -> [{task, st}] for every date in [from, to] a task needs attention. */
export function eventsByDate(items, from, to) {
  const map = new Map();
  const put = (d, it) => { if (d >= from && d <= to) { if (!map.has(d)) map.set(d, []); map.get(d).push(it); } };
  for (const it of items) {
    const { task, st } = it;
    if (!st.due) continue;
    put(st.due, it);
    const r = parseRule(task.rule);
    if (['yearly', 'monthly', 'weekly', 'days', 'seasonal'].includes(r.type) && !st.snoozedUntil) {
      for (const d of occurrences(task, st.due, to)) if (d > st.due) put(d, it);
    }
  }
  return map;
}

/** cal state is kept by the caller: {y, m (0-11), sel (ISO or null)}. */
export function renderCalendar(items, cal, { onChange, renderDay }) {
  const first = `${cal.y}-${pad(cal.m + 1)}-01`;
  const lead = new Date(Date.UTC(cal.y, cal.m, 1)).getUTCDay();
  const dim = new Date(Date.UTC(cal.y, cal.m + 1, 0)).getUTCDate();
  const last = `${cal.y}-${pad(cal.m + 1)}-${pad(dim)}`;
  const ev = eventsByDate(items, first, last);
  const today = todayISO();
  const go = delta => { const d = new Date(Date.UTC(cal.y, cal.m + delta, 1)); cal.y = d.getUTCFullYear(); cal.m = d.getUTCMonth(); cal.sel = null; onChange(); };

  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(h('div', { class: 'mt-cal-cell mt-cal-empty', 'aria-hidden': 'true' }));
  for (let day = 1; day <= dim; day++) {
    const date = `${cal.y}-${pad(cal.m + 1)}-${pad(day)}`;
    const list = ev.get(date) || [];
    const overdue = list.some(i => i.st.state === 'overdue' && i.st.due === date);
    cells.push(h('button', {
      type: 'button', class: `mt-cal-cell${date === today ? ' mt-cal-today' : ''}${date === cal.sel ? ' mt-cal-sel' : ''}${list.length ? ' mt-cal-has' : ''}${overdue ? ' mt-cal-over' : ''}`,
      'aria-label': `${MONTHS[cal.m]} ${day}${list.length ? `, ${list.length} item${list.length === 1 ? '' : 's'}` : ''}`,
      'aria-pressed': date === cal.sel ? 'true' : 'false',
      onclick: () => { cal.sel = cal.sel === date ? null : date; onChange(); },
    }, h('span', { class: 'mt-cal-num' }, day),
      list.length ? h('span', { class: 'mt-cal-count' }, list.length) : null,
      list.slice(0, 2).map(i => h('span', { class: 'mt-cal-tag' }, i.task.title))));
  }
  const sel = cal.sel && ev.get(cal.sel);
  return h('section', { class: 'mt-cal' },
    h('div', { class: 'mt-cal-head' },
      h('button', { type: 'button', class: 'mt-btn', 'aria-label': 'Previous month', onclick: () => go(-1) }, 'Prev'),
      h('h2', null, `${MONTHS[cal.m]} ${cal.y}`),
      h('button', { type: 'button', class: 'mt-btn', 'aria-label': 'Next month', onclick: () => go(1) }, 'Next')),
    h('div', { class: 'mt-cal-grid', role: 'group', 'aria-label': `${MONTHS[cal.m]} ${cal.y}` },
      ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => h('div', { class: 'mt-cal-dow' }, d)), cells),
    cal.sel ? h('div', { class: 'mt-cal-day' }, h('h3', null, cal.sel), sel ? sel.map(i => renderDay(i)) : h('p', { class: 'mt-muted' }, 'Nothing on this day.')) : h('p', { class: 'mt-muted' }, 'Tap a day to see what is due.'));
}
