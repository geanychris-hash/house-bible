// Service history on the asset detail page (gap 2). Owned by G2.
// renderServiceHistory(asset, el): done-task log entries for tasks linked to this asset, newest first,
// with date, note, cost and the contractor (links to the contacts screen). The caller does not await it.
import { HB, h, money } from './maintenance-ui.js';
import { fmtDate } from '../core/recur.js';
import { serviceHistory } from './service-logic.js';

export async function renderServiceHistory(asset, el) {
  const draw = async () => {
    const [tasks, logs, contacts] = await Promise.all(['tasks', 'task_log', 'contacts'].map(t => HB.list(t)));
    const names = new Map(contacts.filter(c => !Number(c.deleted)).map(c => [c.id, c.name]));
    const rows = serviceHistory(asset.id, tasks, logs);
    el.replaceChildren(h('h3', null, 'Service history'),
      rows.length ? h('ul', { class: 'rec-list' }, rows.map(r => h('li', { class: 'rec-item' },
        h('span', { class: 'rec-grow' },
          h('span', { class: 'rec-title' }, `${fmtDate(r.date)} · ${r.title}`),
          r.note ? h('span', { class: 'rec-sub' }, r.note) : null,
          r.contact && names.has(r.contact) ? h('span', { class: 'rec-sub' }, 'By ', h('a', { href: '#/contacts' }, names.get(r.contact))) : null),
        r.cost != null ? h('strong', null, money(r.cost)) : null)))
        : h('p', { class: 'rec-sub rec-muted' }, 'No service recorded yet. When you mark a linked maintenance task done, it shows up here.'));
  };
  await draw();
  const unsubs = ['tasks', 'task_log', 'contacts'].map(t => HB.subscribe(t, draw));
  const obs = new MutationObserver(() => { if (!el.isConnected) { unsubs.forEach(u => u && u()); obs.disconnect(); } });
  obs.observe(document.body, { childList: true, subtree: true });
}
