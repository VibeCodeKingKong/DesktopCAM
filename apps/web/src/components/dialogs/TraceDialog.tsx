import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Crosshair, ImagePlus, Loader2, TriangleAlert } from 'lucide-react';
import type { TraceOptions, TraceResultMm } from '@desktopcam/core';
import { useAppStore } from '../../store/useAppStore';
import { useT } from '../../i18n';
import { Dialog } from '../ui/Dialog';
import { FieldRow, NumberField, Segmented, SelectField, Switch } from '../ui/Field';
import { pickFile } from '../../utils/download';
import { IMAGE_ACCEPT, importImage } from '../../cam/imageObjects';
import { addTraceToDrawing, detectPaperQuad, loadImageRgba, PAPERS, rectifyPaper, runTrace, type P2, type PaperId, type TraceImage } from '../../cam/traceService';

type Calib = 'paper' | 'twoPoint' | 'none';
type Mode = TraceOptions['mode'];
const OFFSETS = [0, 1.5, 3, 4.5];

/**
 * Smart Trace: foto eller skiss → vektorer. Steg 1 kalibrerar (papper med
 * perspektivkorrigering, två punkter eller ingen), steg 2 spårar med
 * förhandsvisning över bilden. Resultatet blir vanliga former i ritningen.
 */
