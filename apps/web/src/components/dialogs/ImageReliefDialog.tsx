import { useEffect, useMemo, useState } from 'react';
import { imageReliefHeights, type ImageReliefKind, type ImageReliefSettings } from '@desktopcam/core';
import { useAppStore } from '../../store/useAppStore';
import { addImageRelief, imageReliefPreset, useImageRelief } from '../../cam/imageRelief';
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

/** Bild till relief: förhandsvisning och inställningar innan reliefen placeras. */
export function ImageReliefDialog() {
  const t = useT();
  const ti = t.imageRelief;
  const open = useAppStore((s) => s.dialog === 'imageRelief');
  const material = useAppStore((s) => s.material);
  const pending = useImageRelief((s) => s.pending);
  const [settings, setSettings] = useState<ImageReliefSettings | null>(null);
  const [width, setWidth] = useState(100);
  const [depth, setDepth] = useState(4);
  const [mirror, setMirror] = useState(false);

  // Ny bild: inställningar från analysen och en storlek som ryms på materialet.
  useEffect(() => {
    if (!pending) return;
    setSettings(imageReliefPreset(pending.analysis.kind, pending.analysis.lightBackground));
    const aspect = pending.width / pending.height;
    const w = Math.min(material.width * 0.8, material.height * 0.8 * aspect);
    setWidth(Math.round(w));
    setDepth(Math.min(pending.analysis.kind === 'photo' ? 3 : 4, Math.max(0.5, material.thickness / 3)));
    setMirror(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  const preview = useMemo(() => {
    if (!pending || !settings) return '';
    const hm = imageReliefHeights(pending.gray, pending.width, pending.height, settings);
    return shadeHeights(hm, pending.width, pending.height);
  }, [pending, settings]);

  if (!pending || !settings) return null;
  const aspect = pending.width / pending.height;
  const height = width / aspect;
  const close = () => {
    useAppStore.getState().openDialog(null);
    useImageRelief.getState().set(null);
  };
  const tooBig = width > material.width + 1e-6 || height > material.height + 1e-6;

  return (
    <Dialog
      open={open}
      onClose={close}
      title={ti.title}
      width="max-w-3xl"
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
              addImageRelief(pending, settings, { width, height: Math.round(height * 100) / 100, depth });
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
      <div className="grid gap-4 p-4 md:grid-cols-[1fr_300px]">
        <div className="space-y-2">
          <div className="flex items-center justify-center rounded-lg bg-app p-2">
            <img src={preview} alt={t.relief.previewAlt(pending.fileName)} className="max-h-[52vh] w-full object-contain" style={{ transform: mirror ? 'scaleX(-1)' : undefined, imageRendering: 'auto' }} />
          </div>
          <p className="text-xs">
            <span className="font-medium">{ti.detected(ti.kinds[pending.analysis.kind])}</span> <span className="text-muted">{ti.why[pending.analysis.kind]}</span>
          </p>
        </div>
        <div className="space-y-2.5">
          <ImageReliefFields settings={settings} detected={pending.analysis.kind} lightBackground={pending.analysis.lightBackground} onChange={setSettings} />
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
