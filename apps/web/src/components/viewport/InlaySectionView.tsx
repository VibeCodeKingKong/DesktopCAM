import { useEffect, useMemo, useState } from 'react';
import { getInlaySections, showSectionLine, type InlaySection } from '../../cam/simController';
import { useT } from '../../i18n';

/** Visningens höjd i bildpunkter och hur mycket som visas ovanför ytan (mm). */
const VIEW_H = 150;
const ABOVE = 1.5;

/** Sammanhängande sträckor där villkoret gäller, som [från, till] index. */
function runs(n: number, ok: (i: number) => boolean): [number, number][] {
  const out: [number, number][] = [];
  let start = -1;
  for (let i = 0; i <= n; i++) {
    const on = i < n && ok(i);
    if (on && start < 0) start = i;
    if (!on && start >= 0) {
      out.push([start, i - 1]);
      start = -1;
    }
  }
  return out;
}

/**
 * Genomskärning av ett V-inlägg efter limning och planing: ett snitt rakt
 * genom inlägget från sidan. Visar grundträet, inlägget, limspalten och det
 * som planas bort ovanför ytan. Höjden är förstorad för att V-formen ska synas.
 */
export function InlaySectionView() {
  const t = useT();
  const ti = t.inlaySim;
  const sections = getInlaySections();
  const [index, setIndex] = useState(0);
  const [pos, setPos] = useState(500);
  const [zoom, setZoom] = useState(1);
  const sec: InlaySection | undefined = sections[Math.min(index, sections.length - 1)];
  const row = sec ? Math.round((pos / 1000) * (sec.ny - 1)) : 0;
  const y = sec ? sec.y0 + row * sec.cell : 0;

  useEffect(() => {
    if (sec) showSectionLine({ x0: sec.x0, x1: sec.x0 + (sec.nx - 1) * sec.cell, y });
    return () => showSectionLine(null);
  }, [sec, y]);

  const view = useMemo(() => {
    if (!sec) return null;
    const { nx, cell } = sec;
    const pocket = (i: number) => sec.pocket[row * nx + i];
    const bottom = (i: number) => sec.bottom[row * nx + i];
    let deepest = 0;
    for (let i = 0; i < nx; i++) deepest = Math.min(deepest, pocket(i));
    const zMin = deepest - 1.5;
    const w = (nx - 1) * cell;
    const X = (i: number) => i * cell;
    const Z = (z: number) => ABOVE - Math.max(zMin, Math.min(ABOVE, z));
    const H = ABOVE - zMin;
    const pt = (i: number, z: number) => `${X(i).toFixed(2)},${Z(z).toFixed(3)}`;
    // Grundträ: under fickans yta.
    let base = `M${pt(0, zMin)}`;
    for (let i = 0; i < nx; i++) base += ` L${pt(i, pocket(i))}`;
    base += ` L${pt(nx - 1, zMin)} Z`;
    const band = (from: number, to: number, top: (i: number) => number, bot: (i: number) => number) => {
      let d = `M${pt(from, top(from))}`;
      for (let i = from + 1; i <= to; i++) d += ` L${pt(i, top(i))}`;
      for (let i = to; i >= from; i--) d += ` L${pt(i, bot(i))}`;
      return d + ' Z';
    };
    const has = (i: number) => !Number.isNaN(bottom(i));
    // Inlägget (under ytan), limspalten och det som planas bort (ovanför ytan).
    const inlay = runs(nx, (i) => has(i) && bottom(i) < 0).map(([a, b]) => band(a, b, () => 0, (i) => Math.min(0, bottom(i))));
    const glue = runs(nx, (i) => has(i) && bottom(i) > pocket(i) + 0.01 && pocket(i) < 0).map(([a, b]) => band(a, b, (i) => Math.min(0, bottom(i)), pocket));
    const planed = runs(nx, (i) => has(i)).map(([a, b]) => band(a, b, () => Math.min(sec.top, ABOVE), (i) => Math.max(0, bottom(i))));
    // Höjden förstoras så att djupet fyller ungefär en tredjedel av bredden i bild.
    const exaggeration = Math.max(1, (w * VIEW_H) / (H * 600 * zoom));
    return { base, inlay, glue, planed, w, H, z0: Z(0), exaggeration };
  }, [sec, row, zoom]);

  if (!sec || !view) return null;
  const mm = (v: number) => v.toLocaleString(t.locale, { maximumFractionDigits: 1 });
  return (
    <div className="space-y-1.5 rounded-lg border border-line bg-app/60 p-2">
      <div className="flex flex-wrap items-center gap-2 text-2xs">
        <span className="font-medium">{ti.section}</span>
        {sections.length > 1 && (
          <select className="field h-6 w-auto py-0 text-2xs" value={index} onChange={(e) => setIndex(Number(e.target.value))} aria-label={ti.section}>
            {sections.map((s, i) => (
              <option key={i} value={i}>
                {s.name}
              </option>
            ))}
          </select>
        )}
        <input type="range" min={0} max={1000} value={pos} onChange={(e) => setPos(Number(e.target.value))} className="h-1 min-w-[6rem] flex-1 accent-[rgb(var(--c-accent))]" aria-label={ti.sectionPos} title={ti.sectionPos} />
        <span className="tabular-nums text-muted">Y {mm(y)} mm</span>
        <select className="field h-6 w-auto py-0 text-2xs" value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label={ti.sectionZoom} title={ti.sectionZoom}>
          {[1, 2, 4, 8].map((z) => (
            <option key={z} value={z}>
              {z}×
            </option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto rounded bg-surface">
        <svg viewBox={`0 0 ${view.w} ${view.H}`} preserveAspectRatio="none" style={{ width: `${zoom * 100}%`, height: VIEW_H }} className="block" role="img" aria-label={ti.section}>
          <path d={view.base} fill={sec.baseColor} />
          {view.planed.map((d, i) => (
            <path key={`p${i}`} d={d} fill={sec.plugColor} opacity={0.25} />
          ))}
          {view.glue.map((d, i) => (
            <path key={`g${i}`} d={d} fill="#f5e6a8" />
          ))}
          {view.inlay.map((d, i) => (
            <path key={`i${i}`} d={d} fill={sec.plugColor} />
          ))}
          <line x1={0} x2={view.w} y1={view.z0} y2={view.z0} stroke="#e11d48" strokeWidth={1.2} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-muted">
        <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: sec.baseColor }} />{ti.sectionBase}</span>
        <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: sec.plugColor }} />{ti.legendInlay}</span>
        <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-[#f5e6a8]" />{ti.sectionGlue}</span>
        <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm opacity-40" style={{ background: sec.plugColor }} />{ti.sectionPlaned}</span>
        <span className="flex items-center gap-1"><i className="inline-block h-0 w-3 border-t border-dashed border-[#e11d48]" />{ti.sectionPlaneLine}</span>
        <span className="ml-auto">{ti.sectionExaggeration(Math.round(view.exaggeration))}</span>
      </div>
    </div>
  );
}
