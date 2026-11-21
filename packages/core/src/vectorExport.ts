/**
 * Export av vektorer: SVG, DXF och PDF i verklig storlek (mm).
 *
 * Egen kod, inga beroenden. Formaten är öppna:
 * - SVG 1.1 med width/height i mm och viewBox i mm (1 enhet = 1 mm). Linjer,
 *   cirkelbågar (A) och kubiska kurvor (C) skrivs exakt.
 * - DXF R12 (AC1009) – det format som flest CAD/CAM-program läser. Varje bana
 *   blir en POLYLINE (bågar och kurvor uppdelade med 0,01 mm tolerans).
 *   $INSUNITS = 4 (mm).
 * - PDF 1.4 med sidstorlek efter ritningen, 1 mm = 72/25,4 pt. En 100 mm
 *   linjal kontrollerar att utskriften blev i skala 1:1.
 *
 * Koordinater: ritningens mm med y uppåt. SVG har y nedåt och vänds därför.
 */
import { shapeToPolylines } from './geometry';
import type { Vec2, VectorPath, VectorShape } from './types';

export interface ExportLayer {
  name: string;
  color?: string;
  shapes: VectorShape[];
}

export interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Omslutande rektangel för alla former (mm). */
export function exportBounds(layers: ExportLayer[]): Bounds | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const l of layers)
    for (const sh of l.shapes)
      for (const p of shapeToPolylines(sh, 0.01))
        for (let i = 0; i < p.points.length; i += 2) {
          x0 = Math.min(x0, p.points[i]); x1 = Math.max(x1, p.points[i]);
          y0 = Math.min(y0, p.points[i + 1]); y1 = Math.max(y1, p.points[i + 1]);
        }
  return Number.isFinite(x0) ? { x0, y0, x1, y1 } : null;
}

const n = (v: number) => (Math.round(v * 1000) / 1000).toString();
const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);

/** SVG-bandata för en bana (y vänds: y' = top − y). */
function svgPath(p: VectorPath, top: number): string {
  const P = (v: Vec2) => `${n(v.x)} ${n(top - v.y)}`;
  let d = `M${P(p.start)}`;
  let cur = p.start;
  for (const s of p.segments) {
    if (s.type === 'line') d += ` L${P(s.to)}`;
    else if (s.type === 'cubic') d += ` C${P(s.c1)} ${P(s.c2)} ${P(s.to)}`;
    else {
      const r = Math.hypot(cur.x - s.center.x, cur.y - s.center.y);
      const a0 = Math.atan2(cur.y - s.center.y, cur.x - s.center.x), a1 = Math.atan2(s.to.y - s.center.y, s.to.x - s.center.x);
      let sweep = a1 - a0;
      if (s.clockwise && sweep > 0) sweep -= 2 * Math.PI;
      if (!s.clockwise && sweep < 0) sweep += 2 * Math.PI;
      // Hel cirkel: dela i två halvor (SVG kan inte rita en båge till samma punkt).
      if (Math.hypot(cur.x - s.to.x, cur.y - s.to.y) < 1e-9) {
        const mid = { x: 2 * s.center.x - cur.x, y: 2 * s.center.y - cur.y };
        // y vänds: moturs i ritningen blir medurs i SVG, alltså sweep-flag 1.
        const f = s.clockwise ? 0 : 1;
        d += ` A${n(r)} ${n(r)} 0 0 ${f} ${P(mid)} A${n(r)} ${n(r)} 0 0 ${f} ${P(s.to)}`;
      } else {
        const large = Math.abs(sweep) > Math.PI ? 1 : 0;
        d += ` A${n(r)} ${n(r)} 0 ${large} ${s.clockwise ? 0 : 1} ${P(s.to)}`;
      }
    }
    cur = s.to;
  }
  return p.closed ? `${d} Z` : d;
}

/**
 * SVG i verklig storlek: sidan = formernas omslutande rektangel plus marginal,
 * eller materialets yta om `area` anges. Ett lager per grupp (id = lagrets namn).
 */
