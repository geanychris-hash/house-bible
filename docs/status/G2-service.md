# G2: contractor link and service history

Branch g2-service. Not merged, not pushed.

## What works
- Done dialog (`maintenance-actions.js`): optional "Contractor" select from contacts, saved to `task_log.contact`. `markDone()` also takes a `contact` option.
- Expense form (`expenses.js`): optional "Contractor (optional)" ref select, saved to `expenses.contact`.
- `renderServiceHistory` (`assets-history.js`): done entries for tasks whose `asset` is this asset, newest first, with date, task title, note, cost and contractor name linking to `#/contacts` (there is no per-contact route). Plain empty state.
- `renderJobs` (`contacts-jobs.js`): task_log and expenses where contact = id, newest first, collapsed summary "N jobs · $total total". Plain empty state.
- Both renderers redraw live on table changes. `contacts.last_job*` untouched.
- Skips and snoozes (logged in task_log with a `[skipped]` / `[snoozed` note) are excluded from history and jobs.

## Added file outside the owned list
`web/js/views/service-logic.js` (+ `.test.mjs`): pure grouping, so it can be tested in Node without a browser.

## Tested
- `node --check` on all touched files; `node --test web/js/views/service-logic.test.mjs`: 5/5 pass.
- Mock server (port 8791) with seeded asset, 2 contacts, task, 2 logs, 1 expense: asset page shows 2 history rows with contractor link; contacts show "2 jobs · $150.50 total" and the empty state.
- Done dialog saved a contractor with fetch forced to fail, then synced after fetch returned: server received `contact` (offline outbox carries the new field).
- Expense saved with contractor; appears in that contact's jobs.
- 400 px: no horizontal overflow on expense form, asset detail, contacts. 1200 px checked for asset and contacts.

## Not tested
- Real Apps Script backend (needs F0 columns deployed). Real phone. Console showed only a service-worker "fetching the script" error from the preview tool, not from app code. 1200 px for the dialogs was not inspected visually.
