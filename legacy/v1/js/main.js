/* Boot */
function boot() {
  load(); applyTheme();
  try { const r = JSON.parse(localStorage.getItem('hb.route') || 'null'); if (r && TABS.some(t => t[0] === r.tab)) route.tab = r.tab; } catch (e) { }
  render();
  document.addEventListener('keydown', e => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '');
    if ((e.key === '/' && !typing && !e.ctrlKey && !e.metaKey) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); if (!document.querySelector('.overlay')) openSearch(); }
  });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
}
boot();
