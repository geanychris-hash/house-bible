// Loads the .gs files into a vm context with minimal fakes of the Apps Script services.
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const gsDir = join(here, '..');
export const GS_FILES = ['Schema.gs', 'Logic.gs', 'Store.gs', 'Files.gs', 'Calendar.gs', 'Weather.gs', 'Api.gs', 'Setup.gs'];

class FakeRange {
  constructor(sheet, r, c, nr, nc) { Object.assign(this, { sheet, r, c, nr, nc }); }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const row = [];
      for (let j = 0; j < this.nc; j++) row.push(this.sheet.cell(this.r + i, this.c + j));
      out.push(row);
    }
    return out;
  }
  setValues(vals) {
    this.sheet.checkBounds(this.r + this.nr - 1, this.c + this.nc - 1);
    vals.forEach((row, i) => row.forEach((v, j) => this.sheet.setCell(this.r + i, this.c + j, v)));
    return this;
  }
  setValue(v) { return this.setValues([[v]]); }
  setNumberFormat() { return this; }
}

class FakeSheet {
  constructor(name) { this.name = name; this.cells = new Map(); this.maxRows = 100; this.hidden = false; this.writes = 0; }
  key(r, c) { return r + ',' + c; }
  cell(r, c) { const v = this.cells.get(this.key(r, c)); return v === undefined ? '' : v; }
  setCell(r, c, v) { this.cells.set(this.key(r, c), v); this.writes++; }
  checkBounds(r) { if (r > this.maxRows) throw new Error('range outside sheet: row ' + r); }
  getLastRow() { let m = 0; for (const [k, v] of this.cells) if (v !== '') m = Math.max(m, +k.split(',')[0]); return m; }
  getLastColumn() { let m = 0; for (const [k, v] of this.cells) if (v !== '') m = Math.max(m, +k.split(',')[1]); return m; }
  getMaxRows() { return this.maxRows; }
  insertRowsAfter(after, n) { this.maxRows += n; }
  getRange(r, c, nr = 1, nc = 1) { return new FakeRange(this, r, c, nr, nc); }
  setFrozenRows() {}
  hideSheet() { this.hidden = true; }
}

class FakeSpreadsheet {
  constructor() { this.sheets = [new FakeSheet('Sheet1')]; }
  getId() { return 'fake-ss'; }
  getUrl() { return 'https://docs.google.com/fake'; }
  getSheetByName(n) { return this.sheets.find((s) => s.name === n) || null; }
  insertSheet(n) { const s = new FakeSheet(n); this.sheets.push(s); return s; }
  getSheets() { return this.sheets; }
  deleteSheet(s) { this.sheets = this.sheets.filter((x) => x !== s); }
}

class FakeEvent {
  constructor(cal, title, date, opts) { Object.assign(this, { cal, title, date, desc: (opts && opts.description) || '', tags: {}, deleted: false }); }
  getTag(k) { return this.tags[k] || null; }
  setTag(k, v) { this.tags[k] = v; return this; }
  getTitle() { return this.title; }
  setTitle(t) { this.title = t; return this; }
  getDescription() { return this.desc; }
  setDescription(d) { this.desc = d; return this; }
  deleteEvent() { this.deleted = true; this.cal.events = this.cal.events.filter((e) => e !== this); }
}
class FakeCalendar {
  constructor(id) { this.id = id; this.events = []; }
  getId() { return this.id; }
  getEvents(from, to) { return this.events.filter((e) => e.date >= from && e.date < to); }
  createAllDayEvent(title, date, opts) { const e = new FakeEvent(this, title, date, opts); this.events.push(e); return e; }
}

export function makeEnv(opts = {}) {
  const propsStore = {};
  const ss = new FakeSpreadsheet();
  const calendars = [];
  const mails = [];
  const fetches = opts.fetchRoutes || {};
  const state = { lockHeld: false, locksTaken: 0 };

  const ctx = {
    console, Date, JSON, Math, Object, Array, String, Number, isFinite, parseInt, Error, RegExp, Map,
    PropertiesService: { getScriptProperties: () => ({
      getProperty: (k) => (k in propsStore ? propsStore[k] : null),
      setProperty: (k, v) => { propsStore[k] = String(v); },
    }) },
    LockService: { getScriptLock: () => ({
      waitLock() { if (state.lockHeld) throw new Error('lock timeout'); state.lockHeld = true; state.locksTaken++; },
      releaseLock() { state.lockHeld = false; },
    }) },
    SpreadsheetApp: {
      create: () => ss, openById: () => ss,
      getActiveSpreadsheet: () => { throw new Error('standalone'); },
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (alg, s) => [...createHash('sha256').update(String(s), 'utf8').digest()].map((b) => (b > 127 ? b - 256 : b)),
      formatDate: (d, tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d),
      base64Decode: (s) => [...Buffer.from(s, 'base64')],
      base64Encode: (b) => Buffer.from(b).toString('base64'),
      newBlob: (b, mime, name) => ({ bytes: typeof b === 'string' ? [...Buffer.from(b)] : b, mime, name, getBytes() { return this.bytes; }, getContentType() { return this.mime; } }),
      sleep() {}, getUuid: () => randomUUID(),
    },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ text: s, setMimeType() { return this; }, getContent() { return this.text; } }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'owner@example.com' }) },
    Logger: { log() {} },
    MailApp: { sendEmail: (to, subject, body) => mails.push({ to, subject, body }) },
    CalendarApp: {
      getCalendarById: (id) => calendars.find((c) => c.id === id) || null,
      getCalendarsByName: () => calendars.slice(),
      createCalendar: () => { const c = new FakeCalendar('cal-' + (calendars.length + 1)); calendars.push(c); return c; },
    },
    UrlFetchApp: { fetch: (url) => {
      const hit = Object.keys(fetches).find((k) => url.includes(k));
      const body = hit ? fetches[hit] : null;
      return { getResponseCode: () => (body ? 200 : 404), getContentText: () => JSON.stringify(body) };
    } },
    DriveApp: {}, ScriptApp: {},
  };
  vm.createContext(ctx);
  for (const f of GS_FILES) vm.runInContext(readFileSync(join(gsDir, f), 'utf8'), ctx, { filename: f });

  const KEY = 'test-key-123456';
  ctx.setKey(KEY);
  const call = (body) => JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify({ key: KEY, device: 'test', ...body }) } }).getContent());
  return { ctx, ss, call, KEY, props: propsStore, calendars, mails, state };
}

export const uid = () => randomUUID().replace(/-/g, '');
