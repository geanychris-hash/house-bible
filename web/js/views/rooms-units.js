// Pure helpers shared by the S4 record views. No DOM, no network: unit tested with node.

// Parse a length typed by a person into inches. Accepts: 126, 126", 10', 10' 6", 10 ft 6 in,
// 10ft 6.5in, 10-6, 10 1/2 (inches with a fraction), 3/4. Returns NaN if it cannot be read.
export function parseLength(v) {
  if (typeof v === 'number') return v;
  if (v == null) return NaN;
  let s = String(v).trim().toLowerCase().replace(/[“”″]/g, '"').replace(/[‘’′]/g, "'");
  if (!s) return NaN;
  const frac = t => {
    t = t.trim();
    if (!t) return 0;
    const m = t.match(/^(?:(\d+(?:\.\d+)?)\s+)?(\d+)\/(\d+)$/);
    if (m) return (m[1] ? +m[1] : 0) + (+m[2]) / (+m[3]);
    return /^\d+(\.\d+)?$/.test(t) ? Number(t) : NaN;
  };
  let m = s.match(/^(\d+(?:\.\d+)?)\s*(?:'|ft|feet|foot)\s*(.*)$/);
  if (m) {
    const rest = m[2].replace(/"|inches|inch|in\b/g, '').replace(/^-/, '').trim();
    const inch = rest ? frac(rest) : 0;
    return isNaN(inch) ? NaN : Number(m[1]) * 12 + inch;
  }
  m = s.match(/^(\d+)-(\d+(?:\.\d+)?)$/);
  if (m) return Number(m[1]) * 12 + Number(m[2]);
  s = s.replace(/"|inches|inch|in\b/g, '').trim();
  return frac(s);
}

// Inches -> "10 ft 6 in" (rounded to the nearest 1/4 inch shown as a decimal-free fraction).
export function fmtLength(inches) {
  if (inches == null || inches === '' || isNaN(inches)) return '';
  const total = Math.round(Number(inches) * 4) / 4;
  const ft = Math.floor(total / 12 + 1e-9);
  const inch = total - ft * 12;
  const whole = Math.floor(inch + 1e-9);
  const q = Math.round((inch - whole) * 4);
  const fr = ['', ' 1/4', ' 1/2', ' 3/4'][q] || '';
  const inchTxt = (whole || q) ? `${whole}${fr} in` : '';
  if (!ft) return inchTxt || '0 in';
  return inchTxt ? `${ft} ft ${inchTxt}` : `${ft} ft`;
}

export const sqft = (lengthIn, widthIn) =>
  (Number(lengthIn) > 0 && Number(widthIn) > 0) ? Math.round(Number(lengthIn) * Number(widthIn) / 144 * 10) / 10 : null;

// ---------- dates (local, YYYY-MM-DD) ----------
const pad = n => String(n).padStart(2, '0');
export const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => isoDate(new Date());
export const parseISO = s => { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
export function daysUntil(dateStr, from = todayISO()) {
  if (!dateStr) return null;
  const a = parseISO(from), b = parseISO(dateStr);
  if (isNaN(a) || isNaN(b)) return null;
  return Math.round((b - a) / 86400000);
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDate(s) {
  if (!s) return '';
  const d = parseISO(s);
  return isNaN(d) ? String(s) : `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
// state: 'expired' | 'soon' | 'ok' | 'none'
export function expiryState(dateStr, windowDays = 60, from = todayISO()) {
  const n = daysUntil(dateStr, from);
  if (n == null) return { state: 'none', days: null, text: '' };
  if (n < 0) return { state: 'expired', days: n, text: n === -1 ? 'Expired yesterday' : `Expired ${-n} days ago` };
  if (n === 0) return { state: 'soon', days: 0, text: 'Expires today' };
  if (n <= windowDays) return { state: 'soon', days: n, text: n === 1 ? 'Expires tomorrow' : `Expires in ${n} days` };
  return { state: 'ok', days: n, text: `Expires ${fmtDate(dateStr)}` };
}

export const money = n => (n == null || n === '' || isNaN(n)) ? '' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ---------- hash routing ----------
// "#/rooms/abc?x=1" -> { path:['rooms','abc'], query:{x:'1'} }
export function parseHash(hash) {
  let s = String(hash || '').replace(/^#\/?/, '');
  let q = '';
  const i = s.indexOf('?');
  if (i >= 0) { q = s.slice(i + 1); s = s.slice(0, i); }
  const query = {};
  for (const [k, v] of new URLSearchParams(q)) query[k] = v;
  return { path: s.split('/').filter(Boolean).map(decodeURIComponent), query };
}

// ---------- text helpers ----------
export const norm = s => String(s == null ? '' : s).toLowerCase();
export const splitTags = s => String(s || '').split(',').map(t => t.trim()).filter(Boolean);
export const baseName = n => String(n || '').replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim();
export function parseJSON(v, fallback) {
  if (v == null || v === '') return fallback;
  if (typeof v !== 'string') return v;
  try { return JSON.parse(v); } catch { return fallback; }
}
export const asIds = v => { const a = parseJSON(v, []); return Array.isArray(a) ? a.filter(Boolean) : []; };
