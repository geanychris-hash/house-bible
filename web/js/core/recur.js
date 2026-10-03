// Recurrence engine (CONTRACT section 5). Pure: no DOM, no network, no clock (callers pass `today`).
// All dates are 'YYYY-MM-DD' strings; arithmetic is done in UTC so DST never shifts a day.
//
// task: a `tasks` row ({id, rule, start, active, ...}); rule may be an object or a JSON string.
// logs: `task_log` rows ({task, date, note}); rows for other tasks are ignored when task.id is set.
//
// Log kinds (no extra column exists, so the kind is encoded in `note`, see makeLogNote):
//   done    : normal completion
//   skip    : "[skipped] reason"                -> counts as completion (moves to the next due)
//   snooze  : "[snoozed until YYYY-MM-DD] why"  -> only defers the current due date

const DAY = 86400000;
const pad = n => String(n).padStart(2, '0');

export const parseISO = s => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return Date.UTC(y, m - 1, d); };
export const iso = ms => { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
export const addDays = (s, n) => iso(parseISO(s) + n * DAY);
export const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / DAY);
const daysInMonth = (y, m0) => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();
const isValid = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}/.test(s) && !isNaN(parseISO(s));

/** Add N calendar months keeping `day` (clamped to month length: Jan 31 + 1 month = Feb 28/29). */
export function addMonths(s, n, day) {
  const d = new Date(parseISO(s));
  const total = d.getUTCFullYear() * 12 + d.getUTCMonth() + n;
  const y = Math.floor(total / 12), m = ((total % 12) + 12) % 12;
  const dd = Math.min(day == null ? d.getUTCDate() : day, daysInMonth(y, m));
  return `${y}-${pad(m + 1)}-${pad(dd)}`;
}
/** Same month/day in year y; Feb 29 falls back to Feb 28 in non-leap years. */
const inYear = (y, m0, day) => `${y}-${pad(m0 + 1)}-${pad(Math.min(day, daysInMonth(y, m0)))}`;

export function parseRule(rule) {
  if (!rule) return { type: 'once' };
  if (typeof rule === 'string') { try { rule = JSON.parse(rule); } catch { return { type: 'once' }; } }
  return rule && rule.type ? rule : { type: 'once' };
}
const interval = r => Math.max(1, Math.floor(Number(r.interval) || 1));

// ---------- log helpers ----------
export function logKind(log) {
  const n = String((log && log.note) || '');
  if (/^\[skipped\]/i.test(n)) return 'skip';
  if (/^\[snoozed until \d{4}-\d{2}-\d{2}\]/i.test(n)) return 'snooze';
  return 'done';
}
export function snoozeUntil(log) {
  const m = String((log && log.note) || '').match(/^\[snoozed until (\d{4}-\d{2}-\d{2})\]/i);
  return m ? m[1] : null;
}
export function logText(log) { return String((log && log.note) || '').replace(/^\[[^\]]*\]\s*/, ''); }
export function makeLogNote(kind, text = '', until) {
  text = String(text || '').trim();
  if (kind === 'skip') return `[skipped] ${text}`.trim();
  if (kind === 'snooze') return `[snoozed until ${until}] ${text}`.trim();
  return text;
}
function logsFor(task, logs) {
  return (logs || []).filter(l => l && isValid(l.date) && !Number(l.deleted) && (task.id == null || l.task == null || l.task === task.id));
}
/** Date of the most recent completion (done or skip), or null. */
export function lastDone(task, logs) {
  let best = null;
  for (const l of logsFor(task, logs)) if (logKind(l) !== 'snooze') { const d = l.date.slice(0, 10); if (!best || d > best) best = d; }
  return best;
}
function activeSnooze(task, logs, done) {
  let best = null;
  for (const l of logsFor(task, logs)) {
    if (logKind(l) !== 'snooze') continue;
    if (done && l.date.slice(0, 10) < done) continue; // a later completion cancels the snooze
    const u = snoozeUntil(l);
    if (u && (!best || u > best)) best = u;
  }
  return best;
}

