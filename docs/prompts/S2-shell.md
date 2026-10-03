# S2 App shell, sync, offline, auth (branch s2-shell, owns web/index.html, manifest, sw.js, css/, js/core/ except recur.js and plan.js, web/dev/, tools/deploy-pages.ps1)
Read 00-common.md first.

Build the PWA shell and the real data layer, replacing the stub `web/js/core/data.js` while keeping its exported API (CONTRACT section 8).

Deliver:
1. `index.html`, `manifest.webmanifest`, icons (adapt `legacy/v1/icons`), service worker (network-first for the shell with cache fallback, version constant, relative paths so it works at `https://<user>.github.io/<repo>/`).
2. `css/tokens.css`, `css/base.css`: reuse the v1 blueprint look and light/dark tokens. Responsive: bottom nav on phones, side nav on wide screens.
3. `js/core/router.js` with `registerView`, hash routing, lazy view loading. The nav lists registered views by `order`. Views that do not exist yet must not break the app. Ship a placeholder Home view.
4. `js/core/data.js`: IndexedDB store per table, outbox of pending changes, `syncNow` using pull and push (CONTRACT section 4) with a `rev` cursor, stale-row handling, retry with backoff, auto-sync on open, on focus, after each save (debounced 2 s) and every 60 s while visible. `subscribe` fires on local and remote changes. Works offline: reads from cache, queues writes.
5. `js/core/files.js`: upload with image downscale to 1600 px JPEG 0.82, queue when offline, thumbnail cache in IndexedDB, open and download.
6. `js/core/ui.js`: port `h()`, `openModal`, `openForm` from `legacy/v1/js/util.js` and extend per CONTRACT section 8 (ref, files, json-list fields), plus toast and confirm, with accessible focus handling.
7. `js/core/auth.js` and a Connect screen: first run asks for the Apps Script URL, the shared key and a device label (for example "Chris-phone"), stores them in IndexedDB, tests with `ping`. Support a setup link of the form `#/connect?u=<url>&k=<key>` so Chris can send his wife one link (comment the security tradeoff: the key is in the link, share it privately). Never log the key.
8. A sync status chip in the header (online, pending count, last sync, error) and a manual Sync button.
9. `web/dev/mock-server.mjs` (Node, no deps) implementing the CONTRACT section 4 API backed by a JSON file, so every session can test end to end without Google. Document how to run it in `docs/status/s2-shell.md`.
10. Unit tests (`node --test`) for the merge and outbox logic, with IndexedDB behind a small adapter so tests run in Node.
11. `docs/HUMAN-STEPS.md` section S2: create the GitHub account and public repo, enable GitHub Pages (pick the simplest route and provide `tools/deploy-pages.ps1`), install to the home screen on Android and iPhone (iOS Safari: Share, Add to Home Screen). Note that push notifications are not relied upon on iPhone.
