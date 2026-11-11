import { useEffect, useMemo, useState } from 'react';
import { patternTransforms, shapesBounds, shapeToPolylines, transformShape, type PatternConfig } from '@desktopcam/core';
import { allShapes, useAppStore } from '../../store/useAppStore';
import { applyPattern } from '../../cam/commands';
import { useT } from '../../i18n';
import { Dialog } from '../ui/Dialog';
import { FieldRow, NumberField, Segmented, Switch } from '../ui/Field';

/** Linjärt eller cirkulärt mönster av markeringen, med förhandsvisning på materialet. */
export function PatternDialog() {
  const t = useT();
  const tp = t.pattern;
  const open = useAppStore((s) => s.dialog === 'pattern');
  const layers = useAppStore((s) => s.layers);
  const ids = useAppStore((s) => s.selectedShapeIds);
  const material = useAppStore((s) => s.material);
  const beginner = useAppStore((s) => s.beginnerMode);
  const shapes = useMemo(() => allShapes(layers).filter((x) => ids.includes(x.id)), [layers, ids]);
  const b = useMemo(() => shapesBounds(shapes), [shapes]);

  const [kind, setKind] = useState<'linear' | 'circular'>('linear');
  const [countX, setCountX] = useState(3);
  const [countY, setCountY] = useState(1);
  const [spacingX, setSpacingX] = useState(20);
  const [spacingY, setSpacingY] = useState(20);
  const [spacingMode, setSpacingMode] = useState<'center' | 'gap'>('center');
  const [count, setCount] = useState(6);
  const [cx, setCx] = useState(0);
  const [cy, setCy] = useState(0);
  const [totalAngle, setTotalAngle] = useState(360);
  const [rotateCopies, setRotateCopies] = useState(true);
  // Cirkelns storlek: radie eller diameter, och var originalet hamnar på cirkeln.
  const [radius, setRadius] = useState(30);
  const [sizeMode, setSizeMode] = useState<'diameter' | 'radius'>('diameter');
  const [startAngle, setStartAngle] = useState(90);

  // Ny öppning: rimliga förval utifrån markeringen och materialet.
  useEffect(() => {
    if (!open || !b) return;
    const w = b.max.x - b.min.x, h = b.max.y - b.min.y;
    setSpacingX(Math.round(w + 10));
    setSpacingY(Math.round(h + 10));
    const ccx = material.width / 2, ccy = material.height / 2;
    setCx(ccx);
    setCy(ccy);
    // Utgå från där markeringen ligger nu; ligger den i mitten, börja med en cirkel upptill.
    const mx = (b.min.x + b.max.x) / 2, my = (b.min.y + b.max.y) / 2;
    const r = Math.hypot(mx - ccx, my - ccy);
    setRadius(r > 0.5 ? Math.round(r * 10) / 10 : Math.round(Math.min(material.width, material.height) / 4));
    setStartAngle(r > 0.5 ? Math.round((Math.atan2(my - ccy, mx - ccx) * 180) / Math.PI) : 90);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const cfg: PatternConfig =
    kind === 'linear'
      ? { kind, countX, countY, spacingX, spacingY, spacingMode }
      : { kind, count, cx, cy, totalAngle, rotateCopies, radius, startAngle };
  const result = useMemo(() => (b ? patternTransforms(cfg, b) : null), [b, JSON.stringify(cfg)]);
  const copies = useMemo(() => (result ? result.copies.flatMap((m) => shapes.map((sh) => transformShape(sh, m))) : []), [result, shapes]);
  // Originalet där det hamnar (flyttas ut på cirkeln i ett cirkulärt mönster).
  const placed = useMemo(() => (result?.origin ? shapes.map((sh) => transformShape(sh, result.origin!)) : shapes), [result, shapes]);
  if (!open || !b) return null;

  const all = shapesBounds([...placed, ...copies]) ?? b;
  const outside = all.min.x < -1e-6 || all.min.y < -1e-6 || all.max.x > material.width + 1e-6 || all.max.y > material.height + 1e-6;
  const mx = (b.min.x + b.max.x) / 2, my = (b.min.y + b.max.y) / 2;
  const fmt = (n: number) => n.toLocaleString(t.locale, { maximumFractionDigits: 1 });

  // Förhandsvisning: materialet, originalet och kopiorna (y uppåt).
  const vb = { x: Math.min(0, all.min.x) - 5, y: Math.min(0, all.min.y) - 5, w: 0, h: 0 };
  vb.w = Math.max(material.width, all.max.x) + 5 - vb.x;
  vb.h = Math.max(material.height, all.max.y) + 5 - vb.y;
  const pathOf = (sh: (typeof shapes)[number]) =>
    shapeToPolylines(sh, 0.3)
      .map((pl) => {
        const pts: string[] = [];
        for (let i = 0; i + 1 < pl.points.length; i += 2) pts.push(`${pl.points[i].toFixed(2)},${(-pl.points[i + 1]).toFixed(2)}`);
        return `M${pts.join('L')}${pl.closed ? 'Z' : ''}`;
      })
      .join('');
  const sw = Math.max(vb.w, vb.h) / 300;

  const close = () => useAppStore.getState().openDialog(null);
  return (
    <Dialog
      open={open}
      onClose={close}
      title={tp.title}
      width="max-w-3xl"
      footer={
        <>
          <p className={`flex-1 text-2xs ${outside ? 'text-warn' : 'text-muted'}`}>{outside ? tp.outside : tp.total(copies.length / Math.max(1, shapes.length) + 1)}</p>
          <button className="btn" onClick={close}>
            {t.common.cancel}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              applyPattern(cfg);
              close();
            }}
          >
            {tp.create}
          </button>
        </>
      }
    >
      <div className="grid gap-4 p-4 md:grid-cols-[1fr_280px]">
        <div className="flex items-center justify-center rounded-lg bg-app p-2">
          <svg viewBox={`${vb.x} ${-(vb.y + vb.h)} ${vb.w} ${vb.h}`} className="max-h-[50vh] w-full" aria-label={tp.preview}>
            <rect x={0} y={-material.height} width={material.width} height={material.height} className="fill-wood/30 stroke-wood" strokeWidth={sw} />
            {copies.map((sh, i) => (
              <path key={i} d={pathOf(sh)} fill="none" stroke="currentColor" className="text-accent" strokeWidth={sw * 1.5} strokeDasharray={`${sw * 4} ${sw * 3}`} />
            ))}
            {placed.map((sh) => (
              <path key={sh.id} d={pathOf(sh)} fill="none" className="stroke-ink" strokeWidth={sw * 2} />
            ))}
            {kind === 'circular' && (
              <g className="text-accent">
                <circle cx={cx} cy={-cy} r={radius} fill="none" stroke="currentColor" strokeWidth={sw} strokeDasharray={`${sw * 2} ${sw * 4}`} opacity={0.6} />
                <path d={`M${cx - sw * 6},${-cy}h${sw * 12}M${cx},${-cy - sw * 6}v${sw * 12}`} stroke="currentColor" strokeWidth={sw * 1.5} />
              </g>
            )}
          </svg>
        </div>
        <div className="space-y-2.5">
          <Segmented
            label={tp.kind}
            value={kind}
            options={[
              { value: 'linear', label: tp.kinds.linear },
              { value: 'circular', label: tp.kinds.circular },
            ]}
            onChange={setKind}
          />
          <p className="text-2xs leading-relaxed text-muted">{tp.kindDesc[kind]}</p>
          {kind === 'linear' ? (
            <>
              <NumberField label={tp.countX} step={1} min={1} max={100} value={countX} onChange={(v) => setCountX(Math.max(1, Math.round(v)))} />
              <NumberField label={tp.countY} step={1} min={1} max={100} value={countY} onChange={(v) => setCountY(Math.max(1, Math.round(v)))} />
              <FieldRow label={tp.spacingMode}>
                <Segmented
                  label={tp.spacingMode}
                  value={spacingMode}
                  options={[
                    { value: 'center', label: tp.spacingModes.center },
                    { value: 'gap', label: tp.spacingModes.gap },
                  ]}
                  onChange={setSpacingMode}
                />
              </FieldRow>
              <NumberField label={tp.spacingX} unit="mm" step={1} value={spacingX} onChange={setSpacingX} />
              {countY > 1 && <NumberField label={tp.spacingY} unit="mm" step={1} value={spacingY} onChange={setSpacingY} />}
            </>
          ) : (
            <>
              <NumberField label={tp.count} step={1} min={2} max={360} value={count} onChange={(v) => setCount(Math.max(2, Math.round(v)))} />
              <NumberField label={tp.cx} unit="mm" step={1} value={cx} onChange={setCx} />
              <NumberField label={tp.cy} unit="mm" step={1} value={cy} onChange={setCy} />
              <div className="flex flex-wrap gap-1.5">
                <button className="btn h-7 px-2 text-2xs" onClick={() => { setCx(material.width / 2); setCy(material.height / 2); }}>
                  {tp.centerMaterial}
                </button>
                {shapes.length > 1 && (
                  <button className="btn h-7 px-2 text-2xs" onClick={() => { setCx(mx); setCy(my); }}>
                    {tp.centerSelection}
                  </button>
                )}
              </div>
              <FieldRow label={tp.size}>
                <Segmented
                  label={tp.size}
                  value={sizeMode}
                  options={[
                    { value: 'diameter', label: tp.sizeModes.diameter },
                    { value: 'radius', label: tp.sizeModes.radius },
                  ]}
                  onChange={setSizeMode}
                />
              </FieldRow>
              <NumberField
                label={sizeMode === 'diameter' ? tp.diameter : tp.radiusLabel}
                unit="mm"
                step={1}
                min={0}
                value={sizeMode === 'diameter' ? Math.round(radius * 2 * 100) / 100 : radius}
                onChange={(v) => setRadius(Math.max(0, sizeMode === 'diameter' ? v / 2 : v))}
              />
              <NumberField label={tp.startAngle} unit="°" step={15} min={-360} max={360} value={startAngle} onChange={setStartAngle} />
              <p className="text-2xs text-muted">{tp.radius(fmt(radius), fmt(radius * 2))}</p>
              <NumberField label={tp.totalAngle} unit="°" step={15} min={-360} max={360} value={totalAngle} onChange={setTotalAngle} />
              {!beginner && (
                <FieldRow label={tp.rotateCopies}>
                  <Switch checked={rotateCopies} onChange={setRotateCopies} label={tp.rotateCopies} />
                </FieldRow>
              )}
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}
