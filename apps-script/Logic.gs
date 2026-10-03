/* Logic.gs - pure functions. No Apps Script services here, so Node tests can load this file. */

var HB_TZ = 'America/New_York';
var SYSTEM_COLS = ['id', 'rev', 'updatedAt', 'updatedBy', 'deleted'];
var PULL_LIMIT = 2000;
var PUSH_LIMIT = 200;
var MAX_FILE_BYTES = 20 * 1024 * 1024;

/* ---------- schema helpers ---------- */

function tableNames_() { return Object.keys(HB_SCHEMA.tables); }

function tableFields_(table) { return HB_SCHEMA.tables[table].fields; }

function tableColumns_(table) {
  return SYSTEM_COLS.concat(tableFields_(table).map(function (f) { return f.name; }));
}

/* ---------- coercion ---------- */

function validIso_(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  var p = s.split('-').map(Number);
  var d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  return d.getUTCFullYear() === p[0] && d.getUTCMonth() === p[1] - 1 && d.getUTCDate() === p[2];
}

function normJsonString_(v) {
  if (typeof v === 'string') {
    if (v === '') return '';
    try { JSON.parse(v); return v; } catch (e) { return JSON.stringify(v); }
  }
  return JSON.stringify(v);
}

function normFiles_(v) {
  var arr = v;
  if (typeof v === 'string') {
    if (v === '') return '[]';
    try { arr = JSON.parse(v); } catch (e) { arr = []; }
  }
  if (!Array.isArray(arr)) arr = [];
  return JSON.stringify(arr.map(String));
}

