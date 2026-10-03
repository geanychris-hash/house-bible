# Kickoff prompts: feature gaps build

Each block is a copy-paste prompt for a new Claude Code session. Start from the worktree named in the block. Create worktrees from `main` with:

```bash
cd /c/Users/geany/Claude/house-bible-app/house-bible
git worktree add ../hb-f0 -b f0-schema
```
(Wave 1: `../hb-g1 -b g1-search`, `../hb-g2 -b g2-service`, `../hb-g3 -b g3-values`, `../hb-g4 -b g4-wall` AFTER Wave 0 merges. Wave 2: `../hb-i1 -b i1-integrate`.)

Common rules for every session: read `docs/prompts/00-common.md` first (same rules as v2), then `docs/CONTRACT.md`, `docs/DECISIONS.md`, `docs/plans/feature-gaps-parallel-plan.md`, and `docs/research/House Bible - Feature gaps (Claude reference).md`.

---

## Wave 0: F0 Foundation (Opus)
```
You are session F0 (Foundation) for the House Bible feature-gaps build. Working folder: the worktree hb-f0 on branch f0-schema. Read docs/prompts/00-common.md, docs/CONTRACT.md, docs/DECISIONS.md, docs/plans/feature-gaps-parallel-plan.md and the Claude reference in docs/research/. You are the only session allowed to edit docs/CONTRACT.md and apps-script/*.

Do exactly this:
1. In apps-script/build.mjs SPEC, append (never reorder/rename): task_log.contact and expenses.contact (ref:contacts); assets.expected_life_years, replace_cost, purchase_price, purchase_date(date), replacement_value; tools.location, lent_to (text); utilities.hdd (num). Add "belonging" to assets.kind. Rebuild schema.json.
2. Add API action "history" {limit, table?, id?} reading the changelog tab, newest first.
3. Create stub modules that Wave 1 will fill, and wire their calls into the owning views with minimal edits: web/js/views/assets-history.js (renderServiceHistory(asset, el)), assets-values.js (lifespanFields/valueFields form helpers + display helper), contacts-jobs.js (renderJobs(contact, el)), reports-forecast.js (lifespanSection(), insuranceSection()). Stubs return empty output and do not break existing views.
4. Update seed and the mock server for the new columns. Write CONTRACT v3 (section 11 list) including the new columns, kind enum, history action, and the new file ownership rows.
5. node --check, node --test green, Playwright smoke at 400 and 1200 px with zero console errors.
6. Write docs/status/F0-schema.md. Commit often. Append to docs/HUMAN-STEPS.md the clasp push + redeploy steps (numbered, under 2 minutes each).
7. Merge f0-schema into main yourself (fast-forward) when green. Final message: 2 to 3 sentences.
```

## Wave 1: G1 Global search (Sonnet), branch g1-search
```
You are session G1 for House Bible feature gaps: global search (gap 1). Work in worktree hb-g1 on branch g1-search (created from main after F0 merged). Read the common docs listed in docs/plans/feature-gaps-kickoffs.md.

Owned paths only: web/js/core/search.js (new), web/css/search.css (new), small hooks in web/index.html, web/js/core/app.js, web/sw.js (add your files to the cache list and bump the cache version). Touch nothing else.

Build a command palette opened by "/" or Ctrl/Cmd+K, plus a header search button (phones). Search the local IndexedDB cache via HB.list across rooms, assets, shutoffs, tasks, consumables, documents (title, tags, notes), contacts, projects, materials, tools. Results are grouped by type, keyboard navigable, and route to the existing hash routes (e.g. #/asset/<id>). Port the matching approach from legacy/v1/js/finder.js. Works offline, no backend change, ignores soft-deleted rows, never indexes the sensitive table.
Done when: search finds seeded items of each type at 400 and 1200 px, Esc closes, zero console errors, node --check passes, unit test for the matcher with node --test. Write docs/status/G1-search.md (what was NOT tested: real phone). Commit often. Do not merge or push.
```

