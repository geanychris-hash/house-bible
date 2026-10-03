/* State, persistence (localStorage with in-memory fallback), schemas, seed data. */
const KEY = 'houseBible.v1';
let memoryFallback = null;

const levelField = { k: 'level', label: 'Level', type: 'select', options: () => [''].concat(S.settings.levels) };
const COLLECTIONS = {
  shutoffs: { label: 'Shutoffs', single: 'shutoff', fields: [
    { k: 'system', label: 'System', placeholder: 'Main water' },
    { k: 'location', label: 'Location', placeholder: 'Basement, front wall' }, levelField,
    { k: 'how', label: 'How to operate', type: 'textarea', placeholder: 'Quarter-turn ball valve, handle parallel = open' },
    { k: 'tested', label: 'Last tested', type: 'date' },
    { k: 'notes', label: 'Notes', type: 'textarea' }, { k: 'photos', label: 'Photos', type: 'photos' }], title: 'system', sub: ['location', 'how'] },
  systems: { label: 'Systems', single: 'system', fields: [
    { k: 'category', label: 'Category', type: 'select', options: ['Heating', 'Plumbing', 'Electrical', 'Envelope', 'Other'] }, levelField,
    { k: 'name', label: 'Name', placeholder: 'Boiler' },
    { k: 'details', label: 'Make, model, age, settings', type: 'textarea' },
    { k: 'lastService', label: 'Last service', type: 'date' }, { k: 'photos', label: 'Photos', type: 'photos' }], title: 'name', sub: ['category', 'details'] },
  radiators: { label: 'Radiators', single: 'radiator', fields: [
    { k: 'room', label: 'Room' }, levelField, { k: 'size', label: 'Size (sections, height)', placeholder: '12 sections, 26 in' },
    { k: 'ventModel', label: 'Air vent model', placeholder: 'Gorton #1' }, { k: 'ventInstalled', label: 'Vent installed', type: 'date' },
    { k: 'valve', label: 'Supply valve', type: 'select', options: ['Unknown', 'Fully open', 'Fully closed'] },
    { k: 'pitch', label: 'Pitch toward valve', type: 'select', options: ['Unknown', 'Pitched OK', 'Needs re-pitch'] },
    { k: 'issue', label: 'Issue', type: 'select', options: ['None', 'Cold or slow', 'Water hammer', 'Spitting vent', 'Leak', 'Other'] },
    { k: 'lastChecked', label: 'Last checked', type: 'date' }, { k: 'notes', label: 'Notes', type: 'textarea' }, { k: 'photos', label: 'Photos', type: 'photos' }], title: 'room', sub: ['level', 'ventModel', 'pitch'] },
  appliances: { label: 'Appliances', single: 'appliance', fields: [
    { k: 'name', label: 'Appliance' }, levelField, { k: 'brand', label: 'Brand' }, { k: 'model', label: 'Model' }, { k: 'serial', label: 'Serial', scan: true },
    { k: 'installed', label: 'Installed / bought', type: 'date' }, { k: 'warrantyEnd', label: 'Warranty ends', type: 'date' },
    { k: 'notes', label: 'Filters, manual link, notes', type: 'textarea' }, { k: 'photos', label: 'Photos', type: 'photos' }], title: 'name', sub: ['brand', 'model', 'serial'] },
  paint: { label: 'Paint', single: 'paint entry', fields: [
    { k: 'room', label: 'Room' }, levelField, { k: 'surface', label: 'Surface', type: 'select', options: ['Walls', 'Ceiling', 'Trim', 'Doors', 'Exterior body', 'Exterior trim', 'Other'] },
    { k: 'brand', label: 'Brand / line' }, { k: 'color', label: 'Color name / code' }, { k: 'sheen', label: 'Sheen' }, { k: 'code', label: 'Barcode on can', scan: true },
    { k: 'date', label: 'Date painted', type: 'date' }, { k: 'notes', label: 'Notes', type: 'textarea' }, { k: 'photos', label: 'Photos', type: 'photos' }], title: 'room', sub: ['surface', 'brand', 'color', 'sheen'] },
  warranties: { label: 'Warranties', single: 'warranty', fields: [
    { k: 'item', label: 'Item' }, { k: 'provider', label: 'Provider' }, { k: 'start', label: 'Start', type: 'date' }, { k: 'end', label: 'Ends', type: 'date' },
    { k: 'claim', label: 'Claim phone / site' }, { k: 'location', label: 'Paperwork location' }, { k: 'notes', label: 'Coverage notes', type: 'textarea' }, { k: 'photos', label: 'Photos', type: 'photos' }], title: 'item', sub: ['provider', 'claim'] },
  log: { label: 'Project log', single: 'log entry', fields: [
    { k: 'date', label: 'Date', type: 'date' }, { k: 'title', label: 'What was done', placeholder: 'Replaced tub spout' },
    { k: 'status', label: 'Status', type: 'select', options: ['Done', 'In progress', 'Planned', 'Unknown'] },
    { k: 'area', label: 'Area' }, { k: 'who', label: 'Who', placeholder: 'DIY or contractor' }, { k: 'cost', label: 'Cost', type: 'number' },
    { k: 'notes', label: 'Materials, products, follow-ups', type: 'textarea' }, { k: 'photos', label: 'Photos', type: 'photos' }], title: 'title', sub: ['area', 'who', 'notes'] },
};

