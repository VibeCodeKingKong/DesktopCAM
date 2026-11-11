import { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, RotateCw, Undo2, Wand2 } from 'lucide-react';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';
import { imageReliefHeights, rgbaToGray, type ImageReliefKind, type ImageReliefSettings } from '@desktopcam/core';
import { useAppStore, useExpert } from '../../store/useAppStore';
import { addImageRelief, imageReliefPreset, prepareImage, processedFull, useImageRelief, type ImagePrep, type PendingImage } from '../../cam/imageRelief';
import { shadeHeights } from '../../cam/reliefs';
import { useT } from '../../i18n';
import { Dialog } from '../ui/Dialog';
import { FieldRow, NumberField, Segmented, Switch } from '../ui/Field';

/** Inställningar för en bildrelief – i dialogen och under Egenskaper. */
export function ImageReliefFields({
  settings,
  detected,
  lightBackground,
  onChange,
}: {
  settings: ImageReliefSettings;
  detected: ImageReliefKind;
  lightBackground: boolean;
  onChange: (s: ImageReliefSettings) => void;
}) {
  const t = useT();
  const ti = t.imageRelief;
  const expert = useExpert();
  const set = (p: Partial<ImageReliefSettings>) => onChange({ ...settings, ...p });
  const kinds: ImageReliefKind[] = ['logo', 'drawing', 'depthmap', 'photo'];
  return (
    <div className="space-y-2.5">
      <FieldRow label={ti.kind}>
        <select
          className="field"
          value={settings.kind}
          aria-label={ti.kind}
          onChange={(e) => onChange(imageReliefPreset(e.target.value as ImageReliefKind, lightBackground))}
        >
          {kinds.map((k) => (
            <option key={k} value={k}>
              {ti.kinds[k]}
              {k === detected ? ` (${ti.detectedTag})` : ''}
            </option>
          ))}
        </select>
      </FieldRow>
      <p className="text-2xs leading-relaxed text-muted">{ti.kindDesc[settings.kind]}</p>
      <FieldRow label={ti.high}>
        <Segmented
          label={ti.high}
          value={settings.invert ? 'dark' : 'light'}
          options={[
            { value: 'light', label: ti.highLight },
            { value: 'dark', label: ti.highDark },
          ]}
          onChange={(v) => set({ invert: v === 'dark' })}
        />
      </FieldRow>
      <NumberField label={ti.smoothing} step={0.5} min={0} max={10} value={settings.smoothing} onChange={(smoothing) => set({ smoothing })} />
      {expert && <NumberField label={ti.contrast} step={0.1} min={0.5} max={3} value={settings.contrast} onChange={(contrast) => set({ contrast })} />}
      {expert && <NumberField label={ti.gamma} step={0.1} min={0.3} max={3} value={settings.gamma} onChange={(gamma) => set({ gamma })} />}
      <NumberField label={ti.background} unit="%" step={5} min={0} max={60} value={Math.round(settings.background * 100)} onChange={(pct) => set({ background: pct / 100 })} />
    </div>
  );
}

