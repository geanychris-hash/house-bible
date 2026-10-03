// Jobs done by a contact (gap 2). Owned by G2.
// renderJobs(contact, el): task_log and expenses rows that reference this contact, newest first, with lifetime total.
import { HB, h, money } from './maintenance-ui.js';
import { fmtDate } from '../core/recur.js';
import { jobsFor } from './service-logic.js';

export async function renderJobs(contact, el) {
  const draw = async () => {
    const [tasks, logs, expenses] = await Promise.all(['tasks', 'task_log', 'expenses'].map(t => HB.list(t)));
    const { rows, total } = jobsFor(contact.id, tasks, logs, expenses);
    if (!rows.length) { el.replaceChildren(h('p', { class: 'rec-sub rec-muted' }, 'No jobs linked yet. Pick this contact when you mark a task done or add an expense.')); return; }
    el.replaceChildren(
      h('details', null,
        h('summary', null, `${rows.length} job${rows.length === 1 ? '' : 's'} · ${money(total) || '$0.00'} total`),
        h('ul', { class: 'rec-list' }, rows.map(r => h('li', { class: 'rec-item' },
          h('span', { class: 'rec-grow' },
            h('span', { class: 'rec-title' }, `${fmtDate(r.date)} · ${r.title}`),
            h('span', { class: 'rec-sub' }, r.kind === 'expense' ? 'Expense' : 'Maintenance', r.note ? ` · ${r.note}` : '')),
          r.cost != null ? h('strong', null, money(r.cost)) : null)))));
  };
  const open = () => el.querySelector('details')?.open;
  const redraw = async () => { const was = open(); await draw(); if (was) el.querySelector('details')?.setAttribute('open', ''); };
  await draw();
  const unsubs = ['task_log', 'expenses', 'tasks'].map(t => HB.subscribe(t, redraw));
  const obs = new MutationObserver(() => { if (!el.isConnected) { unsubs.forEach(u => u && u()); obs.disconnect(); } });
  obs.observe(document.body, { childList: true, subtree: true });
}
