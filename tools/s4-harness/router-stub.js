// Harness-only router stand-in (S2 owns the real one).
export const views = [];
export function registerView(def) { views.push(def); views.sort((a, b) => a.order - b.order); window.dispatchEvent(new Event('hb-views')); }