const SEASONS = ['Fall', 'Heating season', 'Winter', 'Spring', 'Summer', 'Year-round'];
const PRIORITIES = ['Safety', 'Damage', 'Comfort', 'Cosmetic'];
const STATUSES = ['Idea', 'Planned', 'In progress', 'Done', 'On hold'];
const STORES = ['Home Depot', 'Harbor Freight', 'Other'];

function blankState() {
  return {
    v: 2,
    settings: { setupDone: {}, reminderTime: '09:00', sheetW: 48, sheetL: 96, boardL: 96, kerf: 0.125, houseAge: '', examples: true,
      levels: ['Attic', '2nd floor', '1st floor', 'Basement', 'Exterior'], heatFrom: '11-01', heatTo: '04-30',
      emergency: { gas: '', electric: '', water: '', heating: '', plumber: '', electrician: '' } },
    house: { shutoffs: [], systems: [], radiators: [], appliances: [], paint: [], warranties: [], log: [] },
    tools: [],
    tasks: JSON.parse(JSON.stringify(SEED_TASKS)),
    projects: [],
    inbox: [],
  };
}
function exampleRadiators() {
  const r = (room, level, extra) => Object.assign({ id: uid(), example: true, room: room + ' (example)', level, size: '', ventModel: '', ventInstalled: '', valve: 'Unknown', pitch: 'Unknown', issue: 'None', lastChecked: '', notes: 'Example row. Edit or delete.' }, extra || {});
  return [r('Living room', '1st floor', { pitch: 'Pitched OK', lastChecked: todayISO(), valve: 'Fully open' }), r('Kitchen', '1st floor', { pitch: 'Needs re-pitch', lastChecked: todayISO() }),
    r('Front bedroom', '2nd floor', { issue: 'Spitting vent', lastChecked: todayISO() }), r('Bathroom', '2nd floor')];
}
function seedState() {
  const s = blankState();
  const d = todayISO();
  // Project log entries Chris named; details unknown on purpose.
  s.house.log = [
    { id: uid(), date: '', title: 'Ceiling encapsulation', status: 'Unknown', area: '', who: '', cost: null, notes: 'Details to fill in.' },
    { id: uid(), date: '', title: 'Tub spout', status: 'Unknown', area: 'Bathroom', who: '', cost: null, notes: 'Details to fill in.' },
    { id: uid(), date: '', title: 'Radiators', status: 'Unknown', area: 'Steam heat', who: '', cost: null, notes: 'Details to fill in.' },
  ];
  s.house.shutoffs = [
    { id: uid(), example: true, system: 'Main water (example)', location: 'Basement, front wall', level: 'Basement', how: 'Quarter-turn ball valve', tested: '', notes: 'Example row. Edit or delete.' },
  ];
  s.house.radiators = exampleRadiators();
  s.tools = [
    { id: uid(), example: true, name: 'Cordless drill/driver (example)', category: 'Power', notes: 'Edit or delete.' },
    { id: uid(), example: true, name: 'Tape measure 25 ft (example)', category: 'Measuring', notes: '' },
  ];
  const pid = uid(), pid2 = uid();
  s.projects = [
    { id: pid, example: true, name: 'Re-pitch kitchen radiator (example)', status: 'Planned', priority: 'Comfort', pro: 'DIY', season: 'Fall', budget: 75, deps: [], notes: 'Example project. Delete it from Projects or use Settings > Remove examples.',
      steps: [{ t: 'Turn boiler off and let the system cool', d: false }, { t: 'Check slope with a level', d: false }, { t: 'Shim the feet on the valve end lower so condensate drains to the valve', d: false }, { t: 'Replace the air vent if it spits or sticks', d: false }],
      materials: [{ id: uid(), item: 'Gorton #2 air vent', qty: 1, unit: 'ea', hd: 9.98, hf: null, other: null, have: false },
        { id: uid(), item: 'Hardwood shims', qty: 1, unit: 'pack', hd: 4.48, hf: null, other: null, have: false }],
      tools: ['Level', 'Adjustable wrench'],
      parts: [], purchases: [] },
    { id: pid2, example: true, name: 'Build mudroom shelf (example)', status: 'Idea', priority: 'Cosmetic', pro: 'DIY', season: 'Year-round', budget: 120, deps: [pid], notes: 'Example of a dependency and a cut list.',
      steps: [{ t: 'Cut parts to the cut list', d: false }, { t: 'Sand and finish', d: false }, { t: 'Mount to studs', d: false }],
      materials: [{ id: uid(), item: '3/4" plywood 4x8', qty: 1, unit: 'sheet', hd: 62, hf: null, other: null, have: false },
        { id: uid(), item: '2.5" cabinet screws', qty: 1, unit: 'box', hd: 9.5, hf: 7.99, other: null, have: false }],
      tools: ['Circular saw', 'Drill/driver', 'Stud finder'],
      parts: [{ id: uid(), name: 'Shelf', material: '3/4" plywood', kind: 'sheet', qty: 3, l: '36', w: '11.25', t: '3/4' },
        { id: uid(), name: 'Side', material: '3/4" plywood', kind: 'sheet', qty: 2, l: '48', w: '11.25', t: '3/4' },
        { id: uid(), name: 'Cleat', material: '1x3 pine', kind: 'board', qty: 2, l: '34', w: '2.5', t: '3/4' },
        { id: uid(), name: 'Back rail', material: '1x3 pine', kind: 'board', qty: 1, l: '36', w: '2.5', t: '3/4' }],
      purchases: [] },
  ];
  return s;
}

