---
type: software
status: active
started: 2026-09-30
tags: [home-projects, house-bible, webapp, v2]
---
# House Bible: what we're building

The plain-language version. Technical version: [[House Bible Design (technical)]]. How we got here: [[House Bible v2 - Plan]] and [[House Bible v2 - Questions]].

## The idea
One place for everything about the house, shared by you and your wife, on your phones and PCs. It tells you what needs doing and when, and it keeps the papers, photos, model numbers and receipts that you would otherwise hunt for.

The first version (v1) kept everything inside one browser, so a second phone saw an empty copy. Version 2 fixes that: the records live in a Google Sheet that both of you edit through the app.

## What it does
- **Maintenance.** A schedule of recurring jobs for an old Massachusetts house with one-pipe steam heat. Each says why, how, and whether it is a job for a licensed pro. One tap marks it done. You can add your own, such as the dog's heartworm pill every 30 days. Reminders show up in Google Calendar.
- **Supplies.** Filters, bulbs, batteries, water filters: what size, how many you have, when to swap them.
- **Documents.** Manuals, receipts, permits, the inspection report, warranties, insurance. Photos and scans go to Google Drive.
- **Rooms and things.** Each room with size, flooring and paint. Each appliance and system with model, serial and warranty. Where every shutoff is. The radiators.
- **Steam log.** Water level, pressure and what you did to the boiler, by date.
- **Projects and money.** Project ideas in priority order, materials and prices, expenses, tools you own, utility bills.
- **Weather nudges.** An email and a calendar entry when a freeze is coming.
- **Sensitive items.** Locked with a household passphrase before they leave your device. If the passphrase is lost they cannot be recovered. Account passwords still belong in a password manager.
- **Home screen.** What is due today, what is expiring, what is running low, the last steam entry, and a checklist for filling in the house.
- **Visuals.** A year wheel, a cutaway of the house, a steam-pipe diagram, a project flow chart and a budget chart.

## Where things live
- Records: a Google Sheet in your Drive. You can open it and fix a cell by hand.
- Files: a Drive folder called House Bible Files.
- The app: a web page on GitHub Pages. It holds no data. It keeps a local copy so it still opens without signal, and sends your changes when you are back online.
- A free Google script sits in the middle. A shared key keeps strangers out.
- Backups: a copy of the Sheet is made every month and the last twelve are kept. Nothing is ever truly deleted.

## What is already loaded
- Starter maintenance tasks, checked for a steam house.
- Your Harbor Freight and Home Depot receipts: 28 tools, about 113 purchases, two cans of Behr paint, and six project ideas guessed from what you bought. See [[Receipts and Tool History - What we're building]].
- House facts are not filled in. Zillow and Redfin refused an automatic read, so the Home checklist asks you for year built, size and floors.

## What I need from you
- The Google and GitHub setup clicks (a few short steps each, written out in the repo under docs/HUMAN-STEPS).
- Year built, square footage and floors. The year matters for lead and asbestos advice.
- The boiler's make and model, and where the shutoffs are.
- Tell me the radiator list; it goes in as assets.
- `Radiators.md.gdoc` in this folder is a stray file. Keep or remove it, your call.
