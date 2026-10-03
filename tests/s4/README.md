# S4 tests

Run all: `node --test "tests/s4/*.test.mjs"`

- `units.test.mjs` feet/inches, dates, hash parsing.
- `sensitive-crypto.test.mjs` PBKDF2 + AES-GCM helpers.
- `qr.test.mjs` QR structure checks.

`qr-dump.mjs` prints encoder output for sample strings (versions 1-10) as JSON. It was decoded with OpenCV's
QRCodeDetector (`pip install opencv-python-headless numpy`): all 9 samples decoded back to the exact input,
including multi-block versions 5, 6, 8 and 10. Re-run that check if the encoder changes.
