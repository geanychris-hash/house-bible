// "Add recurring thing" / edit form. Plain-language frequency picker that maps to rule JSON (CONTRACT section 5).
import { HB, h, toast, openModal, field, select, todayISO, confirmButton, callApi } from './maintenance-ui.js';
import { parseRule } from '../core/recur.js';

const CAT_OPTIONS = [['house', 'House'], ['steam', 'Steam heat'], ['yard', 'Yard'], ['safety', 'Safety'], ['pet', 'Pet'], ['vehicle', 'Vehicle'], ['health', 'Health'], ['other', 'Other']];
const KIND_OPTIONS = [
  ['every', 'Every so often (days, weeks, months, years)'],
  ['after', 'A while after I last did it'],
  ['yearly', 'Once a year on a date'],
  ['season', 'Any time in a yearly window (like Apr 1 to Apr 30)'],
  ['once', 'One time only'],
];
const UNITS = [['days', 'days'], ['weeks', 'weeks'], ['months', 'months'], ['years', 'years']];
const ASSIGNEES = ['Either', 'Chris', 'Wife'];

/** rule JSON -> form state. */
export function ruleToForm(rule) {
  const r = parseRule(rule), n = Math.max(1, Math.floor(Number(r.interval) || 1));
  const season = r.from && r.to && r.type !== 'seasonal' ? { from: r.from, to: r.to } : null;
  switch (r.type) {
    case 'days': return { kind: 'every', n, unit: 'days', season };
    case 'weekly': return { kind: 'every', n, unit: 'weeks', season };
    case 'monthly': return n % 12 === 0 ? { kind: 'every', n: n / 12, unit: 'years', season } : { kind: 'every', n, unit: 'months', season };
    case 'yearly': return { kind: 'yearly', n: 1, unit: 'years', season: null };
    case 'after_done': return { kind: 'after', n, unit: r.unit || 'days', season: null };
    case 'seasonal': return { kind: 'season', n: 1, unit: 'years', season: { from: r.from, to: r.to } };
    default: return { kind: 'once', n: 1, unit: 'days', season: null };
  }
}
/** form state -> rule JSON object. */
export function formToRule({ kind, n, unit, season }) {
  n = Math.max(1, Math.floor(Number(n) || 1));
  const lim = season && season.from && season.to ? { from: season.from, to: season.to } : {};
  if (kind === 'once') return { type: 'once' };
  if (kind === 'yearly') return { type: 'yearly' };
  if (kind === 'season') return { type: 'seasonal', from: season.from, to: season.to };
  if (kind === 'after') return { type: 'after_done', interval: n, unit };
  if (unit === 'days') return { type: 'days', interval: n, ...lim };
  if (unit === 'weeks') return { type: 'weekly', interval: n, ...lim };
  if (unit === 'months') return { type: 'monthly', interval: n, ...lim };
  return n === 1 && !lim.from ? { type: 'yearly' } : { type: 'monthly', interval: 12 * n, ...lim };
}

const mdOf = d => (d && d.length >= 10 ? d.slice(5, 10) : '');
const dateFromMD = md => md ? `${new Date().getFullYear()}-${md}` : '';

