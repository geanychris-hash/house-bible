// Encrypted notes. The sheet only ever holds ciphertext (CONTRACT section 7). Passphrase is typed per device.
import {
  HB, h, loadCss, modal, mountView, register, emptyState, pageHead, toast, confirmDialog, lsGet, lsSet, parseJSON,
} from './rooms-shared.js';
import { deriveKey, encryptText, decryptText, makeCheck, verifyCheck, newSalt } from './sensitive-crypto.js';

loadCss('rooms', 'sensitive');

const TIMEOUTS = [[1, '1 minute'], [5, '5 minutes'], [15, '15 minutes'], [30, '30 minutes'], [60, '1 hour']];

// ---------- key in memory, optional remembered key in IndexedDB ----------
let memKey = null;          // CryptoKey or null
let autoUnlockTried = false;
let lockTimer = null;
const listeners = new Set();
const notify = () => listeners.forEach(fn => fn());
const timeoutMin = () => Number(lsGet('hb.sens.timeout', '5')) || 5;

function armTimer() {
  clearTimeout(lockTimer);
  if (memKey && !isRemembered()) lockTimer = setTimeout(() => lock('Locked after being idle.'), timeoutMin() * 60000);
}
function lock(msg) {
  memKey = null; autoUnlockTried = true; clearTimeout(lockTimer);
  if (msg) toast(msg);
  notify();
}
const isRemembered = () => lsGet('hb.sens.remember', '') === '1';
['pointerdown', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, () => { if (memKey) armTimer(); }, { passive: true }));

