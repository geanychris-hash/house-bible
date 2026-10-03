# S4 status: house records and documents (branch s4-records)

All eight deliverables are written and run on the stub data layer. Nothing was tried on a real phone, a real Google Sheet or real Drive.

## What works
Files are in `web/js/views/` (CSS in `web/css/`). Nav order and ids: emergency 5, documents 20, rooms 30, assets 40, shutoffs 50, contacts 60, steam 70, sensitive 80, qr 90.

1. **documents.js** upload many files at once (PDF, image), "Take photo" camera button, one metadata form (title, kind, room, asset, project, tags, expires, notes), grid and list views with thumbnails, search over title/tags/notes/room/asset, filters for kind, room and asset, "Expiring soon" panel (60 days), detail view with Open, Download, Edit, Delete. Exports `openAddDocuments`, `openDocument`, `docRows` for other views. Rooms and assets list their documents; assets also keep `docs` ids (Add manual, Link existing).
2. **rooms.js** list plus detail with floor, size in feet and inches (typed as `12' 6"`, `12 ft 6`, `150`), sq ft, ceiling, flooring, wall color, paint notes, outlets, windows, notes, photos, and panels for assets, documents, tasks, projects and expenses filtered by room. First-run "Set up rooms" (kitchen, living, dining, bedrooms and bathrooms by count, basement, attic, garage, yard, porch).
3. **assets.js** kind, room, brand, model, serial, install date, fuel, warranty expiry, pro-only flag, photos. "Warranties expiring soon" (90 days). "Add from data plate photo" opens the form with a photo first (typed by hand, no OCR).
4. **shutoffs.js** shutoffs with photos and how-to, and the **Emergency** view (id `emergency`). It reads only local data, has fixed safety text (gas: leave, 911, licensed pro) and key contacts.
5. **contacts.js** tap to call and email, last job, cost, would rehire, trade filter.
6. **steam.js** log with water level, pressure, event, notes, photos; SVG pressure trend with the 2 psi line, water-level strip, a what-to-look-for checklist (ticks kept on the device).
7. **sensitive.js + sensitive-crypto.js** PBKDF2 250000 + AES-GCM, passphrase setup with repeat, wrong-passphrase detection, lock timeout (1 to 60 min), "remember on this device" (non-extractable key in IndexedDB), reveal hides after 30 s, warnings about lost passphrase, password manager, and plain-text label and hint.
8. **qr.js + qr-encoder.js** own QR encoder; select items, set the app address, print labels (3 per row).

## How it was tested
- `node --test "tests/s4/*.test.mjs"`: 19 tests pass (feet and inches, dates, hash parsing, all crypto helpers including wrong passphrase, tampering and non-extractable key, QR structure). `node --check` passes on every JS file.
- QR encoder: output for 9 strings (versions 1, 2, 5, 6, 8, 10) decoded exactly with OpenCV (see `tests/s4/README.md`).
- Browser pane (Chromium) on `tools/s4-harness/` with the stub data layer and no core ui/files: rooms setup, edit with dimensions, detail panels; upload two files with metadata; search, list/grid, detail, edit, delete (with confirm); assets with warranty and linking a document; shutoffs, emergency, contacts links, steam trend, QR labels; secret notes setup, add, reveal, lock, wrong passphrase, unlock, remember on device and reload. Page width 375 and 1200: no horizontal scroll on any view. Fresh tab console: no errors.

## NOT tested
- Phones (Samsung, iPhone), camera capture, installed PWA, real Drive upload, offline mode, printing (the print CSS exists but I only looked at the on-screen labels), the real core `ui.js`, `files.js`, `router.js` (none existed; the harness stands in), real sync between two devices, auto-lock timer firing (timer is armed but I did not wait 1 minute), Safari behaviour of IndexedDB CryptoKey storage.
- Scanning a printed QR label with a phone. Decoding was checked on the encoder output only.
- Concurrency: two devices creating the secret-notes passphrase in the same minute could produce two salts.

## Things the next stream needs
- Read `docs/DECISIONS.md` "Cross-stream requests". Main ones for S2: route `#/<view>/<id>` to the right view, `HBFiles.blob`, cache thumbnails and precache views for offline Emergency.
- Without `core/files.js`, files are kept only in that browser (IndexedDB, ids start `local`). With the real one they go through `HBFiles` automatically.
- `HBui.openForm` is not used; S4 has its own forms. Photo fields are saved as JSON strings.
- Run the harness: from the repo root `python -m http.server 8123`, open `http://localhost:8123/tools/s4-harness/index.html`. It uses the stub `data.js` (localStorage) and a stub router; `ui.js` and `files.js` are mapped to empty modules so the fallbacks are used.
- Humans: no Google or GitHub steps needed from this stream.