/** lookups: {rooms:[rows], subjects:[strings]}. task null = create. */
export function openTaskForm(task, lookups = {}) {
  const isNew = !task;
  const t = task || { category: 'house', assignee: 'Either', active: 1, calendar: 0, source: 'user', start: todayISO() };
  const f0 = task ? ruleToForm(t.rule) : { kind: 'every', n: 1, unit: 'months', season: null };
  openModal(isNew ? 'Add recurring thing' : 'Edit task', close => {
    const title = h('input', { type: 'text', value: t.title || '', placeholder: 'e.g. Dog heartworm pill', required: true, maxlength: 120 });
    const cat = select(CAT_OPTIONS, t.category || 'house');
    const subjList = h('datalist', { id: 'mt-subjects' }, (lookups.subjects || []).map(s => h('option', { value: s })));
    const subject = h('input', { type: 'text', value: t.subject || '', list: 'mt-subjects', placeholder: "e.g. a pet's name" });
    const kind = select(KIND_OPTIONS, f0.kind);
    const n = h('input', { type: 'number', min: '1', step: '1', value: f0.n, inputmode: 'numeric', 'aria-label': 'How many' });
    const unit = select(UNITS, f0.unit, { 'aria-label': 'Unit' });
    const lead = h('span', null, 'Every'), tail = h('span', null, 'after I last did it');
    const everyRow = h('div', { class: 'mt-inline' }, lead, n, unit, tail);
    const limit = h('input', { type: 'checkbox', checked: !!f0.season });
    const sFrom = h('input', { type: 'date', value: dateFromMD(f0.season ? f0.season.from : '10-15') });
    const sTo = h('input', { type: 'date', value: dateFromMD(f0.season ? f0.season.to : '04-30') });
    const limitRow = h('div', { class: 'mt-limit' },
      h('label', { class: 'mt-check' }, limit, 'Only part of the year (for example the heating season)'),
      h('div', { class: 'mt-inline mt-limit-dates' }, h('span', null, 'From'), sFrom, h('span', null, 'to'), sTo, h('span', { class: 'mt-hint' }, 'Year is ignored')));
    const wFrom = h('input', { type: 'date', value: dateFromMD(f0.kind === 'season' ? f0.season.from : '04-01') });
    const wTo = h('input', { type: 'date', value: dateFromMD(f0.kind === 'season' ? f0.season.to : '04-30') });
    const seasonRow = h('div', { class: 'mt-inline mt-season-dates' }, h('span', null, 'From'), wFrom, h('span', null, 'to'), wTo, h('span', { class: 'mt-hint' }, 'Year is ignored'));
    const start = h('input', { type: 'date', value: t.start || todayISO() });
    const startLabel = h('span', { class: 'mt-label' });
    const time = h('input', { type: 'time', value: t.time || '' });
    const assignee = select(ASSIGNEES, t.assignee || 'Either');
    const room = select([['', '(none)'], ...(lookups.rooms || []).map(r => [r.id, r.name])], t.room || '');
    const pro = h('input', { type: 'checkbox', checked: Number(t.pro_only) === 1 });
    const cal = h('input', { type: 'checkbox', checked: Number(t.calendar) === 1 });
    const how = h('textarea', { rows: 3, placeholder: 'Notes, steps, product to use' }, t.how || '');
    const why = h('textarea', { rows: 2 }, t.why || '');
    const safety = h('textarea', { rows: 2 }, t.safety || '');
    const err = h('p', { class: 'mt-error', role: 'alert' });

    const sync = () => {
      const k = kind.value;
      everyRow.hidden = !(k === 'every' || k === 'after');
      lead.hidden = k === 'after';
      tail.hidden = k !== 'after';
      limitRow.hidden = k !== 'every';
      sFrom.parentElement.hidden = !(k === 'every' && limit.checked);
      seasonRow.hidden = k !== 'season';
      startLabel.textContent = k === 'once' ? 'Date' : k === 'yearly' ? 'Next date (repeats on this day each year)' : k === 'season' ? 'Start counting from' : k === 'after' ? 'First due' : 'First due (later dates count from here)';
    };
    for (const el of [kind, limit]) el.addEventListener('change', sync);
    sync();

    const save = async () => {
      err.textContent = '';
      const k = kind.value;
      if (!title.value.trim()) { err.textContent = 'Give it a name.'; title.focus(); return; }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start.value)) { err.textContent = 'Pick a date.'; start.focus(); return; }
      if ((k === 'every' || k === 'after') && !(Number(n.value) >= 1)) { err.textContent = 'How often needs a number, 1 or more.'; n.focus(); return; }
      let season = null;
      if (k === 'season') {
        if (!wFrom.value || !wTo.value) { err.textContent = 'Pick both window dates.'; return; }
        season = { from: mdOf(wFrom.value), to: mdOf(wTo.value) };
      } else if (k === 'every' && limit.checked) {
        if (!sFrom.value || !sTo.value) { err.textContent = 'Pick both dates for the part of the year.'; return; }
        season = { from: mdOf(sFrom.value), to: mdOf(sTo.value) };
      }
      const rule = formToRule({ kind: k, n: n.value, unit: unit.value, season });
      const row = {
        ...(task || {}),
        title: title.value.trim(), category: cat.value, subject: subject.value.trim(), rule: JSON.stringify(rule),
        start: start.value, time: time.value, assignee: assignee.value, room: room.value,
        pro_only: pro.checked ? 1 : 0, calendar: cal.checked ? 1 : 0, active: t.active == null ? 1 : t.active,
        how: how.value.trim(), why: why.value.trim(), safety: safety.value.trim(),
        source: t.source || 'user', seed_key: t.seed_key || '',
      };
      const saved = await HB.save('tasks', row);
      toast(isNew ? 'Added' : 'Saved');
      if (row.calendar || (task && Number(task.calendar) === 1)) callApi('syncCalendar').catch(() => { /* runs on the next sync anyway */ });
      close();
      return saved;
    };

    return h('form', { class: 'mt-form', onsubmit: e => { e.preventDefault(); save(); } },
      field('What is it?', title), field('Type', cat),
      field('Who or what is it for?', subject, 'Optional. A pet, a person, a car.'), subjList,
      field('How often', kind), everyRow, limitRow, seasonRow,
      h('label', { class: 'mt-field' }, startLabel, start),
      field('Time of day', time, 'Optional'), field('Whose job', assignee), field('Room', room),
      h('label', { class: 'mt-check' }, pro, 'Licensed pro only (gas, flue, main electrical, asbestos, lead)'),
      h('label', { class: 'mt-check' }, cal, 'Also put on Google Calendar'),
      field('Notes', how),
      h('details', { class: 'mt-more' }, h('summary', null, 'Why and safety notes'), field('Why it matters', why), field('Safety', safety)),
      err,
      h('div', { class: 'mt-actions mt-wrap' },
        !isNew && confirmButton('Delete', async () => { await HB.remove('tasks', task.id); toast('Deleted'); close(); }),
        !isNew && h('button', { type: 'button', class: 'mt-btn', onclick: async () => { await HB.save('tasks', { ...task, active: Number(task.active) === 0 ? 1 : 0 }); toast(Number(task.active) === 0 ? 'Resumed' : 'Paused'); close(); } }, Number(task.active) === 0 ? 'Resume' : 'Pause'),
        h('span', { class: 'mt-spacer' }),
        h('button', { type: 'button', class: 'mt-btn', onclick: close }, 'Cancel'),
        h('button', { type: 'submit', class: 'mt-btn mt-btn-primary' }, 'Save')));
  });
}