let S;
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { S = JSON.parse(raw); migrate(); return; }
  } catch (e) { if (memoryFallback) { S = JSON.parse(memoryFallback); return; } }
  S = seedState();
  save();
}
function migrate() {
  const b = blankState();
  S.settings = Object.assign({}, b.settings, S.settings || {});
  S.house = Object.assign({}, b.house, S.house || {});
  S.settings.emergency = Object.assign({}, b.settings.emergency, S.settings.emergency || {});
  if (!Array.isArray(S.settings.levels) || !S.settings.levels.length) S.settings.levels = b.settings.levels;
  S.house.radiators = S.house.radiators || [];
  S.inbox = S.inbox || []; S.settings.setupDone = S.settings.setupDone || {};
  S.tools = S.tools || []; S.tasks = S.tasks || b.tasks; S.projects = S.projects || [];
  if ((S.v || 1) < 2) {
    if (S.settings.examples !== false && !S.house.radiators.length) S.house.radiators = exampleRadiators();
    S.house.shutoffs.forEach(x => { if (x.example && !x.level) x.level = 'Basement'; });
    S.v = 2;
  }
}
let saveErr = false;
function save() {
  const json = JSON.stringify(S);
  memoryFallback = json;
  try { localStorage.setItem(KEY, json); saveErr = false; } catch (e) { saveErr = true; }
}
function resetAll(seed = false) { S = seed ? seedState() : blankState(); save(); }
function removeExamples() {
  ['shutoffs', 'radiators'].forEach(k => S.house[k] = S.house[k].filter(x => !x.example));
  S.tools = S.tools.filter(x => !x.example);
  const gone = new Set(S.projects.filter(p => p.example).map(p => p.id));
  S.projects = S.projects.filter(p => !p.example);
  S.projects.forEach(p => p.deps = (p.deps || []).filter(d => !gone.has(d)));
  S.settings.examples = false; save();
}
const findProject = id => S.projects.find(p => p.id === id);
