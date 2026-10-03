# S3 Maintenance (branch s3-maintenance, owns web/js/core/recur.js, web/js/views/maintenance*.js, consumables.js, weather-alerts.js, web/css/maintenance.css, seed/tasks.json, tools/load-seed.mjs)
Read 00-common.md first. This is Chris's number one priority.

Deliver:
1. `js/core/recur.js`: pure functions `nextDue(task, logs, today)`, `occurrences(task, from, to)`, `taskStatus(task, logs, today)` for every rule type in CONTRACT section 5, ported and extended from `legacy/v1/js/util.js`. `node --test` tests covering each rule type, year boundaries, leap day, `after_done`, and `days` (the dog heartworm every 30 days case).
2. `js/views/maintenance.js`: the main screen. Sections: Overdue, Due now, Next 30 days, All tasks grouped by category. One-tap "Done" (writes `task_log`, optional note, cost, photo). Snooze or skip with a reason. Filter by category, room, assignee, subject. Search.
3. A friendly "Add recurring thing" form: title, category (including pet, health, vehicle, other), subject (for example a dog's name), how often (plain-language picker mapping to rule JSON: every N days, weeks, months or years; after I do it; yearly on a date; seasonal window), start date, assignee (Chris, wife, either), notes, "also put on Google Calendar". Editing and deactivating tasks.
4. `js/views/consumables.js` (Must-have): filters, bulbs, batteries, water filter and so on with spec, quantity on hand, interval, last replaced, computed next due, a "low or due" list, and a one-tap "replaced today".
5. `js/views/weather-alerts.js`: edits `settings.alerts` rules and `settings.notify` emails per CONTRACT section 6, plus a "Send test alert" button calling `testAlert`.
6. `seed/tasks.json`: convert `legacy/v1/js/seed-tasks.js` into the new schema (`source:"seed"`, stable `seed_key`). Review each task for accuracy for a one-pipe steam house in Massachusetts. Add steam-specific tasks (check boiler water level, low-water cut-off blow-down per the manufacturer's instructions, vent check, annual service by a licensed tech, radiator valve and pitch check). Do not seed pet reminders (user-defined). `tools/load-seed.mjs` loads it through the API, skipping seed_keys that already exist so reseeding never duplicates or overwrites user edits.
7. A month-grid calendar view if time allows; list view first.

Develop against the stub `web/js/core/data.js`; it works unchanged once S2 lands. Gas, flue, main electrical, asbestos or lead tasks must be `pro_only` with "licensed pro" language.
