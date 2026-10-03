# S4 House records and documents (branch s4-records, owns web/js/views/{rooms,documents,assets,shutoffs,contacts,steam,sensitive,qr}*.js and matching css)
Read 00-common.md first. Priorities: documents vault first, then room records.

Deliver, in this order:
1. `documents.js` (Chris's #2 priority): upload one or many files (PDF, image) via `HBFiles.upload`, camera capture on phones, metadata form (title, kind, room, asset, project, tags, expires, notes), grid and list views with thumbnails, search by title, tags and notes, filter by kind, room and asset, an expiring-soon list, open and download. Link documents from rooms and assets.
2. `rooms.js` (#3 priority): list of rooms, and a detail page per room with dimensions (inches, shown as feet and inches), floor, flooring, wall color and paint notes, outlets, windows, notes, photos, plus automatic panels listing that room's assets, documents, tasks, projects and expenses (through `HB.list` filtered by `room`). A "Set up rooms" quick-add on first run (kitchen, living room, dining room, bedrooms, bathrooms, basement, attic, garage, yard, porch). Chris said all areas are in scope.
3. `assets.js`: systems, appliances, fixtures with model and serial, install date, warranty expiry with an "expiring soon" list (this is the warranty tracker), manuals attached from documents, quick-add from a photo of the data plate (manual entry, no OCR).
4. `shutoffs.js` and an Emergency screen reachable from the nav: water, gas and electric shutoffs with photos and how-to, key contacts (from `contacts`), working from the local cache with no network.
5. `contacts.js`: trade, company, phone (tap to call), email, last job, cost, would rehire.
6. `steam.js`: one-pipe steam log (water level, pressure, event type, notes, photos) with a simple trend of recent entries and a what-to-look-for checklist. Boiler or gas work is licensed pro.
7. `sensitive.js`: encrypted notes per CONTRACT section 7 using WebCrypto. Unlock screen, lock timeout, "remember on this device" option, clear warnings (lost passphrase means lost data; account passwords belong in a password manager). Unit-test the crypto helpers with `node --test`.
8. `qr.js` (nice to have, last): a printable page of QR labels for shutoffs and assets linking to `#/asset/<id>`. Write a small QR encoder or vendor one tiny MIT library into `web/vendor/` with its licence file.

Develop against the stub data layer. If `HBFiles` does not exist yet, store photos as data URLs behind feature detection and say so in your status file.
