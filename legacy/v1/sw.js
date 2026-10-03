/* Offline cache: app shell first, network for everything else (fonts fall back if offline). */
const CACHE = 'house-bible-v6';
const SHELL = ['./', 'index.html', 'styles.css', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png',
  'js/seed-tasks.js', 'js/util.js', 'js/store.js', 'js/cutlist.js', 'js/plan.js', 'js/export.js', 'js/views.js', 'js/charts.js', 'js/photos.js', 'js/scan.js', 'js/shell.js', 'js/setup.js', 'js/finder.js', 'js/main.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin === location.origin) {
    e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request).then(m => m || caches.match('index.html'))));
  }
});
