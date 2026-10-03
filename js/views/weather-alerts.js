// Weather alerts: edits settings.alerts rules and settings.notify emails (CONTRACT section 6).
// The server (Apps Script) does the checking and emailing; this screen only edits the settings.
import { registerView } from '../core/router.js';
import { HB, h, ensureCss, toast, field, select, jsonOf, callApi, confirmButton } from './maintenance-ui.js';

const METRICS = [['minTempF', 'Lowest temperature (F)'], ['maxTempF', 'Highest temperature (F)'], ['snowIn', 'Snow (inches)'], ['windMph', 'Wind (mph)'], ['rainIn', 'Rain (inches)']];
const OPS = [['<=', 'is at or below'], ['>=', 'is at or above'], ['<', 'is below'], ['>', 'is above']];

export const DEFAULT_RULES = [
  { id: 'freeze', label: 'Freeze', metric: 'minTempF', op: '<=', value: 28, hoursAhead: 48, message: 'Freeze coming: drain/cover hose bibs, check exposed pipes.', enabled: true },
  { id: 'deep-cold', label: 'Deep cold', metric: 'minTempF', op: '<=', value: 10, hoursAhead: 48, message: 'Deep cold coming: open cabinets on exterior walls, let a faucet drip, keep the basement heated.', enabled: false },
  { id: 'heat', label: 'Heat', metric: 'maxTempF', op: '>=', value: 90, hoursAhead: 48, message: 'Hot days coming: check window AC units and fans.', enabled: false },
  { id: 'snow', label: 'Heavy snow', metric: 'snowIn', op: '>=', value: 6, hoursAhead: 48, message: 'Heavy snow coming: clear vents and exhausts at the house, watch for ice dams afterward.', enabled: false },
  { id: 'wind', label: 'High wind', metric: 'windMph', op: '>=', value: 45, hoursAhead: 48, message: 'High wind coming: secure outdoor items, check for loose limbs.', enabled: false },
  { id: 'rain', label: 'Heavy rain', metric: 'rainIn', op: '>=', value: 2, hoursAhead: 48, message: 'Heavy rain coming: check gutters and downspouts, test the sump pump.', enabled: false },
];

export const parseEmails = text => [...new Set(String(text || '').split(/[\s,;]+/).map(s => s.trim()).filter(Boolean))];
export const validEmail = s => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