export function exportSvg(layers: ExportLayer[], opts: { margin?: number; area?: Bounds; stroke?: number } = {}): string {
  const b = opts.area ?? exportBounds(layers) ?? { x0: 0, y0: 0, x1: 100, y1: 100 };
  const m = opts.area ? 0 : opts.margin ?? 5;
  const x0 = b.x0 - m, y0 = b.y0 - m, w = b.x1 - b.x0 + 2 * m, h = b.y1 - b.y0 + 2 * m;
  const top = y0 + h;
  const groups = layers
    .filter((l) => l.shapes.length)
    .map((l) => {
      const paths = l.shapes
        .map((sh) => `    <path id="${esc(sh.id)}" data-name="${esc(sh.name)}" fill-rule="evenodd" d="${sh.paths.map((p) => svgPath(p, top)).join(' ')}"/>`)
        .join('\n');
      return `  <g id="${esc(l.name)}" fill="none" stroke="${l.color ?? '#000000'}" stroke-width="${opts.stroke ?? 0.2}">\n${paths}\n  </g>`;
    })
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- desktopCAM – mått i millimeter, 1 enhet = 1 mm -->
<svg xmlns="http://www.w3.org/2000/svg" width="${n(w)}mm" height="${n(h)}mm" viewBox="${n(x0)} 0 ${n(w)} ${n(h)}">
${groups}
</svg>
`;
}

/** DXF R12: varje bana som POLYLINE (sluten med flagga 1), lager efter ritningens lager. */
export function exportDxf(layers: ExportLayer[]): string {
  const out: string[] = [];
  const g = (code: number, value: string | number) => out.push(String(code), typeof value === 'number' ? n(value) : value);
  const b = exportBounds(layers) ?? { x0: 0, y0: 0, x1: 0, y1: 0 };
  const layerName = (s: string) => s.replace(/[<>/\\":;?*|=,]/g, '_').slice(0, 31) || '0';
  g(0, 'SECTION'); g(2, 'HEADER');
  g(9, '$ACADVER'); g(1, 'AC1009');
  g(9, '$INSUNITS'); g(70, 4);
  g(9, '$EXTMIN'); g(10, b.x0); g(20, b.y0); g(30, 0);
  g(9, '$EXTMAX'); g(10, b.x1); g(20, b.y1); g(30, 0);
  g(0, 'ENDSEC');
  g(0, 'SECTION'); g(2, 'TABLES');
  g(0, 'TABLE'); g(2, 'LAYER'); g(70, layers.length);
  layers.forEach((l, i) => {
    g(0, 'LAYER'); g(2, layerName(l.name)); g(70, 0); g(62, (i % 6) + 1); g(6, 'CONTINUOUS');
  });
  g(0, 'ENDTAB');
  g(0, 'ENDSEC');
  g(0, 'SECTION'); g(2, 'ENTITIES');
  for (const l of layers)
    for (const sh of l.shapes)
      for (const p of shapeToPolylines(sh, 0.01)) {
        const pts = p.points;
        if (pts.length < 4) continue;
        g(0, 'POLYLINE'); g(8, layerName(l.name)); g(66, 1); g(10, 0); g(20, 0); g(30, 0); g(70, p.closed ? 1 : 0);
        // En sluten polylinje ska inte upprepa startpunkten.
        let m = pts.length / 2;
        if (p.closed && m > 1 && Math.hypot(pts[0] - pts[2 * m - 2], pts[1] - pts[2 * m - 1]) < 1e-9) m--;
        for (let i = 0; i < m; i++) {
          g(0, 'VERTEX'); g(8, layerName(l.name)); g(10, pts[2 * i]); g(20, pts[2 * i + 1]); g(30, 0);
        }
        g(0, 'SEQEND'); g(8, layerName(l.name));
      }
  g(0, 'ENDSEC');
  g(0, 'EOF');
  return out.join('\n') + '\n';
}

/**
 * PDF i skala 1:1. Sidan rymmer ritningen med marginal och en 100 mm linjal
 * (med mm-streck) under ritningen. `labels` skriver formernas namn. Text med
 * standardtypsnittet Helvetica (WinAnsi); tecken utanför den ersätts med "?".
 */
export function exportPdf(layers: ExportLayer[], opts: { labels?: boolean; title?: string; note?: string } = {}): Uint8Array {
  const PT = 72 / 25.4;
  const b = exportBounds(layers) ?? { x0: 0, y0: 0, x1: 100, y1: 100 };
  const m = 12, ruler = 22;
  const wMm = Math.max(b.x1 - b.x0, 110) + 2 * m, hMm = b.y1 - b.y0 + 2 * m + ruler;
  const X = (x: number) => ((x - b.x0 + m) * PT).toFixed(3);
  const Y = (y: number) => ((y - b.y0 + m + ruler) * PT).toFixed(3);
  const ascii = (s: string) => s.replace(/[^\x20-\x7e\xa0-\xff]/g, '?').replace(/[\\()]/g, (c) => `\\${c}`);
  const c: string[] = ['0 0 0 RG 0.25 w 1 J 1 j'];
  for (const l of layers)
    for (const sh of l.shapes) {
      for (const p of shapeToPolylines(sh, 0.02)) {
        const pts = p.points;
        if (pts.length < 4) continue;
        c.push(`${X(pts[0])} ${Y(pts[1])} m`);
        for (let i = 2; i < pts.length; i += 2) c.push(`${X(pts[i])} ${Y(pts[i + 1])} l`);
        c.push(p.closed ? 's' : 'S');
      }
      if (opts.labels) {
        const bb = exportBounds([{ name: '', shapes: [sh] }]);
        if (bb) c.push(`BT /F1 7 Tf ${X(bb.x0)} ${Y(bb.y1 + 1.5)} Td (${ascii(sh.name)}) Tj ET`);
      }
    }
  // Linjal: 100 mm med streck varje mm, längre var 5:e och 10:e.
  const rx = (v: number) => ((m + v) * PT).toFixed(3), ry = (v: number) => (v * PT).toFixed(3);
  c.push('0.3 w', `${rx(0)} ${ry(8)} m ${rx(100)} ${ry(8)} l S`);
  for (let i = 0; i <= 100; i++) {
    const len = i % 10 === 0 ? 5 : i % 5 === 0 ? 3.5 : 2;
    c.push(`${rx(i)} ${ry(8)} m ${rx(i)} ${ry(8 + len)} l S`);
  }
  c.push(`BT /F1 8 Tf ${rx(0)} ${ry(3)} Td (0) Tj ET`, `BT /F1 8 Tf ${rx(97)} ${ry(3)} Td (100 mm) Tj ET`);
  if (opts.note) c.push(`BT /F1 8 Tf ${rx(105)} ${ry(9)} Td (${ascii(opts.note)}) Tj ET`);
  if (opts.title) c.push(`BT /F1 9 Tf ${rx(105)} ${ry(15)} Td (${ascii(opts.title)}) Tj ET`);
  const stream = c.join('\n');
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${(wMm * PT).toFixed(3)} ${(hMm * PT).toFixed(3)}] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ];
  let pdf = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  // Latin-1: en byte per tecken (offseten ovan räknar tecken = byte).
  return Uint8Array.from(pdf, (ch) => ch.charCodeAt(0) & 0xff);
}
