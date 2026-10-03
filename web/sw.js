/* House Bible service worker.
   Network-first for everything on this site, with the cache as the offline fallback. All paths are
   relative so it works from https://<user>.github.io/<repo>/. Bump VERSION when this file's logic
   changes; the shell files themselves are refreshed on every online load, so they do not need a bump. */
const VERSION = 'hb2-4';
const CACHE = 'house-bible-' + VERSION;
const SHELL = [
  './', 'index.html', 'manifest.webmanifest', 'css/tokens.css', 'css/base.css', 'css/search.css',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  'js/core/app.js', 'js/core/router.js', 'js/core/data.js', 'js/core/store.js', 'js/core/schema.js', 'js/core/api.js',
  'js/core/auth.js', 'js/core/files.js', 'js/core/ui.js', 'js/core/connect.js', 'js/core/home.js', 'js/core/icons.js', 'js/core/search.js', 'js/core/views.json',
  'js/views/wall.js', 'css/wall.css',
];

self.addEventListener('install', e => {
  // addAll fails as a whole if any file 404s, so add one by one and ignore misses.
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(SHELL.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // API calls are POST and never touch the cache
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        // fonts etc. go straight to the network
  e.respondWith((async () => {
    try {
      const res = await fetch(req, { cache: 'no-cache' });
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    } catch {
      const hit = await caches.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') { const idx = await caches.match('index.html'); if (idx) return idx; }
      return new Response('Offline and not cached yet.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    }
  })());
});
