# G1: Global search

Branch `g1-search` (from main after F0). Not merged, not pushed.

## What works
- Palette opened by `/` (when not typing in a field and no dialog is open), `Ctrl/Cmd+K` anywhere, or the new header **Search** button (phones).
- Searches the local cache with `HB.list` only, so it works offline and needs no backend change: rooms, assets, shutoffs, tasks, consumables, documents (title, tags, notes, kind), contacts, projects, materials, tools.
- Matching ported from `legacy/v1/js/finder.js` (lowercase, split on spaces, every word must appear) plus: accent folding, title hits ranked above other fields, word-start bonus, and the room name counts as a weak match for things in that room. Matched text is highlighted with `<mark>` built from DOM nodes (no innerHTML).
- Results grouped by type (max 6 per group, 40 total, "n of m" shown when capped). Up/Down move, Enter opens, Esc or Close or a click outside closes and returns focus to where you were. ARIA combobox/listbox pattern.
- Soft-deleted rows are ignored. The `sensitive` and `settings` tables are not in the index list at all (a unit test checks this).

## Routes used
`#/assets/<id>`, `#/rooms/<id>`, `#/documents/<id>`, `#/projects/<id>` (materials go to their project). Shutoffs, tasks, supplies, contacts and tools have no detail route today, so those results open the list page (`#/shutoffs`, `#/maintenance`, `#/consumables`, `#/contacts`, `#/tools`). Note the real asset route is `assets`, not `asset`.

## Files
- New: `web/js/core/search.js`, `web/css/search.css`, `web/js/core/search.test.mjs`.
- Hooks: `web/index.html` (Search button in `.top-tools`), `web/js/core/app.js` (import + `initSearch()` after boot), `web/sw.js` (cache list + version `hb2-2` -> `hb2-3`).

## Tested
- `node --check` on search.js, app.js, sw.js: pass.
- `node --test web/js/core/search.test.mjs`: 10 pass (accent folding, all-words rule, ranking, soft delete, sensitive excluded, room match, caps, routes).
- Browser pane against the mock server (port 8793) with one seeded row of each type plus a soft-deleted asset and a sensitive row: every type found by a typed query; "dishwasher" (deleted) and "alarm" (sensitive) correctly found nothing; `/`, Ctrl+K, Enter (navigated to `#/assets/<id>`), real Esc key (closed, focus back on the Search button). Checked at 400 px (no horizontal scroll, box 376 px wide) and 1200 px.

## Not tested
- A real phone (on-screen keyboard overlap, touch scrolling, iOS Safari/Android Chrome). The search field is 16 px to avoid iOS zoom.
- Large data sets (hundreds of rows per table). It rebuilds from `HB.list` on each open, which should be fine at house scale.
- Service worker: the pane could not register `sw.js` ("unknown error fetching the script", file serves 200 via curl). That is the embedded browser, not this change, but it means offline fallback of the new files was not exercised. The two new files are in the SHELL list.
- The only console messages were that service worker registration failure; no errors from search.

## For integration (I1)
- `sw.js` conflicts with G4: both touch the SHELL list and the version. Keep both files, bump once.
- `web/js/core/*.test.mjs` is already in the README test glob.
