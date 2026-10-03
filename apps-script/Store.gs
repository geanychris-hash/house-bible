/* Store.gs - Spreadsheet access: tabs, reads, locked writes, rev counter, changelog. */

var PROP_REV = 'REV';
var PROP_SHEET_ID = 'SHEET_ID';
var PROP_KEY_HASH = 'KEY_HASH';
var CHANGELOG_TAB = 'changelog';
var CHANGELOG_COLS = ['rev', 'table', 'id', 'updatedBy', 'at'];

function props_() { return PropertiesService.getScriptProperties(); }

function getSS_() {
  var id = props_().getProperty(PROP_SHEET_ID);
  if (id) return SpreadsheetApp.openById(id);
  var active = null;
  try { active = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { /* standalone script */ }
  if (active) { props_().setProperty(PROP_SHEET_ID, active.getId()); return active; }
  throw new Error('No spreadsheet yet. Run setup() once.');
}

function currentRev_() { return parseInt(props_().getProperty(PROP_REV) || '0', 10); }

var LOCK_DEPTH_ = 0;

/* Script lock, 20 s wait. Re-entrant within one execution (the real lock is not). */
function withLock_(fn) {
  if (LOCK_DEPTH_ > 0) return fn();
  var lock = LockService.getScriptLock();
  try { lock.waitLock(20000); } catch (e) { var err = new Error('Server busy, try again'); err.code = 'busy'; throw err; }
  LOCK_DEPTH_ = 1;
  try { return fn(); } finally { LOCK_DEPTH_ = 0; lock.releaseLock(); }
}

/* ---------- tabs ---------- */

function textColumn_(table, name) {
  if (SYSTEM_COLS.indexOf(name) >= 0) return name === 'id' || name === 'updatedBy';
  var f = tableFields_(table).filter(function (x) { return x.name === name; })[0];
  return !!f && f.type !== 'num' && f.type !== 'bool';
}

/* Creates the tab if missing; appends any schema columns missing from the header. Never reorders. */
function ensureTab_(ss, table) {
  var sheet = ss.getSheetByName(table);
  var cols = tableColumns_(table);
  if (!sheet) sheet = ss.insertSheet(table);
  var lastCol = sheet.getLastColumn();
  var header = lastCol > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
  cols.forEach(function (c) {
    if (header.indexOf(c) < 0) {
      header.push(c);
      var col = header.length;
      sheet.getRange(1, col).setValue(c);
      if (textColumn_(table, c)) sheet.getRange(2, col, Math.max(1, sheet.getMaxRows() - 1), 1).setNumberFormat('@');
    }
  });
  sheet.setFrozenRows(1);
  return sheet;
}

function ensureChangelog_(ss) {
  var sheet = ss.getSheetByName(CHANGELOG_TAB);
  if (!sheet) {
    sheet = ss.insertSheet(CHANGELOG_TAB);
    sheet.getRange(1, 1, 1, CHANGELOG_COLS.length).setValues([CHANGELOG_COLS]);
    sheet.setFrozenRows(1);
    sheet.hideSheet();
  }
  return sheet;
}

function ensureTabs_(ss) {
  tableNames_().forEach(function (t) { ensureTab_(ss, t); });
  ensureChangelog_(ss);
  var blank = ss.getSheetByName('Sheet1');
  if (blank && ss.getSheets().length > 1 && blank.getLastRow() === 0) ss.deleteSheet(blank);
}

/* ---------- reading ---------- */

function cellOut_(table, col, v) {
  if (v instanceof Date) return Utilities.formatDate(v, HB_TZ, 'yyyy-MM-dd');
  if (v === null || v === undefined) v = '';
  if (col === 'rev' || col === 'updatedAt') return Number(v) || 0;
  if (col === 'deleted') return Number(v) ? 1 : 0;
  var f = tableFields_(table).filter(function (x) { return x.name === col; })[0];
  if (f && f.type === 'num') return v === '' ? '' : Number(v);
  if (f && f.type === 'bool') return Number(v) ? 1 : 0;
  return typeof v === 'string' ? v : String(v);
}

/*
 * Loads a table as {sheet, headers, raw, rows, index}.
 * rows[i] is an object keyed by schema column; raw[i] is the cell array (kept so unknown
 * columns survive a write); index maps id -> i.
 */
function loadTable_(ss, table) {
  var sheet = ss.getSheetByName(table) || ensureTab_(ss, table);
  var lastCol = sheet.getLastColumn(), lastRow = sheet.getLastRow();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  var raw = lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, lastCol).getValues() : [];
  var cols = tableColumns_(table), rows = [], index = {};
  raw.forEach(function (cells, i) {
    var o = {};
    cols.forEach(function (c) {
      var ci = headers.indexOf(c);
      o[c] = cellOut_(table, c, ci >= 0 ? cells[ci] : '');
    });
    rows.push(o);
    if (o.id !== '') index[o.id] = i;
  });
  return { sheet: sheet, headers: headers, raw: raw, rows: rows, index: index };
}

