import { useEffect, useMemo, useState } from 'react';
import { offsetShapes, shapesBounds, shapeToPolylines, type PolylineInput } from '@desktopcam/core';
import { allShapes, useAppStore } from '../../store/useAppStore';
import { offsetSelection } from '../../cam/commands';
import { useT } from '../../i18n';
import { Dialog } from '../ui/Dialog';
import { FieldRow, NumberField, Segmented } from '../ui/Field';
import { fmtLength } from '../../utils/units';

/**
 * Design → Förskjut: samma förskjutning som Kontur i egenskapspanelen
 * (commands.offsetSelection), med förhandsvisning. Originalet behålls.
 */
export function OffsetDialog() {
  const t = useT();
  const c = t.contour;
  const open = useAppStore((s) => s.dialog === 'offset');
  const layers = useAppStore((s) => s.layers);
  const ids = useAppStore((s) => s.selectedShapeIds);
  const shapes = useMemo(() => allShapes(layers).filter((x) => ids.includes(x.id)), [layers, ids]);
  const [dist, setDist] = useState(3);
  const [inward, setInward] = useState(false);
  const [preview, setPreview] = useState<PolylineInput[]>([]);
  const close = () => useAppStore.getState().openDialog(null);
  const signed = inward ? -dist : dist;

  // Förhandsvisning med lite grövre upplösning, en kort stund efter senaste ändringen.
  const groups = useMemo(() => shapes.map((sh) => shapeToPolylines(sh, 0.05).filter((p) => p.closed)).filter((g) => g.length), [shapes]);
  useEffect(() => {
    if (!open || !groups.length || !dist) {
      setPreview([]);
      return;
    }
    const timer = setTimeout(() => setPreview(groups.flatMap((g) => offsetShapes([g], signed))), 200);
    return () => clearTimeout(timer);
  }, [open, groups, signed, dist]);

  if (!open) return null;
  const b = shapesBounds(shapes);
  const pad = Math.abs(signed) + 4;
  const vb = b ? { x: b.min.x - pad, y: b.min.y - pad, w: b.max.x - b.min.x + 2 * pad, h: b.max.y - b.min.y + 2 * pad } : null;
  const d = (pts: number[], closed: boolean) => {
    let s = '';
    // SVG har y nedåt: spegla kring vyrutans mitt.
    for (let i = 0; i + 1 < pts.length; i += 2) s += `${i ? 'L' : 'M'}${pts[i].toFixed(2)} ${(2 * vb!.y + vb!.h - pts[i + 1]).toFixed(2)}`;
    return closed ? s + 'Z' : s;
  };
  const sw = vb ? Math.max(vb.w, vb.h) / 300 : 1;

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t.buttons.offset.title}
      width="max-w-xl"
      footer={
        <>
          <div className="flex-1" />
          <button className="btn" onClick={close}>
            {t.common.cancel}
          </button>
          <button
            className="btn btn-primary"
            disabled={!groups.length || !dist}
            onClick={() => {
              offsetSelection(signed);
              close();
            }}
          >
            {c.apply}
          </button>
        </>
      }
    >
      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="text-xs leading-relaxed text-muted">{c.offsetHint}</p>
          <FieldRow label={c.direction}>
            <Segmented label={c.direction} value={inward ? 'in' : 'out'} options={[{ value: 'out', label: c.outward }, { value: 'in', label: c.inward }]} onChange={(v) => setInward(v === 'in')} />
          </FieldRow>
          <div className="flex flex-wrap gap-1">
            {[1.5, 3, 4.5].map((v) => (
              <button key={v} className={`rounded-full px-2.5 py-0.5 text-xs ${dist === v ? 'bg-accent text-white' : 'bg-app hover:bg-line/60'}`} onClick={() => setDist(v)}>
                {fmtLength(v, t.locale, 2)}
              </button>
            ))}
          </div>
          <NumberField label={c.distance} unit="mm" step={0.5} min={0.01} max={200} value={dist} onChange={setDist} />
          {!groups.length && <p className="rounded-md bg-warn/10 px-2 py-1.5 text-xs text-warn">{t.status.needClosed}</p>}
        </div>
        <figure className="rounded-lg border border-line bg-app p-2">
          {vb && (
            <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} className="max-h-64 w-full" role="img" aria-label={t.offsetPreview}>
              {groups.flat().map((p, i) => (
                <path key={`o${i}`} d={d(p.points, p.closed)} fill="none" stroke="rgb(var(--c-muted))" strokeWidth={sw} />
              ))}
              {preview.map((p, i) => (
                <path key={`n${i}`} d={d(p.points, true)} fill="none" stroke="rgb(var(--c-accent))" strokeWidth={sw * 1.6} />
              ))}
            </svg>
          )}
          <figcaption className="mt-1 text-2xs text-muted">{t.offsetPreview}</figcaption>
        </figure>
      </div>
    </Dialog>
  );
}
