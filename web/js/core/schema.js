// Table list and typed (non-text) fields, copied from CONTRACT section 3.
// The server schema.json is the source of truth; this is the client's copy, used to
// create IndexedDB stores, normalize rows from the server and find file references.
export const TABLES = ['rooms', 'assets', 'shutoffs', 'tasks', 'task_log', 'consumables', 'documents', 'contacts',
  'steam_log', 'projects', 'materials', 'expenses', 'tools', 'utilities', 'sensitive', 'settings'];

export const SYSTEM_COLS = ['id', 'rev', 'updatedAt', 'updatedBy', 'deleted'];

// Only non-text fields are listed. Types: num, bool, json, files, file.
export const FIELD_TYPES = {
  rooms: { length_in: 'num', width_in: 'num', height_in: 'num', photos: 'files' },
  assets: { pro_only: 'bool', photos: 'files', docs: 'json', expected_life_years: 'num', replace_cost: 'num', purchase_price: 'num', replacement_value: 'num' },
  shutoffs: { photos: 'files' },
  tasks: { rule: 'json', pro_only: 'bool', calendar: 'bool', active: 'bool' },
  task_log: { photos: 'files', cost: 'num' },
  consumables: { qty_on_hand: 'num', interval_days: 'num' },
  documents: { file: 'file' },
  contacts: { would_rehire: 'bool', cost: 'num' },
  steam_log: { pressure_psi: 'num', photos: 'files' },
  projects: { pro: 'bool', budget: 'num', deps: 'json', steps: 'json', parts: 'json', capital_improvement: 'bool' },
  materials: { qty: 'num', price_hd: 'num', price_hf: 'num', price_other: 'num', have: 'bool' },
  expenses: { amount: 'num', capital_improvement: 'bool' },
  tools: {},
  utilities: { amount: 'num', usage: 'num', hdd: 'num' },
  sensitive: {},
  settings: { value: 'json' },
};

// Fields holding Drive file ids (used to swap queued-upload placeholders for real ids).
export function fileFields(table) {
  const t = FIELD_TYPES[table] || {};
  return Object.keys(t).filter(k => t[k] === 'files' || t[k] === 'file');
}

// The Sheet stores json/files as text; the server may send them back as strings. Views always
// get real arrays/objects, numbers and 0/1 flags.
export function normalizeRow(table, row) {
  const types = FIELD_TYPES[table] || {};
  const out = { ...row };
  out.rev = Number(out.rev) || 0;
  out.updatedAt = Number(out.updatedAt) || 0;
  out.deleted = out.deleted === true || out.deleted === 'TRUE' || Number(out.deleted) === 1 ? 1 : 0;
  for (const [k, t] of Object.entries(types)) {
    const v = out[k];
    if (v === undefined) continue;
    if (t === 'json' || t === 'files') {
      if (typeof v === 'string') {
        if (v === '') out[k] = t === 'files' ? [] : null;
        else { try { out[k] = JSON.parse(v); } catch { /* leave as is */ } }
      }
    } else if (t === 'bool') {
      out[k] = v === true || v === 'TRUE' || Number(v) === 1 ? 1 : 0;
    } else if (t === 'num') {
      if (v !== '' && v !== null && !isNaN(Number(v))) out[k] = Number(v);
    }
  }
  return out;
}
