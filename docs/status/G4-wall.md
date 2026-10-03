# G4: Wall display mode (gap 5)

Branch `g4-wall`. Route `#/wall`, hidden from the nav. Not merged, not pushed.

## What works
- `web/js/views/wall.js` (new) and `web/css/wall.css` (new). Read-only, large type, dark theme forced while the page is open (previous theme restored on leave). App header and nav are hidden via `body.wall-mode`.
- Sections: Today (tasks due today), Overdue (via `taskStatus`, most late first, red panel), Running low (consumables with zero on hand, or past their replace date), Weather alerts on, Next 5 days (from `occurrences()` starting tomorrow, grouped by day).
- Only control is a small "Exit" link (to `#/home`).
- Data is all from the local cache (`HB.list`). Redraws on cache changes (subscribed to tasks, task_log, consumables, settings), which the app's existing 60 s sync feeds, plus its own 60 s tick for the clock and date rollover. No Google Calendar read.
- Wake lock: `navigator.wakeLock` feature-detected, acquired on open, re-acquired on `visibilitychange` back to visible, released on leave. A denied request is swallowed.
- `web/sw.js`: one new line adding `js/views/wall.js` and `css/wall.css` to the shell list. Version not bumped.
- `web/js/core/views.json` regenerated with `node web/dev/gen-views.mjs` (adds `wall`).
- `wallModel()` is exported and pure, for a later unit test.

## How I tested
Mock server on a scratch data file with seeded tasks (weekly, monthly, days, yearly, once, inactive), task_log rows, consumables and an `alerts` setting. Checked in the in-app browser:
- 1920x1080: three-column grid, no scroll needed with the seed. 400 px: single column, no horizontal overflow (scrollWidth 400).
- Live redraw: saving tasks and logs from the console updated the page without reload.
- Wake lock with a stubbed `navigator.wakeLock`: one request on open, a second after the lock was released and the tab became visible, a release on leaving the route. Theme and `wall-mode` class cleaned up after leaving.
- Console: the only error was the service worker failing to register in the in-app browser ("unknown error fetching the script"). `sw.js` itself returns 200, and the same call is made on every page by `app.js`, so it is not from this change. No errors from the wall view.

## Could not test
- Real wake lock on a tablet (needs HTTPS or localhost and a real device; some browsers deny it without a user gesture or in battery saver).
- Long-running behaviour (hours open) and midnight rollover.
- No unit test file added (not in my owned paths).

## Notes for integration
- Weather alerts: the client has no record of whether an alert actually fired (the server only emails and makes a calendar event). The tile therefore shows which rules are switched on in `settings.alerts`, with the text "The server emails when one fires." If a fired-alert record is added later, hook it into `wallModel`.
- "Running low" treats a consumable as low when `qty_on_hand` is 0 or its replace date has passed.
- Next 5 days skips occurrences already covered by a completion (a yearly task logged early does not show again).
- `views.json`: regenerate with `node web/dev/gen-views.mjs` rather than merging by hand.
- Bump the `sw.js` VERSION once at integration.
