---
type: readme
updated: 2026-09-30
---
# House Bible app

A standalone app for your old steam-heat house. It installs from the browser as its own app on Android and on desktop (Chrome or Edge), works offline, and keeps all data on your device. No AI and no accounts: everything is manual entry, as you asked.

## What it does
- **Home**: a year wheel showing the heating window and where today sits, what needs doing now, the next 30 days, radiator status, money, warranties and active projects.
- **House**: a cutaway **Map** (tap a floor to see everything on it), an animated one-pipe **Steam** diagram with a radiator status table and a Rounds walk-through, **Records** (shutoffs, systems, appliances, paint, warranties, log) and **Tools**.
- **Upkeep**: 30 seasonal tasks for a Massachusetts one-pipe steam house, as a list or the year wheel. Each has why, how, time and tools. Export `.ics` and a Tasker CSV.
- **Projects**: steps, materials with Home Depot / Harbor Freight / Other prices, tools check against your inventory, cut lists with drawn layouts, purchases and budget. A **Flow** graph shows what blocks what; **Shopping** groups what you still need by cheapest store.
- **Setup Sprint** (Home card or More): three short sessions, add-common packs, paste-a-list, quick fill, photo inbox, barcode scan and data-plate reading. See the House Setup Plan note.
- **Find a tool** (House > Tools, or Setup): type a brand and tool, see matching models from the built-in Bauer list, open image search, or scan a barcode, or paste a product link (name and item number come from the link), then answer only the questions that matter for that kind of tool. Your own photos attach to it.
- **Import list** (House > Tools): add tools and paint from a JSON list, such as one made from your store receipts.
- **Everywhere**: press `/` or Ctrl/Cmd+K to search all of it, tap **Shutoffs** for the emergency sheet (shutoffs plus phone numbers), light and dark themes.
- **More**: Obsidian-ready zip export (includes Radiators), import/restore, rename floors, set heating window, emergency numbers, remove example rows.

## Run it
Fastest: open the published page on your phone. Data there lives in that browser.

To install as a real app, host the `house-app` folder on any HTTPS site. The free options that take two minutes:
1. Netlify Drop (app.netlify.com/drop): drag the folder in, open the link on your phone.
2. GitHub Pages: push the folder to a repo and enable Pages.
Then on Android Chrome: menu > Install app. On desktop Chrome/Edge: install icon in the address bar.

To try it on a computer without hosting: in the folder run `python3 -m http.server 8000` and open http://localhost:8000.

## Good to know
- Prices are typed in by you. Search buttons open Home Depot or Harbor Freight searches; the app does not fetch prices.
- Your data stays in the browser or installed app on each device. Use More > Download backup and Import to move it between phone and desktop.
- If Download does nothing in a viewer that blocks downloads, use the Copy buttons.
- This is a web app installed from the browser, not an APK from an app store. A true APK can be made from it later with PWABuilder or Bubblewrap; it needs the app hosted first.
- Maintenance text is general guidance. Follow your boiler manual; use a licensed pro for gas, flue and suspect asbestos.

For the agent-facing description, see `CLAUDE-REFERENCE.md`.