let kdbP = null;
function keyDb() {
  return kdbP || (kdbP = new Promise((res, rej) => {
    try { const r = indexedDB.open('hb.s4.keystore', 1); r.onupgradeneeded = () => r.result.createObjectStore('k'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e) { rej(e); }
  }));
}
async function idbKey(op, value) {
  try {
    const db = await keyDb();
    return await new Promise((res, rej) => {
      const tx = db.transaction('k', op === 'get' ? 'readonly' : 'readwrite');
      const st = tx.objectStore('k');
      const r = op === 'get' ? st.get('key') : op === 'put' ? st.put(value, 'key') : st.delete('key');
      r.onsuccess = () => res(r.result || null); r.onerror = () => rej(r.error);
    });
  } catch { return null; }
}
async function remember(key, salt) { const ok = await idbKey('put', { key, salt }); lsSet('hb.sens.remember', ok === null ? '' : '1'); }
async function forget() { await idbKey('del'); lsSet('hb.sens.remember', ''); memKey = null; notify(); }

// ---------- settings.crypto ----------
const cryptoRow = settings => (settings || []).find(s => s.id === 'crypto' || s.key === 'crypto');
const cryptoConf = row => { const v = row ? parseJSON(row.value, null) : null; return v && v.salt ? v : null; };

async function setupPassphrase(pass) {
  try { await HB.syncNow(); } catch { /* offline: fine */ }
  const latest = cryptoConf(cryptoRow(await HB.list('settings')));
  if (latest) throw new Error('Another device already set a passphrase. Reload and unlock with that one.');
  const salt = newSalt();
  const key = await deriveKey(pass, salt);
  const check = await makeCheck(key);
  await HB.save('settings', { id: 'crypto', key: 'crypto', value: JSON.stringify({ salt, check }) });
  return { key, salt };
}

// ---------- screens ----------
function warnings() {
  return h('div', { class: 'rec-note' },
    h('p', null, h('strong', null, 'If you lose the passphrase, these notes cannot be recovered. '), 'Nobody can reset it, not even Google or the app.'),
    h('p', null, 'Account passwords belong in a password manager. Use this for things like alarm codes, safe combinations and lockbox codes.'),
    h('p', null, 'The label and hint of each note are stored in plain text. Keep secrets in the note body only.'));
}

function setupScreen(done) {
  const p1 = h('input', { type: 'password', autocomplete: 'new-password', 'aria-label': 'Passphrase' });
  const p2 = h('input', { type: 'password', autocomplete: 'new-password', 'aria-label': 'Repeat passphrase' });
  const rem = h('input', { type: 'checkbox' });
  const err = h('p', { class: 'rec-error', role: 'alert' });
  const btn = h('button', { class: 'rec-btn rec-primary', type: 'submit' }, 'Create passphrase');
  const form = h('form', { class: 'rec-stack', onsubmit: async e => {
    e.preventDefault(); err.textContent = '';
    if (p1.value.length < 8) { err.textContent = 'Use at least 8 characters. A few random words works well.'; return; }
    if (p1.value !== p2.value) { err.textContent = 'The two entries do not match.'; return; }
    btn.disabled = true; btn.textContent = 'Working…';
    try {
      const { key, salt } = await setupPassphrase(p1.value);
      memKey = key; armTimer();
      if (rem.checked) await remember(key, salt);
      done();
    } catch (ex) { err.textContent = ex.message; btn.disabled = false; btn.textContent = 'Create passphrase'; }
  } },
  h('p', null, 'Pick one household passphrase. Both of you type the same one on each device.'),
  h('label', null, 'Passphrase', p1), h('label', null, 'Repeat passphrase', p2),
  h('label', { class: 'rec-row' }, rem, 'Remember on this device'),
  err, btn);
  return h('div', { class: 'rec-stack' }, warnings(), h('div', { class: 'rec-panel' }, form));
}

function unlockScreen(conf, done) {
  const p = h('input', { type: 'password', autocomplete: 'current-password', 'aria-label': 'Passphrase' });
  const rem = h('input', { type: 'checkbox', checked: isRemembered() });
  const err = h('p', { class: 'rec-error', role: 'alert' });
  const btn = h('button', { class: 'rec-btn rec-primary', type: 'submit' }, 'Unlock');
  const form = h('form', { class: 'rec-stack', onsubmit: async e => {
    e.preventDefault(); err.textContent = '';
    if (!p.value) { err.textContent = 'Enter the passphrase.'; return; }
    btn.disabled = true; btn.textContent = 'Checking…';
    try {
      const key = await deriveKey(p.value, conf.salt);
      if (!(await verifyCheck(key, conf.check))) { err.textContent = 'That passphrase is not right.'; return; }
      memKey = key; armTimer();
      if (rem.checked) await remember(key, conf.salt); else if (isRemembered()) await forget();
      p.value = '';
      done();
    } catch (ex) { err.textContent = 'Could not unlock: ' + ex.message; }
    finally { btn.disabled = false; btn.textContent = 'Unlock'; }
  } },
  h('label', null, 'Passphrase', p),
  h('label', { class: 'rec-row' }, rem, 'Remember on this device (skips the passphrase here)'),
  err, btn);
  return h('div', { class: 'rec-stack' }, h('div', { class: 'rec-panel' }, h('h3', null, 'Locked'), form), warnings());
}

async function editNote(item) {
  let text = '';
  if (item && item.id) {
    try { text = await decryptText(memKey, item.ciphertext, item.iv); } catch { toast('Could not decrypt this note with the current passphrase.'); return; }
  }
  const label = h('input', { type: 'text', value: item ? item.label : '', 'aria-label': 'Label', placeholder: 'Safe combination' });
  const hint = h('input', { type: 'text', value: item ? item.hint : '', 'aria-label': 'Hint', placeholder: 'Optional, shown while locked' });
  const body = h('textarea', { rows: 6, 'aria-label': 'Secret note', value: text });
  const err = h('p', { class: 'rec-error', role: 'alert' });
  modal(item && item.id ? 'Edit secret note' : 'New secret note', close => h('form', { class: 'rec-stack', onsubmit: async e => {
    e.preventDefault(); err.textContent = '';
    if (!label.value.trim()) { err.textContent = 'Give it a label.'; return; }
    if (!memKey) { err.textContent = 'Locked. Unlock first.'; return; }
    try {
      const { ciphertext, iv } = await encryptText(memKey, body.value);
      await HB.save('sensitive', { ...(item || {}), label: label.value.trim(), hint: hint.value.trim(), ciphertext, iv });
      close();
    } catch (ex) { err.textContent = 'Could not save: ' + ex.message; }
  } },
  h('div', { class: 'rec-note rec-bad' }, h('p', null, 'Label and hint are plain text. Put the secret only in the note below.')),
  h('label', null, 'Label', label), h('label', null, 'Hint', hint), h('label', null, 'Secret note', body), err,
  h('div', { class: 'rec-row rec-between' },
    item && item.id ? h('button', { class: 'rec-btn rec-danger', type: 'button', onclick: async () => { if (await confirmDialog('Delete this note?')) { await HB.remove('sensitive', item.id); close(); } } }, 'Delete') : h('span'),
    h('div', { class: 'rec-row' }, h('button', { class: 'rec-btn', type: 'button', onclick: close }, 'Cancel'), h('button', { class: 'rec-btn rec-primary', type: 'submit' }, 'Save')))));
}

function noteRow(item) {
  const out = h('pre', { class: 'rec-secret rec-hidden' });
  const reveal = h('button', { class: 'rec-btn rec-small', type: 'button' }, 'Reveal');
  const copy = h('button', { class: 'rec-btn rec-small rec-hidden', type: 'button' }, 'Copy');
  let timer;
  const hide = () => { out.textContent = ''; out.classList.add('rec-hidden'); copy.classList.add('rec-hidden'); reveal.textContent = 'Reveal'; };
  reveal.addEventListener('click', async () => {
    if (!out.classList.contains('rec-hidden')) { hide(); return; }
    try {
      out.textContent = await decryptText(memKey, item.ciphertext, item.iv);
      out.classList.remove('rec-hidden'); copy.classList.remove('rec-hidden'); reveal.textContent = 'Hide';
      clearTimeout(timer); timer = setTimeout(hide, 30000);
    } catch { toast('Could not decrypt. It may have been saved with a different passphrase.'); }
  });
  copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(out.textContent); toast('Copied. Clear your clipboard when done.'); } catch { toast('Copy failed.'); } });
  return h('div', { class: 'rec-panel' },
    h('div', { class: 'rec-row rec-between' }, h('h3', null, item.label), h('div', { class: 'rec-row' }, reveal, copy, h('button', { class: 'rec-btn rec-small', type: 'button', onclick: () => editNote(item) }, 'Edit'))),
    item.hint ? h('p', { class: 'rec-muted' }, 'Hint: ' + item.hint) : null, out);
}

