import { useEffect, useMemo, useState } from 'react';
import { FileWarning, Loader2 } from 'lucide-react';
import {
  DEFAULT_IMPORT_OPTIONS,
  shapeToPolylines,
  transformShape,
  translate,
  uid,
  type ImportOptions,
  type ImportResult,
  type VectorLayer,
} from '@desktopcam/core';
import { camClient } from '../../engine/camClient';
import { useAppStore } from '../../store/useAppStore';
import { Dialog } from '../ui/Dialog';
import { FieldRow, Segmented, SelectField, Switch } from '../ui/Field';

type Placement = 'keep' | 'corner' | 'center';
type UnitChoice = 'auto' | 'mm' | 'cm' | 'in' | 'px96' | 'px72';

const UNIT_SCALE: Record<UnitChoice, number | null> = { auto: null, mm: 1, cm: 10, in: 25.4, px96: 25.4 / 96, px72: 25.4 / 72 };
const LAYER_COLORS = ['#0071e3', '#2e9d5b', '#b35ad6', '#d4572a', '#0b8f9c', '#8a6d1d'];
const fmt = (n: number) => n.toLocaleString('sv-SE', { maximumFractionDigits: 1 });

/** Förhandsvisning och inställningar innan en SVG eller DXF läggs till i projektet. */
export function ImportDialog() {
  const open = useAppStore((s) => s.dialog === 'importFile');
  const pending = useAppStore((s) => s.pendingImport);
  const material = useAppStore((s) => s.material);
  const [units, setUnits] = useState<UnitChoice>('auto');
  const [join, setJoin] = useState(true);
  const [placement, setPlacement] = useState<Placement>('keep');
  const [growStock, setGrowStock] = useState(true);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    useAppStore.getState().openDialog(null);
    useAppStore.getState().setPendingImport(null);
  };

  useEffect(() => {
    if (open) {
      setUnits('auto');
      setJoin(true);
      setPlacement('keep');
      setResult(null);
      setError(null);
    }
  }, [open, pending]);

  // Tolka om när inställningarna ändras – tolkningen sker i workern.
  useEffect(() => {
    if (!open || !pending) return;
    let cancelled = false;
    const options: ImportOptions = { ...DEFAULT_IMPORT_OPTIONS, unitScale: UNIT_SCALE[units], join, svgDpi: units === 'px72' ? 72 : 96 };
    setBusy(true);
    camClient
      .request({ type: 'import', format: pending.format, text: pending.text, options })
      .then((r) => {
        if (cancelled) return;
        setResult(r);
        setError(null);
        // Ritningar långt från origo placeras på materialet som standard.
        if (r.bounds && (r.bounds.min.x < -1 || r.bounds.min.y < -1 || r.bounds.max.x > material.width * 3)) setPlacement('corner');
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
    };
  }, [open, pending, units, join, material.width]);

  const size = result?.bounds ? { w: result.bounds.max.x - result.bounds.min.x, h: result.bounds.max.y - result.bounds.min.y } : null;

  const offset = useMemo(() => {
    if (!result?.bounds || !size) return { x: 0, y: 0 };
    if (placement === 'corner') return { x: 10 - result.bounds.min.x, y: 10 - result.bounds.min.y };
    if (placement === 'center') return { x: (material.width - size.w) / 2 - result.bounds.min.x, y: (material.height - size.h) / 2 - result.bounds.min.y };
    return { x: 0, y: 0 };
  }, [result, size, placement, material.width, material.height]);

  const placed = result?.bounds && size ? { minX: result.bounds.min.x + offset.x, minY: result.bounds.min.y + offset.y, maxX: result.bounds.max.x + offset.x, maxY: result.bounds.max.y + offset.y } : null;
  const outside = placed && (placed.minX < 0 || placed.minY < 0 || placed.maxX > material.width || placed.maxY > material.height);

  const preview = useMemo(() => {
    if (!result?.bounds || !size) return null;
    const lines: { d: string; color: string; closed: boolean }[] = [];
    let total = 0;
    result.layers.forEach((layer, li) => {
      for (const shape of layer.shapes) {
        for (const pl of shapeToPolylines(shape, Math.max(0.05, Math.max(size.w, size.h) / 600))) {
          if (total > 40000) return;
          const pts: string[] = [];
          for (let i = 0; i + 1 < pl.points.length; i += 2) pts.push(`${pl.points[i].toFixed(2)},${(-pl.points[i + 1]).toFixed(2)}`);
          total += pts.length;
          lines.push({ d: `M${pts.join('L')}${pl.closed ? 'Z' : ''}`, color: LAYER_COLORS[li % LAYER_COLORS.length], closed: pl.closed });
        }
      }
    });
    const pad = Math.max(size.w, size.h) * 0.04 + 1;
    return { lines, viewBox: `${result.bounds.min.x - pad} ${-result.bounds.max.y - pad} ${size.w + 2 * pad} ${size.h + 2 * pad}`, stroke: Math.max(size.w, size.h) / 300 };
  }, [result, size]);

  const confirm = () => {
    if (!result || !pending) return;
    const s = useAppStore.getState();
    const m = translate(offset.x, offset.y);
    const base = pending.fileName.replace(/\.[^.]+$/, '');
    const layers: VectorLayer[] = result.layers.map((l, i) => ({
      id: uid('layer'),
      name: result.layers.length > 1 ? `${base}: ${l.name}` : base,
      color: LAYER_COLORS[(s.layers.length + i) % LAYER_COLORS.length],
      visible: true,
      locked: false,
      shapes: l.shapes.map((sh) => transformShape(sh, m)),
    }));
    if (growStock && placed && outside) {
      s.setMaterial({
        width: Math.ceil(Math.max(material.width, placed.maxX + 10)),
        height: Math.ceil(Math.max(material.height, placed.maxY + 10)),
      });
    }
    s.addLayers(layers);
    s.setStatus(`Importerade ${result.shapeCount} former från ${pending.fileName}`);
    close();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title={`Importera ${pending?.fileName ?? ''}`}
      width="max-w-4xl"
      footer={
        <>
          <p className="flex-1 text-xs text-muted">
            {result ? `${result.shapeCount} former i ${result.layers.length} $lager` : ''}
          </p>
          <button className="btn" onClick={close}>
            Avbryt
          </button>
          <button className="btn btn-primary" onClick={confirm} disabled={!result || !result.shapeCount || busy}>
            Importera
          </button>
        </>
      }
    >
      <div className="grid gap-0 md:grid-cols-[1fr_300px]">
        <div className="relative flex min-h-[320px] items-center justify-center border-b border-line bg-app p-4 md:border-b-0 md:border-r">
          {busy && <Loader2 className="absolute right-3 top-3 animate-spin text-muted" size={16} />}
          {error && (
            <div className="max-w-sm text-center text-sm">
              <FileWarning className="mx-auto mb-2 text-warn" size={28} />
              <p className="font-medium">Filen kunde inte läsas</p>
              <p className="mt-1 text-xs text-muted">{error}</p>
            </div>
          )}
          {preview && !error && (
            <svg viewBox={preview.viewBox} className="h-full max-h-[52vh] w-full" role="img" aria-label="Förhandsvisning av importen">
              {preview.lines.map((l, i) => (
                <path key={i} d={l.d} fill="none" stroke={l.color} strokeDasharray={l.closed ? undefined : `${preview.stroke * 4} ${preview.stroke * 3}`} vectorEffect="non-scaling-stroke" style={{ strokeWidth: 1.2 }} />
              ))}
            </svg>
          )}
          {size && (
            <p className="absolute bottom-3 left-3 rounded-md bg-surface/90 px-2 py-1 text-xs tabular-nums shadow-sm">
              {fmt(size.w)} × {fmt(size.h)} mm
            </p>
          )}
        </div>

        <div className="space-y-4 p-4">
          <section className="space-y-2.5">
            <SelectField<UnitChoice>
              label="Enhet"
              hint="importUnits"
              value={units}
              onChange={setUnits}
              options={[
                { value: 'auto', label: 'Läs från filen' },
                { value: 'mm', label: 'Millimeter' },
                { value: 'cm', label: 'Centimeter' },
                { value: 'in', label: 'Tum' },
                ...(pending?.format === 'svg'
                  ? [
                      { value: 'px96' as const, label: 'Pixlar, 96 per tum' },
                      { value: 'px72' as const, label: 'Pixlar, 72 per tum' },
                    ]
                  : []),
              ]}
            />
            {result && <p className="text-2xs text-muted">{result.unitsNote}</p>}
            <FieldRow label="Sammanfoga segment" hint="importJoin">
              <Switch checked={join} onChange={setJoin} label="Sammanfoga segment" />
            </FieldRow>
          </section>

          <section className="space-y-2">
            <p className="text-xs text-muted">Placering</p>
            <Segmented<Placement>
              label="Placering"
              value={placement}
              onChange={setPlacement}
              options={[
                { value: 'keep', label: 'Som i filen' },
                { value: 'corner', label: 'Nere till vänster' },
                { value: 'center', label: 'Mitten' },
              ]}
            />
            {outside && (
              <div className="rounded-md bg-warn/10 p-2 text-xs text-warn">
                <p>Ritningen hamnar utanför materialet ({material.width} × {material.height} mm).</p>
                <label className="mt-1.5 flex items-center gap-2 text-ink">
                  <Switch checked={growStock} onChange={setGrowStock} label="Förstora materialet" />
                  Förstora materialet så att allt får plats
                </label>
              </div>
            )}
          </section>

          {result && result.layers.length > 0 && (
            <section>
              <p className="mb-1.5 text-xs text-muted">Lager</p>
              <ul className="space-y-1 text-xs">
                {result.layers.map((l, i) => (
                  <li key={l.name} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: LAYER_COLORS[i % LAYER_COLORS.length] }} />
                    <span className="flex-1 truncate">{l.name}</span>
                    <span className="tabular-nums text-muted">{l.shapes.length}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {result && result.warnings.length > 0 && (
            <section className="space-y-1.5">
              <p className="text-xs text-muted">Att kontrollera</p>
              {result.warnings.map((w) => (
                <p key={w} className="rounded-md border border-line bg-app px-2 py-1.5 text-2xs leading-relaxed">
                  {w}
                </p>
              ))}
            </section>
          )}
        </div>
      </div>
    </Dialog>
  );
}