// ---------- anchored occurrences ----------
/** Approximate period in days, used for how early a completion may count toward the next occurrence. */
function periodDays(r) {
  const n = interval(r);
  return r.type === 'yearly' ? 365 : r.type === 'monthly' ? 30 * n : r.type === 'weekly' ? 7 * n : r.type === 'days' ? n : 365;
}
const leadDays = r => Math.min(45, Math.floor(periodDays(r) / 2));

/** nth (0-based) anchored occurrence, or null when the rule has no such anchor. */
function nth(task, r, k) {
  const s = task.start;
  const sd = new Date(parseISO(s));
  switch (r.type) {
    case 'yearly': return inYear(sd.getUTCFullYear() + k, sd.getUTCMonth(), sd.getUTCDate());
    case 'monthly': return addMonths(s, k * interval(r), sd.getUTCDate());
    case 'weekly': return addDays(s, 7 * interval(r) * k);
    case 'days': return addDays(s, interval(r) * k);
    default: return null;
  }
}
const ANCHORED = new Set(['yearly', 'monthly', 'weekly', 'days']);

/** Optional season limit on anchored rules: {from:'MM-DD', to:'MM-DD'} keeps only occurrences inside it
 *  (e.g. weekly boiler checks only in the heating season). Extension of CONTRACT section 5. */
function inSeason(date, r) {
  if (!r.from || !r.to) return true;
  const md = date.slice(5);
  return r.from <= r.to ? md >= r.from && md <= r.to : md >= r.from || md <= r.to;
}

function windowsAround(r, fromYear, toYear) {
  const [fm, fd] = r.from.split('-').map(Number), [tm, td] = r.to.split('-').map(Number);
  const out = [];
  for (let y = fromYear; y <= toYear; y++) {
    out.push({ start: inYear(y, fm - 1, fd), end: inYear(tm < fm || (tm === fm && td < fd) ? y + 1 : y, tm - 1, td) });
  }
  return out;
}

/**
 * Dates a task falls on within [from, to] inclusive. yearly/monthly/weekly/days: every anchored date
 * on/after start. seasonal: the window start dates. once and after_done: `start` if in range
 * (after_done has no fixed schedule; use nextDue for its real next date).
 */
export function occurrences(task, from, to) {
  const r = parseRule(task.rule), start = task.start;
  if (!isValid(start) || !isValid(from) || !isValid(to)) return [];
  const out = [];
  if (ANCHORED.has(r.type)) {
    for (let k = 0; k < 20000; k++) {
      const d = nth(task, r, k);
      if (d > to) break;
      if (d >= from && inSeason(d, r)) out.push(d);
    }
  } else if (r.type === 'seasonal' && r.from && r.to) {
    const y0 = Number(from.slice(0, 4)) - 1, y1 = Number(to.slice(0, 4));
    for (const w of windowsAround(r, y0, y1)) if (w.start >= start && w.start >= from && w.start <= to) out.push(w.start);
  } else if (start >= from && start <= to) out.push(start);
  return out;
}

// ---------- next due and status ----------
/**
 * The date the task next needs attention, or null (once-task already done, or no valid schedule).
 * May be in the past (overdue). For seasonal tasks it is the window start; see taskStatus for the window end.
 */
export function nextDue(task, logs, today) {
  return compute(task, logs, today).due;
}

const LAPSE_DAYS = 60; // a missed seasonal window stops counting as overdue this long after it ends

