---
type: claude-reference
audience: Claude (Cowork or Claude Code)
project: House Bible
updated: 2026-10-03
companion: "House Bible - Feature gaps vs other home apps.md"
---
# House Bible feature gap analysis: Claude reference

Cold-start context for a session that will plan or build any of these. The human version has the reasoning in plain language; this file has the implementation detail.

## Baseline examined
- Repo: `C:\Users\geany\Claude\house-bible-app\house-bible` (merged `main`, last commit `afaa2b8`; integration status in `docs/status/S7-integration.md`). Binding spec: `docs/CONTRACT.md` (v2 after S7). Decisions: `docs/DECISIONS.md`.
- Stack: vanilla-JS PWA (`web/`, no build, no npm deps) -> Apps Script web app -> Google Sheet tabs, Drive files, Calendar, Gmail (weather alerts only). Schema source of truth: `apps-script/schema.json`, generated from SPEC in `apps-script/build.mjs` (edit SPEC, rebuild, redeploy; new columns append automatically, never reorder or rename).
- Views present: home, maintenance (+form/calendar/actions), consumables, weather-alerts, documents, rooms, assets, shutoffs/emergency, contacts, steam, sensitive, qr, projects, materials, expenses, tools, utilities, reports, visuals, settings.
- Chris's constraints (DECISIONS): free; manual entry only; no AI backend; no price scraping; no weekly digest email; reminders via Google Calendar; email only for weather. CUT from v1: barcode/OCR, Find-a-tool catalog, cut-list optimizer, Tasker CSV, Obsidian zip. Gas, flue, main electrical, asbestos, lead = "licensed pro" in advice text.

## Verified absent in code (grep of web/js, apps-script on 2026-10-03)
- No app-wide search: `router.js`, `app.js`, `index.html`, `home.js` have no global search or `/` / Ctrl+K handler. v1 had one (`legacy/v1/js/finder.js`, README "Everywhere").
- No contact ref on `task_log` or `expenses`. `task_log.by` is free text. `assets.js` detail (~line 111-125) lists `tasks` for the asset but not `task_log` completions.
- No lifespan, expected life, replacement cost, purchase price or value field on `assets`. `reports.js` insurance inventory takes cost from `plan.js matchAssetCost()`, a fuzzy substring match of asset name against `expenses.item`.
- No recall feature (`recall` grep: zero hits).
- No kiosk or wall route.
- Utilities: `plan.js utilityTrend`, `yearOverYear` only; no weather normalization (no HDD).
- Task assignee is plain text; no rotation logic.
- `changelog` tab is written in `Store.gs` but nothing in `web/` reads it, and no API action exposes it.
- No location field on `tools`.

## Gaps, ranked, with build notes
Owner stream names follow CONTRACT section 9 (schema = S1, core = S2, maintenance = S3, records = S4, projects/money = S5, home/visuals = S6). Post-integration, any session may do it, but keep the file ownership boundaries in mind.

