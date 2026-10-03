---
type: handoff
project: House Bible
created: 2026-10-03
source: Cowork session (cloud), research task "home dashboard software feature gaps"
---
# Handoff: House Bible feature gap research

## What was made
Two files comparing House Bible v2 with other home-management and home-dashboard apps, and listing features House Bible doesn't have yet.

| File | For | What's in it |
|---|---|---|
| `House Bible - Feature gaps vs other home apps.md` | Chris | Plain-language list: 6 worth adding, 6 nice to have, features skipped on purpose, suggested order |
| `House Bible - Feature gaps (Claude reference).md` | Claude | Build notes per gap: schema fields to add, files and views to change, owning stream, API details, sources, what wasn't verified |

## Where they are
1. **On the laptop, in the repo (saved):**
   `C:\Users\geany\Claude\house-bible-app\house-bible\docs\research\`
   - Not committed to git. They're untracked files in the `main` worktree.
2. **In the Cowork chat:** in the sidebar of the session where they were made.
3. **Obsidian General vault: not copied yet.** This session couldn't reach the vault. Copy both files to:
   `C:\Users\geany\Google Drive Streaming\My Drive\Vaults\Synced\General\Areas\Home Projects\House Bible\`
   Optionally put the Claude reference in the Claude vault at `C:\Users\geany\Documents\Vaults\Claude\House Bible\`, following the convention in `docs/prompts/S6-data.md`.

## For the next Claude session (Claude Code on desktop)
- Read the Claude reference file first. It's self-contained and lists the baseline (repo `house-bible`, `main` at commit `afaa2b8`) and Chris's constraints (free, manual entry, no AI, no price scraping, no weekly digest).
- To-dos:
  1. Copy both files into the General vault (see path above), applying the vault's own formatting and storage rules.
  2. Ask Chris whether to `git add docs/research/` and commit, or move the files out of the repo.
  3. If Chris picks features to build, start with gaps 1 (global search) and 2 (contractor link and service history), per the suggested order.
- Open questions for Chris: recall checks (gap 6) and heating degree days (gap 7) both have the app fetch outside data on its own. Get his OK before building either one.
