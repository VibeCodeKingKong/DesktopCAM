import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer } from 'lucide-react';
import { shapeToPolylines, type ToolpathConfig } from '@desktopcam/core';
import { allShapes, useAppStore, useMachine, useMaterialPreset } from '../../store/useAppStore';
import { materialName, toolName, useT } from '../../i18n';
import { duration } from '../../utils/format';
import { Dialog } from '../ui/Dialog';

const COLORS = ['#0969da', '#cf222e', '#1a7f37', '#8250df', '#bc4c00', '#1b7c83', '#9a6700', '#bf3989'];

/**
 * Arbetsblad: allt som behövs vid maskinen på ett papper – material, nollpunkt,
 * banorna i ordning med verktyg, matning och tid, och en ritning uppifrån.
 * Skrivs ut med webbläsarens utskrift (där kan man också spara som PDF).
 */
export function JobSheetDialog() {
  const t = useT();
  const J = t.jobSheet;
  const open = useAppStore((s) => s.dialog === 'jobSheet');
  const close = () => useAppStore.getState().openDialog(null);
  const [notes, setNotes] = useState('');
  if (!open) return null;
  return (
    <Dialog
      open={open}
      onClose={close}
      title={J.title}
      width="max-w-4xl"
      footer={
        <>
          <p className="flex-1 text-2xs text-muted">{J.printHint}</p>
          <button className="btn" onClick={close}>
            {t.common.close}
          </button>
          <button className="btn btn-primary" onClick={() => window.print()}>
            <Printer size={13} /> {J.print}
          </button>
        </>
      }
    >
      <div className="p-4">
        <div className="rounded-lg border border-line bg-white p-4 text-black shadow-sm">
          <Sheet notes={notes} />
        </div>
        <label className="mt-3 block text-xs text-muted">
          {J.notes}
          <textarea className="field mt-1 h-20 w-full resize-y py-1.5" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={J.notesPlaceholder} />
        </label>
      </div>
      {/* Utskriften: samma blad, utanför appen (allt annat döljs vid utskrift). */}
      {createPortal(
        <div className="print-sheet">
          <Sheet notes={notes} />
        </div>,
        document.body,
      )}
    </Dialog>
  );
}