/* returns {v} or {err} */
function coerceValue_(f, v) {
  if (v === undefined || v === null) v = '';
  switch (f.type) {
    case 'num': {
      if (v === '') return { v: '' };
      var n = Number(v);
      return isFinite(n) ? { v: n } : { err: f.name + ': not a number' };
    }
    case 'bool':
      return { v: (v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true') ? 1 : 0 };
    case 'date': {
      if (v === '') return { v: '' };
      var s = String(v).slice(0, 10);
      return validIso_(s) ? { v: s } : { err: f.name + ': bad date' };
    }
    case 'json': return { v: v === '' ? '' : normJsonString_(v) };
    case 'files': return { v: normFiles_(v) };
    default: {
      var t = (typeof v === 'object') ? JSON.stringify(v) : String(v);
      if (f.enum && t !== '' && f.enum.indexOf(t) < 0) return { err: f.name + ': must be one of ' + f.enum.join(', ') };
      return { v: t };
    }
  }
}

/*
 * Coerce an incoming client row. Only fields present in the input are returned (so a partial
 * row can be merged over the stored one). Unknown fields are ignored. Client rev is ignored.
 * returns {row, errors}
 */
function coerceRow_(table, input, device, now) {
  var errors = [], out = {}, row = input && typeof input === 'object' ? input : {};
  var id = String(row.id === undefined || row.id === null ? '' : row.id).trim();
  if (table === 'settings' && !id && row.key) id = String(row.key).trim();
  if (!/^[A-Za-z0-9_.-]{1,64}$/.test(id)) errors.push('id: missing or invalid');
  out.id = id;
  var ua = Number(row.updatedAt);
  out.updatedAt = (isFinite(ua) && ua > 0) ? Math.floor(ua) : now;
  out.updatedBy = String(row.updatedBy || device || '');
  out.deleted = coerceValue_({ name: 'deleted', type: 'bool' }, row.deleted).v;
  tableFields_(table).forEach(function (f) {
    if (!Object.prototype.hasOwnProperty.call(row, f.name)) return;
    var r = coerceValue_(f, row[f.name]);
    if (r.err) errors.push(r.err); else out[f.name] = r.v;
  });
  if (table === 'settings') {
    if (!out.key) out.key = id;
    if (out.key !== id) errors.push('key: must equal id for settings');
  }
  return { row: out, errors: errors };
}

/* ---------- conflict resolution ---------- */

function emptyRow_(table) {
  var r = {};
  tableColumns_(table).forEach(function (c) { r[c] = ''; });
  r.rev = 0; r.updatedAt = 0; r.deleted = 0;
  tableFields_(table).forEach(function (f) { if (f.type === 'bool') r[f.name] = 0; if (f.type === 'files') r[f.name] = '[]'; });
  return r;
}

function mergeRow_(table, existing, partial, rev) {
  var base = existing ? JSON.parse(JSON.stringify(existing)) : emptyRow_(table);
  Object.keys(partial).forEach(function (k) { base[k] = partial[k]; });
  base.rev = rev;
  return base;
}

/*
 * Larger updatedAt wins; tie goes to the server.
 * returns {status:'accepted', row} or {status:'stale', row: existing}
 */
function resolveChange_(table, existing, partial, rev) {
  if (!existing) return { status: 'accepted', row: mergeRow_(table, null, partial, rev) };
  if (Number(partial.updatedAt) > (Number(existing.updatedAt) || 0)) {
    return { status: 'accepted', row: mergeRow_(table, existing, partial, rev) };
  }
  return { status: 'stale', row: existing };
}

/* ---------- pull selection ---------- */

/*
 * tablesRows: {name:[row,...]}. Returns the rows with rev > since, first `limit` by rev.
 * returns {tables, more, lastRev}
 */
function selectPull_(tablesRows, since, limit) {
  var flat = [];
  Object.keys(tablesRows).forEach(function (t) {
    tablesRows[t].forEach(function (r) { if (Number(r.rev) > since) flat.push({ t: t, r: r }); });
  });
  flat.sort(function (a, b) { return a.r.rev - b.r.rev; });
  var more = flat.length > limit;
  if (more) flat = flat.slice(0, limit);
  var tables = {};
  Object.keys(tablesRows).forEach(function (t) { tables[t] = []; });
  flat.forEach(function (x) { tables[x.t].push(x.r); });
  return { tables: tables, more: more, lastRev: flat.length ? flat[flat.length - 1].r.rev : since };
}

/* ---------- ISO date helpers (UTC arithmetic, no time zones) ---------- */

function isoToDays_(iso) {
  var p = iso.split('-').map(Number);
  return Math.round(Date.UTC(p[0], p[1] - 1, p[2]) / 86400000);
}

function daysToIso_(n) {
  var d = new Date(n * 86400000);
  return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
}

function addDaysIso_(iso, n) { return daysToIso_(isoToDays_(iso) + n); }

/* add months, clamping the day to the end of the target month (Jan 31 + 1 month = Feb 28/29) */
function addMonthsIso_(iso, months) {
  var p = iso.split('-').map(Number);
  var total = p[0] * 12 + (p[1] - 1) + months;
  var y = Math.floor(total / 12), m = total % 12;
  var last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  var d = Math.min(p[2], last);
  return y + '-' + ('0' + (m + 1)).slice(-2) + '-' + ('0' + d).slice(-2);
}

function parseJsonSafe_(s, fallback) {
  if (s === '' || s === null || s === undefined) return fallback;
  if (typeof s !== 'string') return s;
  try { return JSON.parse(s); } catch (e) { return fallback; }
}

/* ---------- recurrence expansion (server copy of CONTRACT section 5) ---------- */

/*
 * Dates (ISO, sorted) on which `task` occurs within [fromIso, toIso].
 * lastDoneIso is only used by after_done. Past-due after_done dates are returned as is;
 * the caller decides what to do with them.
 */
function expandOccurrences_(task, fromIso, toIso, lastDoneIso) {
  var rule = parseJsonSafe_(task.rule, null);
  var start = task.start && validIso_(String(task.start)) ? String(task.start) : '';
  if (!rule || !rule.type) return [];
  var out = [], i, d;
  var fromD = isoToDays_(fromIso), toD = isoToDays_(toIso);
  var interval = Math.max(1, Math.floor(Number(rule.interval) || 1));

  if (rule.type === 'once') {
    if (start && start >= fromIso && start <= toIso) out.push(start);
  } else if (rule.type === 'days' || rule.type === 'weekly') {
    if (!start) return [];
    var step = interval * (rule.type === 'weekly' ? 7 : 1), sD = isoToDays_(start);
    var k = fromD > sD ? Math.ceil((fromD - sD) / step) : 0;
    for (d = sD + k * step; d <= toD; d += step) out.push(daysToIso_(d));
  } else if (rule.type === 'monthly' || rule.type === 'yearly') {
    if (!start) return [];
    var stepM = rule.type === 'yearly' ? 12 : interval;
    for (i = 0; i < 1500; i++) {
      var dt = addMonthsIso_(start, i * stepM);
      if (dt > toIso) break;
      if (dt >= fromIso) out.push(dt);
    }
  } else if (rule.type === 'seasonal') {
    var f = String(rule.from || '').split('-').map(Number);
    if (f.length !== 2 || !f[0] || !f[1]) return [];
    var y0 = Number(fromIso.slice(0, 4)) - 1, y1 = Number(toIso.slice(0, 4));
    for (var y = y0; y <= y1; y++) {
      var begin = y + '-' + ('0' + f[0]).slice(-2) + '-' + ('0' + f[1]).slice(-2);
      if (!validIso_(begin)) continue;
      if (begin >= fromIso && begin <= toIso && (!start || begin >= start)) out.push(begin);
    }
  } else if (rule.type === 'after_done') {
    var base = lastDoneIso || start;
    if (!base) return [];
    var n = Math.max(1, Math.floor(Number(rule.interval) || 1)), unit = rule.unit || 'days';
    var next = unit === 'weeks' ? addDaysIso_(base, n * 7)
      : unit === 'months' ? addMonthsIso_(base, n)
      : unit === 'years' ? addMonthsIso_(base, n * 12)
      : addDaysIso_(base, n);
    // the first-ever due date is `start` itself when nothing has been logged
    if (!lastDoneIso) next = start;
    out.push(next);
  }
  return out.sort();
}

/* ---------- calendar planning ---------- */

function describeRule_(rule) {
  if (!rule || !rule.type) return '';
  switch (rule.type) {
    case 'yearly': return 'Every year';
    case 'monthly': return 'Every ' + (rule.interval > 1 ? rule.interval + ' months' : 'month');
    case 'weekly': return 'Every ' + (rule.interval > 1 ? rule.interval + ' weeks' : 'week');
    case 'days': return 'Every ' + (rule.interval || 1) + ' days';
    case 'seasonal': return 'Seasonal window ' + rule.from + ' to ' + rule.to;
    case 'after_done': return (rule.interval || 1) + ' ' + (rule.unit || 'days') + ' after last done';
    default: return 'One time';
  }
}

/*
 * Desired calendar events for tasks with calendar=1, active=1, not deleted.
 * logs: task_log rows. Returns [{taskId,date,title,description}].
 */
function buildDesiredEvents_(tasks, logs, todayIso, endIso) {
  var lastDone = {};
  logs.forEach(function (l) {
    if (Number(l.deleted) === 1 || !l.task || !l.date) return;
    if (!lastDone[l.task] || l.date > lastDone[l.task]) lastDone[l.task] = l.date;
  });
  var out = [];
  tasks.forEach(function (t) {
    if (Number(t.deleted) === 1 || Number(t.calendar) !== 1 || Number(t.active) !== 1) return;
    var rule = parseJsonSafe_(t.rule, null);
    var dates = expandOccurrences_(t, todayIso, endIso, lastDone[t.id] || '');
    if (rule && rule.type === 'after_done') {
      // an overdue after_done task shows up today rather than silently never
      var base = expandOccurrences_(t, '1900-01-01', '2999-12-31', lastDone[t.id] || '');
      dates = base.filter(function (d) { return d <= endIso; }).map(function (d) { return d < todayIso ? todayIso : d; });
    }
    var title = t.title + (t.subject ? ' (' + t.subject + ')' : '');
    var lines = [];
    if (t.time) lines.push('Time: ' + t.time);
    var rt = describeRule_(rule);
    if (rt) lines.push(rt);
    if (rule && rule.type === 'seasonal') lines.push('Window ends ' + rule.to);
    if (t.why) lines.push('Why: ' + t.why);
    if (t.how) lines.push('How: ' + t.how);
    if (t.safety) lines.push('Safety: ' + t.safety);
    if (Number(t.pro_only) === 1) lines.push('Licensed pro only.');
    lines.push('(House Bible task)');
    dates.forEach(function (d) {
      out.push({ taskId: t.id, date: d, title: title, description: lines.join('\n') });
    });
  });
  return out;
}

/*
 * desired: [{taskId,date,title,description}]
 * existing: [{ref,taskId,date,title,description}] (events carrying our tag)
 * returns {create:[desired], update:[{ref,title,description}], remove:[ref]}
 */
function planCalendarSync_(desired, existing) {
  var want = {}, have = {}, plan = { create: [], update: [], remove: [] };
  desired.forEach(function (d) { want[d.taskId + '|' + d.date] = d; });
  existing.forEach(function (e) {
    var k = e.taskId + '|' + e.date;
    if (have[k] || !want[k]) { plan.remove.push(e.ref); return; } // duplicate, or no longer wanted
    have[k] = e;
  });
  Object.keys(want).forEach(function (k) {
    var d = want[k], e = have[k];
    if (!e) plan.create.push(d);
    else if (e.title !== d.title || e.description !== d.description) plan.update.push({ ref: e.ref, title: d.title, description: d.description });
  });
  return plan;
}

/* ---------- weather rules ---------- */

function defaultAlertRules_() {
  return [
    { id: 'freeze', label: 'Freeze', metric: 'minTempF', op: '<=', value: 28, hoursAhead: 48,
      message: 'Freeze coming: drain/cover hose bibs, check exposed pipes.', enabled: true },
    { id: 'heat', label: 'Heat', metric: 'maxTempF', op: '>=', value: 92, hoursAhead: 48,
      message: 'Heat coming: check AC filter, keep pets cool, check on the basement dehumidifier.', enabled: false },
    { id: 'snow', label: 'Snow', metric: 'snowIn', op: '>=', value: 4, hoursAhead: 48,
      message: 'Snow coming: clear gutters and drains if you can, check the snow shovel and salt.', enabled: false },
    { id: 'wind', label: 'High wind', metric: 'windMph', op: '>=', value: 40, hoursAhead: 24,
      message: 'High wind coming: secure outdoor items, check for loose branches.', enabled: false },
    { id: 'rain', label: 'Heavy rain', metric: 'rainIn', op: '>=', value: 2, hoursAhead: 24,
      message: 'Heavy rain coming: check the sump, gutters and basement.', enabled: false },
  ];
}

/* "10 mph", "5 to 15 mph" -> largest number */
function parseWindMph_(s) {
  var nums = String(s || '').match(/\d+(\.\d+)?/g);
  return nums ? Math.max.apply(null, nums.map(Number)) : 0;
}

/* "PT6H", "P1DT6H", "PT30M" -> hours */
function parseIsoDurationHours_(s) {
  var m = String(s).match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/);
  if (!m) return 1;
  return (Number(m[1]) || 0) * 24 + (Number(m[2]) || 0) + (Number(m[3]) || 0) / 60;
}

/* sum of gridpoint interval values (mm) overlapping [nowMs, nowMs + hours], pro-rated, in inches */
function sumGridIn_(layer, nowMs, hoursAhead) {
  if (!layer || !layer.values) return 0;
  var endMs = nowMs + hoursAhead * 3600000, total = 0;
  layer.values.forEach(function (v) {
    if (v.value === null || v.value === undefined) return;
    var parts = String(v.validTime).split('/');
    var s = Date.parse(parts[0]), durH = parseIsoDurationHours_(parts[1] || 'PT1H');
    var e = s + durH * 3600000;
    var overlap = Math.min(e, endMs) - Math.max(s, nowMs);
    if (overlap > 0) total += Number(v.value) * (overlap / (e - s));
  });
  return total / 25.4;
}

/*
 * Value of one metric over the next hoursAhead hours.
 * hourly: forecastHourly properties.periods; grid: forecastGridData properties (may be null).
 * returns a number, or null when there is no data for it.
 */
function metricValue_(metric, hourly, grid, nowMs, hoursAhead) {
  var endMs = nowMs + hoursAhead * 3600000;
  var periods = (hourly || []).filter(function (p) {
    var s = Date.parse(p.startTime), e = p.endTime ? Date.parse(p.endTime) : s + 3600000;
    return s < endMs && e > nowMs;
  });
  if (metric === 'snowIn') return grid ? sumGridIn_(grid.snowfallAmount, nowMs, hoursAhead) : null;
  if (metric === 'rainIn') return grid ? sumGridIn_(grid.quantitativePrecipitation, nowMs, hoursAhead) : null;
  if (!periods.length) return null;
  if (metric === 'minTempF' || metric === 'maxTempF') {
    var temps = periods.map(function (p) { return p.temperatureUnit === 'C' ? p.temperature * 9 / 5 + 32 : Number(p.temperature); });
    return metric === 'minTempF' ? Math.min.apply(null, temps) : Math.max.apply(null, temps);
  }
  if (metric === 'windMph') return Math.max.apply(null, periods.map(function (p) { return parseWindMph_(p.windSpeed); }));
  return null;
}

function compareOp_(a, op, b) {
  switch (op) {
    case '<': return a < b;
    case '<=': return a <= b;
    case '>': return a > b;
    case '>=': return a >= b;
    case '==': return a === b;
    default: return false;
  }
}

/* returns [{rule, value}] for enabled rules that fire */
function evalAlertRules_(rules, hourly, grid, nowMs) {
  var fired = [];
  (rules || []).forEach(function (r) {
    if (!r || !r.enabled) return;
    var v = metricValue_(r.metric, hourly, grid, nowMs, Number(r.hoursAhead) || 24);
    if (v !== null && compareOp_(v, r.op, Number(r.value))) fired.push({ rule: r, value: Math.round(v * 100) / 100 });
  });
  return fired;
}

/* ---------- misc ---------- */

function guessMimeIcon_(mime) {
  var label = String(mime || 'file').split('/').pop().slice(0, 5).toUpperCase();
  return '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">' +
    '<rect x="14" y="6" width="68" height="84" rx="6" fill="#e5e7eb" stroke="#9ca3af" stroke-width="3"/>' +
    '<text x="48" y="56" text-anchor="middle" font-family="sans-serif" font-size="16" fill="#374151">' + label + '</text></svg>';
}

function safeFileName_(name) {
  var n = String(name || 'file').replace(/[\\\/:*?"<>|\u0000-\u001f]/g, '_').trim();
  return (n || 'file').slice(0, 120);
}
