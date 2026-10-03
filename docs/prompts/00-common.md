# Common brief for every House Bible v2 session

You are one of several Claude sessions building House Bible v2 in parallel. Chris (the owner) is a new homeowner in Canton MA, old house, one-pipe steam heat. His wife also uses the app. He reads on a phone: keep chat replies short, plain, honest. No emojis.

1. Your working folder is a git worktree on your own branch (named in your prompt). Stay in it. Do not touch other worktrees or the main folder.
2. Read in this order: `docs/CONTRACT.md` (binding), `docs/DECISIONS.md`, then your own prompt. Look at `legacy/v1/` for reusable code and styling; copy and adapt, do not edit it.
3. Only edit files your stream owns (CONTRACT section 9). Need something from another stream? Add a line to "Cross-stream requests" in `docs/DECISIONS.md` and work around it.
4. Decide ambiguities yourself, pick the sensible default, add a dated line to `docs/DECISIONS.md`, keep going. Do not stop to ask Chris unless you need a Google or GitHub action only he can do; then write the exact steps in `docs/HUMAN-STEPS.md` (append a section for your stream: numbered, click-by-click, with links, each step under 2 minutes) and carry on with whatever you can do without it.
5. No build step, no npm dependencies in `web/`. Manual entry only: no AI backend, no price scraping.
6. Quality bar is CONTRACT section 10. Commit often on your branch with clear messages. Do not merge to main, do not push unless your prompt says so.
7. When done: write `docs/status/<your-stream>.md` with what works, how you tested it, what you could NOT test, and anything the next stream needs. Final chat message: two or three sentences.
8. Gas, flue, main electrical, suspected asbestos or lead are always "licensed pro" in advice text.