function build(rt, data) {
  const screen = h('div');
  const toolbar = h('div', { class: 'rec-row rec-noprint' });
  let renderToken = 0;
  async function update() {
    const t = ++renderToken;
    const conf = cryptoConf(cryptoRow(data.settings));
    if (conf && !memKey && !autoUnlockTried && isRemembered()) {
      autoUnlockTried = true;
      const rec = await idbKey('get');
      if (rec && rec.key && rec.salt === conf.salt) { memKey = rec.key; armTimer(); }
      else { lsSet('hb.sens.remember', ''); }
      if (t !== renderToken) return;
    }
    toolbar.replaceChildren();
    if (!conf) { screen.replaceChildren(setupScreen(update)); return; }
    if (!memKey) { screen.replaceChildren(unlockScreen(conf, update)); return; }
    const items = (data.sensitive || []).slice().sort((a, b) => String(a.label).localeCompare(String(b.label)));
    const sel = h('select', { 'aria-label': 'Lock after', onchange: e => { lsSet('hb.sens.timeout', e.target.value); armTimer(); } },
      TIMEOUTS.map(([m, l]) => h('option', { value: m, selected: m === timeoutMin() }, l)));
    toolbar.append(h('button', { class: 'rec-btn', type: 'button', onclick: () => lock('Locked.') }, 'Lock now'),
      isRemembered() ? h('button', { class: 'rec-btn', type: 'button', onclick: async () => { await forget(); toast('Forgotten on this device.'); } }, 'Forget on this device')
        : h('label', { class: 'rec-row' }, 'Lock after ', sel));
    screen.replaceChildren(
      warnings(),
      items.length ? h('div', { class: 'rec-list' }, items.map(noteRow))
        : emptyState('No secret notes yet', 'Add alarm codes, safe combinations, or anything you want kept private.'));
  }
  listeners.clear();
  listeners.add(update);
  const view = h('div', { class: 'rec-view' },
    pageHead('Secret notes', h('button', { class: 'rec-btn rec-primary', type: 'button', onclick: () => { if (memKey) editNote(null); else toast('Unlock first.'); } }, 'New note')),
    toolbar, screen);
  return { node: view, refresh: update, dispose: () => listeners.delete(update) };
}

register({
  id: 'sensitive', title: 'Secret notes', icon: 'lock', order: 80,
  render(container) {
    const stop = mountView(container, ['sensitive', 'settings'], (rt, data) => build(rt, data));
    return () => { stop(); listeners.clear(); };
  },
});

// Exposed for tests in the harness only.
export const _lock = () => lock();
