# Human steps

Each stream appends its own section here. Numbered, click-by-click.

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
