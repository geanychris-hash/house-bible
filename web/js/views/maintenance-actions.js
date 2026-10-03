// Task card plus the Done / Snooze / Skip / Details dialogs for the maintenance screen.
import { HB, h, toast, openModal, field, todayISO, who, uploadPhotos, money, jsonOf, confirmButton } from './maintenance-ui.js';
import { ruleText, fmtDate, makeLogNote, logKind, logText, snoozeUntil, addDays, parseRule } from '../core/recur.js';
import { openTaskForm } from './maintenance-form.js';

export const CATS = { house: 'House', steam: 'Steam heat', yard: 'Yard', safety: 'Safety', pet: 'Pet', vehicle: 'Vehicle', health: 'Health', other: 'Other' };
export const catName = c => CATS[c] || 'Other';

const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
/** Plain-language due line for a status object from taskStatus(). */
export function dueText(st) {
  if (st.state === 'inactive') return 'Paused';
  if (st.state === 'done') return st.lastDone ? `Done ${fmtDate(st.lastDone)}` : 'Done';
  if (st.state === 'overdue') return st.windowEnd ? `Missed the window that ended ${fmtDate(st.windowEnd)}` : `${plural(st.overdueDays, 'day')} overdue (was ${fmtDate(st.due)})`;
  if (st.windowEnd && st.days <= 0) return `Open now, until ${fmtDate(st.windowEnd)}`;
  const when = st.days === 0 ? 'Today' : st.days === 1 ? 'Tomorrow' : `In ${plural(st.days, 'day')}`;
  return `${st.snoozedUntil ? 'Snoozed to ' : 'Due '}${fmtDate(st.due)} (${when.toLowerCase()})`;
}

export async function markDone(task, { date, note = '', cost = null, photos = [], contact = '', silent = false } = {}) {
  const row = await HB.save('task_log', {
    task: task.id, date: date || todayISO(), by: who(), note, cost: cost == null || cost === '' ? null : Number(cost),
    photos: JSON.stringify(photos), ...(contact ? { contact } : {}),
  });
  if (!silent) toast(`Done: ${task.title}`, { label: 'Undo', fn: () => HB.remove('task_log', row.id) });
  return row;
}

export function openDoneDialog(task) {
  openModal('Mark done', close => {
    const date = h('input', { type: 'date', value: todayISO(), max: todayISO() });
    const note = h('textarea', { rows: 3, placeholder: 'What you did, what you found (optional)' });
    const cost = h('input', { type: 'number', inputmode: 'decimal', step: '0.01', min: '0', placeholder: '0.00' });
    const photos = h('input', { type: 'file', accept: 'image/*', multiple: true });
    const contact = h('select', { 'aria-label': 'Contractor' }, h('option', { value: '' }, '(none, did it myself)'));
    HB.list('contacts').then(rows => rows.filter(c => !Number(c.deleted)).sort((a, b) => String(a.name).localeCompare(String(b.name)))
      .forEach(c => contact.append(h('option', { value: c.id }, c.name + (c.trade ? ` (${c.trade})` : '')))));
    const save = h('button', { type: 'button', class: 'mt-btn mt-btn-primary', onclick: async () => {
      save.disabled = true; save.textContent = 'Saving';
      const ids = await uploadPhotos(photos.files, 'general');
      await markDone(task, { date: date.value || todayISO(), note: note.value.trim(), cost: cost.value, photos: ids, contact: contact.value });
      close();
    } }, 'Save');
    return h('div', { class: 'mt-form' }, h('p', { class: 'mt-muted' }, task.title),
      field('Date done', date), field('Note', note), field('Cost ($)', cost), field('Contractor', contact, 'Optional. Links this job to their contact page.'), field('Photos', photos),
      h('div', { class: 'mt-actions' }, h('button', { type: 'button', class: 'mt-btn', onclick: close }, 'Cancel'), save));
  });
}

/** mode 'snooze' (ask again on a later date) or 'skip' (skip this one, schedule moves on). A reason is required. */
export function openDeferDialog(task, mode) {
  const snooze = mode === 'snooze';
  openModal(snooze ? 'Snooze' : 'Skip this time', close => {
    const until = h('input', { type: 'date', value: addDays(todayISO(), 7), min: addDays(todayISO(), 1) });
    const why = h('input', { type: 'text', placeholder: 'Reason (required)', required: true });
    const chips = [['Tomorrow', 1], ['1 week', 7], ['2 weeks', 14], ['1 month', 30]].map(([l, n]) =>
      h('button', { type: 'button', class: 'mt-chip', onclick: () => { until.value = addDays(todayISO(), n); } }, l));
    const err = h('p', { class: 'mt-error', role: 'alert' });
    const save = h('button', { type: 'button', class: 'mt-btn mt-btn-primary', onclick: async () => {
      if (!why.value.trim()) { err.textContent = 'Please add a short reason.'; why.focus(); return; }
      if (snooze && !(until.value > todayISO())) { err.textContent = 'Pick a date after today.'; return; }
      await HB.save('task_log', { task: task.id, date: todayISO(), by: who(), note: makeLogNote(mode, why.value, until.value), cost: null, photos: '[]' });
      toast(snooze ? `Snoozed to ${fmtDate(until.value)}` : 'Skipped');
      close();
    } }, snooze ? 'Snooze' : 'Skip');
    return h('div', { class: 'mt-form' }, h('p', { class: 'mt-muted' }, task.title),
      snooze && field('Remind me on', until), snooze && h('div', { class: 'mt-chips' }, chips),
      field('Reason', why), err,
      h('div', { class: 'mt-actions' }, h('button', { type: 'button', class: 'mt-btn', onclick: close }, 'Cancel'), save));
  });
}

