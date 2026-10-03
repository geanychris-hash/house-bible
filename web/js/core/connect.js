// Connect screen: Apps Script URL, shared key, device label. Also reads a setup link.
import { registerView, navigate } from './router.js';
import * as auth from './auth.js';
import * as HB from './data.js';
import { h, toast, confirm } from './ui.js';

let pending = { url: '', key: '' };

// Call once at boot, before the router starts. If the address is a setup link
// (#/connect?u=...&k=...), keep the values in memory and take the key out of the address bar and history.
export function captureSetupLink() {
  const m = /^#\/connect\?(.*)$/.exec(location.hash);
  if (!m) return false;
  const q = {};
  new URLSearchParams(m[1]).forEach((v, k) => { q[k] = v; });
  pending = auth.parseSetupQuery(q);
  history.replaceState(null, '', location.pathname + location.search + '#/connect');
  return !!(pending.url || pending.key);
}

function render(container, ctx) {
  // Setup link opened while the app was already running (hash change, no page reload).
  if (ctx && (ctx.query.u || ctx.query.k)) {
    pending = auth.parseSetupQuery(ctx.query);
    history.replaceState(null, '', location.pathname + location.search + '#/connect');
  }
  const cfg = auth.getConfig();
  const fromLink = !!(pending.url && pending.key);
  const url = h('input', { id: 'c_url', type: 'url', inputmode: 'url', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', placeholder: 'https://script.google.com/macros/s/.../exec', value: pending.url || (cfg && cfg.url) || '' });
  const key = h('input', { id: 'c_key', type: 'password', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', value: pending.key || '' , placeholder: cfg ? 'Leave blank to keep the saved key' : 'The shared key' });
  const dev = h('input', { id: 'c_dev', type: 'text', autocomplete: 'off', maxlength: '40', placeholder: 'Chris-phone', value: (cfg && cfg.device) || '' });
  const msg = h('p', { class: 'form-error', role: 'alert' });
  const go = h('button', { class: 'btn primary', type: 'submit' }, 'Test and save');

  const form = h('form', { class: 'list', onsubmit: async e => {
    e.preventDefault();
    msg.textContent = ''; msg.classList.remove('ok');
    const next = { url: url.value, key: key.value || (cfg && cfg.key) || '', device: dev.value };
    if (!auth.normalizeUrl(next.url)) { msg.textContent = 'The address should start with https:// (or http://localhost for testing).'; url.focus(); return; }
    if (!next.key) { msg.textContent = 'Enter the shared key.'; key.focus(); return; }
    if (!next.device.trim()) { msg.textContent = 'Give this device a short name, like Chris-phone.'; dev.focus(); return; }
    go.disabled = true; go.textContent = 'Testing...';
    try {
      await auth.testConnection(next);
      await auth.saveConfig(next);
      pending = { url: '', key: '' };
      toast('Connected');
      HB.reconfigure();
      navigate('', { replace: false });
    } catch (err) {
      msg.textContent = err.code === 'auth' ? 'The server did not accept that key.'
        : err.code === 'network' ? 'Could not reach that address. Check it and your connection.'
        : err.code === 'bad_response' ? 'That address answered, but not like House Bible. Use the link that ends in /exec.'
        : (err.message || 'That did not work.');
    } finally { go.disabled = false; go.textContent = 'Test and save'; }
  } },
    h('div', { class: 'field wide' }, h('label', { for: 'c_url' }, 'Apps Script address'), url),
    h('div', { class: 'field wide' }, h('label', { for: 'c_key' }, 'Shared key'), key),
    h('div', { class: 'field wide' }, h('label', { for: 'c_dev' }, 'This device\'s name'), dev,
      h('small', { class: 'muted' }, 'Shown as "last edited by" on changes you make. Example: Chris-phone, Wife-iPhone.')),
    msg, h('div', { class: 'row' }, go));

  const panels = [
    h('section', { class: 'panel' },
      h('header', null, h('h2', null, cfg ? 'Connection' : 'Connect this device')),
      cfg ? h('p', { class: 'muted' }, `Connected as ${cfg.device}. You can change the details below.`)
        : h('p', null, fromLink ? 'Your setup link filled in the address and key. Name this device and tap Test and save.' : 'Paste the address and key Chris was given. You only do this once per device.'),
      form),
  ];
  if (cfg) {
    panels.push(h('section', { class: 'panel' },
      h('header', null, h('h3', null, 'Set up another device')),
      h('p', { class: 'muted' }, 'This makes one link that fills in the address and key on the other device. The key is inside the link, so send it privately (a direct message, not a group chat or a public post) and delete the message afterwards.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn', type: 'button', onclick: async () => {
          const base = location.origin + location.pathname;
          const link = auth.buildSetupLink(base, cfg);
          try { await navigator.clipboard.writeText(link); toast('Setup link copied'); }
          catch { toast('Could not copy. Copy is blocked in this browser.'); }
        } }, 'Copy setup link'))));
    panels.push(h('section', { class: 'panel' },
      h('header', null, h('h3', null, 'Disconnect')),
      h('p', { class: 'muted' }, 'Forgets the address and key on this device. Saved data stays on the device but will not sync until you connect again.'),
      h('button', { class: 'btn danger', type: 'button', onclick: async () => {
        if (await confirm('Disconnect this device?', { yes: 'Disconnect', danger: true })) { await auth.clearConfig(); toast('Disconnected'); navigate('connect'); }
      } }, 'Disconnect')));
  }
  container.replaceChildren(h('div', { class: 'list narrow' }, panels));
  (cfg ? url : (fromLink ? dev : url)).focus();
}

export function registerConnect() {
  registerView({ id: 'connect', title: 'Connect', icon: 'sync', order: 999, hidden: true, render });
}