1. **Global search** (core/S2). Command palette opened by `/` or Ctrl/Cmd+K plus a header search button (phones have no keyboard shortcut). Search the local IndexedDB cache via `HB.list` across rooms, assets, shutoffs, tasks, consumables, documents (title, tags, notes), contacts, projects, materials, tools. Route results to existing hash routes such as `#/asset/<id>`. Port the matching approach from `legacy/v1/js/finder.js` / v1 shell. Must work offline; no backend change.
2. **Contractor linkage and service history** (S1 schema + S3 + S4 + S5). Append `contact` (ref:contacts) to `task_log` and `expenses`. Done dialog in `maintenance-actions.js` gets an optional contractor select. `contacts.js` detail: jobs list (task_log + expenses where contact = id) and lifetime total. `assets.js` detail: "Service history" panel from task_log rows whose task.asset = id, newest first, with cost and contact. `contacts.last_job*` could then be derived, but keep the columns (never remove).
3. **Lifespan and replacement forecast** (S1 + S4 + S5 reports). Append to `assets`: `expected_life_years` (num), `replace_cost` (num). `install_date` is text (approximate, S1 decision), so parse a 4-digit year from it. Output: list sorted by remaining life (install year + life - current year), flag at 3 years or less or past due, plus annual reserve = sum(replace_cost / max(remaining,1)). Offer typical-lifespan hints as placeholder text only, user-entered (for example cast-iron steam boiler, tank water heater, asphalt roof). Do not assert numbers as facts without a source; label them "typical, check yours".
4. **Insurance inventory values** (S1 + S4 + S5). Append to `assets`: `purchase_price` (num), `purchase_date` (date), `replacement_value` (num), and extend `kind` enum with `belonging` (needs a CONTRACT change; or use `other` plus a tag if the contract owner declines). `reports.js`: use these fields first, fall back to `matchAssetCost`. Include photos and serials in the print view and show a total.
5. **Wall display mode** (S6). New view `wall` (hidden from nav, reached by `#/wall`): read-only, large type, auto-refresh via existing 60 s sync, screen wake lock (`navigator.wakeLock`, feature-detected), today's and overdue tasks (`recur.js taskStatus`), low consumables, active weather alert status, the next 3 to 5 calendar days computed from tasks with `occurrences()`. Dark theme default. No Google Calendar read needed: the data is already local. Context: Chris plans a wall-mounted smart calendar and a home server (Unraid on a used SFF PC); a tablet or browser kiosk on that box could show this.
6. **Recall checks** (S1). CPSC Recalls API, free, no key: `https://www.saferproducts.gov/RestWebServices/Recall?format=json` with params such as `ProductName`, `Title`, `RecallDescription` (full list in CPSC Programmer's Guide v1.4). Monthly time trigger: for each asset with brand+model, query, match brand AND model string in returned products/description; de-dup by RecallID in Script Properties; email `settings.notify.emails` and create a Calendar event, mirroring `Weather.gs`. Store `settings.recalls = {enabled, lastRun, seen:[ids]}`. **Ask Chris first:** it is outbound automated fetching (not price scraping, but close to his no-scrape spirit). Expect false positives; show matched text in the email.
7. **Heating degree day normalization** (S1 + S5). Needs daily mean temps for the bill period. NWS (`api.weather.gov`, already used) gives forecasts, not easy history. Candidate free no-key source: Open-Meteo historical archive API (verify terms before use). Compute HDD base 65 F per bill period server-side, cache in `settings` or a new `degree_days` tab; `utilities.js` shows usage/HDD by season. Same "ask Chris" caveat as 6. Manual alternative: an HDD field on the utilities row that he types from the gas bill (many bills print it).
8. **Chore rotation** (S3). Optional `rotation` value in task assignee (`"rotate"`): next assignee = household member with fewer task_log rows for that task (Grocy "who-least-did-first"). Low priority.
9. **Policies and renewals** (S1 + S4). Either a `policies` table (name, type insurance|mortgage|tax|other, provider, renews (date), premium (num), document ref, notes; policy numbers go in `sensitive`) or reuse documents.expires plus a task with a `yearly` rule. Prefer reuse unless Chris wants premium history.
10. **Change history view** (S1 + S2). New API action `history` with `{limit, table?, id?}` returning recent changelog rows; a settings sub-screen listing them. Undo is out of scope; show the old row if cheap.
11. **House history export** (S5 reports). Printable or zip packet: assets with service history, warranties, capital improvements by year, document index with Drive file names. Builds on items 2 to 4.
12. **Storage location and lending** (S1 + S5). Append `location` (text) and `lent_to` (text) to `tools`.

## Deliberately excluded (conflict with Chris's decisions)
AI photo/appliance recognition and manual retrieval (Homer, HomeZada, OnOtto); home value/equity (HomeZada; paid data feeds); contractor marketplaces and rewards (HomeBinder, Dwellin); gamification (OnOtto, Sweepy, Tody); meal planning and groceries (Skylight, Grocy, Cozi); weekly digest; barcode and data-plate OCR (cut).

## Competitor feature notes (sources checked 2026-10-03)
- HomeZada: inventory with photos and values, maintenance calendar and checklists, project budgets, home value and equity, documents, multi-property, AI assistant. https://www.homezada.com/
- Centriq: nameplate scan for manuals, parts, warranties, recall flags; shut down (sources say early 2025). https://upkeepify.com/blog/centriq-alternative/
- Upkeepify: asset capture, document vault, CPSC-matched recall alerts, whole-home reminders. Same source.
- HomeBinder: reminders by text/email, recall alerts from make/model, document storage, projects from inspection reports, service providers, inventory; distributed via home inspectors. https://pages.homebinder.com/
- Dwellin: address auto-populated home data, schedule based on home age, annual maintenance and replacement cost estimates. DwellPulse: home transfer packet, weather-aware yard alerts, cost forecasting. https://www.dwellpulse.com/blog/the-best-home-maintenance-apps-in-2026-an-honest-comparison/ and https://realestateledger.io/guides/best-homeowner-apps
- OnOtto: tasks persist until done, household of 6, points and streaks, chores combined with maintenance. https://www.onotto.com/best-home-maintenance-app/
- HomeBox (self-hosted): locations, labels, custom fields, QR label maker, maintenance log, warranty, attachments, CSV import/export, fractional quantities. https://github.com/sysadminsmedia/homebox and https://docs.elfhosted.com/app/homebox/
- Grocy: chores with hourly to yearly, manual and adaptive periods, assignment by alphabetical, random or who-least-did-first; battery charge-cycle tracking; equipment with PDF manuals. https://deepwiki.com/grocy/grocy/2.4-chore-task-battery-and-equipment-management
- DAKboard and Skylight: wall dashboards with calendar sync, weather, photos, chores and rewards, meal plans, lists; DAKboard runs on any screen including a Raspberry Pi. https://dakboard.com/c/comparisons/dakboard-vs-skylight/
- CPSC Recalls API: free, public, JSON via `format=json`. https://www.cpsc.gov/Recalls/CPSC-Recalls-Application-Program-Interface-API-Information
- Home Assistant energy: gas tracking needs meter hardware (pulse, AMR via RTL-SDR, camera reader). Possible future tie-in with Chris's home server; not a House Bible change. https://www.home-assistant.io/docs/energy/gas/

## Not verified
Claims about competitor features come from vendor pages and review articles, not hands-on use. CPSC API parameters beyond the three shown on its info page were not tested. Open-Meteo terms were not checked.
