/** Inställningarna för bild till relief – delas av dialogen och egenskapspanelen (utan bildbeskärningen, som laddas först i dialogen). */
import type { ImageReliefKind, ImageReliefSettings } from '@desktopcam/core';
import { useExpert } from '../../store/useAppStore';
import { imageReliefPreset } from '../../cam/imageRelief';
import { useT } from '../../i18n';
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
      <div className="space-y-2.5 border-t border-line pt-2.5">
        <FieldRow label={ti.bump} hint="bumpMap">
          <Switch checked={(settings.bump ?? 0) > 0} onChange={(on) => set({ bump: on ? 0.4 : 0, bumpSize: settings.bumpSize ?? 4 })} label={ti.bump} />
        </FieldRow>
        {(settings.bump ?? 0) > 0 && (
          <>
            <NumberField label={ti.bumpStrength} unit="%" step={5} min={5} max={100} value={Math.round((settings.bump ?? 0) * 100)} onChange={(pct) => set({ bump: pct / 100 })} />
            <NumberField label={ti.bumpSize} unit="px" step={1} min={1} max={20} value={settings.bumpSize ?? 4} onChange={(bumpSize) => set({ bumpSize })} />
          </>
        )}
      </div>
    </div>
  );
}
