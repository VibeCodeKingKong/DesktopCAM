import { useEffect, useMemo, useState } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { buildLibraryShape, DEFAULT_SHAPE_PARAMS, SHAPE_LIBRARY, shapeToPolylines, type ShapeLibraryCategory, type ShapeLibraryControl, type ShapeLibraryItem, type ShapeLibraryParams } from '@desktopcam/core';
import { useT } from '../../i18n';
import { useAppStore, useMachine } from '../../store/useAppStore';
import { Dialog } from '../ui/Dialog';
import { FieldRow, NumberField, SelectField } from '../ui/Field';

const CATEGORIES: (ShapeLibraryCategory | 'all')[] = ['all', 'basic', 'frames', 'banners', 'ornaments', 'mechanical', 'joinery', 'textures'];

/** Motivets polylinjer och omslutande ruta (mm). */
function geometry(item: ShapeLibraryItem, w: number, h: number, params: ShapeLibraryParams) {
  const shape = buildLibraryShape(item, '', w, h, params, 0, 0);
  let path = '';
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const pl of shapeToPolylines(shape)) {
    const pts: string[] = [];
    for (let i = 0; i + 1 < pl.points.length; i += 2) {
      const x = pl.points[i], y = pl.points[i + 1];
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      pts.push(`${x.toFixed(2)},${(-y).toFixed(2)}`);
    }
    path += `M${pts.join('L')}${pl.closed ? 'Z' : ''}`;
  }
  if (!Number.isFinite(x0)) (x0 = -w / 2), (x1 = w / 2), (y0 = -h / 2), (y1 = h / 2);
  return { d: path, x0, y0, x1, y1 };
}

/** SVG-förhandsvisning av ett motiv i given storlek. */
function Preview({ item, w, h, params, className }: { item: ShapeLibraryItem; w: number; h: number; params: ShapeLibraryParams; className?: string }) {
  const g = useMemo(() => geometry(item, w, h, params), [item, w, h, params]);
  const gw = g.x1 - g.x0, gh = g.y1 - g.y0, m = Math.max(gw, gh) * 0.06;
  const vb = `${g.x0 - m} ${-g.y1 - m} ${gw + 2 * m} ${gh + 2 * m}`;
  const sw = Math.max(gw, gh) / 160;
  return (
    <svg viewBox={vb} className={className} aria-hidden="true">
      <path d={g.d} fillRule="evenodd" className={item.kind === 'lines' ? 'fill-none stroke-ink' : 'fill-wood stroke-ink/70'} strokeWidth={item.kind === 'lines' ? sw * 1.4 : sw} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Bild för ett alternativ: urtag uppifrån med fingret inskjutet (urfrästa hörn). */
function OptionIcon({ option }: { option: string }) {
  // Urtag 20 brett, 12 djupt; fräsradie 3,4.
  const r = 3.4, k = r / Math.SQRT2;
  const holes =
    option === 'diagonal' ? [[k, 12 - k], [20 - k, 12 - k]] : option === 'straight' ? [[r, 12], [20 - r, 12]] : [];
  return (
    <svg viewBox="-8 -6 36 24" className="h-12 w-full" aria-hidden="true">
      <rect x="-8" y="0" width="36" height="18" className="fill-wood" />
      {option === 'off' ? (
        <path d={`M0 -6 L0 ${12 - r} A${r} ${r} 0 0 0 ${r} 12 L${20 - r} 12 A${r} ${r} 0 0 0 20 ${12 - r} L20 -6 Z`} className="fill-app" />
      ) : (
        <>
          <rect x="0" y="-6" width="20" height="18" className="fill-app" />
          {holes.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={r} className="fill-app" />
          ))}
        </>
      )}
      <rect x="0" y="-6" width="20" height="18" className="fill-accent/25 stroke-accent" strokeWidth="0.6" />
      {option === 'off' && <path d={`M0 ${12 - r} A${r} ${r} 0 0 0 ${r} 12 L0 12 Z M20 ${12 - r} A${r} ${r} 0 0 1 ${20 - r} 12 L20 12 Z`} className="fill-warn" />}
    </svg>
  );
}

