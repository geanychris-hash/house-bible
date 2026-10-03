# Human steps

Each stream appends its own section here. Numbered, click-by-click.

## S3 Maintenance
Load the starter tasks (43 house and steam tasks) once the backend is running. About 2 minutes.
1. Open a terminal in the project folder (the one containing `tools` and `seed`). You need Node installed (nodejs.org, the LTS download).
2. Test first without changing anything (replace the two values with your Apps Script web app URL and your shared key):
   `node tools/load-seed.mjs --url "YOUR_URL" --key "YOUR_KEY" --dry-run`
3. If it says how many tasks it would add, run the same line without `--dry-run`.
4. Safe to run again later: it skips tasks that are already there and never overwrites your edits.
5. Open the app, Maintenance. Pet and medicine reminders (like heartworm) are yours to add with "Add recurring thing".
