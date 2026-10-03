// Maintenance: the main screen. Overdue, Due now, Next 30 days, All tasks by category (+ month calendar).
import { registerView } from '../core/router.js';
import { HB, h, ensureCss, todayISO, select } from './maintenance-ui.js';
import { taskStatus } from '../core/recur.js';
import { taskCard, CATS, catName } from './maintenance-actions.js';
import { openTaskForm } from './maintenance-form.js';
import { renderCalendar } from './maintenance-calendar.js';

const ASSIGNEES = ['Chris', 'Wife', 'Either'];
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

export function render(container) {
  ensureCss('maintenance.css');
  const now = new Date();
  const S = {
    tasks: [], logs: [], rooms: [],
    f: { cat: '', room: '', assignee: '', subject: '', q: '' },
    view: lsGet('mt.view') === 'calendar' ? 'calendar' : 'list',
    cal: { y: now.getFullYear(), m: now.getMonth(), sel: null },
  };
  const roomName = id => (S.rooms.find(r => r.id === id) || {}).name || '';
  const ctx = {
    logs: () => S.logs,
    lookups: () => ({ rooms: S.rooms, subjects: [...new Set(S.tasks.map(t => t.subject).filter(Boolean))].sort() }),
    roomName,
  };

  const root = h('div', { class: 'mt-root' });
  container.replaceChildren(root);
  const head = h('div', { class: 'mt-head' });
  const filterBox = h('div', { class: 'mt-filters-wrap' });
  const body = h('div', { class: 'mt-body' });
  root.append(head, filterBox, body);

  function drawHead() {
    head.replaceChildren(
      h('div', { class: 'mt-head-row' },
        h('h1', null, 'Maintenance'),
        h('button', { type: 'button', class: 'mt-btn mt-btn-primary', onclick: () => openTaskForm(null, ctx.lookups()) }, 'Add recurring thing')),
      h('div', { class: 'mt-head-row' },
        h('div', { class: 'mt-seg', role: 'group', 'aria-label': 'View' },
          ['list', 'calendar'].map(v => h('button', { type: 'button', class: 'mt-seg-btn', 'aria-pressed': S.view === v ? 'true' : 'false', onclick: () => { S.view = v; lsSet('mt.view', v); drawHead(); paint(); } }, v === 'list' ? 'List' : 'Calendar'))),
        h('nav', { class: 'mt-links', 'aria-label': 'Related' },
          h('a', { href: '#/consumables' }, 'Supplies'), h('a', { href: '#/weather-alerts' }, 'Weather alerts'))));
  }

  function drawFilters() {
    const subjects = [...new Set(S.tasks.filter(t => !Number(t.deleted)).map(t => t.subject).filter(Boolean))].sort();
    const upd = (k, el) => () => { S.f[k] = el.value; paint(); };
    const q = h('input', { type: 'search', placeholder: 'Search tasks', value: S.f.q, 'aria-label': 'Search tasks' });
    q.addEventListener('input', () => { S.f.q = q.value; paint(); });
    const mk = (k, label, opts) => { const el = select([['', label], ...opts], S.f[k], { 'aria-label': label }); el.addEventListener('change', upd(k, el)); return el; };
    const active = Object.entries(S.f).filter(([k, v]) => k !== 'q' && v).length;
    filterBox.replaceChildren(h('div', { class: 'mt-search' }, q),
      h('details', { class: 'mt-filters', open: active > 0 },
        h('summary', null, active ? `Filters (${active})` : 'Filters'),
        h('div', { class: 'mt-filter-row' },
          mk('cat', 'All types', Object.entries(CATS)),
          mk('room', 'All rooms', S.rooms.map(r => [r.id, r.name])),
          mk('assignee', 'Anyone', ASSIGNEES.map(a => [a, a])),
          mk('subject', 'Everyone and everything', subjects.map(s => [s, s])),
          active ? h('button', { type: 'button', class: 'mt-btn mt-btn-small', onclick: () => { Object.assign(S.f, { cat: '', room: '', assignee: '', subject: '' }); drawFilters(); paint(); } }, 'Clear') : null)));
  }

  function matches(t) {
    const f = S.f;
    if (f.cat && t.category !== f.cat) return false;
    if (f.room && t.room !== f.room) return false;
    const a = t.assignee || 'Either';
    if (f.assignee && a !== f.assignee && a !== 'Either') return false;
    if (f.subject && t.subject !== f.subject) return false;
    if (f.q) {
      const hay = [t.title, t.subject, t.how, t.why, catName(t.category), roomName(t.room)].join(' ').toLowerCase();
      if (!f.q.toLowerCase().split(/\s+/).every(w => hay.includes(w))) return false;
    }
    return true;
  }

  function section(title, items, { open = true, count = true, cls = '' } = {}) {
    if (!items.length && cls !== 'always') return null;
    return h('section', { class: `mt-section ${cls}` },
      h('h2', null, title, count ? h('span', { class: 'mt-count' }, items.length) : null),
      items.length ? items.map(i => taskCard(i.task, i.st, ctx)) : h('p', { class: 'mt-muted' }, 'Nothing here.'));
  }

  function paint() {
    const today = todayISO();
    const byTask = new Map();
    for (const l of S.logs) { if (Number(l.deleted)) continue; (byTask.get(l.task) || byTask.set(l.task, []).get(l.task)).push(l); }
    const all = S.tasks.filter(t => !Number(t.deleted));
    const items = all.filter(matches).map(task => ({ task, st: taskStatus(task, byTask.get(task.id) || [], today) }));
    const live = items.filter(i => i.st.state !== 'inactive');
    const byDue = (a, b) => (a.st.due || '9').localeCompare(b.st.due || '9') || a.task.title.localeCompare(b.task.title);

    if (!all.length) {
      body.replaceChildren(h('div', { class: 'mt-empty' }, h('h2', null, 'No recurring things yet'),
        h('p', null, 'Tap "Add recurring thing" to start. Filters, pet medicine, yearly service, anything that repeats.'),
        h('p', { class: 'mt-muted' }, 'The starter set of house and steam heat tasks is loaded by Chris from a computer (see docs/HUMAN-STEPS.md).')));
      return;
    }
    if (S.view === 'calendar') {
      body.replaceChildren(renderCalendar(live, S.cal, { onChange: paint, renderDay: i => taskCard(i.task, i.st, ctx) }));
      return;
    }
    const overdue = live.filter(i => i.st.state === 'overdue').sort((a, b) => b.st.overdueDays - a.st.overdueDays);
    const due = live.filter(i => i.st.state === 'due').sort(byDue);
    const next = live.filter(i => i.st.state === 'upcoming' && i.st.days <= 30).sort(byDue);
    const groups = new Map();
    for (const i of items.slice().sort(byDue)) {
      const key = i.st.state === 'inactive' ? '~paused' : i.task.category || 'other';
      (groups.get(key) || groups.set(key, []).get(key)).push(i);
    }
    const order = [...Object.keys(CATS), '~paused'];
    const allSection = h('section', { class: 'mt-section mt-all' }, h('h2', null, 'All tasks', h('span', { class: 'mt-count' }, items.length)),
      order.filter(k => groups.has(k)).map(k => h('details', { class: 'mt-group', open: !!S.f.q || !!S.f.cat },
        h('summary', null, k === '~paused' ? 'Paused' : catName(k), h('span', { class: 'mt-count' }, groups.get(k).length)),
        groups.get(k).map(i => taskCard(i.task, i.st, ctx)))));
    body.replaceChildren(...[
      !overdue.length && !due.length ? h('p', { class: 'mt-allclear' }, 'Nothing is overdue or due right now.') : null,
      section('Overdue', overdue, { cls: 'mt-sec-over' }),
      section('Due now', due, { cls: 'mt-sec-due' }),
      section('Next 30 days', next),
      items.length ? allSection : h('p', { class: 'mt-muted' }, 'No tasks match your filters.')].filter(Boolean));
  }

  const unsubs = [
    HB.subscribe('tasks', rows => { S.tasks = rows; drawFilters(); paint(); }),
    HB.subscribe('task_log', rows => { S.logs = rows; paint(); }),
    HB.subscribe('rooms', rows => { S.rooms = rows; drawFilters(); paint(); }),
  ];
  Promise.all([HB.list('tasks'), HB.list('task_log'), HB.list('rooms')]).then(([t, l, r]) => {
    S.tasks = t; S.logs = l; S.rooms = r; drawHead(); drawFilters(); paint();
  });
  drawHead();
  return () => unsubs.forEach(u => u());
}

registerView({ id: 'maintenance', title: 'Maintenance', icon: 'wrench', order: 10, render });
