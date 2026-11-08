import { useEffect, useMemo, useState } from 'react';
import { Lock, Unlock } from 'lucide-react';
import { RELIEF_CATEGORIES, RELIEF_LIBRARY, type ReliefCategory } from '@desktopcam/core';
import { useAppStore } from '../../store/useAppStore';
import { addRelief } from '../../cam/commands';
import { reliefThumbnail } from '../../cam/reliefs';
import { Dialog } from '../ui/Dialog';
import { FieldRow, NumberField, Segmented, Switch } from '../ui/Field';

/** Bibliotek med färdiga reliefer, med skuggade miniatyrer att välja bland. */
export function ReliefLibraryDialog() {
  const open = useAppStore((s) => s.dialog === 'reliefLibrary');
  const material = useAppStore((s) => s.material);
  const isLaser = useAppStore((s) => s.machines.find((m) => m.id === s.machineId)?.kind === 'laser');
  const [category, setCategory] = useState<ReliefCategory | 'all'>('all');
  const [selectedId, setSelectedId] = useState(RELIEF_LIBRARY[0].id);
  const [width, setWidth] = useState(60);
  const [height, setHeight] = useState(60);
  const [depth, setDepth] = useState(5);
  const [lockAspect, setLockAspect] = useState(true);
  const [invert, setInvert] = useState(false);
  const [mirror, setMirror] = useState(false);

  const def = RELIEF_LIBRARY.find((r) => r.id === selectedId) ?? RELIEF_LIBRARY[0];
  const items = useMemo(() => RELIEF_LIBRARY.filter((r) => category === 'all' || r.category === category), [category]);
  const thumbs = useMemo(() => (open ? Object.fromEntries(RELIEF_LIBRARY.map((r) => [r.id, reliefThumbnail(r, 112)])) : {}), [open]);
  const large = useMemo(() => (open ? reliefThumbnail(def, 240) : ''), [open, def]);

  // Standardstorlek när en relief väljs, anpassad så att den får plats på materialet.
  useEffect(() => {
    const maxW = material.width * 0.8;
    const maxH = material.height * 0.8;
    let w = def.defaultWidth;
    let h = w / def.aspect;
    const k = Math.min(1, maxW / w, maxH / h);
    w = Math.round(w * k);
    h = Math.round(h * k);
    setWidth(w);
    setHeight(h);
    setDepth(Math.min(def.defaultDepth, Math.max(1, material.thickness - 3)));
    setInvert(false);
    setMirror(false);
  }, [def, material.width, material.height, material.thickness]);

  const close = () => useAppStore.getState().openDialog(null);
  const tooDeep = depth > material.thickness;
  const tooBig = width > material.width || height > material.height;

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Reliefbibliotek"
      width="max-w-5xl"
      actions={
        <div className="ml-2 w-80">
          <Segmented label="Kategori" value={category} onChange={setCategory} options={RELIEF_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} />
        </div>
      }
      footer={
        <>
          <p className="flex-1 text-xs text-muted">
            {isLaser ? 'Reliefer fräses med en fräs. Byt maskin under Inställning innan du skapar en 3D-bana.' : 'Reliefen placeras mitt på materialet. Flytta den sedan i inställningspanelen.'}
          </p>
          <button className="btn" onClick={close}>
            Avbryt
          </button>
          <button
            className="btn btn-primary"
            disabled={tooBig}
            onClick={() => {
              addRelief(def.id, { width, height, depth }, { invert, mirror });
              close();
            }}
          >
            Lägg till i projektet
          </button>
        </>
      }
    >
      <div className="grid md:grid-cols-[1fr_300px]">
        <ul className="grid max-h-[62vh] grid-cols-2 gap-3 overflow-y-auto p-4 sm:grid-cols-3 lg:grid-cols-4" role="listbox" aria-label="Reliefer">
          {items.map((r) => {
            const active = r.id === def.id;
            return (
              <li key={r.id}>
                <button
                  role="option"
                  aria-selected={active}
                  onClick={() => setSelectedId(r.id)}
                  onDoubleClick={() => {
                    if (r.id !== def.id || tooBig) return;
                    addRelief(def.id, { width, height, depth }, { invert, mirror });
                    close();
                  }}
                  className={`w-full overflow-hidden rounded-lg border text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
                    active ? 'border-accent ring-1 ring-accent' : 'border-line hover:border-muted/60'
                  }`}
                >
                  <div className="flex aspect-square items-center justify-center bg-app p-2">
                    {thumbs[r.id] && <img src={thumbs[r.id]} alt="" className="max-h-full max-w-full rounded-sm" />}
                  </div>
                  <p className={`px-2 py-1.5 text-xs ${active ? 'font-semibold text-accent' : ''}`}>{r.name}</p>
                </button>
              </li>
            );
          })}
        </ul>

        <aside className="space-y-3 border-t border-line p-4 md:border-l md:border-t-0">
          <div className="flex justify-center rounded-lg bg-app p-3">{large && <img src={large} alt={`Förhandsvisning av ${def.name}`} className="max-h-48 rounded" />}</div>
          <div>
            <h3 className="text-sm font-semibold">{def.name}</h3>
            <p className="mt-0.5 text-xs leading-relaxed text-muted">{def.description}</p>
          </div>
          <div className="space-y-2">
            <NumberField
              label="Bredd"
              unit="mm"
              min={5}
              value={width}
              onChange={(w) => {
                setWidth(w);
                if (lockAspect) setHeight(Math.round((w / def.aspect) * 10) / 10);
              }}
            />
            <NumberField
              label="Höjd"
              unit="mm"
              min={5}
              value={height}
              onChange={(h) => {
                setHeight(h);
                if (lockAspect) setWidth(Math.round(h * def.aspect * 10) / 10);
              }}
            />
            <FieldRow label="Lås proportioner">
              <button className="btn h-6 px-2" onClick={() => setLockAspect((l) => !l)} aria-pressed={lockAspect}>
                {lockAspect ? <Lock size={12} /> : <Unlock size={12} />}
                {lockAspect ? 'Låst' : 'Fri'}
              </button>
            </FieldRow>
            <NumberField label="Djup" unit="mm" min={0.2} step={0.5} value={depth} hint="reliefDepth" onChange={setDepth} />
            <FieldRow label="Invertera">
              <Switch checked={invert} onChange={setInvert} label="Invertera" />
            </FieldRow>
            <FieldRow label="Spegla">
              <Switch checked={mirror} onChange={setMirror} label="Spegla" />
            </FieldRow>
          </div>
          {(tooDeep || tooBig) && (
            <p className="rounded-md bg-warn/10 px-2 py-1.5 text-xs text-warn">
              {tooBig ? 'Reliefen är större än materialet.' : `Djupet är större än materialets tjocklek (${material.thickness} mm).`}
            </p>
          )}
        </aside>
      </div>
    </Dialog>
  );
}
