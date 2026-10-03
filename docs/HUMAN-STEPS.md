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
## S2: Put the app online and on the phones
Do these once. Order matters. Each step is under 2 minutes except step 5 (about 5).

### A. GitHub account and repo
1. Go to https://github.com/signup and create a free account (email, password, username). Verify the email. Pick a username you do not mind in the app address: the site will be `https://<username>.github.io/<repo>/`.
2. Go to https://github.com/new. Repository name: `house-bible`. Choose **Public** (Chris said public is fine; the code holds no data and no key). Leave all the "Add a README / .gitignore / license" boxes unticked. Click **Create repository**.
3. Copy the repo address shown on the next page (looks like `https://github.com/<username>/house-bible.git`). Tell Claude, or run this in the project folder (replace the address): `git remote add origin https://github.com/<username>/house-bible.git`
4. Push the code once from the project folder: `git push -u origin main` (after Integration has merged to main). A browser window opens the first time; sign in to GitHub there.

### B. Publish the site (GitHub Pages)
5. In the project folder run: `powershell -ExecutionPolicy Bypass -File tools\deploy-pages.ps1`. It copies the `web` folder to a branch called `gh-pages`. Re-run it any time to publish a new version.
6. On GitHub open your repo, then **Settings** (top right of the repo), then **Pages** (left list). Under "Build and deployment" set **Source: Deploy from a branch**, **Branch: gh-pages**, folder **/ (root)**, click **Save**.
7. Wait about one minute, refresh the Pages screen. It shows "Your site is live at https://<username>.github.io/house-bible/". Open that link. You should see the House Bible Connect screen.

### C. Connect each device
8. On the Connect screen paste the Apps Script address (ends in `/exec`) and the shared key, type a device name (for example `Chris-phone`), tap **Test and save**.
9. To set up your wife's phone or PC: on your connected device open **Connect**, scroll to "Set up another device", tap **Copy setup link**, and send it to her privately (direct message, not a group chat). The key is inside that link, so delete the message afterwards. She opens it, types a device name (for example `Wife-iPhone`) and taps Test and save.

### D. Install to the home screen
10. **Android (Samsung, Chrome):** open the site link in Chrome. Tap the three dots, then **Add to Home screen** (or **Install app**), then **Install**. It appears as "House Bible".
11. **iPhone (must be Safari, not Chrome):** open the site link in Safari. Tap the **Share** button (square with an arrow, bottom of the screen). Scroll the list, tap **Add to Home Screen**, then **Add**.
12. **Windows PC (Chrome or Edge):** open the site, click the install icon at the right end of the address bar (or menu, then **Install House Bible**). Optional.

Notes
- Push notifications are not relied on, especially on iPhone. Reminders come from Google Calendar events and weather alert emails (set up by the backend steps), not from the app.
- The app works offline from what it last saved. Changes made offline wait on the phone and send themselves the next time it is online and the app is open.
- Updating the site: run step 5 again. Phones pick up the new version the next time they open the app with a connection (open it twice if it still looks old).
## S3 Maintenance
Load the starter tasks (43 house and steam tasks) once the backend is running. About 2 minutes.
1. Open a terminal in the project folder (the one containing `tools` and `seed`). You need Node installed (nodejs.org, the LTS download).
2. Test first without changing anything (replace the two values with your Apps Script web app URL and your shared key):
   `node tools/load-seed.mjs --url "YOUR_URL" --key "YOUR_KEY" --dry-run`
3. If it says how many tasks it would add, run the same line without `--dry-run`.
4. Safe to run again later: it skips tasks that are already there and never overwrites your edits.
5. Open the app, Maintenance. Pet and medicine reminders (like heartworm) are yours to add with "Add recurring thing".