/** Ett reglage: dragreglage med värde (eller val bland alternativ). */
function ControlField({ control, value, onChange }: { control: ShapeLibraryControl; value: number | string; onChange: (v: number | string) => void }) {
  const t = useT();
  const L = t.shapeLib;
  const label = L.controls[control.key] ?? control.key;
  if ('options' in control && control.visual)
    return (
      <div className="space-y-1">
        <p className="text-xs">{label}</p>
        <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label={label}>
          {control.options.map((o) => (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={value === o}
              onClick={() => onChange(o)}
              className={`overflow-hidden rounded-md border text-center text-2xs transition-colors ${value === o ? 'border-accent ring-1 ring-accent' : 'border-line hover:border-muted/60'}`}
            >
              <div className="bg-app px-1 pt-1">
                <OptionIcon option={o} />
              </div>
              <span className={`block px-1 py-1 ${value === o ? 'font-semibold text-accent' : ''}`}>{L.choices[o] ?? o}</span>
            </button>
          ))}
        </div>
        {L.notes[control.key] && <p className="text-2xs leading-relaxed text-muted">{L.notes[control.key]}</p>}
      </div>
    );
  if ('options' in control)
    return (
      <SelectField label={label} value={String(value)} options={control.options.map((o) => ({ value: o, label: L.choices[o] ?? o }))} onChange={onChange} />
    );
  const v = Number(value);
  const id = `shapelib-${control.key}`;
  const unit = control.unit === 'mm' ? ' mm' : control.unit === '%' ? ' %' : '';
  return (
    <div className="space-y-0.5">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id} className="tabular-nums text-muted">
          {v.toLocaleString(t.locale, { maximumFractionDigits: 1 })}
          {unit}
        </output>
      </div>
      <input id={id} type="range" className="w-full accent-[rgb(var(--c-accent))]" min={control.min} max={control.max} step={control.step ?? 1} value={v} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

/** Formbibliotek: ramar, banderoller, ornament och mönster att lägga in och bearbeta. */
export function ShapeLibraryDialog() {
  const t = useT();
  const L = t.shapeLib;
  const open = useAppStore((s) => s.dialog === 'shapeLibrary');
  const material = useAppStore((s) => s.material);
  const machine = useMachine();
  const toolDia = useAppStore((s) => {
    const tool = s.tools.find((x) => x.id === s.activeToolId);
    return tool && tool.kind !== 'laser' && tool.kind !== 'plasma' && tool.kind !== 'pen' ? tool.diameter : undefined;
  });
  const [category, setCategory] = useState<ShapeLibraryCategory | 'all'>('all');
  const [selectedId, setSelectedId] = useState(SHAPE_LIBRARY[0].id);
  const [width, setWidth] = useState(100);
  const [height, setHeight] = useState(60);
  const [lock, setLock] = useState(true);
  const [params, setParams] = useState<ShapeLibraryParams>(DEFAULT_SHAPE_PARAMS);
  const [values, setValues] = useState<Record<string, number | string>>({});

  const item = SHAPE_LIBRARY.find((x) => x.id === selectedId) ?? SHAPE_LIBRARY[0];
  const items = SHAPE_LIBRARY.filter((x) => category === 'all' || x.category === category)
    .map((x, i) => ({ x, i }))
    .sort((a, b) => CATEGORIES.indexOf(a.x.category) - CATEGORIES.indexOf(b.x.category) || a.i - b.i)
    .map(({ x }) => x);
  const aspect = item.size.w / item.size.h;

  // Standardstorlek: motivets egen, nedskalad så att den ryms på materialet.
  useEffect(() => {
    const k = Math.min(1, (material.width * 0.85) / item.size.w, (material.height * 0.85) / item.size.h);
    setWidth(Math.round(item.size.w * k));
    setHeight(Math.round(item.size.h * k));
    setParams({ band: Math.max(2, Math.round(Math.min(item.size.w, item.size.h) * k * 0.08)), spacing: Math.max(3, Math.round(Math.min(item.size.w, item.size.h) * k * 0.09)) });
    // Materialtjocklek: arbetsstyckets som standard (går att ändra).
    // Standardvärden: arbetsstyckets tjocklek, den valda fräsens diameter, och
    // urfrästa hörn påslaget när maskinen är en fräs.
    setValues(
      Object.fromEntries(
        (item.controls ?? []).map((c) => {
          if ('options' in c) return [c.key, machine.kind === 'router' && c.defRouter ? c.defRouter : c.def];
          const clamp = (v: number) => Math.min(c.max, Math.max(c.min, v));
          if (c.fromMaterial) return [c.key, clamp(material.thickness)];
          if (c.fromTool && toolDia) return [c.key, clamp(toolDia)];
          return [c.key, c.def];
        }),
      ),
    );
  }, [item, material.width, material.height, material.thickness, machine.kind, toolDia]);
  const full = useMemo(() => ({ ...params, values }), [params, values]);
  // Verklig storlek (för motiv vars mått styrs av reglagen).
  const size = useMemo(() => {
    const g = geometry(item, width, height, full);
    return { w: g.x1 - g.x0, h: g.y1 - g.y0 };
  }, [item, width, height, full]);

  const close = () => useAppStore.getState().openDialog(null);
  const add = () => {
    const s = useAppStore.getState();
    const name = L.items[item.id] ?? item.id;
    const n = s.layers.flatMap((l) => l.shapes).filter((x) => x.name.startsWith(name)).length + 1;
    s.addShape(buildLibraryShape(item, `${name} ${n}`, width, height, full, material.width / 2, material.height / 2));
    s.setEditTool('select');
    s.setStatus(L.added(name));
    close();
  };
  const tooBig = size.w > material.width + 1e-6 || size.h > material.height + 1e-6;

  return (
    <Dialog
      open={open}
      onClose={close}
      title={L.title}
      width="max-w-5xl"
      actions={
        <div className="flex w-full flex-wrap gap-1 sm:ml-2" role="radiogroup" aria-label={L.title}>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              role="radio"
              aria-checked={category === c}
              onClick={() => setCategory(c)}
              className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${category === c ? 'border-accent bg-accent text-white' : 'border-line hover:border-muted/60'}`}
            >
              {L.categories[c]}
            </button>
          ))}
        </div>
      }
      footer={
        <>
          <p className="flex-1 text-xs text-muted">{L.footer}</p>
          <button className="btn" onClick={close}>
            {t.common.cancel}
          </button>
          <button className="btn btn-primary" onClick={add}>
            {L.add}
          </button>
        </>
      }
    >
      <div className="grid md:grid-cols-[1fr_300px]">
        <ul className="grid max-h-[40vh] grid-cols-3 gap-2 overflow-y-auto p-3 sm:max-h-[62vh] sm:gap-3 sm:p-4 lg:grid-cols-4" role="listbox" aria-label={L.title}>
          {items.map((x) => {
            const active = x.id === item.id;
            return (
              <li key={x.id}>
                <button
                  role="option"
                  aria-selected={active}
                  onClick={() => setSelectedId(x.id)}
                  onDoubleClick={() => x.id === item.id && add()}
                  className={`w-full overflow-hidden rounded-lg border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                    active ? 'border-accent ring-1 ring-accent' : 'border-line hover:border-muted/60'
                  }`}
                >
                  <div className="flex aspect-[4/3] items-center justify-center bg-app p-2">
                    <Preview item={x} w={x.size.w} h={x.size.h} params={{ band: Math.min(x.size.w, x.size.h) * 0.08, spacing: Math.min(x.size.w, x.size.h) * 0.09 }} className="h-full w-full" />
                  </div>
                  <p className={`truncate px-2 py-1.5 text-xs ${active ? 'font-semibold text-accent' : ''}`}>{L.items[x.id] ?? x.id}</p>
                </button>
              </li>
            );
          })}
        </ul>

        <aside className="space-y-3 border-t border-line p-4 md:border-l md:border-t-0">
          <div className="flex h-40 justify-center rounded-lg bg-app p-3">
            <Preview item={item} w={width} h={height} params={full} className="h-full w-full" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">{L.items[item.id] ?? item.id}</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">{L.hints[item.id] ?? L.kindDesc[item.kind]}</p>
          </div>
          <div className="space-y-2">
            {item.fixedSize ? (
              <p className="text-xs tabular-nums text-muted">{L.size(size.w.toLocaleString(t.locale, { maximumFractionDigits: 1 }), size.h.toLocaleString(t.locale, { maximumFractionDigits: 1 }))}</p>
            ) : (
              <>
                <NumberField
                  label={t.props.width}
                  unit="mm"
                  min={5}
                  value={width}
                  onChange={(w) => {
                    setWidth(w);
                    if (lock) setHeight(Math.round((w / aspect) * 10) / 10);
                  }}
                />
                <NumberField
                  label={t.props.height}
                  unit="mm"
                  min={5}
                  value={height}
                  onChange={(h) => {
                    setHeight(h);
                    if (lock) setWidth(Math.round(h * aspect * 10) / 10);
                  }}
                />
                <FieldRow label={t.props.lockAspect}>
                  <button className="btn h-6 px-2" onClick={() => setLock((l) => !l)} aria-pressed={lock}>
                    {lock ? <Lock size={12} /> : <Unlock size={12} />}
                    {lock ? t.common.locked : t.common.free}
                  </button>
                </FieldRow>
              </>
            )}
            {(item.controls ?? []).filter((c) => !('showWhen' in c && c.showWhen && values[c.showWhen.key] === c.showWhen.not)).map((c) => (
              <ControlField key={c.key} control={c} value={values[c.key] ?? c.def} onChange={(v) => setValues((o) => ({ ...o, [c.key]: v }))} />
            ))}
            {item.param === 'band' && <NumberField label={L.band} unit="mm" min={1} step={0.5} value={params.band} onChange={(band) => setParams((p) => ({ ...p, band }))} />}
            {item.param === 'spacing' && <NumberField label={L.spacing} unit="mm" min={2} step={0.5} value={params.spacing} onChange={(spacing) => setParams((p) => ({ ...p, spacing }))} />}
            {tooBig && <p className="text-xs text-warn">{L.tooBig}</p>}
          </div>
        </aside>
      </div>
    </Dialog>
  );
}
