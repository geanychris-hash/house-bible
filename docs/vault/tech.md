---
type: claude-reference
status: active
started: 2026-09-30
updated: 2026-10-03
tags: [home-projects, house-bible, technical, v2]
---
# House Bible Design (technical)

Audience: Claude. Plain-language version: [[House Bible - What we're building]]. Binding spec: `docs/CONTRACT.md` in the repo (`house-bible-app`); decisions: `docs/DECISIONS.md`. Where they disagree with this note, the repo wins.

## Context
Chris, Canton MA, old house, one-pipe steam, plus his wife. Windows PCs, Samsung phone, iPhone. Manual entry only. Facts about the house are only what he stated; blank means unknown. Never invent models, locations, prices or dates.

## Architecture
PWA (vanilla JS, ES modules, no build) on GitHub Pages. IndexedDB cache + outbox. `fetch` POST `text/plain` JSON to an Apps Script web app (execute as owner, access Anyone, shared key checked by SHA-256). Sheet tabs are tables; every table starts `id, rev, updatedAt, updatedBy, deleted`. Newest `updatedAt` wins, server wins ties; soft deletes only; `rev` is one global counter under LockService; hidden `changelog` tab. Files in Drive `House Bible Files/<kind>/`. Calendar "House Bible". Daily 16:00 NWS weather rules by email + calendar. Monthly backup copy, last 12 kept. Sensitive tab holds only AES-GCM ciphertext (PBKDF2 250k from a household passphrase).

## Tables
rooms, assets, shutoffs, tasks, task_log, consumables, documents, contacts, steam_log, projects, materials, expenses, tools, utilities, sensitive, settings. Field lists are in CONTRACT section 3 and `apps-script/schema.json`.

## Streams (parallel build, 2026-10-03)
S1 backend, S2 shell and sync, S3 maintenance, S4 records, S5 projects and money, S6 data and visuals (this note), S7 integration.

## S6 notes
- `tools/import-receipts.mjs`: ids are SHA-256 of a content key, so reruns skip existing rows and never overwrite. Inputs are searched in `seed/`, Downloads, then the vault folder read-only. Tools skip by name too. Paint with no room goes on a placeholder room "Paint: room not yet known"; the two paint-can expense rows link to it. Project clues become `projects` rows with status `idea`. Net expense total 2037.65 (Harbor Freight 1226.69, Home Depot 810.96), matching the Receipts note. Returns are negative rows.
- `seed/house.json`: address and heat only. Zillow and Redfin returned HTTP 403 and Realtor.com was unreachable from the tool on 2026-10-03; year built, sqft, floors, lat and lon are null. S1 ships a default lat/lon (42.158, -71.145) that Chris must confirm.
- Home (`web/js/views/home.js`, logic in `home-logic.js`): reads via `HB.list`; uses S3's `recur.js` (`taskStatus`, `consumableStatus`) loaded dynamically so it degrades if absent; the setup checklist is derived from data, not stored.
- Visuals (`visuals.js`, logic in `visuals-logic.js`): floors come from `rooms.floor`; radiators are `assets` whose name or kind contains "radiator", placed by `room`; radiator colour is read from `notes` keywords because there is no status column; heating season assumed Oct 15 to May 1 (not stored). Project flow uses `projects.deps`; budget spent = expenses linked by `project`, estimate = unbought `materials` at the cheapest entered price.
- Tests: `node --test tools/import-receipts.test.mjs web/js/views/*.test.mjs`.

## Not verified
Real Google backend, phones, install, calendar and email behaviour. See `docs/status/` in the repo.
