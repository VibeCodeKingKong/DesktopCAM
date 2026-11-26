import { useEffect, useMemo, useState } from 'react';
import { shapeToPolylines, transformShape } from '@desktopcam/core';
import { useAppStore, useMachine } from '../../store/useAppStore';
import { applyNesting, planNesting, type NestOptions } from '../../cam/nesting';
import { useT } from '../../i18n';
import { Dialog } from '../ui/Dialog';
import { FieldRow, NumberField, Switch } from '../ui/Field';

/** Placera ut på skivan: kopior, avstånd och vridning, med förhandsvisning av hela arbetsstycket. */
export function NestDialog() {
  const t = useT();
  const N = t.nesting;
  const open = useAppStore((s) => s.dialog === 'nest');
  const material = useAppStore((s) => s.material);
  const layers = useAppStore((s) => s.layers);
  const ids = useAppStore((s) => s.selectedShapeIds);
  const tools = useAppStore((s) => s.tools);
  const activeToolId = useAppStore((s) => s.activeToolId);
  const machine = useMachine();
  // Förval för avståndet: fräsen behöver plats för verktyget, laser och plasma lite spel.
  const defSpacing = useMemo(() => {
    if (machine.kind === 'router') return +((tools.find((x) => x.id === activeToolId)?.diameter ?? 6) + 2).toFixed(1);
    return machine.kind === 'plasma' ? 5 : 2;
  }, [machine.kind, tools, activeToolId]);
  const [o, setO] = useState<NestOptions>({ copies: 1, spacing: defSpacing, margin: 5, rotate: true });
  useEffect(() => {
    if (open) setO((x) => ({ ...x, spacing: defSpacing }));
  }, [open, defSpacing]);
  const close = () => useAppStore.getState().openDialog(null);
  const plan = useMemo(() => (open ? planNesting(o) : null), [open, o, layers, ids, material]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!open || !plan) return null;
  const W = material.width, H = material.height;
  const sw = Math.max(W, H) / 400;
  const d = (pts: number[], closed: boolean) => {
    let s = '';
    for (let i = 0; i + 1 < pts.length; i += 2) s += `${i ? 'L' : 'M'}${pts[i].toFixed(1)} ${(H - pts[i + 1]).toFixed(1)}`;
    return closed ? s + 'Z' : s;
  };
  const fits = plan.placements.length;
  const pct = Math.round(plan.usage * 100).toLocaleString(t.locale);

  return (
    <Dialog
      open={open}
      onClose={close}
      title={N.title}
      width="max-w-3xl"
      footer={
        <>
          <div className="flex-1" />
          <button className="btn" onClick={close}>
            {t.common.cancel}
          </button>
          <button
            className="btn btn-primary"
            disabled={!fits}
            onClick={() => {
              applyNesting(o);
              close();
            }}
          >
            {N.apply}
          </button>
        </>
      }
    >
      <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="space-y-2">
          <p className="text-xs leading-relaxed text-muted">{N.intro}</p>
          {!plan.units.length && <p className="rounded-md bg-warn/10 px-2 py-1.5 text-xs text-warn">{t.reasons.needsSelection}</p>}
          <NumberField label={N.copies} step={1} min={1} max={500} value={o.copies} onChange={(copies) => setO({ ...o, copies: Math.max(1, Math.round(copies)) })} />
          <NumberField label={N.spacing} unit="mm" step={0.5} min={0} max={100} value={o.spacing} onChange={(spacing) => setO({ ...o, spacing })} />
          <NumberField label={N.margin} unit="mm" step={1} min={0} max={200} value={o.margin} onChange={(margin) => setO({ ...o, margin })} />
          <FieldRow label={N.rotate}>
            <Switch checked={o.rotate} onChange={(rotate) => setO({ ...o, rotate })} label={N.rotate} />
          </FieldRow>
          <p className={`rounded-md px-2 py-1.5 text-xs ${fits < plan.wanted ? 'bg-warn/10 text-warn' : 'bg-app'}`} role="status">
            {fits < plan.wanted ? N.previewPartial(String(fits), String(plan.wanted), pct) : N.previewAll(String(fits), pct)}
          </p>
          <p className="text-2xs leading-relaxed text-muted">{N.note}</p>
        </div>
        <figure className="rounded-lg border border-line bg-app p-2">
          <svg viewBox={`${-sw * 4} ${-sw * 4} ${W + sw * 8} ${H + sw * 8}`} className="max-h-[55vh] w-full" role="img" aria-label={N.preview}>
            <rect x={0} y={0} width={W} height={H} fill="rgb(var(--c-wood))" opacity={0.35} stroke="rgb(var(--c-muted))" strokeWidth={sw} />
            <rect x={o.margin} y={o.margin} width={Math.max(0, W - 2 * o.margin)} height={Math.max(0, H - 2 * o.margin)} fill="none" stroke="rgb(var(--c-muted))" strokeWidth={sw * 0.6} strokeDasharray={`${sw * 4} ${sw * 3}`} />
            {plan.placements.map((p, k) =>
              plan.units[p.unit].shapes.flatMap((sh, si) =>
                shapeToPolylines(transformShape(sh, p.m), 0.5).map((pl, pi) => (
                  <path key={`${k}-${si}-${pi}`} d={d(pl.points, pl.closed)} fill={pl.closed ? 'rgb(var(--c-accent) / 0.12)' : 'none'} stroke={p.copy ? 'rgb(var(--c-accent))' : 'rgb(var(--c-ink))'} strokeWidth={sw} />
                )),
              ),
            )}
          </svg>
          <figcaption className="mt-1 text-2xs text-muted">{N.preview}</figcaption>
        </figure>
      </div>
    </Dialog>
  );
}
