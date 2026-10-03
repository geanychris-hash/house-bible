/* Cut list optimizer: sheets via shelf packing, boards via first-fit-decreasing. Units: inches. */
function expandParts(parts) {
  const out = [];
  for (const p of parts) {
    const l = parseInches(p.l), w = parseInches(p.w), q = Math.max(1, Math.round(p.qty || 1));
    if (isNaN(l) || isNaN(w) && p.kind === 'sheet') continue;
    for (let i = 0; i < q; i++) out.push({ name: p.name, material: p.material || 'Material', kind: p.kind, l, w: isNaN(w) ? 0 : w, t: p.t });
  }
  return out;
}
/* Sheet: parts placed in rows (shelves) across the sheet width W, running along length L. */
function packSheets(parts, W, L, kerf, rotate) {
  const items = parts.map(p => {
    let a = p.l, b = p.w; // a runs along L, b along W
    if (rotate && b > a) [a, b] = [b, a];
    return { ...p, a, b };
  }).sort((x, y) => y.b - x.b || y.a - x.a);
  const sheets = [], problems = [];
  for (const it of items) {
    if (it.a > L + 1e-6 || it.b > W + 1e-6) {
      if (!rotate && it.b <= L && it.a <= W) { /* fits only rotated */ }
      problems.push(`${it.name} (${fmtIn(it.l)} x ${fmtIn(it.w)}) does not fit a ${W}" x ${L}" sheet`); continue;
    }
    let placed = false;
    for (const sh of sheets) {
      for (const row of sh.rows) {
        if (it.b <= row.h + 1e-6 && row.used + it.a <= L + 1e-6) {
          row.items.push({ ...it, x: row.used, y: row.y }); row.used += it.a + kerf; placed = true; break;
        }
      }
      if (placed) break;
      const usedW = sh.rows.reduce((s, r) => s + r.h + kerf, 0);
      if (usedW + it.b <= W + 1e-6) {
        const row = { y: usedW, h: it.b, used: 0, items: [] };
        row.items.push({ ...it, x: 0, y: row.y }); row.used = it.a + kerf; sh.rows.push(row); placed = true; break;
      }
    }
    if (!placed) {
      const row = { y: 0, h: it.b, used: it.a + kerf, items: [] };
      row.items.push({ ...it, x: 0, y: 0 });
      sheets.push({ rows: [row] });
    }
  }
  const sheetArea = W * L;
  sheets.forEach(sh => { sh.usedArea = sh.rows.flatMap(r => r.items).reduce((s, i) => s + i.a * i.b, 0); sh.util = sh.usedArea / sheetArea; });
  return { sheets, problems };
}
function sheetSVG(sheet, W, L, n) {
  const scale = 6, pw = L * scale, ph = W * scale, ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${pw} ${ph + 16}`); svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `Sheet ${n} cut layout`);
  const mk = (tag, attrs, txt) => { const e = document.createElementNS(ns, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (txt != null) e.textContent = txt; return e; };
  svg.append(mk('rect', { x: 0, y: 0, width: pw, height: ph, fill: 'none', stroke: 'currentColor', 'stroke-opacity': .35 }));
  sheet.rows.forEach(r => r.items.forEach(i => {
    svg.append(mk('rect', { class: 'part', x: i.x * scale, y: i.y * scale, width: i.a * scale, height: i.b * scale }));
    const label = `${i.name}`, dims = `${fmtIn(i.a)} x ${fmtIn(i.b)}`;
    if (i.a * scale > 60 && i.b * scale > 26) {
      svg.append(mk('text', { x: i.x * scale + 4, y: i.y * scale + 12 }, label));
      svg.append(mk('text', { x: i.x * scale + 4, y: i.y * scale + 24 }, dims));
    } else if (i.a * scale > 30) svg.append(mk('text', { x: i.x * scale + 3, y: i.y * scale + 11 }, dims));
  }));
  svg.append(mk('text', { x: 0, y: ph + 12 }, `${L}" long x ${W}" wide`));
  return svg;
}
/* Boards: pack lengths into stock boards of length L. */
function packBoards(parts, L, kerf) {
  const items = parts.map(p => ({ ...p, len: p.l })).sort((a, b) => b.len - a.len);
  const boards = [], problems = [];
  for (const it of items) {
    if (it.len > L + 1e-6) { problems.push(`${it.name} (${fmtIn(it.len)}) is longer than the ${L}" stock`); continue; }
    let bd = boards.find(b => b.used + it.len + (b.items.length ? kerf : 0) <= L + 1e-6);
    if (!bd) { bd = { used: 0, items: [] }; boards.push(bd); }
    bd.used += it.len + (bd.items.length ? kerf : 0); bd.items.push(it);
  }
  boards.forEach(b => b.left = L - b.used);
  return { boards, problems };
}
/* Full cut plan for a project: groups by material. */
function cutPlan(project, settings) {
  const parts = expandParts(project.parts || []);
  const groups = {};
  parts.forEach(p => { const k = p.kind + '|' + p.material; (groups[k] = groups[k] || { kind: p.kind, material: p.material, parts: [] }).parts.push(p); });
  return Object.values(groups).map(g => {
    if (g.kind === 'sheet') {
      const r = packSheets(g.parts, settings.sheetW, settings.sheetL, settings.kerf, true);
      return { ...g, sheets: r.sheets, problems: r.problems, count: r.sheets.length };
    }
    const r = packBoards(g.parts, settings.boardL, settings.kerf);
    return { ...g, boards: r.boards, problems: r.problems, count: r.boards.length };
  });
}
