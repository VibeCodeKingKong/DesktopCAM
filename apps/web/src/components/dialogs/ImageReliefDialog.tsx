import { useEffect, useMemo, useRef, useState } from 'react';
import { Wand2 } from 'lucide-react';
import { imageReliefHeights, type CropRect, type ImageReliefKind, type ImageReliefSettings } from '@desktopcam/core';
import { useAppStore } from '../../store/useAppStore';
import { addImageRelief, imageReliefPreset, prepareImage, processedFull, useImageRelief, type ImagePrep } from '../../cam/imageRelief';
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
      <NumberField label={ti.contrast} step={0.1} min={0.5} max={3} value={settings.contrast} onChange={(contrast) => set({ contrast })} />
      <NumberField label={ti.gamma} step={0.1} min={0.3} max={3} value={settings.gamma} onChange={(gamma) => set({ gamma })} />
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

/** Bilden med beskärningsruta: dra för att välja en del. */
function CropView({ src, w, h, crop, onCrop, hint }: { src: string; w: number; h: number; crop: CropRect | null; onCrop: (c: CropRect | null) => void; hint: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<CropRect | null>(null);
  const toImg = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: Math.min(w, Math.max(0, ((e.clientX - r.left) / r.width) * w)), y: Math.min(h, Math.max(0, ((e.clientY - r.top) / r.height) * h)) };
  };
  const rect = (a: { x: number; y: number }, b: { x: number; y: number }): CropRect => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) });
  const shown = drag ?? crop;
  const aspect = w / h;
  return (
    <div
      ref={ref}
      className="relative mx-auto cursor-crosshair touch-none select-none overflow-hidden rounded-md"
      style={{ width: `min(100%, calc(52vh * ${aspect}))`, aspectRatio: `${w} / ${h}` }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        start.current = toImg(e);
        setDrag(null);
      }}
      onPointerMove={(e) => start.current && setDrag(rect(start.current, toImg(e)))}
      onPointerUp={(e) => {
        if (!start.current) return;
        const r = rect(start.current, toImg(e));
        start.current = null;
        setDrag(null);
        // Ett klick utan att dra tar bort beskärningen.
        onCrop(r.w > w * 0.02 && r.h > h * 0.02 ? r : null);
      }}
      title={hint}
    >
      <img src={src} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" />
      {shown && (
        <div
          className="pointer-events-none absolute border-2 border-dashed border-white"
          style={{
            left: `${(shown.x / w) * 100}%`,
            top: `${(shown.y / h) * 100}%`,
            width: `${(shown.w / w) * 100}%`,
            height: `${(shown.h / h) * 100}%`,
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.5)',
          }}
        />
      )}
    </div>
  );
}

/** Bild till relief: förbehandling, förhandsvisning och inställningar innan reliefen placeras. */
export function ImageReliefDialog() {
  const t = useT();
  const ti = t.imageRelief;
  const open = useAppStore((s) => s.dialog === 'imageRelief');
  const material = useAppStore((s) => s.material);
  const pending = useImageRelief((s) => s.pending);
  const [prep, setPrep] = useState<ImagePrep>({ crop: null, removeBackground: false, blackWhite: false, threshold: null });
  const [view, setView] = useState<'image' | 'relief'>('image');
  const [settings, setSettings] = useState<ImageReliefSettings | null>(null);
  const [width, setWidth] = useState(100);
  const [depth, setDepth] = useState(4);
  const [mirror, setMirror] = useState(false);
  const lastKind = useRef<string>('');

  // Ny bild: börja om.
  useEffect(() => {
    if (!pending) return;
    setPrep({ crop: null, removeBackground: false, blackWhite: false, threshold: null });
    setView('image');
    setMirror(false);
    lastKind.current = '';
  }, [pending]);

  const prepared = useMemo(() => (pending ? prepareImage(pending, prep) : null), [pending, prep]);

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

  const imageUrl = useMemo(() => {
    if (!pending) return '';
    if (!prep.removeBackground && !prep.blackWhite) return toDataUrl(pending.width, pending.height, null, pending.rgba);
    return toDataUrl(pending.width, pending.height, processedFull(pending, prep).gray, null);
  }, [pending, prep.removeBackground, prep.blackWhite, prep.threshold, prep.crop]);

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
          <div className="flex items-center gap-2">
            <Segmented
              label={ti.view}
              value={view}
              options={[
                { value: 'image', label: ti.views.image },
                { value: 'relief', label: ti.views.relief },
              ]}
              onChange={setView}
            />
            {view === 'image' && (
              <>
                <p className="min-w-0 flex-1 text-2xs text-muted">{ti.cropHint}</p>
                {prep.crop && (
                  <button className="btn h-7 shrink-0 px-2 text-2xs" onClick={() => setP({ crop: null })}>
                    {ti.cropReset}
                  </button>
                )}
              </>
            )}
          </div>
          <div className="flex items-center justify-center rounded-lg bg-app p-2">
            {view === 'image' ? (
              <CropView src={imageUrl} w={pending.width} h={pending.height} crop={prep.crop} onCrop={(crop) => setP({ crop })} hint={ti.cropHint} />
            ) : (
              <img src={reliefUrl} alt={t.relief.previewAlt(pending.fileName)} className="max-h-[52vh] w-full object-contain" style={{ transform: mirror ? 'scaleX(-1)' : undefined }} />
            )}
          </div>
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