function readTable_(table) { return loadTable_(getSS_(), table).rows.filter(function (r) { return r.id !== ''; }); }

function toCells_(table, headers, row, existingCells) {
  var cells = existingCells ? existingCells.slice() : [];
  while (cells.length < headers.length) cells.push('');
  tableColumns_(table).forEach(function (c) {
    var ci = headers.indexOf(c);
    if (ci >= 0) cells[ci] = row[c] === undefined ? '' : row[c];
  });
  return cells;
}

function ensureRows_(sheet, lastRowNeeded) {
  var max = sheet.getMaxRows();
  if (lastRowNeeded > max) sheet.insertRowsAfter(max, lastRowNeeded - max + 100);
}

/* ---------- writing (caller must hold the lock) ---------- */

/*
 * changes: [{table,row}] raw from the client. Returns results [{table,id,status,row,message?}].
 * Reserves the rev block in Script Properties BEFORE writing rows so a crash can skip revs but never reuse one.
 */
function applyChanges_(changes, device, now) {
  var ss = getSS_(), models = {}, dirty = {}, results = [], log = [];
  var rev = currentRev_();

  changes.forEach(function (ch) {
    var table = ch && ch.table;
    if (!table || !HB_SCHEMA.tables[table]) {
      results.push({ table: table || '', id: ch && ch.row && ch.row.id || '', status: 'invalid', message: 'unknown table' });
      return;
    }
    var c = coerceRow_(table, ch.row, device, now);
    if (c.errors.length) {
      results.push({ table: table, id: c.row.id, status: 'invalid', message: c.errors.join('; ') });
      return;
    }
    var m = models[table] || (models[table] = loadTable_(ss, table));
    var pos = m.index[c.row.id];
    var existing = pos === undefined ? null : m.rows[pos];
    var r = resolveChange_(table, existing, c.row, rev + 1);
    if (r.status === 'accepted') {
      rev += 1;
      var cells = toCells_(table, m.headers, r.row, pos === undefined ? null : m.raw[pos]);
      if (pos === undefined) {
        pos = m.rows.length;
        m.rows.push(r.row); m.raw.push(cells); m.index[r.row.id] = pos;
        var dn = dirty[table] = dirty[table] || { first: pos, last: pos };
        dn.last = Math.max(dn.last, pos);
      } else {
        m.rows[pos] = r.row; m.raw[pos] = cells;
        var d = dirty[table] = dirty[table] || { first: pos, last: pos };
        d.first = Math.min(d.first, pos); d.last = Math.max(d.last, pos);
      }
      log.push([r.row.rev, table, r.row.id, r.row.updatedBy, now]);
    }
    results.push({ table: table, id: c.row.id, status: r.status, row: r.row });
  });

  if (rev !== currentRev_()) props_().setProperty(PROP_REV, String(rev));
  Object.keys(dirty).forEach(function (table) {
    var m = models[table], d = dirty[table];
    // existing rows were already in the sheet when read, so one write covers first..last
    ensureRows_(m.sheet, d.last + 2);
    m.sheet.getRange(d.first + 2, 1, d.last - d.first + 1, m.headers.length)
      .setValues(m.raw.slice(d.first, d.last + 1).map(function (cells) {
        var c = cells.slice(); while (c.length < m.headers.length) c.push(''); return c;
      }));
  });
  if (log.length) {
    var cl = ensureChangelog_(ss);
    ensureRows_(cl, cl.getLastRow() + log.length);
    cl.getRange(cl.getLastRow() + 1, 1, log.length, CHANGELOG_COLS.length).setValues(log);
  }
  return results;
}

/* ---------- settings ---------- */

function readSettings_() {
  var out = {};
  readTable_('settings').forEach(function (r) {
    if (Number(r.deleted) !== 1) out[r.key] = parseJsonSafe_(r.value, null);
  });
  return out;
}

/* writes a setting (always wins on conflict because updatedAt = now) */
function writeSetting_(key, value, by) {
  return withLock_(function () {
    return applyChanges_([{ table: 'settings', row: { id: key, key: key, value: JSON.stringify(value), updatedBy: by || 'server' } }], by || 'server', Date.now());
  });
}
