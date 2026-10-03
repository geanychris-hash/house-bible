# Human steps

Each stream appends its own section here. Numbered, click-by-click.

## S1: Backend (Apps Script)

Live deployment has NOT been tested. Nothing here has run against real Google services yet. The steps below are the first real test. Total time: about 15 minutes. Do them in order.

You need: a Google account (the one that will own the data), and the file `apps-script/dist/HouseBible-all.gs` from this repo (one file, everything in it).

### Path A: web editor (no installs, recommended)

1. Open https://script.google.com and click **New project**. Name it "House Bible" (click "Untitled project" at the top).
2. Click the gear icon on the left (**Project Settings**). Tick **Show "appsscript.json" manifest file in editor**.
3. Click the pen icon (**Editor**). Click `appsscript.json`, select all, and paste the contents of `apps-script/appsscript.json`. Press Ctrl+S.
4. Click `Code.gs`, select all, and paste the whole contents of `apps-script/dist/HouseBible-all.gs`. Press Ctrl+S.
5. In the function dropdown at the top pick **setup** and click **Run**. Click **Review permissions**, choose your account, click **Advanced**, then **Go to House Bible (unsafe)**, then **Allow**. (It says unsafe only because you wrote it yourself and Google has not reviewed it.) Wait for "Execution completed" in the log. This creates the Sheet, the Drive folders, the calendar and the timers.
6. Find the line `setKey('CHANGE-ME-TO-A-LONG-PHRASE');` near the bottom. Replace the text inside the quotes with a long key phrase of your own (12 or more characters, for example four random words). Write it down: you and your wife type this key into the app on each device.
7. Pick **runSetKey** in the dropdown and click **Run**. Then change the line back to `CHANGE-ME-TO-A-LONG-PHRASE` and press Ctrl+S, so the key is not left in the code. (Only its hash is stored.)
8. Click **Deploy** (top right), **New deployment**, click the gear next to "Select type", choose **Web app**. Set **Execute as: Me** and **Who has access: Anyone**. Click **Deploy**. Allow again if asked.
9. Copy the **Web app URL** (ends in `/exec`). Keep it private. The app needs this URL plus your key.
10. In a terminal in this repo run: `node tools/hb-cli.mjs ping --url "PASTE_URL" --key "YOUR KEY"`. Success shows `"ok": true` and a `schemaVersion`.
11. Browser check (this is the CORS spike): open `apps-script/spike/cors-spike.html` in Chrome, paste the URL and key, click **Test**. It should say PASS. Tell Claude the result either way.
12. Optional: `node tools/hb-cli.mjs test-alert --url ... --key ...` sends a test email to your Google address.
13. Optional, once: open the Sheet (in Drive as "House Bible") and check the `settings` row `house`: lat 42.158, lon -71.145. Confirm on a map that this is your house; edit the numbers in the Sheet if not.

When the code changes later: paste the new `HouseBible-all.gs` over `Code.gs`, then **Deploy > Manage deployments > pencil icon > Version: New version > Deploy**. The URL stays the same.

### Path B: clasp (fewer pastes, needs Node and one-time setup)

1. `npm install -g @google/clasp`, then `clasp login`.
2. Turn on the Apps Script API at https://script.google.com/home/usersettings .
3. In the repo root: `clasp create --type standalone --title "House Bible" --rootDir apps-script`, then `clasp push` (answer `y` to overwrite the manifest).
4. `clasp open-script`, then continue at step 5 above (clasp did steps 1 to 4). Later updates: `clasp push`, then a new version under Manage deployments.

If something fails, send Claude the red error text and the step number.
