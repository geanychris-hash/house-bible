// Tool inventory: own and want (the wishlist is status "want"). importTools() is for S6's receipts import.
import { registerView } from '../core/router.js';
import { HB, HBui, h, panel, btn, chip, empty, tabBar, ensureCss, watchTables } from './projects-common.js';
import { planToolImport } from '../core/plan.js';

/* Add many tools at once. rows: [{name, category, status, brand, model, notes}]. Skips ones already present.
   Returns {added, skipped} (counts, plus the skipped reasons). */
export async function importTools(rows) {
  const existing = await HB.list('tools');
  const { toAdd, skipped } = planToolImport(existing, rows);
  for (const t of toAdd) await HB.save('tools', t);
  return { added: toAdd.length, skipped: skipped.length, skippedRows: skipped };
}

export function editTool(t, defaults = {}, onDone = () => {}) {
  HBui.openForm({
    title: t ? 'Edit tool' : 'Add tool',
    values: t || { status: 'own', ...defaults },
    fields: [
      { k: 'name', label: 'Tool', wide: true },
      { k: 'status', label: 'Status', type: 'select', options: ['own', 'want'] },
      { k: 'category', label: 'Category', placeholder: 'Power tools' },
      { k: 'brand', label: 'Brand' },
      { k: 'model', label: 'Model' },
      { k: 'notes', label: 'Notes', type: 'textarea' },
    ],
    onSave: async out => {
      if (!String(out.name || '').trim()) { HBui.toast('Give the tool a name'); return false; }
      await HB.save('tools', { ...(t ? { id: t.id } : {}), ...out, name: out.name.trim() });
      onDone();
    },
    onDelete: t ? async () => { await HB.remove('tools', t.id); onDone(); } : null,
  });
}

registerView({
  id: 'tools', title: 'Tools', icon: 'wrench', order: 46,
  render(container) {
    ensureCss();
    const st = { tab: 'own', q: '' };
    const head = h('div', { class: 's5-list' }), listBox = h('div', { class: 's5-list' });
    const search = h('input', { type: 'search', placeholder: 'Search tools', 'aria-label': 'Search tools', oninput: e => { st.q = e.target.value; draw(); } });
    container.replaceChildren(h('div', { class: 's5-list' }, head, search, listBox));
    const draw = async () => {
      const all = await HB.list('tools');
      const q = st.q.trim().toLowerCase();
      const match = t => !q || [t.name, t.brand, t.model, t.category, t.notes].some(x => String(x || '').toLowerCase().includes(q));
      const rows = all.filter(t => (t.status === 'want' ? 'want' : 'own') === st.tab && match(t)).sort((a, b) => String(a.category || '~').localeCompare(String(b.category || '~')) || String(a.name).localeCompare(String(b.name)));
      const counts = { own: all.filter(t => t.status !== 'want').length, want: all.filter(t => t.status === 'want').length };
      const groups = new Map();
      rows.forEach(t => { const k = t.category || 'Uncategorized'; (groups.get(k) || groups.set(k, []).get(k)).push(t); });
      const card = t => h('div', { class: 's5-item s5-click', tabindex: '0', role: 'button', onclick: () => editTool(t, {}, draw), onkeydown: e => { if (e.key === 'Enter') editTool(t, {}, draw); } },
        h('div', { class: 's5-row spread' }, h('span', { class: 's5-title' }, t.name), t.status === 'want' ? chip('Want', 'warn') : null),
        h('span', { class: 's5-muted' }, [t.brand, t.model].filter(Boolean).join(' ')),
        t.status === 'want' ? btn('Got it: move to Own', async e => { e.stopPropagation(); await HB.save('tools', { id: t.id, status: 'own' }); draw(); }, 'small') : null);
      head.replaceChildren(
        panel(null, btn('Add tool', () => editTool(null, { status: st.tab }, draw), 'primary'), h('div', { class: 's5-muted' }, `${counts.own} owned, ${counts.want} on the wishlist`)),
        tabBar([['own', `Own (${counts.own})`], ['want', `Wishlist (${counts.want})`]], st.tab, k => { st.tab = k; draw(); }));
      listBox.replaceChildren(...(rows.length ? [...groups].map(([cat, ts]) => panel(cat, null, h('div', { class: 's5-list' }, ts.map(card)))) : [empty(q ? 'No tool matches.' : st.tab === 'own' ? 'No tools yet.' : 'The wishlist is empty.')]));
    };
    draw();
    return watchTables(container, ['tools'], draw);
  },
});
