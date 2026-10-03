# S7 Integration and real-device testing (branch integration, WAVE 3, after S1 to S4 are done; S5 and S6 may still be merging)
Read 00-common.md first. You own `docs/CONTRACT.md` in this phase.

1. Merge s1 through s6 into an `integration` branch one at a time, resolving conflicts, running every `node --test` suite and `node --check` on every JS file after each merge.
2. Run the PWA against the mock server, then against Chris's deployed Apps Script (he supplies the URL and key; never write the key into any file in the repo, and make sure `.gitignore` covers any local config).
3. Playwright pass at 400 px and 1200 px: every view renders, add, edit and delete a row in each table, upload a file, complete a task, make an offline edit then reconnect and sync, and a two-device conflict (two browser contexts).
4. Walk Chris through the real device checks (exact taps in `docs/HUMAN-STEPS.md`): install on the Samsung and the iPhone, camera capture, upload a PDF, calendar events appear in his Google Calendar, a test weather alert email arrives, and his wife's device connects through the setup link.
5. Fix bugs, bump the contract version, merge to `main`. Report what was verified on real devices and what was not.
