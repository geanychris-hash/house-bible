// Pure grouping helpers for service history and contractor jobs (G2). No DOM, no storage.
const live = r => r && !Number(r.deleted);
const num = v => (v == null || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v));
const newestFirst = (a, b) => String(b.date || '').localeCompare(String(a.date || '')) || String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
// Done entries only: skips and snoozes are logged in task_log too (note starts with a marker).
const isDoneLog = l => !/^\s*\[(skip|snooze)/i.test(String(l.note || ''));

/** task_log rows whose task is linked to this asset, newest first. Each: {kind:'task', id, date, note, cost, contact, title}. */
export function serviceHistory(assetId, tasks, logs) {
  const mine = new Map((tasks || []).filter(t => t && t.asset === assetId).map(t => [t.id, t]));
  return (logs || []).filter(l => live(l) && mine.has(l.task) && isDoneLog(l))
    .map(l => ({ kind: 'task', id: l.id, date: l.date || '', note: l.note || '', cost: l.cost == null || l.cost === '' ? null : num(l.cost), contact: l.contact || '', title: mine.get(l.task).title || 'Task', updatedAt: l.updatedAt }))
    .sort(newestFirst);
}

/** Jobs for a contact: task_log + expenses where contact = id, newest first, with lifetime total. */
export function jobsFor(contactId, tasks, logs, expenses) {
  const titles = new Map((tasks || []).map(t => [t.id, t.title]));
  const a = (logs || []).filter(l => live(l) && l.contact === contactId && isDoneLog(l))
    .map(l => ({ kind: 'task', id: l.id, date: l.date || '', note: l.note || '', cost: l.cost == null || l.cost === '' ? null : num(l.cost), title: titles.get(l.task) || 'Task', updatedAt: l.updatedAt }));
  const b = (expenses || []).filter(x => live(x) && x.contact === contactId)
    .map(x => ({ kind: 'expense', id: x.id, date: x.date || '', note: x.notes || '', cost: x.amount == null || x.amount === '' ? null : num(x.amount), title: x.item || 'Expense', updatedAt: x.updatedAt }));
  const rows = a.concat(b).sort(newestFirst);
  return { rows, total: rows.reduce((s, r) => s + num(r.cost), 0) };
}
