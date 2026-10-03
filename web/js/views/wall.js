// Wall display mode: read-only, large type, dark by default. Route #/wall, hidden from the nav.
// Everything comes from the local cache (HB.list); nothing here writes or reads Google Calendar.
// Redraws on cache changes (the app's 60 s auto sync feeds those) and once a minute for the clock/date.
import { registerView } from '../core/router.js';
import * as HB from '../core/data.js';
import { taskStatus, occurrences, addDays, consumableStatus, parseISO } from '../core/recur.js';

const AHEAD_DAYS = 5;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const OPS = { '<=': 'at or below', '>=': 'at or above', '<': 'below', '>': 'above' };
const METRIC = { minTempF: ['low', 'F'], maxTempF: ['high', 'F'], snowIn: ['snow', 'in'], windMph: ['wind', 'mph'], rainIn: ['rain', 'in'] };

const pad = n => String(n).padStart(2, '0');
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const jsonOf = (v, fb) => { if (v == null || v === '') return fb; if (typeof v !== 'string') return v; try { return JSON.parse(v); } catch { return fb; } };
const dayName = iso => DAYS[new Date(parseISO(iso)).getUTCDay()];
const longDate = iso => { const d = new Date(parseISO(iso)); return `${DAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`; };
const shortDate = iso => { const d = new Date(parseISO(iso)); return `${MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCDate()}`; };

function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) { if (v != null && v !== false) e.setAttribute(k, v === true ? '' : v); }
  for (const c of kids.flat(Infinity)) { if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c))); }
  return e;
}
function ensureCss(file) {
  const id = 'css-' + file;
  if (document.getElementById(id)) return;
  const l = h('link', { id, rel: 'stylesheet', href: new URL('../../css/' + file, import.meta.url).href });
  document.head.append(l);
}

/** Pure: everything the wall shows, from cache rows and today's date. Exported for tests. */
export function wallModel({ tasks = [], logs = [], consumables = [], settings = [] }, today) {
  const active = tasks.filter(t => t && !Number(t.deleted));
  const overdue = [], dueToday = [], soon = new Map();
  const end = addDays(today, AHEAD_DAYS);
  for (const t of active) {
    const st = taskStatus(t, logs, today);
    if (st.state === 'inactive' || st.state === 'done') continue;
    if (st.state === 'overdue') { overdue.push({ t, st }); continue; }
    if (st.due && st.due <= today) dueToday.push({ t, st });   // may also repeat inside the window below
    // Skip occurrences a completion already covers (e.g. a yearly task logged a few days early).
    const dates = new Set(occurrences(t, addDays(today, 1), end).filter(d => !st.due || d >= st.due));
    if (st.due && st.due > today && st.due <= end) dates.add(st.due);
    for (const d of dates) { if (!soon.has(d)) soon.set(d, []); soon.get(d).push(t); }
  }
  overdue.sort((a, b) => b.st.overdueDays - a.st.overdueDays);
  const low = [];
  for (const c of consumables) {
    if (!c || Number(c.deleted)) continue;
    const s = consumableStatus(c, today);
    if (s.low || s.state === 'overdue') low.push({ c, s });
  }
  const alertsRow = settings.find(s => s.id === 'alerts' || s.key === 'alerts');
  const rules = ((alertsRow && jsonOf(alertsRow.value, null)) || {}).rules;
  const armed = (Array.isArray(rules) ? rules : []).filter(r => r && r.enabled);
  return { overdue, dueToday, low, armed, soon: [...soon.entries()].sort((a, b) => a[0].localeCompare(b[0])) };
}

function ruleText(r) {
  const m = METRIC[r.metric] || [r.metric, ''];
  return `${r.label || r.id}: ${m[0]} ${OPS[r.op] || r.op} ${r.value}${m[1]} within ${r.hoursAhead || 48} h`;
}

function section(title, cls, count, ...body) {
  return h('section', { class: 'wl-sec ' + cls }, h('h2', null, title, count != null ? h('span', { class: 'wl-count' }, count) : null), ...body);
}
const empty = text => h('p', { class: 'wl-empty' }, text);

