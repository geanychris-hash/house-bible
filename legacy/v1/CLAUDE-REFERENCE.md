---
type: claude-reference
audience: Claude (Cowork or Claude Code)
updated: 2026-09-30
---
# House Bible app: Claude reference

Stand-alone PWA, vanilla JS, no build step, no dependencies. Owner: Chris (Canton, MA, old house, one-pipe steam). Decisions he made: installable app for Android and desktop, manual entry only (no AI, no price scraping), data on device with export to Obsidian markdown. Sibling markdown system lives in `../house-system/` (templates, tasks.json, build.py); the app supersedes it as the UI but exports the same note kinds.

## Files
- `index.html` full PWA shell; loads scripts in order: `js/seed-tasks.js, util.js, store.js, cutlist.js, plan.js, export.js, views.js, main.js`.
- `house-bible-artifact.html` single-file build (inline CSS and JS, no doctype/head/body) for publishing with the Artifact tool. Regenerate by concatenating the same scripts in the same order plus a boot snippet without service worker registration.
- `manifest.webmanifest`, `sw.js` (network-first, cache fallback), `icons/`.
- `styles.css` design tokens at top; light and dark via `prefers-color-scheme` and `data-theme`.

## Data model (localStorage key `houseBible.v1`; theme `hb.theme`; last tab `hb.route`)
`S = {v, settings{reminderTime,sheetW,sheetL,boardL,kerf,houseAge,examples}, house{shutoffs,systems,appliances,paint,warranties,log}, tools[{id,name,category,status own|want,notes}], tasks[{id,season,title,rule,start,time,tools,why,how,safety,done[]}], projects[{id,name,status,priority,pro,season,budget,deps[ids],notes,steps[{t,d}],materials[{id,item,qty,unit,hd,hf,other,have}],tools[],parts[{id,name,material,kind sheet|board,qty,l,w,t}],purchases[{id,date,item,store,type,amount}]}]}`.
Rows with `example:true` are demo data; "Remove examples" deletes them.
Task rule: `{type:'yearly'} | {type:'monthly',interval} | {type:'weekly',from:'MM-DD',to:'MM-DD'}`. Status: due within a grace window of the latest occurrence if not logged done since; otherwise upcoming.

## Logic
- Sequencing (plan.js): Kahn levels over unfinished projects; within a level sort by priority (Safety<Damage<Comfort<Cosmetic) then season. Cycles reported.
- Pricing: best price = lowest of Home Depot/Harbor Freight/Other entries above zero. Estimate excludes `have` items.
- Tool check: case-insensitive substring match between project tool names and owned inventory.
- Cut lists (cutlist.js): inches with fractions ("1 1/2", "3/4"); sheets by shelf packing with rotation allowed and kerf; boards by first-fit-decreasing. Not grain-aware or optimal; say so.
- Exports (export.js): Obsidian bundle (zip stored, no compression), `.ics` (floating local time, yearly/monthly/weekly-with-BYMONTH rules, display alarm), Tasker CSV, cost CSV, JSON backup, README and CLAUDE-REFERENCE generated from current state.

## Limits and honest notes
- Not an APK. PWA install needs HTTPS hosting. Android SDK was not available in the build environment, so no native wrapper was built or tested.
- Downloads are blocked inside the Artifact viewer; Copy buttons work there. In that viewer data lives only in that viewer's browser.
- Tested in headless Chromium: navigation, materials pricing, cut layouts, ICS (30 events), zip (17 files valid). Not tested on a real Android device or installed PWA, and the `.ics` was not imported into a real calendar.
- Do not add live price scraping or AI calls without Chris asking; he chose manual entry.
- Maintenance content is general guidance; gas, flue and suspect asbestos work are for licensed pros.
