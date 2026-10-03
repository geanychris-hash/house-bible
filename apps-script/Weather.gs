/* Weather.gs - api.weather.gov alerts, once per rule per day. */

var NWS = 'https://api.weather.gov';

function nwsUserAgent_(notify) {
  var email = (notify && notify.emails && notify.emails[0]) || Session.getEffectiveUser().getEmail() || 'unknown';
  return 'HouseBible/2 (' + email + ')';
}

function nwsGet_(url, ua) {
  var last;
  for (var i = 0; i < 2; i++) {
    var res = UrlFetchApp.fetch(url, { headers: { 'User-Agent': ua, 'Accept': 'application/geo+json' }, muteHttpExceptions: true });
    if (res.getResponseCode() === 200) return JSON.parse(res.getContentText());
    last = res.getResponseCode();
    Utilities.sleep(1500);
  }
  throw new Error('weather.gov returned ' + last + ' for ' + url);
}

function alertEmailText_(rule, value, house) {
  return rule.message + '\n\n' + rule.label + ': ' + rule.metric + ' ' + rule.op + ' ' + rule.value +
    ' within ' + rule.hoursAhead + ' hours (forecast value ' + value + ').\n' +
    'Location: ' + (house.address || '') + '\nSource: National Weather Service. Sent by House Bible.';
}

function sendAlert_(notify, cal, rule, value, house, dateIso) {
  var text = alertEmailText_(rule, value, house);
  if (notify.emails && notify.emails.length) {
    MailApp.sendEmail(notify.emails.join(','), 'House Bible: ' + rule.label, text);
  }
  if (cal) createAlertEvent_(cal, rule, dateIso, text);
}

/* Fetches the forecast, evaluates enabled rules, alerts for new ones. Returns a summary. */
function runWeatherAlerts_() {
  var s = readSettings_(), house = s.house || {}, notify = s.notify || {}, rules = (s.alerts && s.alerts.rules) || [];
  var enabled = rules.filter(function (r) { return r.enabled; });
  if (!enabled.length) return { ok: true, fired: [], skipped: 'no enabled rules' };
  if (!house.lat || !house.lon) throw new Error('settings.house needs lat and lon');

  var ua = nwsUserAgent_(notify);
  var point = nwsGet_(NWS + '/points/' + house.lat + ',' + house.lon, ua).properties;
  var hourly = nwsGet_(point.forecastHourly, ua).properties.periods;
  var needGrid = enabled.some(function (r) { return r.metric === 'snowIn' || r.metric === 'rainIn'; });
  var grid = needGrid ? nwsGet_(point.forecastGridData, ua).properties : null;

  var today = todayIso_(), cal = ensureCalendar_(), fired = [];
  evalAlertRules_(enabled, hourly, grid, Date.now()).forEach(function (f) {
    var pk = 'ALERTED_' + f.rule.id;
    if (props_().getProperty(pk) === today) return; // already alerted today
    sendAlert_(notify, cal, f.rule, f.value, house, today);
    props_().setProperty(pk, today);
    fired.push({ id: f.rule.id, value: f.value });
  });
  return { ok: true, fired: fired };
}

function apiTestAlert_() {
  var s = readSettings_(), notify = s.notify || {};
  if (!notify.emails || !notify.emails.length) return err_('no_email', 'settings.notify.emails is empty');
  var rule = { id: 'test', label: 'Test alert', metric: 'minTempF', op: '<=', value: 28, hoursAhead: 48,
    message: 'This is a test. If you can read it, weather alert email works.' };
  MailApp.sendEmail(notify.emails.join(','), 'House Bible: test alert', alertEmailText_(rule, 27, s.house || {}));
  return { ok: true, sentTo: notify.emails.length };
}

/* time trigger entry point */
function dailyWeatherAlert() {
  try { runWeatherAlerts_(); } catch (e) { console.error('weather alert failed: ' + e); }
}
