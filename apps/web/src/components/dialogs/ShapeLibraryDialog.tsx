import { useEffect, useMemo, useState } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { buildLibraryShape, DEFAULT_SHAPE_PARAMS, SHAPE_LIBRARY, shapeToPolylines, type ShapeLibraryCategory, type ShapeLibraryItem, type ShapeLibraryParams } from '@desktopcam/core';
import { useT } from '../../i18n';
import { useAppStore } from '../../store/useAppStore';
import { Dialog } from '../ui/Dialog';
import { FieldRow, NumberField, Segmented } from '../ui/Field';

const CATEGORIES: (ShapeLibraryCategory | 'all')[] = ['all', 'frames', 'banners', 'ornaments', 'textures'];

/** SVG-förhandsvisning av ett motiv i given storlek. */
function Preview({ item, w, h, params, className }: { item: ShapeLibraryItem; w: number; h: number; params: ShapeLibraryParams; className?: string }) {
  const { d, vb } = useMemo(() => {
    const shape = buildLibraryShape(item, '', w, h, params, 0, 0);
    let path = '';
    for (const pl of shapeToPolylines(shape)) {
      const pts: string[] = [];
      for (let i = 0; i + 1 < pl.points.length; i += 2) pts.push(`${pl.points[i].toFixed(2)},${(-pl.points[i + 1]).toFixed(2)}`);
      path += `M${pts.join('L')}${pl.closed ? 'Z' : ''}`;
    }
    const m = Math.max(w, h) * 0.06;
    return { d: path, vb: `${-w / 2 - m} ${-h / 2 - m} ${w + 2 * m} ${h + 2 * m}` };
  }, [item, w, h, params]);
  const sw = Math.max(w, h) / 160;
  return (
    <svg viewBox={vb} className={className} aria-hidden="true">
      <path d={d} fillRule="evenodd" className={item.kind === 'lines' ? 'fill-none stroke-ink' : 'fill-wood stroke-ink/70'} strokeWidth={item.kind === 'lines' ? sw * 1.4 : sw} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Formbibliotek: ramar, banderoller, ornament och mönster att lägga in och bearbeta. */
export function ShapeLibraryDialog() {
  const t = useT();
  const L = t.shapeLib;
  const open = useAppStore((s) => s.dialog === 'shapeLibrary');
  const material = useAppStore((s) => s.material);
  const [category, setCategory] = useState<ShapeLibraryCategory | 'all'>('all');
  const [selectedId, setSelectedId] = useState(SHAPE_LIBRARY[0].id);
  const [width, setWidth] = useState(100);
  const [height, setHeight] = useState(60);
  const [lock, setLock] = useState(true);
  const [params, setParams] = useState<ShapeLibraryParams>(DEFAULT_SHAPE_PARAMS);

  const item = SHAPE_LIBRARY.find((x) => x.id === selectedId) ?? SHAPE_LIBRARY[0];
  const items = SHAPE_LIBRARY.filter((x) => category === 'all' || x.category === category);
  const aspect = item.size.w / item.size.h;

  // Standardstorlek: motivets egen, nedskalad så att den ryms på materialet.
  useEffect(() => {
    const k = Math.min(1, (material.width * 0.85) / item.size.w, (material.height * 0.85) / item.size.h);
    setWidth(Math.round(item.size.w * k));
    setHeight(Math.round(item.size.h * k));
    setParams({ band: Math.max(2, Math.round(Math.min(item.size.w, item.size.h) * k * 0.08)), spacing: Math.max(3, Math.round(Math.min(item.size.w, item.size.h) * k * 0.09)) });
  }, [item, material.width, material.height]);

  const close = () => useAppStore.getState().openDialog(null);
  const add = () => {
    const s = useAppStore.getState();
    const name = L.items[item.id] ?? item.id;
    const n = s.layers.flatMap((l) => l.shapes).filter((x) => x.name.startsWith(name)).length + 1;
    s.addShape(buildLibraryShape(item, `${name} ${n}`, width, height, params, material.width / 2, material.height / 2));
    s.setEditTool('select');
    s.setStatus(L.added(name));
    close();
  };
  const tooBig = width > material.width || height > material.height;

  return (
    <Dialog
      open={open}
      onClose={close}
      title={L.title}
      width="max-w-5xl"
      actions={
        <div className="w-full sm:ml-2 sm:w-[26rem]">
          <Segmented label={L.title} value={category} onChange={setCategory} options={CATEGORIES.map((c) => ({ value: c, label: L.categories[c] }))} />
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
            <Preview item={item} w={width} h={height} params={params} className="h-full w-full" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">{L.items[item.id] ?? item.id}</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">{L.kindDesc[item.kind]}</p>
          </div>
          <div className="space-y-2">
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
            {item.param === 'band' && <NumberField label={L.band} unit="mm" min={1} step={0.5} value={params.band} onChange={(band) => setParams((p) => ({ ...p, band }))} />}
            {item.param === 'spacing' && <NumberField label={L.spacing} unit="mm" min={2} step={0.5} value={params.spacing} onChange={(spacing) => setParams((p) => ({ ...p, spacing }))} />}
            {tooBig && <p className="text-xs text-warn">{L.tooBig}</p>}
          </div>
        </aside>
      </div>
    </Dialog>
  );
}
