// Hash router and view registry (CONTRACT section 8).
//   registerView({ id, title, icon, order, render(container, ctx) -> cleanupFn|Promise<cleanupFn>, hidden? })
// URLs look like  #/<id>/<param>/<param>?a=1  and work from any sub-folder (GitHub Pages project sites).
// ctx = { id, params:[...], query:{...}, navigate(path), container }
// A view that throws while rendering shows an error panel; it never breaks the app.
const views = new Map();
const viewListeners = new Set();
const routeListeners = new Set();
let container = null;
let cleanup = null;
let token = 0;
let guard = () => null;
let loading = true;

export function registerView(v) {
  if (!v || !v.id || typeof v.render !== 'function') throw new Error('registerView needs {id, render}');
  views.set(v.id, { title: v.id, icon: 'dot', order: 100, hidden: false, ...v });
  viewListeners.forEach(fn => fn());
  // A view registering after boot may be the one the URL points at.
  if (container && parseHash().id === v.id) renderCurrent();
}
export const getView = id => views.get(id);
export function listViews({ includeHidden = false } = {}) {
  return [...views.values()].filter(v => includeHidden || !v.hidden).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}
export const onViewsChanged = fn => { viewListeners.add(fn); return () => viewListeners.delete(fn); };
export const onRoute = fn => { routeListeners.add(fn); return () => routeListeners.delete(fn); };
export const setGuard = fn => { guard = fn; };

export function parseHash(hash = location.hash) {
  const raw = hash.replace(/^#\/?/, '');
  const [pathPart, qs = ''] = raw.split('?');
  const segs = pathPart.split('/').filter(Boolean).map(decodeURIComponent);
  const query = {};
  new URLSearchParams(qs).forEach((v, k) => { query[k] = v; });
  return { id: segs[0] || '', params: segs.slice(1), query };
}
export function navigate(path, { replace = false } = {}) {
  const target = '#/' + String(path).replace(/^#?\/?/, '');
  if (replace) history.replaceState(null, '', target.startsWith('#') ? location.pathname + location.search + target : target);
  if (replace) renderCurrent(); else location.hash = target;
}

function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

async function renderCurrent() {
  if (!container) return;
  let r = parseHash();
  const redirect = guard(r);
  if (redirect && redirect !== r.id) { navigate(redirect, { replace: true }); return; }
  if (!r.id) {
    const first = listViews()[0];
    if (first) { r = { id: first.id, params: [], query: {} }; history.replaceState(null, '', location.pathname + location.search + '#/' + first.id); }
  }
  const my = ++token;
  if (cleanup) { try { await cleanup(); } catch (e) { console.error('view cleanup failed', e); } cleanup = null; }
  if (my !== token) return;
  const view = views.get(r.id);
  routeListeners.forEach(fn => fn(r, view));
  container.replaceChildren();
  container.removeAttribute('aria-busy');
  if (!view) {
    container.innerHTML = loading
      ? '<div class="panel"><p class="muted">Loading...</p></div>'
      : `<div class="panel"><h2>Not found</h2><p class="muted">There is no page called "${esc(r.id)}" in this app yet.</p><p><a href="#/">Go to the start page</a></p></div>`;
    return;
  }
  document.title = (view.title && view.id !== 'home' ? view.title + ' - ' : '') + 'House Bible';
  const ctx = { id: r.id, params: r.params, query: r.query, navigate, container };
  try {
    const out = await view.render(container, ctx);
    if (my !== token) { if (typeof out === 'function') out(); return; }
    cleanup = typeof out === 'function' ? out : null;
  } catch (e) {
    console.error('view failed: ' + r.id, e);
    container.innerHTML = '<div class="panel"><h2>That page hit a problem</h2><p class="muted">Try going back or reloading. The rest of the app still works.</p></div>';
  }
  if (!container.contains(document.activeElement)) container.focus({ preventScroll: true });   // a view may have focused a field itself
  window.scrollTo(0, 0);
}

export function start(el) {
  container = el;
  window.addEventListener('hashchange', renderCurrent);
  renderCurrent();
}
export const refresh = () => renderCurrent();

// Load view modules listed in js/core/views.json (written by web/dev/gen-views.mjs). Each module calls
// registerView() when imported. A file that fails to load is skipped with a console warning.
export async function loadViews() {
  let names = [];
  try {
    const res = await fetch(new URL('./views.json', import.meta.url), { cache: 'no-cache' });
    if (res.ok) names = await res.json();
  } catch { /* offline with no cache: no extra views */ }
  await Promise.allSettled(names.map(n => import(`../views/${n}.js`).catch(e => { console.warn('view module failed to load:', n, e && e.message); })));
  loading = false;
  viewListeners.forEach(fn => fn());
  if (container && !views.has(parseHash().id)) renderCurrent();
}
