# House Bible: feature gaps, parallel build plan

Source: `docs/research/House Bible - Feature gaps (Claude reference).md` (gap numbers below match it). Baseline: `main` at `de9295c`. Binding spec: `docs/CONTRACT.md` v2.

## Decisions made (no questionnaire: research already done, Chris's constraints already in DECISIONS)
- In scope now: gaps 1 to 5 plus small extras 10 (history view) and 12 (tool location/lent_to), and 11 (house history export) last.
- Held until Chris says yes: 6 (recall checks) and 7 (heating degree days). Both fetch outside data on their own. Cheap manual alternative for 7 is a typed HDD field on utilities rows; included in Wave 2 as optional.
- Deferred/cut by default: 8 (chore rotation, low value), 9 (policies: reuse documents.expires + yearly task instead).
- `belonging` added to assets.kind (gap 4) via a CONTRACT v3 change made by the Foundation session.

## Why a Foundation session first
Three gaps all edit `assets` (schema, detail panel, form, reports). Without agreed schema and file seams they collide. Foundation appends every new column once, adds hook stubs in `assets.js` / `contacts.js`, writes CONTRACT v3, then everyone builds on it.

## Waves

### Wave 0: Foundation (solo, ~30 min, Opus) branch `f0-schema`
Owns: `apps-script/*`, `docs/CONTRACT.md`, hook stubs only in `web/js/views/assets.js`, `contacts.js`, `reports.js`.
- Append columns (never reorder/rename): `task_log.contact`, `expenses.contact` (ref:contacts); `assets.expected_life_years`, `replace_cost`, `purchase_price` (num), `purchase_date` (date), `replacement_value` (num); `tools.location`, `lent_to` (text); `utilities.hdd` (num, optional).
- `assets.kind` enum gains `belonging`.
- API action `history` `{limit, table?, id?}` over the `changelog` tab.
- Rebuild schema.json, update seed/mock server, `node --test` green, redeploy via clasp (Chris step if clasp auth lapsed).
- Stub seams so Wave 1 never edits the same lines:
  - `assets.js`: calls `renderServiceHistory(asset, el)` imported from new `web/js/views/assets-history.js` (stub returns nothing), and `renderLifespanFields`/`valueFields` helpers imported from new `assets-values.js` (stubs).
  - `contacts.js`: calls `renderJobs(contact, el)` from new `contacts-jobs.js` (stub).
  - `reports.js`: calls `lifespanSection()` and `insuranceSection()` from new `reports-forecast.js` (stub).
- Merge to `main`. Tell Chris to redeploy Apps Script if needed.

### Wave 1: four in parallel (after Wave 0 merges). Worktrees `hb-g1`..`hb-g4`
| Session | Branch | Gap | Model | Est. | Owned paths |
|---|---|---|---|---|---|
| G1 Search | `g1-search` | 1 | Sonnet | 40 min | `web/js/core/search.js` (new), `web/css/search.css` (new), small hooks in `web/index.html`, `web/js/core/app.js`, `web/sw.js` (cache list + version bump) |
| G2 Service history | `g2-service` | 2 | Sonnet | 60 min | `web/js/views/assets-history.js`, `contacts-jobs.js`, `maintenance-actions.js` (contractor select in Done dialog), expenses form contractor field in `web/js/views/expenses*.js` |
| G3 Lifespan + insurance | `g3-values` | 3, 4 | Opus (forecast math) | 75 min | `web/js/views/assets-values.js`, `reports-forecast.js`, `web/js/core/plan.js` additions (new functions only) |
| G4 Wall mode | `g4-wall` | 5 | Sonnet | 50 min | `web/js/views/wall.js`, `web/css/wall.css`, views manifest entry |

No file appears twice. G1 and G4 both bump `sw.js` cache: G1 owns the bump, G4 adds its files to the list in a separate line and tells integration; Integration resolves.

Merge point 1: after all four finish, integration session (Wave 2) merges in order G2, G3, G1, G4.

### Wave 2: Integration + small extras (solo, ~60 min, Sonnet) branch `i1-integrate`
- Merge G1 to G4, resolve `sw.js` / manifest conflicts, bump cache version.
- Playwright at 400 px and 1200 px against mock server: search finds an asset and a contact, done-dialog saves contractor, asset detail shows service history, reports show lifespan + insurance totals, `#/wall` renders and holds wake lock when supported. Zero console errors.
- Extras (own these files): history screen under settings (gap 10), `location` / `lent_to` in tools view (gap 12), optional HDD field on utilities rows.
- Status note `docs/status/I1-integrate.md`.

### Wave 3: Polish (optional, ~45 min, Sonnet) branch `p1-export`
- Gap 11 house history export (printable packet) in `reports-forecast.js` neighbours; docs refresh; Chris-facing "what's new" note.

## Hand steps for Chris (when)
1. After Wave 0: run `clasp push` + new deployment version (or paste the steps from `HUMAN-STEPS.md`). Wave 1 can start before this; only the live app needs it.
2. After Wave 2: reload app on phones (service worker refreshes within a minute).
3. Anytime: say yes/no on recall checks (6) and heating degree days (7).

## Safety rails
- Each branch: `node --check`, `node --test`, Playwright smoke at two widths, status note stating what was NOT tested.
- Schema changes are append-only, so rollback = revert the code; extra empty columns are harmless.
- Nobody merges to `main` except Foundation and Integration.
- If a session needs a contract change: line in DECISIONS "Contract requests", work around it.

## Time
Wave 0: 30 min. Wave 1: about 75 min wall clock (longest is G3). Wave 2: 60 min. Wave 3: 45 min. Total about 3.5 hours wall clock, versus about 6 hours serial.