function compute(task, logs, today) {
  const r = parseRule(task.rule);
  const done = lastDone(task, logs);
  const res = { due: null, windowEnd: null, lastDone: done, snoozedUntil: null };
  if (!isValid(task.start)) return res;

  if (r.type === 'once') {
    res.due = done ? null : task.start;
  } else if (r.type === 'after_done') {
    const n = interval(r), unit = r.unit || 'days';
    if (!done) res.due = task.start;
    else res.due = unit === 'weeks' ? addDays(done, 7 * n) : unit === 'months' ? addMonths(done, n) : unit === 'years' ? addMonths(done, 12 * n) : addDays(done, n);
  } else if (ANCHORED.has(r.type)) {
    const lead = leadDays(r);
    for (let k = 0; k < 20000; k++) {
      const o = nth(task, r, k);
      if (!inSeason(o, r)) continue;
      if (!done || addDays(o, -lead) > done) { res.due = o; break; }
    }
  } else if (r.type === 'seasonal' && r.from && r.to) {
    const y = Number(String(today).slice(0, 4));
    for (const w of windowsAround(r, y - 2, y + 2)) {
      if (w.end < task.start) continue;
      if (done && addDays(w.start, -14) <= done) continue;           // satisfied
      if (w.end < today && daysBetween(w.end, today) > LAPSE_DAYS) continue; // missed long ago, lapsed
      res.due = w.start; res.windowEnd = w.end; break;
    }
  }
  if (res.due && r.type !== 'seasonal') {
    const s = activeSnooze(task, logs, done);
    if (s && s > res.due) { res.snoozedUntil = s; res.due = s; }
  }
  return res;
}

/**
 * {state, due, days, overdueDays, windowEnd, lastDone, snoozedUntil}
 * state: 'overdue' | 'due' | 'upcoming' | 'done' | 'inactive'
 *   due     = due today, inside a seasonal window, or within 7 days
 *   done    = a once-task that has been completed
 * days = days from today until due (negative when overdue).
 */
export function taskStatus(task, logs, today) {
  const c = compute(task, logs, today);
  const base = { due: c.due, days: null, overdueDays: 0, windowEnd: c.windowEnd, lastDone: c.lastDone, snoozedUntil: c.snoozedUntil };
  if (task.active != null && !Number(task.active) && task.active !== true) return { ...base, state: 'inactive' };
  if (!c.due) return { ...base, state: 'done' };
  const days = daysBetween(today, c.due);
  base.days = days;
  if (c.windowEnd) {
    if (today > c.windowEnd) return { ...base, state: 'overdue', overdueDays: daysBetween(c.windowEnd, today) };
    if (today >= c.due) return { ...base, state: 'due', days: 0 };
    return { ...base, state: days <= 7 ? 'due' : 'upcoming' };
  }
  if (days < 0) return { ...base, state: 'overdue', overdueDays: -days };
  return { ...base, state: days <= 7 ? 'due' : 'upcoming' };
}

// ---------- plain-language text ----------
const UNIT_WORD = { days: 'day', weeks: 'week', months: 'month', years: 'year' };
const plural = (n, w) => n === 1 ? w : w + 's';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDate(s) {
  if (!isValid(s)) return '';
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}
const fmtMD = s => { const [m, d] = s.split('-').map(Number); return `${MONTHS[m - 1]} ${d}`; };
export function ruleText(rule) {
  const r = parseRule(rule), n = interval(r);
  switch (r.type) {
    case 'yearly': return 'Every year';
    case 'monthly': return n === 1 ? 'Every month' : `Every ${n} months`;
    case 'weekly': return n === 1 ? 'Every week' : `Every ${n} weeks`;
    case 'days': return n === 1 ? 'Every day' : `Every ${n} days`;
    case 'seasonal': return `Every year, ${fmtMD(r.from)} to ${fmtMD(r.to)}`;
    case 'after_done': { const u = r.unit || 'days'; return `${n} ${plural(n, UNIT_WORD[u] || 'day')} after I do it`; }
    default: return 'One time';
  }
}

// ---------- consumables (filters, bulbs, batteries) ----------
/**
 * {next, days, state, low} for a `consumables` row.
 * next = last_replaced + interval_days (null if either is missing); state: 'overdue' | 'due' (within 14 days) | 'ok';
 * low = quantity on hand is zero (only when a quantity was entered).
 */
export function consumableStatus(c, today) {
  const interval = Math.floor(Number(c.interval_days) || 0);
  const next = interval > 0 && isValid(c.last_replaced) ? addDays(c.last_replaced.slice(0, 10), interval) : null;
  const days = next ? daysBetween(today, next) : null;
  const q = c.qty_on_hand;
  const low = q !== '' && q != null && !isNaN(Number(q)) && Number(q) <= 0;
  return { next, days, low, state: days == null ? 'ok' : days < 0 ? 'overdue' : days <= 14 ? 'due' : 'ok' };
}
