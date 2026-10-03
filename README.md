# House Bible v2

A free, shared home-management app for one house: 353 Washington St, Canton MA (old house, one-pipe steam heat). Two people, phones and PCs, one set of records.

- Maintenance schedule with reminders, documents vault, room and appliance records, steam log, projects, expenses, tools.
- Data lives in a Google Sheet. Files live in Google Drive. Reminders go to Google Calendar. A small Google Apps Script is the go-between.
- The app itself is a static web page (a PWA) on GitHub Pages. It holds no data of its own except a local copy for offline use.
- No build step, no npm dependencies, no AI backend, no price scraping. Everything is typed in by hand.

The binding design is in [docs/CONTRACT.md](docs/CONTRACT.md). Decisions are logged in [docs/DECISIONS.md](docs/DECISIONS.md). Steps only Chris can do (Google and GitHub clicks) are in [docs/HUMAN-STEPS.md](docs/HUMAN-STEPS.md).

## Layout

```
web/            the app (index.html, sw.js, css/, js/core/, js/views/)
web/dev/        local mock server and tests (not deployed)
apps-script/    the Google Apps Script backend and its tests
tools/          deploy and import scripts
seed/           starter data: tasks, receipts, house facts
docs/           contract, decisions, human steps, status reports
legacy/v1/      the old single-browser version, kept for reference only
```

## Run it locally with the mock server

You need Node 20 or newer. Nothing to install.

```bash
node web/dev/mock-server.mjs
```

Open http://localhost:8787/ . On the Connect screen use the address `http://localhost:8787/exec`, the key `dev`, and any device name. Or open this one-click link:

`http://localhost:8787/#/connect?u=http%3A%2F%2Flocalhost%3A8787%2Fexec&k=dev`

The mock behaves like the real backend (same API, newest edit wins). Its data is kept in `web/dev/data.json`; delete that file to start fresh. Use `PORT=9000` or `MOCK_KEY=secret` to change the port or key.

Load the starter data into whichever backend you are connected to (add `--dry-run` first to see what would be written; both scripts skip anything already there, so running them twice is safe):

```bash
node tools/load-seed.mjs        --url http://localhost:8787/exec --key dev   # starter maintenance tasks
node tools/import-receipts.mjs  --url http://localhost:8787/exec --key dev   # tools, expenses, paint, project ideas from receipts
```

Tests:

```bash
node --test web/dev/tests/*.test.mjs web/js/core/*.test.mjs web/js/views/*.test.mjs tools/*.test.mjs
node --test apps-script/test/*.test.mjs
```

## Deploy

One-time setup, in order. Each has click-by-click steps in [docs/HUMAN-STEPS.md](docs/HUMAN-STEPS.md):

1. Create the Google backend (Apps Script). This makes the Sheet, the Drive folders, the Calendar and the timers, and gives you a web app address ending in `/exec` and a shared key you choose.
2. Create a GitHub account and an empty public repository for the code. (The code is public. Your house data is not; it stays in your Google account.)
3. Publish the app to GitHub Pages:

```powershell
powershell -ExecutionPolicy Bypass -File tools\deploy-pages.ps1
```

That copies `web/` (without `web/dev`) to the `gh-pages` branch. Run it again whenever the app changes. Your site address is `https://<your-github-name>.github.io/<repo-name>/`.

4. Open the site on your computer, go to Connect, paste the `/exec` address and key, name the device (for example `Chris-PC`), tap Test and save.
5. Run the two load scripts above once against the real `/exec` address.

Changing the backend later: edit `apps-script/`, run `node apps-script/build.mjs`, paste or `clasp push`, then make a new deployment version.

## Add a second device

On a connected device open Connect, scroll to "Set up another device", tap Copy setup link, and send it privately to the other person (a direct message, not a group chat). The link contains the key, so delete the message afterwards. They open the link, type a device name such as `Wife-iPhone`, and tap Test and save. Then, on a phone, use the browser menu "Add to Home screen" to install it.

The key is not a password for Google. It only lets this app talk to your backend. Anyone with the link and key can read and change the house records, so share it only with people who should.

## Backups

- The Sheet has Google's normal version history (File, Version history).
- A monthly timer in the backend copies the whole spreadsheet into a Drive folder called `House Bible Backups` and keeps the last 12.
- Deleting in the app only marks a row as deleted; nothing is physically removed, and the backend never deletes Drive files.
- A hidden `changelog` tab records which device changed which row.
- Sensitive items (account numbers, codes) are encrypted on your device with the household passphrase before they reach the Sheet. If the passphrase is lost they cannot be recovered. Passwords still belong in a password manager.
- Each device also keeps a local copy and a queue of unsent edits, so the app opens and records changes offline and syncs when the connection returns.

## Safety note

The app gives plain advice, but gas, flue, main electrical work, and anything that might be asbestos or lead paint are always a licensed-pro job.
