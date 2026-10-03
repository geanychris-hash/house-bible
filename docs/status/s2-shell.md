# S2 status: app shell, sync, offline, auth

Branch `s2-shell`. All items in the S2 prompt are built.

## What works (tested)
- PWA shell: `web/index.html`, manifest, icons (from v1), `sw.js` (network-first, cache fallback, relative paths, `VERSION` constant). Checked in the built-in browser: service worker registers, caches the shell and views, and the app reloads and shows saved data with the server stopped.
- Router with `registerView`, hash routes, view loading from `js/core/views.json`, placeholder Home, hidden Connect view. A throwing view shows an error panel. Checked with temporary demo views (removed before commit): nav shows 4 tabs plus a More sheet at 375 px, full side nav at 1200 px, no horizontal scroll.
- `data.js`: IndexedDB store per table, outbox, push then pull with `rev` cursor, stale handling, backoff (5 s doubling to 5 min), auto-sync on open, focus, online, after save (2 s debounce) and every 60 s while visible. 17 unit tests pass (`node --test web/dev/tests/`) covering save/merge/outbox coalescing, soft delete, subscribe, push, two-device conflict, pending-edit-wins, server-newer-wins, edit during push, offline backoff, auth failure stops auto retry, pull paging and type normalization, restart persistence, API error mapping, and an end-to-end run over HTTP against the mock server.
- `files.js`: in the browser, a 3000x2000 PNG was downscaled to 1600x1067 JPEG, uploaded to the mock, thumbnail fetched and cached. Offline upload (simulated with `navigator.onLine=false`) queued as `pending-...`, showed a local thumbnail, and on the next sync was sent and the referencing row's photo id was swapped for the real id.
- `ui.js`: `h`, `openModal` (focus moves in, Tab trapped, Escape closes, focus returns), `openForm` (text, textarea, date, time, number, select, bool, ref, files, file, json-list; required fields), `toast`, `confirm`. Form opened, validated ("Name is needed."), saved, and Escape closed it in the browser. The files picker button was not clicked through a real file dialog (only `upload()` was called directly).
- Connect screen: setup link `#/connect?u=..&k=..` fills the fields and removes the key from the address bar; test with ping, save, redirect home. Disconnect and "Copy setup link" are built; copy was not exercised.
- Sync chip and Sync button in the header (states: Not connected, Syncing, Online + last sync, N waiting, Offline, Sync problem, Key rejected).

## NOT tested
- Real Apps Script backend (only the mock). Real Google redirects/CORS behavior is untested.
- Real phones, iPhone Safari, install-to-home-screen, Android Chrome. Dark mode and the 1200 px layout were checked by DOM measurement only; screenshots timed out while the pane was hidden, so visual look at 1200 px and dark was not eyeballed. The 375 px Connect screen and form were seen in screenshots.
- `tools/deploy-pages.ps1` parses but was not run (no GitHub remote exists yet).
- Camera capture, large (20 MB) uploads, HEIC photos from iPhone (the browser may not decode HEIC; such files upload unchanged).
- A views folder with real views from S3-S6 (only temporary demo views).

## How to run the mock server
From the repo (worktree) root:

    node web/dev/mock-server.mjs

Open http://localhost:8787/ . On the Connect screen use address `http://localhost:8787/exec`, key `dev`, any device name. Options: `PORT=9000`, `MOCK_KEY=secret` environment variables. Key `slow` behaves like the real key but answers after 800 ms. Data is kept in `web/dev/data.json`, uploaded files in `web/dev/files/` (both git-ignored); delete them to start fresh. The mock also serves `web/` and computes `/js/core/views.json` live from `web/js/views/`.
Setup-link test: `http://localhost:8787/#/connect?u=http%3A%2F%2Flocalhost%3A8787%2Fexec&k=dev`

Tests: `node --test web/dev/tests/`. Syntax check: `node --check` on each file.

## Notes for the next streams
- Views: import `* as HB from '../core/data.js'`, `{ registerView } from '../core/router.js'`, `{ h, openForm, toast, confirm } from '../core/ui.js'`, `* as HBFiles from '../core/files.js'`. Put the view file in `web/js/views/` and make sure it is listed in `js/core/views.json` (run `node web/dev/gen-views.mjs`; the mock server does this live, so you only need the script for static hosting). Do not commit your own copy of `views.json` changes if you can avoid it: integration regenerates it.
- Use css classes from `css/base.css` (panel, btn, chip, list, item, form, field, kv, tabs, table, grid, cols, row, banner). Colors only via tokens.
- `ref` field: `{k, label, type:'ref', table:'rooms', labelKey:'name'}`. `files`: `{type:'files', parentKind:'rooms'}`; `file` (single): `{type:'file', parentKind:'documents', docs:true}`. `json-list` with `itemFields` for `[{t,d}]` steps.
- Row values: json/files fields are real arrays/objects; flags are 0/1; numbers are numbers (empty stays `''` or null).
- S7 / integration: regenerate `views.json` after merging; bump `VERSION` in `sw.js` only if the service worker logic changes.