function draw(root, model, today) {
  const now = new Date();
  const taskLi = ({ t, st }, late) => h('li', null, h('span', { class: 'wl-t' }, t.title || 'Untitled'),
    late ? h('span', { class: 'wl-tag wl-late' }, `${st.overdueDays} day${st.overdueDays === 1 ? '' : 's'} late`) : null,
    t.assignee ? h('span', { class: 'wl-tag' }, t.assignee) : null);
  const todayList = model.dueToday.length ? h('ul', { class: 'wl-list' }, model.dueToday.map(x => taskLi(x, false))) : empty('Nothing due today.');
  const lateList = model.overdue.length ? h('ul', { class: 'wl-list' }, model.overdue.map(x => taskLi(x, true))) : empty('Nothing overdue.');
  const lowList = model.low.length
    ? h('ul', { class: 'wl-list' }, model.low.map(({ c, s }) => h('li', null, h('span', { class: 'wl-t' }, c.name || 'Item'),
      h('span', { class: 'wl-tag ' + (s.low ? 'wl-late' : '') }, s.low ? 'none left' : `replace ${s.days < 0 ? Math.abs(s.days) + ' d ago' : 'now'}`))))
    : empty('Stock is fine.');
  const alertBody = model.armed.length
    ? h('ul', { class: 'wl-list wl-small' }, model.armed.map(r => h('li', null, h('span', { class: 'wl-t' }, ruleText(r)))))
    : empty('No weather rules switched on.');
  const soonBody = model.soon.length
    ? h('div', { class: 'wl-days' }, model.soon.map(([d, ts]) => h('div', { class: 'wl-day' },
      h('h3', null, d === addDays(today, 1) ? 'Tomorrow' : dayName(d), h('small', null, shortDate(d))),
      h('ul', null, ts.map(t => h('li', null, t.title || 'Untitled'))))))
    : empty(`Nothing scheduled in the next ${AHEAD_DAYS} days.`);

  root.replaceChildren(
    h('header', { class: 'wl-head' },
      h('div', null, h('div', { class: 'wl-date' }, longDate(today)), h('div', { class: 'wl-brand' }, 'House Bible')),
      h('div', { class: 'wl-clock', 'aria-label': 'Time' }, now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })),
      h('a', { class: 'wl-exit', href: '#/home' }, 'Exit')),
    h('div', { class: 'wl-grid' },
      section('Today', 'wl-today', model.dueToday.length, todayList),
      section('Overdue', 'wl-over' + (model.overdue.length ? ' wl-hot' : ''), model.overdue.length, lateList),
      section('Running low', 'wl-low', model.low.length, lowList),
      section('Weather alerts on', 'wl-alerts', model.armed.length, alertBody,
        h('p', { class: 'wl-note' }, 'The server emails when one fires.')),
      section(`Next ${AHEAD_DAYS} days`, 'wl-soon', null, soonBody)));
}

export function render(container) {
  ensureCss('wall.css');
  const doc = document.documentElement;
  const prevTheme = doc.getAttribute('data-theme');
  doc.setAttribute('data-theme', 'dark');
  document.body.classList.add('wall-mode');
  document.title = 'Wall - House Bible';
  const root = h('div', { class: 'wl-root' });
  container.replaceChildren(root);

  let alive = true, busy = false, again = false;
  async function refresh() {
    if (busy) { again = true; return; }
    busy = true;
    try {
      const [tasks, logs, consumables, settings] = await Promise.all(['tasks', 'task_log', 'consumables', 'settings'].map(t => HB.list(t)));
      if (alive) { const today = todayISO(); draw(root, wallModel({ tasks, logs, consumables, settings }, today), today); }
    } catch (e) {
      console.error('wall refresh failed', e);
      if (alive && !root.firstChild) root.append(h('p', { class: 'wl-empty' }, 'Could not read the saved data.'));
    } finally { busy = false; if (again && alive) { again = false; refresh(); } }
  }
  refresh();
  const unsubs = ['tasks', 'task_log', 'consumables', 'settings'].map(t => HB.subscribe(t, refresh));
  const tick = setInterval(refresh, 60000);   // keeps the clock and the date current between syncs

  // Screen wake lock: feature-detected, released on leave, re-acquired when the tab becomes visible again.
  let lock = null;
  async function acquire() {
    if (!alive || !('wakeLock' in navigator) || document.visibilityState !== 'visible' || lock) return;
    try {
      lock = await navigator.wakeLock.request('screen');
      lock.addEventListener('release', () => { lock = null; });
    } catch { lock = null; }   // denied (battery saver, no user gesture): the screen may dim, nothing else breaks
  }
  const onVis = () => { if (document.visibilityState === 'visible') { acquire(); refresh(); } };
  document.addEventListener('visibilitychange', onVis);
  acquire();

  return () => {
    alive = false;
    clearInterval(tick);
    unsubs.forEach(u => { try { u(); } catch { /* ignore */ } });
    document.removeEventListener('visibilitychange', onVis);
    if (lock) { try { lock.release(); } catch { /* ignore */ } lock = null; }
    document.body.classList.remove('wall-mode');
    if (prevTheme == null) doc.removeAttribute('data-theme'); else doc.setAttribute('data-theme', prevTheme);
  };
}

registerView({ id: 'wall', title: 'Wall display', icon: 'dot', order: 900, hidden: true, render });
