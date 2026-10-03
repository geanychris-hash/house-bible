// Contacts: trades and companies, tap to call, last job, cost, would rehire.
import {
  HB, h, loadCss, openForm, mountView, register, emptyState, badge, pageHead, norm, fmtDate, money, byName,
} from './rooms-shared.js';
import { renderJobs } from './contacts-jobs.js';

loadCss('rooms');

const state = { q: '', trade: '' };
const telHref = p => 'tel:' + String(p || '').replace(/[^\d+]/g, '');

export async function editContact(c, onDone) {
  const fields = [
    { key: 'name', label: 'Name', required: true },
    { key: 'trade', label: 'Trade', placeholder: 'Plumber, electrician, heating' },
    { key: 'company', label: 'Company' },
    { key: 'phone', label: 'Phone', type: 'tel' },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'last_job', label: 'Last job' },
    { key: 'last_job_date', label: 'Last job date', type: 'date' },
    { key: 'cost', label: 'Cost of last job', type: 'num' },
    { key: 'would_rehire', label: 'Would hire again', type: 'bool' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ];
  return openForm({
    title: c && c.id ? 'Edit contact' : 'Add contact', fields, values: c || {},
    async onSubmit(out) { const r = await HB.save('contacts', { ...(c || {}), ...out }); onDone && onDone(r); },
    onDelete: c && c.id ? async () => { await HB.remove('contacts', c.id); } : null,
  });
}

// One contact card; also used by the Emergency screen.
export function contactCard(c, { editable = true } = {}) {
  const jobs = h('div', { class: 'rec-jobs' });
  try { Promise.resolve(renderJobs(c, jobs)).catch(() => {}); } catch { /* jobs are optional */ }
  return h('div', { class: 'rec-panel rec-contact' },
    h('div', { class: 'rec-row rec-between' },
      h('div', null, h('div', { class: 'rec-title' }, c.name), h('div', { class: 'rec-sub rec-muted' }, [c.trade, c.company].filter(Boolean).join(' / '))),
      Number(c.would_rehire) ? badge('Would rehire', 'rec-good') : null),
    h('div', { class: 'rec-row' },
      c.phone ? h('a', { class: 'rec-btn rec-primary', href: telHref(c.phone) }, 'Call ' + c.phone) : null,
      c.email ? h('a', { class: 'rec-btn', href: 'mailto:' + c.email }, 'Email') : null,
      editable ? h('button', { class: 'rec-btn', type: 'button', onclick: () => editContact(c) }, 'Edit') : null),
    (c.last_job || c.cost) ? h('p', { class: 'rec-sub rec-muted' }, ['Last job: ' + [c.last_job, fmtDate(c.last_job_date)].filter(Boolean).join(', '), c.cost ? money(c.cost) : ''].filter(Boolean).join(' / ')) : null,
    c.notes ? h('p', { class: 'rec-sub' }, c.notes) : null,
    jobs);
}

function build(rt, data) {
  const results = h('div');
  const search = h('input', { type: 'search', class: 'rec-search', placeholder: 'Search name, trade, company', 'aria-label': 'Search contacts', value: state.q });
  const tradeSel = h('select', { 'aria-label': 'Filter by trade' });
  search.addEventListener('input', () => { state.q = search.value; update(true); });
  tradeSel.addEventListener('change', () => { state.trade = tradeSel.value; update(true); });
  function update(skip) {
    const all = data.contacts || [];
    if (!skip) {
      const trades = [...new Set(all.map(c => (c.trade || '').trim()).filter(Boolean))].sort();
      tradeSel.replaceChildren(h('option', { value: '' }, 'All trades'), ...trades.map(t => h('option', { value: t }, t)));
      tradeSel.value = trades.includes(state.trade) ? state.trade : '';
    }
    if (!all.length) {
      results.replaceChildren(emptyState('No contacts yet', 'Add your plumber, electrician, heating pro, and the gas and electric utility emergency lines.',
        h('button', { class: 'rec-btn rec-primary', type: 'button', onclick: () => editContact(null) }, 'Add first contact')));
      return;
    }
    const q = norm(state.q);
    const shown = all.filter(c => (!state.trade || c.trade === state.trade) && (!q || norm([c.name, c.trade, c.company, c.notes, c.last_job].join(' ')).includes(q))).sort(byName());
    results.replaceChildren(shown.length ? h('div', { class: 'rec-list' }, shown.map(c => contactCard(c))) : emptyState('Nothing matches'));
  }
  return {
    node: h('div', { class: 'rec-view' }, pageHead('Contacts', h('button', { class: 'rec-btn rec-primary', type: 'button', onclick: () => editContact(null) }, 'Add contact')),
      h('div', { class: 'rec-toolbar' }, search, tradeSel), results),
    refresh: () => update(),
  };
}

register({ id: 'contacts', title: 'Contacts', icon: 'phone', order: 60, render(container) { return mountView(container, ['contacts'], build); } });
