/* Setup.gs - run once from the editor: setup(), then runSetKey() after editing the key below. */

var TRIGGER_FUNCS = ['dailyWeatherAlert', 'monthlyBackup', 'dailyCalendarSync'];
var KEEP_BACKUPS = 12;

function setup() {
  var ss;
  var id = props_().getProperty(PROP_SHEET_ID);
  if (id) ss = SpreadsheetApp.openById(id);
  else {
    try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { ss = null; }
    if (!ss) ss = SpreadsheetApp.create('House Bible');
    props_().setProperty(PROP_SHEET_ID, ss.getId());
  }
  ensureTabs_(ss);
  ensureFolders_();
  writeDefaultSettings_();
  ensureCalendar_();
  installTriggers_();
  Logger.log('Setup done. Spreadsheet: ' + ss.getUrl());
  Logger.log(props_().getProperty(PROP_KEY_HASH) ? 'Key is set.' : 'Next: edit runSetKey() and run it.');
  return ss.getUrl();
}

function writeDefaultSettings_() {
  var existing = readSettings_();
  var owner = '';
  try { owner = Session.getEffectiveUser().getEmail(); } catch (e) { /* ignore */ }
  var defaults = {
    house: { address: '353 Washington St, Canton, MA 02021', lat: 42.158, lon: -71.145, year_built: null, sqft: null, floors: null },
    alerts: { rules: defaultAlertRules_() },
    notify: { emails: owner ? [owner] : [], calendarId: '' },
    schemaVersion: HB_SCHEMA.schemaVersion,
  };
  var changes = [];
  Object.keys(defaults).forEach(function (k) {
    if (existing[k] === undefined) changes.push({ table: 'settings', row: { id: k, key: k, value: JSON.stringify(defaults[k]), updatedBy: 'setup' } });
  });
  if (changes.length) withLock_(function () { return applyChanges_(changes, 'setup', Date.now()); });
}

function installTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (TRIGGER_FUNCS.indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dailyWeatherAlert').timeBased().inTimezone(HB_TZ).everyDays(1).atHour(16).create();
  ScriptApp.newTrigger('dailyCalendarSync').timeBased().inTimezone(HB_TZ).everyDays(1).atHour(5).create();
  ScriptApp.newTrigger('monthlyBackup').timeBased().inTimezone(HB_TZ).onMonthDay(1).atHour(3).create();
}

/* ---------- key ---------- */

/* Stores only the SHA-256 hash of the shared key. */
function setKey(plain) {
  if (typeof plain !== 'string' || plain.length < 12) throw new Error('Key must be at least 12 characters.');
  props_().setProperty(PROP_KEY_HASH, sha256Hex_(plain));
  Logger.log('Key saved (hash only). Now delete the key text from this file.');
}

/* Edit the text between the quotes, run this once, then put the placeholder back. */
function runSetKey() {
  setKey('CHANGE-ME-TO-A-LONG-PHRASE');
}

/* ---------- triggers ---------- */

function dailyCalendarSync() {
  try { withLock_(apiSyncCalendar_); } catch (e) { console.error('calendar sync failed: ' + e); }
}

/* Copies the spreadsheet into "House Bible Backups"; keeps the newest 12 (older ones go to Drive trash). */
function monthlyBackup() {
  var ssFile = DriveApp.getFileById(getSS_().getId());
  var folderId = props_().getProperty(folderProp_('backups'));
  if (!folderId) { ensureFolders_(); folderId = props_().getProperty(folderProp_('backups')); }
  var folder = DriveApp.getFolderById(folderId);
  ssFile.makeCopy('House Bible backup ' + todayIso_(), folder);
  var files = [], it = folder.getFiles();
  while (it.hasNext()) files.push(it.next());
  files.sort(function (a, b) { return b.getDateCreated() - a.getDateCreated(); });
  files.slice(KEEP_BACKUPS).forEach(function (f) { f.setTrashed(true); });
}
