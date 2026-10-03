// App bootstrap: header (sync chip + Sync button), navigation, router start, service worker.
import { h, toast } from './ui.js';
import * as HB from './data.js';
import * as auth from './auth.js';
import { start, loadViews, listViews, onViewsChanged, onRoute, setGuard, navigate } from './router.js';
import { registerConnect, captureSetupLink } from './connect.js';
import { registerHomePlaceholder } from './home.js';
import { iconSvg } from './icons.js';
import { initSearch } from './search.js';

const PHONE_SLOTS = 4;          // tabs shown in the bottom bar on phones; the rest go under "More"
const nav = document.getElementById('nav');
const main = document.getElementById('main');
const chip = document.getElementById('syncchip');
const syncBtn = document.getElementById('syncbtn');

/* ---------- sync chip ---------- */
function ago(ts) {
  if (!ts) return 'not synced yet';
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 45) return 'synced just now';
  if (s < 3600) return `synced ${Math.round(s / 60)} min ago`;
  if (s < 86400) return `synced ${Math.round(s / 3600)} h ago`;
  return `synced ${Math.round(s / 86400)} d ago`;
}
function drawChip() {
  const s = HB.status();
  let text, cls;
  if (!auth.isConfigured()) { text = 'Not connected'; cls = 'warn'; }
  else if (s.syncing) { text = 'Syncing...'; cls = 'acc'; }
  else if (s.authFailed) { text = 'Key rejected'; cls = 'bad'; }
  else if (!s.online) { text = `Offline${s.pending ? ' · ' + s.pending + ' waiting' : ''}`; cls = 'warn'; }
  else if (s.error && s.error.code !== 'partial') { text = `Sync problem${s.pending ? ' · ' + s.pending + ' waiting' : ''}`; cls = 'bad'; }
  else if (s.pending) { text = `${s.pending} waiting · ${ago(s.lastSync)}`; cls = 'acc'; }
  else { text = `Online · ${ago(s.lastSync)}`; cls = 'good'; }
  chip.className = 'chip ' + cls;
  chip.textContent = text;
  chip.title = s.error ? s.error.message : '';
  syncBtn.disabled = s.syncing;
}
chip.addEventListener('click', () => { if (!auth.isConfigured()) navigate('connect'); else if (HB.status().error) toast(HB.status().error.message); });
syncBtn.addEventListener('click', async () => {
  if (!auth.isConfigured()) { navigate('connect'); return; }
  const res = await HB.syncNow();
  toast(res.errors.length ? `Sync problem: ${res.errors[0]}` : `Synced. Sent ${res.pushed}, got ${res.pulled}.`);
});
HB.onStatus(drawChip);
auth.onConfigChange(drawChip);
setInterval(drawChip, 30000);

/* ---------- navigation ---------- */
let current = '';
function drawNav() {
  const views = listViews();
  const overflow = views.slice(PHONE_SLOTS);
  nav.replaceChildren(
    ...views.map((v, i) => h('a', {
      href: '#/' + v.id, class: 'navlink' + (i >= PHONE_SLOTS ? ' overflow' : ''), 'data-view': v.id,
      'aria-current': v.id === current ? 'page' : null,
    }, h('span', { class: 'ni', html: iconSvg(v.icon) }), h('span', { class: 'nl' }, v.title))),
    overflow.length ? h('button', { type: 'button', class: 'navlink morebtn', 'aria-haspopup': 'true', 'aria-expanded': 'false',
      'aria-current': overflow.some(v => v.id === current) ? 'page' : null, onclick: e => toggleMore(e.currentTarget, overflow) },
      h('span', { class: 'ni', html: iconSvg('more') }), h('span', { class: 'nl' }, 'More')) : null);
}
let moreSheet = null;
function closeMore() { if (moreSheet) { moreSheet.remove(); moreSheet = null; const b = nav.querySelector('.morebtn'); if (b) b.setAttribute('aria-expanded', 'false'); } }
function toggleMore(btn, overflow) {
  if (moreSheet) { closeMore(); return; }
  btn.setAttribute('aria-expanded', 'true');
  moreSheet = h('div', { class: 'moresheet', role: 'menu' }, overflow.map(v =>
    h('a', { href: '#/' + v.id, role: 'menuitem', onclick: closeMore }, h('span', { class: 'ni', html: iconSvg(v.icon) }), v.title)));
  document.body.append(moreSheet);
  const first = moreSheet.querySelector('a'); if (first) first.focus();
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && moreSheet) { closeMore(); const b = nav.querySelector('.morebtn'); if (b) b.focus(); } });
document.addEventListener('click', e => { if (moreSheet && !moreSheet.contains(e.target) && !e.target.closest('.morebtn')) closeMore(); });

onViewsChanged(drawNav);
onRoute(r => { current = r.id; closeMore(); drawNav(); });

/* ---------- boot ---------- */
async function boot() {
  const fromLink = captureSetupLink();
  registerConnect();
  registerHomePlaceholder();
  drawNav();
  await HB.init();
  // Until the device is connected, every page except Connect sends you to Connect.
  setGuard(r => (!auth.isConfigured() && r.id !== 'connect' ? 'connect' : null));
  start(main);
  drawChip();
  HB.startAutoSync();
  initSearch().catch(e => console.warn('search not started:', e && e.message));
  loadViews();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('service worker not registered:', e && e.message));
  }
  if (fromLink) toast('Setup link read. Name this device to finish.');
}
boot();
