// Small line icons for the nav. registerView({icon:'wrench'}) picks one by name; unknown names get a dot.
const P = {
  home: '<path d="M3 11l9-8 9 8M5 10v10h14V10M9 20v-5h6v5"/>',
  wrench: '<path d="M14.5 6.5a4 4 0 0 0-5.2 5.2L4 17l3 3 5.3-5.3a4 4 0 0 0 5.2-5.2l-2.6 2.6-2.4-.6-.6-2.4z"/>',
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  file: '<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/>',
  door: '<path d="M6 21V4h12v17M4 21h16"/><circle cx="15" cy="12.5" r=".8"/>',
  room: '<path d="M4 20V6l8-3 8 3v14zM4 20h16M9 20v-6h6v6"/>',
  box: '<path d="M4 8l8-4 8 4v9l-8 4-8-4zM4 8l8 4 8-4M12 12v9"/>',
  valve: '<path d="M12 4v6M8 4h8M5 14h14M7 10h10v8H7z"/>',
  steam: '<path d="M8 5c-2 2 2 3 0 5M13 5c-2 2 2 3 0 5M18 5c-2 2 2 3 0 5M4 14h16v5H4z"/>',
  dollar: '<path d="M12 3v18M16 7.5c-.8-1-2.2-1.5-4-1.5-2.4 0-4 1.2-4 3s1.6 2.5 4 3 4 1.2 4 3-1.6 3-4 3c-1.8 0-3.200-.5-4-1.500"/>',
  tools: '<path d="M4 20l8-8M14 5l5 5-3 3-5-5zM9 10L5 6l2-2 4 4"/>',
  chart: '<path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  qr: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v6h-4M14 18h2v2"/>',
  phone: '<path d="M6 4h4l2 5-2.500 1.500a11 11 0 0 0 5 5L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 4 6a2 2 0 0 1 2-2z"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  sync: '<path d="M20 11a8 8 0 0 0-14-4M4 4v4h4M4 13a8 8 0 0 0 14 4M20 20v-4h-4"/>',
  dot: '<circle cx="12" cy="12" r="4"/>',
};
export function iconSvg(name) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${P[name] || P.dot}</svg>`;
}
export const iconNames = Object.keys(P);
