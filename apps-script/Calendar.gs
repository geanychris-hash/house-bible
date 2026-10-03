/* Calendar.gs - "House Bible" Google Calendar: task events (idempotent sync) and alert events. */

var CAL_NAME = 'House Bible';
var TAG_TASK = 'hbTask';
var TAG_DATE = 'hbDate';
var TAG_ALERT = 'hbAlert';

function todayIso_() { return Utilities.formatDate(new Date(), HB_TZ, 'yyyy-MM-dd'); }

function dateFromIso_(iso) { var p = iso.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); }

/* finds the calendar from settings.notify.calendarId, else by name; creates it if missing */
function ensureCalendar_() {
  var notify = readSettings_().notify || {};
  var cal = null;
  if (notify.calendarId) cal = CalendarApp.getCalendarById(notify.calendarId);
  if (!cal) {
    var found = CalendarApp.getCalendarsByName(CAL_NAME);
    cal = found.length ? found[0] : CalendarApp.createCalendar(CAL_NAME, { timeZone: HB_TZ });
  }
  if (notify.calendarId !== cal.getId()) {
    notify.calendarId = cal.getId();
    if (!notify.emails) notify.emails = [];
    writeSetting_('notify', notify, 'server');
  }
  return cal;
}

function apiSyncCalendar_() {
  var today = todayIso_(), end = addDaysIso_(today, 365);
  var tasks = readTable_('tasks'), logs = readTable_('task_log');
  var desired = buildDesiredEvents_(tasks, logs, today, end);
  var cal = ensureCalendar_();

  var events = cal.getEvents(dateFromIso_(today), dateFromIso_(addDaysIso_(end, 1)));
  var existing = [];
  events.forEach(function (ev) {
    var taskId = ev.getTag(TAG_TASK);
    if (!taskId) return; // not ours (or an alert event)
    existing.push({ ref: ev, taskId: taskId, date: ev.getTag(TAG_DATE), title: ev.getTitle(), description: ev.getDescription() });
  });

  var plan = planCalendarSync_(desired, existing);
  plan.create.forEach(function (d) {
    var ev = cal.createAllDayEvent(d.title, dateFromIso_(d.date), { description: d.description });
    ev.setTag(TAG_TASK, d.taskId);
    ev.setTag(TAG_DATE, d.date);
  });
  plan.update.forEach(function (u) { u.ref.setTitle(u.title); u.ref.setDescription(u.description); });
  plan.remove.forEach(function (ref) { ref.deleteEvent(); });
  return { ok: true, created: plan.create.length, updated: plan.update.length, removed: plan.remove.length };
}

/* all-day event for a fired weather alert; skipped if one for this rule and day already exists */
function createAlertEvent_(cal, rule, dateIso, text) {
  var d = dateFromIso_(dateIso);
  var dup = cal.getEvents(d, dateFromIso_(addDaysIso_(dateIso, 1))).filter(function (e) { return e.getTag(TAG_ALERT) === rule.id; });
  if (dup.length) return false;
  var ev = cal.createAllDayEvent('House Bible alert: ' + rule.label, d, { description: text });
  ev.setTag(TAG_ALERT, rule.id);
  return true;
}