/** Full details, history and the less common actions. ctx: {logs() -> all task_log rows, lookups} */
export function openDetail(task, ctx) {
  openModal(task.title, close => {
    const body = h('div', { class: 'mt-detail' });
    const draw = () => {
      body.replaceChildren();
      const mine = ctx.logs().filter(l => l.task === task.id && !Number(l.deleted)).sort((a, b) => (b.date + b.updatedAt).toString().localeCompare((a.date + a.updatedAt).toString()));
      const rule = parseRule(task.rule);
      body.append(
        h('p', { class: 'mt-muted' }, [catName(task.category), task.subject && `for ${task.subject}`, ruleText(rule), task.assignee && `assigned to ${task.assignee}`].filter(Boolean).join(' · ')),
        Number(task.pro_only) ? h('p', { class: 'mt-callout mt-callout-pro' }, 'Licensed pro only. Do not do this yourself.') : null,
        task.safety ? h('p', { class: 'mt-callout' }, h('strong', null, 'Safety: '), task.safety) : null,
        task.why ? h('p', null, h('strong', null, 'Why: '), task.why) : null,
        task.how ? h('p', null, h('strong', null, 'How: '), task.how) : null,
        h('div', { class: 'mt-actions mt-wrap' },
          h('button', { type: 'button', class: 'mt-btn mt-btn-primary', onclick: () => { close(); openDoneDialog(task); } }, 'Done, with details'),
          h('button', { type: 'button', class: 'mt-btn', onclick: () => { close(); openDeferDialog(task, 'snooze'); } }, 'Snooze'),
          h('button', { type: 'button', class: 'mt-btn', onclick: () => { close(); openDeferDialog(task, 'skip'); } }, 'Skip this time'),
          h('button', { type: 'button', class: 'mt-btn', onclick: () => { close(); openTaskForm(task, ctx.lookups()); } }, 'Edit'),
          h('button', { type: 'button', class: 'mt-btn', onclick: async () => { await HB.save('tasks', { ...task, active: Number(task.active) === 0 ? 1 : 0 }); toast(Number(task.active) === 0 ? 'Resumed' : 'Paused'); close(); } },
            Number(task.active) === 0 ? 'Resume' : 'Pause')),
        h('h3', null, 'History'),
        mine.length ? h('ul', { class: 'mt-history' }, mine.map(l => {
          const k = logKind(l), photos = jsonOf(l.photos, []);
          return h('li', null,
            h('span', { class: 'mt-hist-main' }, `${fmtDate(l.date)} `,
              k === 'skip' ? h('em', null, 'skipped') : k === 'snooze' ? h('em', null, `snoozed to ${fmtDate(snoozeUntil(l))}`) : h('strong', null, 'done'),
              l.by ? ` by ${l.by}` : '', l.cost ? ` · ${money(l.cost)}` : '', photos.length ? ` · ${plural(photos.length, 'photo')}` : '',
              logText(l) ? h('span', { class: 'mt-hist-note' }, logText(l)) : null),
            confirmButton('Remove', async () => { await HB.remove('task_log', l.id); toast('Removed'); }, 'mt-btn mt-btn-small mt-btn-danger'));
        })) : h('p', { class: 'mt-muted' }, 'Nothing logged yet.'));
    };
    draw();
    const unsub = HB.subscribe('task_log', draw);
    const obs = new MutationObserver(() => { if (!body.isConnected) { unsub(); obs.disconnect(); } });
    obs.observe(document.body, { childList: true, subtree: true });
    return body;
  });
}

/** One task as a card. st is taskStatus(); ctx as for openDetail. */
export function taskCard(task, st, ctx, { showDone = true } = {}) {
  const pro = Number(task.pro_only) === 1;
  const room = ctx.roomName && task.room ? ctx.roomName(task.room) : '';
  return h('article', { class: `mt-card mt-${st.state}`, 'data-id': task.id },
    h('div', { class: 'mt-card-main', role: 'button', tabindex: '0', onclick: () => openDetail(task, ctx), onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(task, ctx); } } },
      h('div', { class: 'mt-card-title' }, task.title),
      h('div', { class: 'mt-card-sub' }, [catName(task.category), task.subject && `for ${task.subject}`, room, task.assignee && task.assignee.toLowerCase() !== 'either' && task.assignee].filter(Boolean).join(' · ')),
      h('div', { class: 'mt-card-due' }, dueText(st), ' · ', ruleText(task.rule)),
      pro ? h('span', { class: 'mt-badge mt-badge-pro' }, 'Licensed pro') : null),
    showDone && st.state !== 'inactive' && st.state !== 'done'
      ? h('button', { type: 'button', class: 'mt-btn mt-btn-primary mt-done', 'aria-label': `Mark done: ${task.title}`, onclick: () => markDone(task) }, 'Done')
      : null);
}
