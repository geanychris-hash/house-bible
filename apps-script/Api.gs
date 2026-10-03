/* Api.gs - web app entry points and action router (CONTRACT section 4). */

function err_(code, message) { return { ok: false, error: code, message: message || '' }; }

function sha256Hex_(s) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s), Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + (b < 0 ? b + 256 : b).toString(16)).slice(-2); }).join('');
}

function authOk_(key) {
  var stored = props_().getProperty(PROP_KEY_HASH);
  if (!stored || typeof key !== 'string' || !key) return false;
  var h = sha256Hex_(key), diff = h.length ^ stored.length;
  for (var i = 0; i < h.length && i < stored.length; i++) diff |= h.charCodeAt(i) ^ stored.charCodeAt(i);
  return diff === 0;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() { return json_({ ok: false, error: 'use_post', message: 'POST text/plain JSON to this URL.' }); }

function doPost(e) {
  var out;
  try {
    var body;
    try { body = JSON.parse((e && e.postData && e.postData.contents) || ''); } catch (x) { body = null; }
    if (!body || typeof body !== 'object') out = err_('bad_request', 'Body must be JSON');
    else if (!authOk_(body.key)) out = { ok: false, error: 'auth' };
    else out = route_(body);
  } catch (ex) {
    out = err_(ex && ex.code || 'server', String(ex && ex.message || ex));
  }
  return json_(out);
}

function route_(req) {
  switch (req.action) {
    case 'ping': return { ok: true, serverTime: Date.now(), schemaVersion: HB_SCHEMA.schemaVersion };
    case 'pull': return apiPull_(req);
    case 'push': return apiPush_(req);
    case 'upload': return apiUpload_(req);
    case 'file': return apiFile_(req);
    case 'thumb': return apiThumb_(req);
    case 'syncCalendar': return withLock_(apiSyncCalendar_);
    case 'testAlert': return apiTestAlert_();
    default: return err_('bad_request', 'Unknown action');
  }
}

function apiPull_(req) {
  var since = Number(req.since || 0);
  if (!isFinite(since) || since < 0) return err_('bad_request', 'since must be a non-negative integer');
  since = Math.floor(since);
  var rev = currentRev_(); // read the counter first: rows newer than it are only re-sent, never missed
  var ss = getSS_(), all = {};
  if (rev <= since) {
    tableNames_().forEach(function (t) { all[t] = []; });
    return { ok: true, rev: rev, tables: all, more: false };
  }
  tableNames_().forEach(function (t) { all[t] = loadTable_(ss, t).rows.filter(function (r) { return r.id !== ''; }); });
  var sel = selectPull_(all, since, PULL_LIMIT);
  return { ok: true, rev: sel.more ? sel.lastRev : Math.max(rev, sel.lastRev), tables: sel.tables, more: sel.more };
}

function apiPush_(req) {
  var changes = req.changes;
  if (!Array.isArray(changes)) return err_('bad_request', 'changes must be an array');
  if (changes.length > PUSH_LIMIT) return err_('too_many', 'Max ' + PUSH_LIMIT + ' changes per push');
  var device = String(req.device || '');
  return { ok: true, results: withLock_(function () { return applyChanges_(changes, device, Date.now()); }) };
}
