// Settings: house facts (settings.house). Weather alert rules and emails live in the Weather alerts view.
import { registerView } from '../core/router.js';
import * as HB from '../core/data.js';
import { h, openForm, toast } from '../core/ui.js';

const FIELDS = [
  { k: 'address', label: 'Address', wide: true },
  { k: 'year_built', label: 'Year built', type: 'number' },
  { k: 'sqft', label: 'Square feet', type: 'number' },
  { k: 'floors', label: 'Floors', type: 'number' },
  { k: 'lat', label: 'Latitude (for weather alerts)', type: 'number' },
  { k: 'lon', label: 'Longitude (for weather alerts)', type: 'number' },
];
const parse = v => { if (v && typeof v === 'object') return v; try { return JSON.parse(v || '{}') || {}; } catch { return {}; } };

registerView({
  id: 'settings', title: 'Settings', icon: 'tools', order: 95,
  render(container) {
    const draw = async () => {
      const row = await HB.get('settings', 'house');
      const house = parse(row && row.value);
      const edit = () => openForm({
        title: 'House facts', fields: FIELDS, values: house,
        onSave: async v => {
          const out = { ...house };
          for (const f of FIELDS) { const x = v[f.k]; out[f.k] = x === '' || x == null ? null : (f.type === 'number' ? Number(x) : x); }
          await HB.save('settings', { ...(row || {}), id: 'house', key: 'house', value: JSON.stringify(out) });
          toast('Saved'); draw();
        },
      });
      container.replaceChildren(h('div', { class: 'list narrow' },
        h('section', { class: 'panel' },
          h('header', null, h('h2', null, 'House facts')),
          h('dl', { class: 'kv' }, ...FIELDS.flatMap(f => [h('dt', null, f.label), h('dd', null, house[f.k] == null || house[f.k] === '' ? 'Not set' : String(house[f.k]))])),
          h('div', { class: 'row' }, h('button', { class: 'btn primary', type: 'button', onclick: edit }, 'Edit'))),
        h('section', { class: 'panel' },
          h('p', { class: 'muted' }, 'Weather alert emails and rules are under Weather alerts. Device name and key: Connect.'))));
    };
    draw();
    const un = HB.subscribe('settings', draw);
    return un;
  },
});