export function render(container) {
  ensureCss('maintenance.css');
  const root = h('div', { class: 'mt-root' });
  container.replaceChildren(root);
  const body = h('div', { class: 'mt-body' });
  root.append(
    h('div', { class: 'mt-head' }, h('div', { class: 'mt-head-row' }, h('h1', null, 'Weather alerts')),
      h('nav', { class: 'mt-links', 'aria-label': 'Related' }, h('a', { href: '#/maintenance' }, 'Back to maintenance'))),
    body);
  let rules = [], notify = {}, alertsRow = null, notifyRow = null, dirty = false;

  const ruleCard = (r, i) => {
    const num = (v, k, attrs) => { const el = h('input', { type: 'number', value: v, step: 'any', ...attrs }); el.addEventListener('input', () => { r[k] = el.value === '' ? '' : Number(el.value); dirty = true; }); return el; };
    const txt = (v, k, attrs) => { const el = h('input', { type: 'text', value: v || '', ...attrs }); el.addEventListener('input', () => { r[k] = el.value; dirty = true; }); return el; };
    const sel = (opts, v, k) => { const el = select(opts, v); el.addEventListener('change', () => { r[k] = el.value; dirty = true; }); return el; };
    const on = h('input', { type: 'checkbox', checked: !!r.enabled }); on.addEventListener('change', () => { r.enabled = on.checked; dirty = true; });
    return h('article', { class: 'mt-card mt-rule' },
      h('label', { class: 'mt-check' }, on, h('strong', null, 'On')),
      field('Name', txt(r.label, 'label', { placeholder: 'e.g. Freeze' })),
      h('div', { class: 'mt-inline' }, h('span', null, 'Alert when'), sel(METRICS, r.metric, 'metric'), sel(OPS, r.op, 'op'), num(r.value, 'value', { 'aria-label': 'Value' })),
      h('div', { class: 'mt-inline' }, h('span', null, 'looking ahead'), num(r.hoursAhead, 'hoursAhead', { min: '1', max: '168', 'aria-label': 'Hours ahead' }), h('span', null, 'hours')),
      field('Message in the email', txt(r.message, 'message', { maxlength: 200 })),
      confirmButton('Delete rule', () => { rules.splice(i, 1); dirty = true; draw(); }, 'mt-btn mt-btn-small mt-btn-danger'));
  };

  function draw() {
    const emails = h('textarea', { rows: 2, placeholder: 'name@example.com, other@example.com', 'aria-label': 'Email addresses' }, (notify.emails || []).join(', '));
    const err = h('p', { class: 'mt-error', role: 'alert' });
    const saveAll = async () => {
      err.textContent = '';
      const list = parseEmails(emails.value), bad = list.find(e => !validEmail(e));
      if (bad) { err.textContent = `"${bad}" does not look like an email address.`; return false; }
      for (const r of rules) {
        if (!(r.label || '').trim()) { err.textContent = 'Every rule needs a name.'; return false; }
        if (r.value === '' || isNaN(Number(r.value))) { err.textContent = `"${r.label}" needs a number to compare to.`; return false; }
        if (!(Number(r.hoursAhead) >= 1)) { err.textContent = `"${r.label}" needs hours ahead (1 or more).`; return false; }
        if (!r.id) r.id = r.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).slice(2, 5);
      }
      await HB.save('settings', { ...(alertsRow || {}), id: 'alerts', key: 'alerts', value: JSON.stringify({ rules }) });
      notify = { ...notify, emails: list };
      await HB.save('settings', { ...(notifyRow || {}), id: 'notify', key: 'notify', value: JSON.stringify(notify) });
      dirty = false; toast('Saved');
      return true;
    };
    const test = h('button', { type: 'button', class: 'mt-btn', onclick: async () => {
      if (!(await saveAll())) return;
      if (!notify.emails.length) { err.textContent = 'Add at least one email address first.'; return; }
      test.disabled = true; test.textContent = 'Sending';
      try { await HB.syncNow(); const r = await callApi('testAlert'); toast(r && r.ok === false ? `Could not send: ${r.message || r.error}` : 'Test alert sent. Check your email.'); }
      catch (e) { toast(`Could not send: ${e.message}`); }
      test.disabled = false; test.textContent = 'Send test alert';
    } }, 'Send test alert');
    body.replaceChildren(
      h('p', { class: 'mt-muted' }, 'The server checks the National Weather Service forecast for your house once a day at 4 pm. When a rule matches, it emails everyone below and adds an all-day event to the House Bible calendar. One alert per rule per day.'),
      h('section', { class: 'mt-section' }, h('h2', null, 'Who gets the email'),
        field('Email addresses', emails, 'Separate with commas'), ),
      h('section', { class: 'mt-section' }, h('h2', null, 'Rules', h('span', { class: 'mt-count' }, rules.length)),
        rules.map(ruleCard),
        h('button', { type: 'button', class: 'mt-btn', onclick: () => { rules.push({ id: '', label: '', metric: 'minTempF', op: '<=', value: 32, hoursAhead: 48, message: '', enabled: true }); dirty = true; draw(); } }, 'Add a rule')),
      err,
      h('div', { class: 'mt-actions mt-wrap' }, test, h('span', { class: 'mt-spacer' }),
        h('button', { type: 'button', class: 'mt-btn mt-btn-primary', onclick: saveAll }, 'Save')),
      h('p', { class: 'mt-hint' }, 'The location comes from your house settings (latitude and longitude).'));
  }

  Promise.all([HB.get('settings', 'alerts'), HB.get('settings', 'notify')]).then(([a, n]) => {
    alertsRow = a; notifyRow = n;
    const saved = a && jsonOf(a.value, null);
    rules = saved && Array.isArray(saved.rules) && saved.rules.length ? saved.rules.map(r => ({ ...r })) : DEFAULT_RULES.map(r => ({ ...r }));
    notify = (n && jsonOf(n.value, {})) || {};
    if (!Array.isArray(notify.emails)) notify.emails = [];
    draw();
  });
  return () => { /* no subscriptions */ };
}

registerView({ id: 'weather-alerts', title: 'Weather alerts', icon: 'cloud', order: 14, render });