function Sheet({ notes }: { notes: string }) {
  const t = useT();
  const J = t.jobSheet;
  const s = useAppStore();
  const machine = useMachine();
  const preset = useMaterialPreset();
  const m = s.material;
  const toolpaths = s.toolpaths.filter((tp) => tp.visible && s.results[tp.id]);
  const total = toolpaths.reduce((a, tp) => a + (s.results[tp.id]?.stats.estimatedSeconds ?? 0), 0);
  const changes = toolpaths.reduce((a, tp, i) => a + (i > 0 && tp.toolId !== toolpaths[i - 1].toolId ? 1 : 0), 0);
  const num = (v: number, d = 1) => v.toLocaleString(t.locale, { maximumFractionDigits: d });
  const tName = (id: string) => {
    const tool = s.tools.find((x) => x.id === id);
    return tool ? toolName(t, tool.id, tool.name) : '–';
  };
  const details = (tp: ToolpathConfig): string => {
    const parts: string[] = [];
    const p = tp.params;
    if (tp.operation === 'laserCut' || tp.operation === 'laserRaster') {
      parts.push(`${t.props.laserSpeed} ${num(p.feedRate, 0)} mm/min`, `${t.props.power} ${num(p.laserPowerPct ?? 0, 0)} %`);
      if (tp.operation === 'laserCut') parts.push(`${t.props.passes} ${tp.passes}`);
    } else if (tp.operation === 'plasmaCut') {
      parts.push(`${num(tp.amps, 0)} A`, `${t.props.feed} ${num(p.feedRate, 0)} mm/min`, `${t.props.kerf} ${num(tp.kerf, 2)} mm`);
    } else if (tp.operation === 'gcode') {
      parts.push(tp.source.kind === 'file' ? tp.source.fileName : t.calib.tests[tp.source.testId]?.name ?? '');
    } else {
      const depth = 'cutDepth' in tp ? tp.cutDepth : 'depth' in tp ? tp.depth : 'flatDepth' in tp ? tp.flatDepth : undefined;
      if (depth !== undefined) parts.push(`${t.props.depth} ${num(depth, 2)} mm`);
      parts.push(`${t.props.feed} ${num(p.feedRate, 0)} mm/min`);
      if (p.spindleRpm && machine.kind === 'router') parts.push(`${num(p.spindleRpm, 0)} rpm`);
    }
    return parts.join(' · ');
  };

  // Ritningen uppifrån: arbetsstycket, formerna (grått) och banorna i färg med nummer.
  const W = m.width, H = m.height;
  const pad = Math.max(W, H) * 0.04;
  const sw = Math.max(W, H) / 500;
  const y = (v: number) => H - v;
  const shapesPath = useMemo(
    () =>
      allShapes(s.layers)
        .flatMap((sh) => shapeToPolylines(sh, 0.3))
        .map((pl) => {
          let d = '';
          for (let i = 0; i + 1 < pl.points.length; i += 2) d += `${i ? 'L' : 'M'}${pl.points[i].toFixed(1)} ${y(pl.points[i + 1]).toFixed(1)}`;
          return pl.closed ? d + 'Z' : d;
        })
        .join(''),
    [s.layers, H], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const cutPath = (id: string) => {
    const c = s.results[id]?.cuts;
    if (!c) return { d: '', x: 0, y: 0 };
    let d = '';
    let first: [number, number] | null = null;
    const step = Math.max(1, Math.floor(c.length / 6 / 4000)) * 6; // högst ~4000 segment per bana
    for (let i = 0; i + 5 < c.length; i += step) {
      // Bara där verktyget är i materialet (inte nedgången från säker höjd).
      if (machine.kind === 'router' && (c[i + 2] > 0.01 || c[i + 5] > 0.01)) continue;
      first ??= [c[i], c[i + 1]];
      d += `M${c[i].toFixed(1)} ${y(c[i + 1]).toFixed(1)}L${c[i + 3].toFixed(1)} ${y(c[i + 4]).toFixed(1)}`;
    }
    return { d, x: first?.[0] ?? 0, y: y(first?.[1] ?? 0) };
  };

  return (
    <div className="job-sheet space-y-3 text-[11px] leading-snug">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-black/30 pb-2">
        <h2 className="text-base font-semibold">{s.projectName || t.common.untitledProject}</h2>
        <span>{new Date().toLocaleString(t.locale, { dateStyle: 'medium', timeStyle: 'short' })} · desktopCAM</span>
      </header>
      <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
        <p>
          <b>{J.machine}:</b> {machine.name} ({machine.postprocessor.name})
        </p>
        <p>
          <b>{J.material}:</b> {materialName(t, preset.id, preset.name)}, {num(m.thickness, 2)} mm
        </p>
        <p>
          <b>{J.stock}:</b> {num(W)} × {num(H)} mm
        </p>
        <p>
          <b>{J.zeroXY}:</b> {m.origin === 'center' ? J.originCenter : J.originCorner}
        </p>
        <p>
          <b>{J.zeroZ}:</b> {m.zZero === 'bottom' ? J.zBottom : J.zTop}
        </p>
        <p>
          <b>{J.totalTime}:</b> {total > 0 ? duration(total) : '–'}
          {changes > 0 && ` · ${J.toolChanges(String(changes))}`}
        </p>
      </div>
      {toolpaths.length ? (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-black/30 text-left">
              <th className="py-1 pr-2">#</th>
              <th className="py-1 pr-2">{J.toolpath}</th>
              <th className="py-1 pr-2">{J.tool}</th>
              <th className="py-1 pr-2">{J.settings}</th>
              <th className="py-1 text-right">{J.time}</th>
              <th className="w-8 py-1 text-center">✓</th>
            </tr>
          </thead>
          <tbody>
            {toolpaths.map((tp, i) => (
              <tr key={tp.id} className={`border-b border-black/10 align-top ${i > 0 && tp.toolId !== toolpaths[i - 1].toolId ? 'border-t-2 border-t-black/50' : ''}`}>
                <td className="py-1 pr-2">
                  <span className="inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: COLORS[i % COLORS.length] }} /> {i + 1}
                </td>
                <td className="py-1 pr-2">{tp.name.replace(/^\d+\.\s*/, '')}</td>
                <td className="py-1 pr-2">{tName(tp.toolId)}</td>
                <td className="py-1 pr-2">{details(tp)}</td>
                <td className="py-1 text-right tabular-nums">{duration(s.results[tp.id]?.stats.estimatedSeconds ?? 0)}</td>
                <td className="py-1 text-center">☐</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>{J.noToolpaths}</p>
      )}
      <svg viewBox={`${-pad} ${-pad} ${W + 2 * pad} ${H + 2 * pad}`} className="max-h-[48vh] w-full" role="img" aria-label={J.drawing}>
        <rect x={0} y={0} width={W} height={H} fill="#f3eadb" stroke="#555" strokeWidth={sw} />
        <path d={shapesPath} fill="none" stroke="#999" strokeWidth={sw * 0.8} />
        {toolpaths.map((tp, i) => {
          const c = cutPath(tp.id);
          return (
            <g key={tp.id}>
              <path d={c.d} fill="none" stroke={COLORS[i % COLORS.length]} strokeWidth={sw * 1.2} />
              <circle cx={c.x} cy={c.y} r={sw * 7} fill={COLORS[i % COLORS.length]} />
              <text x={c.x} y={c.y} fontSize={sw * 9} fill="#fff" textAnchor="middle" dominantBaseline="central" fontWeight="bold">
                {i + 1}
              </text>
            </g>
          );
        })}
        {/* Nollpunkten. */}
        {(() => {
          const ox = m.origin === 'center' ? W / 2 : 0, oy = m.origin === 'center' ? H / 2 : 0;
          return (
            <g stroke="#000" strokeWidth={sw * 1.5}>
              <line x1={ox - sw * 12} y1={y(oy)} x2={ox + sw * 12} y2={y(oy)} />
              <line x1={ox} y1={y(oy) - sw * 12} x2={ox} y2={y(oy) + sw * 12} />
            </g>
          );
        })()}
      </svg>
      {notes && (
        <p className="whitespace-pre-line border-t border-black/30 pt-2">
          <b>{J.notes}:</b> {notes}
        </p>
      )}
      <p className="text-[9px] text-black/60">{J.disclaimer}</p>
    </div>
  );
}