## Wave 1: G2 Contractor link + service history (Sonnet), branch g2-service
```
You are session G2 for House Bible feature gaps: contractor linkage and service history (gap 2). Worktree hb-g2, branch g2-service. Read the common docs listed in docs/plans/feature-gaps-kickoffs.md.

Owned paths only: web/js/views/assets-history.js, web/js/views/contacts-jobs.js (both exist as stubs from F0), web/js/views/maintenance-actions.js, and the contractor field in web/js/views/expenses*.js. The assets.js and contacts.js hook calls already exist; do not edit those files.

Build: (a) optional contractor select (from contacts) in the Done dialog writing task_log.contact; (b) optional contractor select on the expense form writing expenses.contact; (c) renderJobs: jobs list for a contact (task_log + expenses where contact = id, newest first) with lifetime total; (d) renderServiceHistory: for an asset, task_log rows whose task.asset = id, newest first, with date, note, cost, contact name linking to the contact. Keep contacts.last_job* columns untouched. Empty states in plain language.
Done when: seeded data shows history on an asset and jobs on a contact, offline outbox still syncs the new field, 400/1200 px, zero console errors, node --check, node --test for any pure grouping logic. Write docs/status/G2-service.md. Do not merge or push.
```

## Wave 1: G3 Lifespan forecast + insurance values (Opus), branch g3-values
```
You are session G3 for House Bible feature gaps: lifespan/replacement forecast (gap 3) and insurance inventory values (gap 4). Worktree hb-g3, branch g3-values. Read the common docs listed in docs/plans/feature-gaps-kickoffs.md.

Owned paths only: web/js/views/assets-values.js, web/js/views/reports-forecast.js (both stubs from F0), and NEW functions appended to web/js/core/plan.js (do not alter existing ones). Hooks in assets.js and reports.js already exist; do not edit those files.

Build: form fields for expected_life_years, replace_cost, purchase_price, purchase_date, replacement_value, and kind "belonging" support, with typical-lifespan hints as placeholder text only labelled "typical, check yours" (no unsourced numbers as fact). Forecast: parse a 4-digit year from install_date (text), remaining = install year + life - current year; list sorted by remaining, flag 3 years or less or past due, annual reserve = sum(replace_cost / max(remaining,1)). Insurance inventory: use purchase_price/replacement_value first, fall back to matchAssetCost, include photos and serials in the print view, show a total. Pure math in plan.js with node --test cases (missing year, past due, zero life).
Done when: seeded assets render both reports at 400/1200 px, print view is clean, zero console errors. Write docs/status/G3-values.md. Do not merge or push.
```

## Wave 1: G4 Wall display mode (Sonnet), branch g4-wall
```
You are session G4 for House Bible feature gaps: wall display mode (gap 5). Worktree hb-g4, branch g4-wall. Read the common docs listed in docs/plans/feature-gaps-kickoffs.md.

Owned paths only: web/js/views/wall.js (new), web/css/wall.css (new), the views manifest entry for wall (hidden from nav, route #/wall). In web/sw.js add only your two files to the cache list on their own line; do not bump the version (integration does).

Build a read-only, large-type, dark-default view: today's and overdue tasks (recur.js taskStatus), low consumables, active weather-alert status, next 3 to 5 days from occurrences(). Auto-refresh with the existing 60 s sync, screen wake lock via navigator.wakeLock (feature-detected, re-acquire on visibilitychange), no interactive controls except a tiny exit link. All data comes from the local cache; no Google Calendar read.
Done when: renders with seeded data at 1920x1080 and 400 px, wake lock code path guarded, zero console errors. Write docs/status/G4-wall.md. Do not merge or push.
```

## Wave 2: I1 Integration + extras (Sonnet), branch i1-integrate
```
You are session I1 (integration) for House Bible feature gaps. Worktree hb-i1 on i1-integrate from main. Read the common docs listed in docs/plans/feature-gaps-kickoffs.md and docs/status/G1..G4 notes.

1. Merge in order g2-service, g3-values, g1-search, g4-wall. Resolve sw.js/manifest conflicts, bump the cache version once.
2. Playwright against the mock server at 400 and 1200 px: search finds an asset and a contact; Done dialog saves a contractor; asset detail shows service history; contact shows jobs; reports show lifespan and insurance totals; #/wall renders. Zero console errors.
3. You own these extras: history screen under settings using the "history" action (gap 10); location and lent_to in the tools view (gap 12); optional HDD field on utilities rows with usage/HDD display (manual entry only, no fetching).
4. Write docs/status/I1-integrate.md including what was NOT tested. Merge to main when green. Final message: 2 to 3 sentences.
```

## Wave 3: P1 House history export (Sonnet), branch p1-export
```
You are session P1 for House Bible. Worktree hb-p1 on p1-export from main after I1 merged. Build gap 11: a printable house history packet (assets with service history, warranties, capital improvements by year, document index with Drive file names) as a new report section in a NEW file web/js/views/reports-export.js, hooked via one line in reports.js. Update README and docs with a short "what's new". Tests and status note as in other sessions. Do not push.
```