export function TraceDialog() {
  const t = useT();
  const tr = t.trace;
  const open = useAppStore((s) => s.dialog === 'trace');
  const startImage = useAppStore((s) => (s.dialog === 'trace' ? s.dialogStep : null));
  const images = useAppStore((s) => s.imageObjects);
  const close = () => useAppStore.getState().openDialog(null);

  const [imageId, setImageId] = useState<string | null>(null);
  const [src, setSrc] = useState<TraceImage | null>(null);
  const [step, setStep] = useState<'calibrate' | 'trace'>('calibrate');
  const [calib, setCalib] = useState<Calib>('paper');
  const [paper, setPaper] = useState<PaperId>('A4');
  const [custom, setCustom] = useState<[number, number]>([200, 300]);
  const [quad, setQuad] = useState<P2[] | null>(null);
  const [points, setPoints] = useState<P2[]>([]);
  const [distMm, setDistMm] = useState(100);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bilden som spåras (upprätad eller original) och dess skala.
  const [work, setWork] = useState<{ image: TraceImage; mmPerPx: number; rectified: { image: TraceImage; widthMm: number } | null; label: string } | null>(null);
  const [mode, setMode] = useState<Mode>('objects');
  const [autoThreshold, setAutoThreshold] = useState(true);
  const [threshold, setThreshold] = useState(128);
  const [dark, setDark] = useState(true);
  const [smooth, setSmooth] = useState(0.5);
  const [detail, setDetail] = useState(0.3);
  const [minAreaMm, setMinAreaMm] = useState(20);
  const [holes, setHoles] = useState(true);
  const [thinMm, setThinMm] = useState(1);
  const [minHoleMm, setMinHoleMm] = useState(100);
  const [offsetMm, setOffsetMm] = useState(0);
  const [result, setResult] = useState<TraceResultMm | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  // Öppnas: välj bild (markerad bild, angiven bild eller den enda).
  useEffect(() => {
    if (!open) return;
    const s = useAppStore.getState();
    const id = startImage ?? s.selectedImageId ?? (s.imageObjects.length === 1 ? s.imageObjects[0].id : null);
    setImageId(id);
    setStep('calibrate');
    setWork(null);
    setResult(null);
    setError(null);
  }, [open, startImage]);

  // Ny bild: läs in och leta efter papper.
  useEffect(() => {
    if (!open || !imageId) return setSrc(null);
    const img = loadImageRgba(imageId);
    setSrc(img);
    setQuad(null);
    setPoints([]);
    if (!img) return;
    setBusy(tr.detecting);
    detectPaperQuad(img)
      .then((q) => {
        const w = img.width, h = img.height;
        setQuad(q ?? [[w * 0.1, h * 0.1], [w * 0.9, h * 0.1], [w * 0.9, h * 0.9], [w * 0.1, h * 0.9]]);
        setCalib(q ? 'paper' : useAppStore.getState().imageObjects.length ? 'none' : 'paper');
        setError(q ? null : tr.noPaper);
      })
      .catch(() => setError(tr.noPaper))
      .finally(() => setBusy(null));
  }, [open, imageId]);

  const image = images.find((im) => im.id === imageId) ?? null;
  const paperMm: [number, number] = paper === 'custom' ? custom : [PAPERS[paper][0], PAPERS[paper][1]];

  const chooseFile = async (capture?: 'environment') => {
    const f = await pickFile(IMAGE_ACCEPT, capture);
    if (!f) return;
    setBusy(tr.reading);
    setError(null);
    try {
      const id = await importImage(f);
      if (id) setImageId(id);
      else setError(t.imageRelief.unreadable(f.name));
    } finally {
      setBusy(null);
    }
  };

  /** Kalibrera → bilden som ska spåras och dess skala. */
  const applyCalibration = async () => {
    if (!src || !image) return;
    setError(null);
    if (calib === 'paper' && quad) {
      setBusy(tr.rectifying);
      try {
        const r = await rectifyPaper(src, quad, paperMm);
        setWork({ image: r.image, mmPerPx: r.mmPerPx, rectified: { image: r.image, widthMm: r.widthMm }, label: tr.statusPaper(paper === 'custom' ? `${custom[0]} × ${custom[1]} mm` : paper) });
      } catch {
        setError(tr.rectifyFailed);
        return;
      } finally {
        setBusy(null);
      }
    } else if (calib === 'twoPoint' && points.length === 2) {
      const px = Math.hypot(points[1][0] - points[0][0], points[1][1] - points[0][1]);
      if (px < 5 || distMm <= 0) return setError(tr.twoPointInvalid);
      setWork({ image: src, mmPerPx: distMm / px, rectified: null, label: tr.statusTwoPoint });
    } else {
      setWork({ image: src, mmPerPx: image.widthMm / src.width, rectified: null, label: tr.statusNone });
    }
    setStep('trace');
  };

  // Spåra (fördröjt) när inställningarna ändras.
  useEffect(() => {
    if (!open || step !== 'trace' || !work) return;
    const timer = setTimeout(() => {
      setBusy(tr.tracing);
      const pxArea = minAreaMm / (work.mmPerPx * work.mmPerPx);
      runTrace(
        work.image,
        {
          mode,
          threshold: autoThreshold ? null : threshold,
          dark,
          smooth: mode === 'centerline' ? 0 : smooth / work.mmPerPx,
          simplify: Math.max(0.3, detail / work.mmPerPx),
          minArea: pxArea,
          holes,
          ignoreEdge: !!work.rectified,
          thinRemove: mode === 'objects' ? thinMm / work.mmPerPx : 0,
          minHoleArea: mode === 'centerline' ? 0 : minHoleMm / (work.mmPerPx * work.mmPerPx),
        },
        work.mmPerPx,
        mode === 'centerline' ? 0 : offsetMm,
      )
        .then((r) => {
          setResult(r);
          if (autoThreshold) setThreshold(r.threshold);
          setSelected(new Set(r.objects.map((o) => o.id)));
          setError(r.objects.length ? null : tr.nothingFound);
        })
        .catch(() => setError(tr.traceFailed))
        .finally(() => setBusy(null));
    }, 250);
    return () => clearTimeout(timer);
  }, [open, step, work, mode, autoThreshold, threshold, dark, smooth, detail, minAreaMm, holes, thinMm, minHoleMm, offsetMm]);

  const add = async () => {
    if (!result || !work || !image) return;
    setBusy(tr.adding);
    const n = await addTraceToDrawing(result, selected, { x: image.x, y: image.y }, { imageId: image.id, rectified: work.rectified, widthMm: work.image.width * work.mmPerPx });
    setBusy(null);
    if (n) close();
  };

  const selObjects = result?.objects.filter((o) => selected.has(o.id)) ?? [];
  const fmt = (v: number) => v.toLocaleString(t.locale, { maximumFractionDigits: 1 });

  const footer = (
    <>
      {step === 'trace' && (
        <button className="btn" onClick={() => setStep('calibrate')}>
          {tr.back}
        </button>
      )}
      <div className="flex-1" />
      {busy && (
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <Loader2 size={14} className="animate-spin" /> {busy}
        </span>
      )}
      {step === 'calibrate' ? (
        <button className="btn btn-primary" disabled={!src || !!busy || (calib === 'twoPoint' && points.length < 2)} onClick={() => void applyCalibration()}>
          {tr.next}
        </button>
      ) : (
        <button className="btn btn-primary" disabled={!selObjects.length || !!busy} onClick={() => void add()}>
          {tr.add(selObjects.length)}
        </button>
      )}
    </>
  );

  return (
    <Dialog open={open} onClose={close} title={tr.title} width="max-w-5xl" footer={footer}>
      {!src ? (
        <div className="space-y-4 p-6 text-sm">
          <p className="text-muted">{tr.intro}</p>
          {images.length > 0 && (
            <SelectField label={tr.image} value={imageId ?? ''} options={[{ value: '', label: '–' }, ...images.map((im) => ({ value: im.id, label: im.name }))]} onChange={(v) => setImageId(v || null)} />
          )}
          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={() => void chooseFile()}>
              <ImagePlus size={15} /> {tr.chooseImage}
            </button>
            <button className="btn" onClick={() => void chooseFile('environment')}>
              <Camera size={15} /> {tr.takePhoto}
            </button>
          </div>
          <p className="text-xs text-muted">{tr.photoTips}</p>
          {busy && (
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <Loader2 size={14} className="animate-spin" /> {busy}
            </p>
          )}
          {error && <p className="rounded-md bg-warn/10 px-2 py-1.5 text-xs text-warn">{error}</p>}
        </div>
      ) : (
        <div className="flex flex-col gap-4 p-4 lg:flex-row">
          <div className="min-w-0 flex-1">
            <Preview
              img={step === 'trace' && work ? work.image : src}
              quad={step === 'calibrate' && calib === 'paper' ? quad : null}
              onQuad={setQuad}
              points={step === 'calibrate' && calib === 'twoPoint' ? points : null}
              onPoints={setPoints}
              result={step === 'trace' ? result : null}
              mmPerPx={work?.mmPerPx ?? 1}
              selected={selected}
              onToggle={(id) => setSelected((s) => {
                const n = new Set(s);
                if (n.has(id)) n.delete(id);
                else n.add(id);
                return n;
              })}
            />
            <p className="mt-1.5 text-2xs text-muted">{step === 'calibrate' ? (calib === 'paper' ? tr.hintQuad : calib === 'twoPoint' ? tr.hintTwoPoint : tr.hintNone) : tr.hintSelect}</p>
          </div>

          <div className="w-full shrink-0 space-y-3 text-sm lg:w-72">
            {error && (
              <p className="flex gap-1.5 rounded-md bg-warn/10 px-2 py-1.5 text-xs text-warn">
                <TriangleAlert size={14} className="mt-0.5 shrink-0" /> {error}
              </p>
            )}
            {step === 'calibrate' ? (
              <>
                <h3 className="font-semibold">{tr.calibrate}</h3>
                <Segmented label={tr.calibrate} value={calib} options={(['paper', 'twoPoint', 'none'] as const).map((value) => ({ value, label: tr.calibs[value] }))} onChange={setCalib} />
                {calib === 'paper' && (
                  <>
                    <SelectField label={tr.paper} value={paper} options={(['A4', 'A3', 'Letter', 'custom'] as const).map((value) => ({ value, label: value === 'custom' ? tr.custom : value }))} onChange={setPaper} />
                    {paper === 'custom' && (
                      <>
                        <NumberField label={t.props.width} unit="mm" min={10} value={custom[0]} onChange={(v) => setCustom([v, custom[1]])} />
                        <NumberField label={t.props.height} unit="mm" min={10} value={custom[1]} onChange={(v) => setCustom([custom[0], v])} />
                      </>
                    )}
                    <button className="btn w-full" disabled={!!busy} onClick={() => src && void detectPaperQuad(src).then((q) => (q ? (setQuad(q), setError(null)) : setError(tr.noPaper)))}>
                      <Crosshair size={14} /> {tr.detectAgain}
                    </button>
                    <p className="text-2xs leading-relaxed text-muted">{tr.paperNote}</p>
                  </>
                )}
                {calib === 'twoPoint' && (
                  <>
                    <NumberField label={tr.distance} unit="mm" min={0.1} step={1} value={distMm} onChange={setDistMm} />
                    <p className="text-2xs leading-relaxed text-muted">{tr.twoPointNote}</p>
                  </>
                )}
                {calib === 'none' && <p className="rounded-md bg-warn/10 px-2 py-1.5 text-xs text-warn">{tr.noneNote}</p>}
              </>
            ) : (
              <>
                <p className="rounded-md bg-accent/10 px-2 py-1.5 text-xs">
                  <b>{work?.label}</b> · {tr.scale(fmt(1 / (work?.mmPerPx ?? 1)))}
                </p>
                <Segmented label={tr.mode} value={mode} options={(['objects', 'outline', 'centerline'] as const).map((value) => ({ value, label: tr.modes[value] }))} onChange={setMode} />
                <p className="text-2xs leading-relaxed text-muted">{tr.modeNotes[mode]}</p>
                <FieldRow label={tr.darkOnLight}>
                  <Switch checked={dark} onChange={setDark} label={tr.darkOnLight} />
                </FieldRow>
                <FieldRow label={tr.autoThreshold}>
                  <Switch checked={autoThreshold} onChange={setAutoThreshold} label={tr.autoThreshold} />
                </FieldRow>
                {!autoThreshold && <NumberField label={tr.threshold} step={4} min={1} max={254} value={threshold} onChange={(v) => setThreshold(Math.round(v))} />}
                {mode === 'objects' && <p className="text-2xs leading-relaxed text-muted">{tr.shadowHint}</p>}
                {mode !== 'centerline' && <NumberField label={tr.smooth} unit="mm" step={0.25} min={0} max={10} value={smooth} onChange={setSmooth} />}
                <NumberField label={tr.detail} unit="mm" step={0.1} min={0.05} max={5} value={detail} onChange={setDetail} />
                <NumberField label={tr.minArea} unit="mm²" step={5} min={0} value={minAreaMm} onChange={setMinAreaMm} />
                {mode === 'objects' && <NumberField label={tr.thinRemove} unit="mm" step={0.25} min={0} max={10} value={thinMm} onChange={setThinMm} />}
                {mode !== 'centerline' && (
                  <>
                    <FieldRow label={tr.holes}>
                      <Switch checked={holes} onChange={setHoles} label={tr.holes} />
                    </FieldRow>
                    {holes && <NumberField label={tr.minHole} unit="mm²" step={10} min={0} value={minHoleMm} onChange={setMinHoleMm} />}
                    <div>
                      <p className="mb-1 text-xs text-muted">{tr.offset}</p>
                      <div className="flex flex-wrap gap-1">
                        {OFFSETS.map((v) => (
                          <button key={v} className={`rounded-full px-2.5 py-0.5 text-xs ${offsetMm === v ? 'bg-accent text-white' : 'bg-app hover:bg-line/60'}`} onClick={() => setOffsetMm(v)}>
                            {fmt(v)} mm
                          </button>
                        ))}
                      </div>
                      <NumberField label={tr.offsetCustom} unit="mm" step={0.5} min={-20} max={50} value={offsetMm} onChange={setOffsetMm} />
                    </div>
                  </>
                )}
                {result && (
                  <div className="space-y-1 rounded-md border border-line p-2 text-xs">
                    <p className="font-semibold">{tr.found(result.objects.length, selObjects.length)}</p>
                    {selObjects.slice(0, 6).map((o, i) => (
                      <p key={o.id} className="tabular-nums text-muted">
                        {tr.objectName} {i + 1}: {fmt(o.bbox[2] - o.bbox[0])} × {fmt(o.bbox[3] - o.bbox[1])} mm
                      </p>
                    ))}
                  </div>
                )}
                <details className="text-2xs leading-relaxed text-muted">
                  <summary className="cursor-pointer text-xs">{tr.accuracyTitle}</summary>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {tr.accuracy.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                  </ul>
                </details>
              </>
            )}
          </div>
        </div>
      )}
    </Dialog>
  );
}

/** Bilden med kalibreringshandtag eller spårade konturer; anpassas till bredden. */
function Preview({
  img,
  quad,
  onQuad,
  points,
  onPoints,
  result,
  mmPerPx,
  selected,
  onToggle,
}: {
  img: TraceImage;
  quad: P2[] | null;
  onQuad: (q: P2[]) => void;
  points: P2[] | null;
  onPoints: (p: P2[]) => void;
  result: TraceResultMm | null;
  mmPerPx: number;
  selected: Set<number>;
  onToggle: (id: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 600, h: 400 });
  const drag = useRef<{ kind: 'quad' | 'point'; i: number } | null>(null);
  const bitmap = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    c.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(img.rgba), img.width, img.height), 0, 0);
    return c;
  }, [img]);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const maxH = Math.min(window.innerHeight * 0.62, 720);
      const k = Math.min(w / img.width, maxH / img.height);
      setSize({ w: Math.round(img.width * k), h: Math.round(img.height * k) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [img]);

  const k = size.w / img.width;
  // Spårade mm → bildens pixlar → skärm.
  const toScreen = (x: number, y: number): P2 => [(x / mmPerPx) * k, (img.height - y / mmPerPx) * k];

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = size.w * dpr;
    c.height = size.h * dpr;
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.drawImage(bitmap, 0, 0, size.w, size.h);
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--c-accent').trim();
    const col = accent ? `rgb(${accent})` : '#0071e3';
    if (quad) {
      g.strokeStyle = col;
      g.lineWidth = 2;
      g.beginPath();
      quad.forEach(([x, y], i) => (i ? g.lineTo(x * k, y * k) : g.moveTo(x * k, y * k)));
      g.closePath();
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.9)';
      for (const [x, y] of quad) {
        g.beginPath();
        g.arc(x * k, y * k, 8, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      }
    }
    if (points) {
      g.strokeStyle = '#d4572a';
      g.lineWidth = 2;
      if (points.length === 2) {
        g.beginPath();
        g.moveTo(points[0][0] * k, points[0][1] * k);
        g.lineTo(points[1][0] * k, points[1][1] * k);
        g.stroke();
      }
      g.fillStyle = 'rgba(255,255,255,0.9)';
      for (const [x, y] of points) {
        g.beginPath();
        g.arc(x * k, y * k, 7, 0, Math.PI * 2);
        g.fill();
        g.stroke();
      }
    }
    if (result) {
      for (const o of result.objects) {
        const on = selected.has(o.id);
        g.strokeStyle = on ? '#e5194d' : 'rgba(120,120,120,0.8)';
        g.lineWidth = on ? 2 : 1;
        g.setLineDash(on ? [] : [4, 3]);
        for (const l of o.loops) {
          g.beginPath();
          for (let i = 0; i < l.length; i += 2) {
            const [x, y] = toScreen(l[i], l[i + 1]);
            if (i) g.lineTo(x, y);
            else g.moveTo(x, y);
          }
          g.closePath();
          g.stroke();
        }
        for (const l of o.lines) {
          g.beginPath();
          for (let i = 0; i < l.length; i += 2) {
            const [x, y] = toScreen(l[i], l[i + 1]);
            if (i) g.lineTo(x, y);
            else g.moveTo(x, y);
          }
          g.stroke();
        }
      }
      g.setLineDash([]);
    }
  }, [bitmap, size, quad, points, result, selected, mmPerPx]);

  const imgPoint = (e: React.PointerEvent): P2 => {
    const r = canvas.current!.getBoundingClientRect();
    return [Math.max(0, Math.min(img.width, (e.clientX - r.left) / k)), Math.max(0, Math.min(img.height, (e.clientY - r.top) / k))];
  };
  const near = (p: P2, list: P2[]) => list.findIndex(([x, y]) => Math.hypot((x - p[0]) * k, (y - p[1]) * k) < 18);

  const onDown = (e: React.PointerEvent) => {
    const p = imgPoint(e);
    if (quad) {
      const i = near(p, quad);
      if (i >= 0) {
        drag.current = { kind: 'quad', i };
        (e.target as Element).setPointerCapture(e.pointerId);
      }
      return;
    }
    if (points) {
      const i = near(p, points);
      if (i >= 0) drag.current = { kind: 'point', i };
      else {
        const next = points.length >= 2 ? [p] : [...points, p];
        onPoints(next);
        drag.current = { kind: 'point', i: next.length - 1 };
      }
      (e.target as Element).setPointerCapture(e.pointerId);
      return;
    }
    if (result) {
      // Klick på ett objekt (inuti dess omslutande rektangel, minsta först) växlar valet.
      const mx = p[0] * mmPerPx, my = (img.height - p[1]) * mmPerPx;
      const hit = [...result.objects]
        .filter((o) => mx >= o.bbox[0] && mx <= o.bbox[2] && my >= o.bbox[1] && my <= o.bbox[3])
        .sort((a, b) => (a.bbox[2] - a.bbox[0]) * (a.bbox[3] - a.bbox[1]) - (b.bbox[2] - b.bbox[0]) * (b.bbox[3] - b.bbox[1]))[0];
      if (hit) onToggle(hit.id);
    }
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = imgPoint(e);
    if (d.kind === 'quad' && quad) onQuad(quad.map((q, i) => (i === d.i ? p : q)));
    if (d.kind === 'point' && points) onPoints(points.map((q, i) => (i === d.i ? p : q)));
  };

  return (
    <div ref={host} className="w-full">
      <canvas
        ref={canvas}
        style={{ width: size.w, height: size.h }}
        className={`mx-auto block touch-none rounded-md border border-line ${result ? 'cursor-pointer' : 'cursor-crosshair'}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={() => (drag.current = null)}
        aria-label="trace preview"
      />
    </div>
  );
}

