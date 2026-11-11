import { useState } from 'react';
import { gearModule, makeGearShape, shapeToPolylines, type GearToothShape } from '@desktopcam/core';
import { useAppStore, useExpert } from '../../store/useAppStore';
import { addGear } from '../../cam/commands';
import { useT } from '../../i18n';
import { Dialog } from '../ui/Dialog';
import { NumberField, SelectField } from '../ui/Field';

/** Kugghjul med valbart antal kuggar och kuggform, med förhandsvisning. */
export function GearDialog() {
  const t = useT();
  const g = t.gearDialog;
  const open = useAppStore((s) => s.dialog === 'gear');
  const expert = useExpert();
  const [teeth, setTeeth] = useState(20);
  const [diameter, setDiameter] = useState(80);
  const [depth, setDepth] = useState(6);
  const [shape, setShape] = useState<GearToothShape>('involute');
  const [pressure, setPressure] = useState(20);
  const [bore, setBore] = useState(8);

  const opts = { teeth, outerDiameter: diameter, toothDepth: depth, shape, pressureAngle: pressure, boreDiameter: bore };
  const close = () => useAppStore.getState().openDialog(null);
  const create = () => {
    addGear(opts);
    close();
  };

  const preview = makeGearShape('', 0, 0, opts);
  const r = diameter / 2 + 2;
  const d = shapeToPolylines(preview)
    .map((pl) => {
      const pts: string[] = [];
      for (let i = 0; i + 1 < pl.points.length; i += 2) pts.push(`${pl.points[i].toFixed(2)},${(-pl.points[i + 1]).toFixed(2)}`);
      return `M${pts.join('L')}Z`;
    })
    .join('');
  const mod = gearModule(teeth, diameter);
  const fmt = (n: number) => n.toLocaleString(t.locale, { maximumFractionDigits: 2 });

  return (
    <Dialog
      open={open}
      onClose={close}
      title={g.title}
      width="max-w-lg"
      footer={
        <>
          <div className="flex-1" />
          <button className="btn" onClick={close}>
            {t.common.cancel}
          </button>
          <button className="btn btn-primary" onClick={create}>
            {g.create}
          </button>
        </>
      }
    >
      <div className="grid gap-4 p-4 sm:grid-cols-[1fr_180px]">
        <div className="space-y-3">
          <SelectField
            label={g.shape}
            value={shape}
            onChange={setShape}
            options={(['involute', 'trapezoid', 'triangle', 'rounded'] as const).map((v) => ({ value: v, label: g.shapes[v] }))}
          />
          <NumberField label={g.teeth} min={3} max={200} step={1} value={teeth} onChange={(v) => setTeeth(Math.round(v))} />
          <NumberField label={g.diameter} unit="mm" min={5} step={1} value={diameter} onChange={setDiameter} />
          {shape === 'involute' ? (
            expert && <NumberField label={g.pressure} unit="°" min={14.5} max={30} step={0.5} value={pressure} onChange={setPressure} />
          ) : (
            <NumberField label={g.depth} unit="mm" min={0.5} max={diameter / 2 - 1} step={0.5} value={depth} onChange={setDepth} />
          )}
          <NumberField label={g.bore} unit="mm" min={0} max={diameter * 0.6} step={0.5} value={bore} onChange={setBore} />
          {shape === 'involute' && <p className="text-2xs text-muted">{g.module(fmt(mod))}</p>}
        </div>
        <div className="flex aspect-square items-center justify-center rounded-lg bg-app p-2">
          <svg viewBox={`${-r} ${-r} ${2 * r} ${2 * r}`} className="h-full w-full" aria-hidden="true">
            <path d={d} fillRule="evenodd" className="fill-accent/15 stroke-ink" strokeWidth={r / 120} strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-2xs leading-relaxed text-muted sm:col-span-2">{g.note}</p>
      </div>
    </Dialog>
  );
}