/** Gråskala eller RGBA som data-URL (för bildvyn i dialogen). */
function toDataUrl(w: number, h: number, gray: Uint8Array | null, rgba: Uint8ClampedArray | null): string {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(w, h);
  if (rgba) img.data.set(rgba);
  else if (gray) for (let i = 0; i < gray.length; i++) { img.data[4 * i] = img.data[4 * i + 1] = img.data[4 * i + 2] = gray[i]; img.data[4 * i + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

/**
 * Beskärning och vridning med Cropper.js (github.com/fengyuanchen/cropperjs).
 * Lämnar ifrån sig den vridna och beskurna bilden som en ny källa.
 */
function ImageCropper({ src, angle, onResult }: { src: string; angle: number; onResult: (c: HTMLCanvasElement) => void }) {
  const imgRef = useRef<HTMLImageElement>(null);
  const cropper = useRef<Cropper | null>(null);
  const ready = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const emit = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const c = cropper.current;
      if (!c || !ready.current) return;
      onResult(c.getCroppedCanvas({ maxWidth: 1000, maxHeight: 1000, imageSmoothingQuality: 'high' }));
    }, 120);
  };
  useEffect(() => {
    if (!imgRef.current) return;
    ready.current = false;
    const c = new Cropper(imgRef.current, {
      viewMode: 1,
      autoCropArea: 1,
      background: false,
      zoomable: false,
      movable: false,
      scalable: false,
      rotatable: true,
      checkOrientation: false,
      toggleDragModeOnDblclick: false,
      ready() {
        ready.current = true;
        if (angle) rotateAndFit(c, angle);
        emit();
      },
      cropend: emit,
    });
    cropper.current = c;
    return () => {
      clearTimeout(timer.current);
      c.destroy();
      cropper.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);
  useEffect(() => {
    const c = cropper.current;
    if (!c || !ready.current) return;
    rotateAndFit(c, angle);
    emit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [angle]);
  return (
    <div className="h-[48vh] w-full">
      <img ref={imgRef} src={src} alt="" className="block max-w-full" />
    </div>
  );
}

/**
 * Vrider och skalar sedan ner bilden så att hela den vridna bilden ryms i
 * rutan. Cropper.js förstorar annars arbetsytan till den vridna bildens
 * omslutande rektangel, så att bilden ser inzoomad ut och delar hamnar utanför.
 * I viewMode 1 kan arbetsytan inte bli mindre än beskärningsrutan, så rutan
 * släpps först och läggs sedan om hela bilden igen.
 */
function rotateAndFit(c: Cropper, angle: number) {
  c.clear();
  c.rotateTo(angle);
  const box = c.getContainerData();
  const cv = c.getCanvasData();
  const k = Math.min(box.width / cv.width, box.height / cv.height);
  const width = cv.width * k, height = cv.height * k;
  c.setCanvasData({ left: (box.width - width) / 2, top: (box.height - height) / 2, width, height });
  c.crop();
  c.setCropBoxData(c.getCanvasData());
}

/** Vinkeln inom −180…180° (180 behålls som 180). */
const wrapAngle = (a: number) => {
  const w = ((((a + 180) % 360) + 360) % 360) - 180;
  return w === -180 && a > 0 ? 180 : Math.round(w * 10) / 10;
};

/** Fält för exakt vinkel (grader, decimalkomma eller -punkt). */
function AngleInput({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const t = useT();
  const fmt = (v: number) => v.toLocaleString(t.locale, { maximumFractionDigits: 1 });
  const [draft, setDraft] = useState(fmt(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(fmt(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focused]);
  const commit = () => {
    const v = parseFloat(draft.replace(',', '.').replace('−', '-'));
    if (Number.isFinite(v)) onChange(v);
    else setDraft(fmt(value));
  };
  return (
    <label className="flex items-center gap-0.5 text-2xs text-muted">
      <input
        className="h-7 w-14 rounded-md border border-line bg-app px-1.5 text-right text-xs tabular-nums text-ink"
        inputMode="decimal"
        aria-label={label}
        value={draft}
        onFocus={(e) => {
          setFocused(true);
          e.currentTarget.select();
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setFocused(false);
          commit();
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
      />
      °
    </label>
  );
}

/** Canvas → källa för förbehandlingen (gråskala och bakgrundens ljushet). */
function canvasToSource(c: HTMLCanvasElement, fileName: string): PendingImage {
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  const rgba = ctx.getImageData(0, 0, c.width, c.height).data;
  const gray = rgbaToGray(rgba, c.width, c.height);
  const sorted = Float32Array.from(gray).sort();
  return { fileName, width: c.width, height: c.height, rgba, gray, lightBackground: sorted[Math.floor(sorted.length * 0.5)] >= 110 };
}

/** Bild till relief: förbehandling, förhandsvisning och inställningar innan reliefen placeras. */
export function ImageReliefDialog() {
  const t = useT();
  const ti = t.imageRelief;
  const open = useAppStore((s) => s.dialog === 'imageRelief');
  const material = useAppStore((s) => s.material);
  const pending = useImageRelief((s) => s.pending);
  const [prep, setPrep] = useState<ImagePrep>({ crop: null, removeBackground: false, blackWhite: false, threshold: null });
  const [view, setView] = useState<'crop' | 'result' | 'relief'>('crop');
  // Vinkel −180…180° (0 = originalet). Knapparna vrider 90°, reglaget och fältet fritt.
  const [angle, setAngleRaw] = useState(0);
  const setAngle = (a: number) => setAngleRaw(wrapAngle(a));
  const [source, setSource] = useState<PendingImage | null>(null);
  const [settings, setSettings] = useState<ImageReliefSettings | null>(null);
  const [width, setWidth] = useState(100);
  const [depth, setDepth] = useState(4);
  const [mirror, setMirror] = useState(false);
  const lastKind = useRef<string>('');

  // Ny bild: börja om.
  useEffect(() => {
    if (!pending) return;
    setPrep({ crop: null, removeBackground: false, blackWhite: false, threshold: null });
    setView('crop');
    setAngleRaw(0);
    setSource(null);
    setMirror(false);
    lastKind.current = '';
  }, [pending]);

  // Källan är det som Cropper.js lämnar ifrån sig (vriden och beskuren), annars hela bilden.
  const src = source ?? pending;
  const prepared = useMemo(() => (src ? prepareImage(src, prep) : null), [src, prep]);
  const originalUrl = useMemo(() => (pending ? toDataUrl(pending.width, pending.height, null, pending.rgba) : ''), [pending]);

  // Ny bildtyp efter analysen (t.ex. när svartvitt slås på): ladda typens inställningar.
  useEffect(() => {
    if (!prepared || !pending) return;
    const key = `${prepared.analysis.kind}:${prepared.analysis.lightBackground}`;
    if (key === lastKind.current) return;
    const first = !lastKind.current;
    lastKind.current = key;
    setSettings(imageReliefPreset(prepared.analysis.kind, prepared.analysis.lightBackground));
    if (first) setDepth(Math.min(prepared.analysis.kind === 'photo' ? 3 : 4, Math.max(0.5, material.thickness / 3)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepared]);

  // Storlek som ryms på materialet; följer beskärningens proportioner.
  const aspect = prepared ? prepared.width / prepared.height : 1;
  useEffect(() => {
    if (!prepared) return;
    setWidth(Math.round(Math.min(material.width * 0.8, material.height * 0.8 * aspect)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aspect, pending]);

  const resultUrl = useMemo(() => {
    if (!src || view !== 'result') return '';
    if (!prep.removeBackground && !prep.blackWhite) return toDataUrl(src.width, src.height, null, src.rgba);
    return toDataUrl(src.width, src.height, processedFull(src, prep).gray, null);
  }, [src, view, prep]);

  const reliefUrl = useMemo(() => {
    if (!prepared || !settings || view !== 'relief') return '';
    return shadeHeights(imageReliefHeights(prepared.gray, prepared.width, prepared.height, settings), prepared.width, prepared.height);
  }, [prepared, settings, view]);

  if (!pending || !prepared || !settings) return null;
  const height = width / aspect;
  const close = () => {
    useAppStore.getState().openDialog(null);
    useImageRelief.getState().set(null);
  };
  const tooBig = width > material.width + 1e-6 || height > material.height + 1e-6;
  const setP = (p: Partial<ImagePrep>) => setPrep((x) => ({ ...x, ...p }));

  return (
    <Dialog
      open={open}
      onClose={close}
      title={ti.title}
      width="max-w-4xl"
      footer={
        <>
          <p className="flex-1 text-2xs text-muted">{tooBig ? t.relief.tooBig : depth > material.thickness ? t.relief.tooDeep(material.thickness) : ti.footer}</p>
          <button className="btn" onClick={close}>
            {t.common.cancel}
          </button>
          <button
            className="btn btn-primary"
            disabled={tooBig}
            onClick={() => {
              addImageRelief(pending.fileName, prepared, settings, { width, height: Math.round(height * 100) / 100, depth });
              if (mirror) {
                const s = useAppStore.getState();
                const last = s.reliefs[s.reliefs.length - 1];
                if (last) s.updateRelief(last.id, { mirror: true });
              }
              close();
            }}
          >
            {t.relief.add}
          </button>
        </>
      }
    >
      <div className="grid gap-4 p-4 md:grid-cols-[1fr_310px]">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              label={ti.view}
              value={view}
              options={[
                { value: 'crop', label: ti.views.crop },
                { value: 'result', label: ti.views.result },
                { value: 'relief', label: ti.views.relief },
              ]}
              onChange={setView}
            />
            {view === 'crop' && (
              <div className="flex items-center gap-1">
                <button className="btn h-7 px-2" onClick={() => setAngle(angle - 90)} title={ti.rotateLeft} aria-label={ti.rotateLeft}>
                  <RotateCcw size={13} />
                </button>
                <button className="btn h-7 px-2" onClick={() => setAngle(angle + 90)} title={ti.rotateRight} aria-label={ti.rotateRight}>
                  <RotateCw size={13} />
                </button>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={0.5}
                  value={angle}
                  onChange={(e) => setAngle(Number(e.target.value))}
                  className="h-7 w-40 accent-[rgb(var(--c-accent))]"
                  aria-label={ti.angle}
                  title={ti.angle}
                />
                <AngleInput value={angle} onChange={setAngle} label={ti.angle} />
                <button className="btn h-7 px-2 text-2xs" onClick={() => setAngle(0)} disabled={angle === 0} title={ti.rotateResetDesc}>
                  <Undo2 size={12} /> {ti.rotateReset}
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center justify-center rounded-lg bg-app p-2">
            {/* Döljs i stället för att tas bort, så att beskärningen finns kvar mellan vyerna. */}
            <div className={view === 'crop' ? 'w-full' : 'hidden'}>
              <ImageCropper src={originalUrl} angle={angle} onResult={(c) => setSource(canvasToSource(c, pending.fileName))} />
            </div>
            {view === 'result' && <img src={resultUrl} alt="" className="max-h-[48vh] w-full object-contain" />}
            {view === 'relief' && (
              <img src={reliefUrl} alt={t.relief.previewAlt(pending.fileName)} className="max-h-[48vh] w-full object-contain" style={{ transform: mirror ? 'scaleX(-1)' : undefined }} />
            )}
          </div>
          {view === 'crop' && <p className="text-2xs text-muted">{ti.cropHint}</p>}
          <p className="text-xs">
            <span className="font-medium">{ti.detected(ti.kinds[prepared.analysis.kind])}</span> <span className="text-muted">{ti.why[prepared.analysis.kind]}</span>
          </p>
        </div>
        <div className="space-y-2.5">
          <div className="space-y-2.5 rounded-lg border border-line p-2.5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-semibold">{ti.prepare}</h3>
              {!(prep.removeBackground && prep.blackWhite) && (
                <button className="btn h-7 px-2 text-2xs" onClick={() => setP({ removeBackground: true, blackWhite: true, threshold: null })} title={ti.paperDesc}>
                  <Wand2 size={12} /> {ti.paper}
                </button>
              )}
            </div>
            <FieldRow label={ti.removeBackground}>
              <Switch checked={prep.removeBackground} onChange={(removeBackground) => setP({ removeBackground })} label={ti.removeBackground} />
            </FieldRow>
            <FieldRow label={ti.blackWhite}>
              <Switch checked={prep.blackWhite} onChange={(blackWhite) => setP({ blackWhite, threshold: null })} label={ti.blackWhite} />
            </FieldRow>
            {prep.blackWhite && (
              <FieldRow label={ti.threshold}>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={1}
                    max={254}
                    value={prepared.threshold}
                    onChange={(e) => setP({ threshold: Number(e.target.value) })}
                    className="h-7 min-w-0 flex-1 accent-[rgb(var(--c-accent))]"
                    aria-label={ti.threshold}
                  />
                  <button className={`btn h-6 shrink-0 px-1.5 text-2xs ${prep.threshold === null ? 'btn-primary' : ''}`} onClick={() => setP({ threshold: null })} title={ti.autoDesc}>
                    {ti.auto}
                  </button>
                </div>
              </FieldRow>
            )}
            <p className="text-2xs leading-relaxed text-muted">{prep.removeBackground || prep.blackWhite ? ti.prepNote : ti.paperDesc}</p>
          </div>
          <ImageReliefFields settings={settings} detected={prepared.analysis.kind} lightBackground={prepared.analysis.lightBackground} onChange={setSettings} />
          <div className="space-y-2.5 border-t border-line pt-2.5">
            <NumberField label={t.props.width} unit="mm" step={5} min={5} value={width} onChange={setWidth} />
            <FieldRow label={t.props.height}>
              <p className="text-xs tabular-nums">{height.toLocaleString(t.locale, { maximumFractionDigits: 1 })} mm</p>
            </FieldRow>
            <NumberField label={ti.depth} unit="mm" step={0.5} min={0.2} value={depth} onChange={setDepth} />
            <FieldRow label={ti.mirror}>
              <Switch checked={mirror} onChange={setMirror} label={ti.mirror} />
            </FieldRow>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
