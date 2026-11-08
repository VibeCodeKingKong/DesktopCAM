import type { ReactNode } from 'react';
import { Download, RefreshCw, Trash2 } from 'lucide-react';
import type { CutSide, DitherMethod, ReliefInstance, ToolpathConfig } from '@desktopcam/core';
import { useAppStore, useMaterialPreset, useSelectedRelief, useSelectedToolpath } from '../../store/useAppStore';
import { computeToolpath, scheduleCompute } from '../../cam/toolpathService';
import { createToolpath, exportSelectedGcode } from '../../cam/commands';
import { FieldRow, NumberField, Segmented, SelectField, Switch } from '../ui/Field';
import { duration, mm } from '../../utils/format';

const SIDES: { value: CutSide; label: string }[] = [
  { value: 'outside', label: 'Utsida' },
  { value: 'inside', label: 'Insida' },
  { value: 'on', label: 'På linjen' },
];

const DITHERS: { value: DitherMethod; label: string }[] = [
  { value: 'floyd-steinberg', label: 'Floyd–Steinberg' },
  { value: 'ordered', label: 'Ordnad (halvton)' },
  { value: 'threshold', label: 'Tröskel' },
];

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="space-y-2 border-b border-line px-3 py-3 last:border-b-0">
      <legend className="sr-only">{title}</legend>
      <p className="text-2xs font-semibold text-muted">{title}</p>
      {children}
    </fieldset>
  );
}

export function PropertiesPanel() {
  const tp = useSelectedToolpath();
  const relief = useSelectedRelief();
  return (
    <aside className="hidden w-72 shrink-0 flex-col border-l border-line bg-surface lg:flex" aria-label="Inställningar">
      <div className="panel-heading">{tp ? 'Inställningar för verktygsbana' : relief ? 'Relief' : 'Inställningar'}</div>
      <div className="flex-1 overflow-y-auto">
        {tp ? <ToolpathEditor tp={tp} /> : relief ? <ReliefEditor relief={relief} /> : <EmptyState />}
      </div>
    </aside>
  );
}

/** Placering och djup för en relief. Ändringar räknar om banor som använder den. */
function ReliefEditor({ relief }: { relief: ReliefInstance }) {
  const update = useAppStore((s) => s.updateRelief);
  const remove = useAppStore((s) => s.removeRelief);
  const toolpaths = useAppStore((s) => s.toolpaths);
  const material = useAppStore((s) => s.material);
  const patch = (p: Partial<ReliefInstance>) => {
    update(relief.id, p);
    toolpaths.filter((t) => t.operation === 'relief' && t.reliefId === relief.id).forEach((t) => scheduleCompute(t.id, 500));
  };
  return (
    <div>
      <Group title="Allmänt">
        <FieldRow label="Namn">
          <input className="field" value={relief.name} onChange={(e) => update(relief.id, { name: e.target.value })} />
        </FieldRow>
        <FieldRow label="Visa">
          <Switch checked={relief.visible} onChange={(visible) => update(relief.id, { visible })} label="Visa relief" />
        </FieldRow>
      </Group>
      <Group title="Placering">
        <NumberField label="X" unit="mm" value={relief.x} onChange={(x) => patch({ x })} />
        <NumberField label="Y" unit="mm" value={relief.y} onChange={(y) => patch({ y })} />
        <NumberField label="Bredd" unit="mm" min={5} value={relief.width} onChange={(width) => patch({ width })} />
        <NumberField label="Höjd" unit="mm" min={5} value={relief.height} onChange={(height) => patch({ height })} />
        <button
          className="btn w-full"
          onClick={() => patch({ x: (material.width - relief.width) / 2, y: (material.height - relief.height) / 2 })}
        >
          Centrera på materialet
        </button>
      </Group>
      <Group title="Form">
        <NumberField label="Djup" unit="mm" min={0.2} step={0.5} value={relief.depth} hint="reliefDepth" onChange={(depth) => patch({ depth })} />
        <FieldRow label="Invertera">
          <Switch checked={relief.invert} onChange={(invert) => patch({ invert })} label="Invertera" />
        </FieldRow>
        <FieldRow label="Spegla">
          <Switch checked={relief.mirror} onChange={(mirror) => patch({ mirror })} label="Spegla" />
        </FieldRow>
        {relief.depth > material.thickness && (
          <p className="rounded-md bg-warn/10 px-2 py-1.5 text-xs text-warn">Djupare än materialet ({material.thickness} mm).</p>
        )}
      </Group>
      <Group title="Bearbetning">
        <div className="flex gap-2">
          <button className="btn btn-primary flex-1" onClick={() => createToolpath('relief')}>
            Skapa 3D-bana
          </button>
          <button className="btn" onClick={() => remove(relief.id)} title="Ta bort relief" aria-label="Ta bort relief">
            <Trash2 size={13} />
          </button>
        </div>
      </Group>
    </div>
  );
}

function EmptyState() {
  const preset = useMaterialPreset();
  const selected = useAppStore((s) => s.selectedShapeIds.length);
  return (
    <div className="space-y-4 p-4 text-xs leading-relaxed">
      <p className="text-muted">
        {selected
          ? `${selected} ${selected === 1 ? 'form markerad' : 'former markerade'}. Välj en operation under fliken Verktygsbanor.`
          : 'Ingen verktygsbana vald. Markera former i projektträdet och välj Profil eller Laserskärning, eller välj en bana i listan.'}
      </p>
      <div className="rounded-lg border border-line bg-app p-3">
        <p className="mb-1.5 font-semibold">Tips för {preset.name.toLowerCase()}</p>
        <ul className="list-disc space-y-1 pl-4 text-muted">
          {preset.tips.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function ToolpathEditor({ tp }: { tp: ToolpathConfig }) {
  const tools = useAppStore((s) => s.tools);
  const update = useAppStore((s) => s.updateToolpath);
  const remove = useAppStore((s) => s.removeToolpath);
  const result = useAppStore((s) => s.results[tp.id]);
  const busy = useAppStore((s) => !!s.progress[tp.id]);
  const error = useAppStore((s) => s.errors[tp.id]);
  const engine = useAppStore((s) => s.engine);

  const patch = (p: Partial<ToolpathConfig>) => {
    update(tp.id, p);
    scheduleCompute(tp.id);
  };
  const param = (p: Partial<ToolpathConfig['params']>) => patch({ params: { ...tp.params, ...p } });
  const isLaser = tp.operation === 'laserCut' || tp.operation === 'laserRaster';
  const toolFilter = (kind: string) =>
    isLaser ? kind === 'laser' : tp.operation === 'relief' ? kind === 'ballnose' || kind === 'endmill' || kind === 'vbit' : kind !== 'laser';

  return (
    <div>
      <Group title="Allmänt">
        <FieldRow label="Namn">
          <input className="field" value={tp.name} onChange={(e) => update(tp.id, { name: e.target.value })} />
        </FieldRow>
        <SelectField
          label="Verktyg"
          value={tp.toolId}
          options={tools.filter((t) => toolFilter(t.kind)).map((t) => ({ value: t.id, label: t.name }))}
          onChange={(toolId) => patch({ toolId })}
        />
        {(tp.operation === 'profile' || tp.operation === 'laserCut') && (
          <FieldRow label="Sida" hint="cutSide">
            <Segmented label="Sida" value={tp.side} options={SIDES} onChange={(side) => patch({ side })} />
          </FieldRow>
        )}
      </Group>

      {tp.operation === 'profile' && (
        <>
          <Group title="Djup">
            <NumberField label="Skärdjup" unit="mm" step={0.5} min={0} value={tp.cutDepth} hint="cutDepth" onChange={(cutDepth) => patch({ cutDepth })} />
            <NumberField label="Djup per pass" unit="mm" step={0.1} min={0.05} value={tp.params.stepDown} hint="stepDown" onChange={(stepDown) => param({ stepDown })} />
          </Group>
          <Group title="Hastighet">
            <NumberField label="Matning" unit="mm/min" step={50} min={1} value={tp.params.feedRate} hint="feedRate" onChange={(feedRate) => param({ feedRate })} />
            <NumberField label="Nedmatning" unit="mm/min" step={25} min={1} value={tp.params.plungeRate} hint="plungeRate" onChange={(plungeRate) => param({ plungeRate })} />
            <NumberField label="Spindel" unit="rpm" step={1000} min={0} value={tp.params.spindleRpm ?? 18000} hint="spindleRpm" onChange={(spindleRpm) => param({ spindleRpm })} />
          </Group>
        </>
      )}

      {tp.operation === 'relief' && (
        <>
          <Group title="3D-bearbetning">
            <NumberField
              label="Sidosteg"
              unit="%"
              step={1}
              min={2}
              max={60}
              value={Math.round(tp.params.stepOver * 1000) / 10}
              hint="reliefStepOver"
              onChange={(pct) => param({ stepOver: pct / 100 })}
            />
            <FieldRow label="Riktning">
              <Segmented
                label="Riktning"
                value={tp.direction}
                options={[
                  { value: 'x', label: 'Längs X' },
                  { value: 'y', label: 'Längs Y' },
                ]}
                onChange={(direction) => patch({ direction })}
              />
            </FieldRow>
            <FieldRow label="Grovbearbetning" hint="roughing">
              <Switch checked={tp.roughing} onChange={(roughing) => patch({ roughing })} label="Grovbearbetning" />
            </FieldRow>
            {tp.roughing && (
              <>
                <NumberField label="Djup per pass" unit="mm" step={0.1} min={0.1} value={tp.params.stepDown} hint="stepDown" onChange={(stepDown) => param({ stepDown })} />
                <NumberField label="Lämna material" unit="mm" step={0.05} min={0} max={2} value={tp.allowance} hint="allowance" onChange={(allowance) => patch({ allowance })} />
              </>
            )}
          </Group>
          <Group title="Hastighet">
            <NumberField label="Matning" unit="mm/min" step={50} min={1} value={tp.params.feedRate} hint="feedRate" onChange={(feedRate) => param({ feedRate })} />
            <NumberField label="Nedmatning" unit="mm/min" step={25} min={1} value={tp.params.plungeRate} hint="plungeRate" onChange={(plungeRate) => param({ plungeRate })} />
            <NumberField label="Spindel" unit="rpm" step={1000} min={0} value={tp.params.spindleRpm ?? 18000} hint="spindleRpm" onChange={(spindleRpm) => param({ spindleRpm })} />
          </Group>
        </>
      )}

      {tp.operation === 'laserCut' && (
        <Group title="Laser">
          <NumberField label="Hastighet" unit="mm/min" step={50} min={1} value={tp.params.feedRate} hint="laserSpeed" onChange={(feedRate) => param({ feedRate })} />
          <NumberField label="Effekt" unit="%" step={5} min={0} max={100} value={tp.params.laserPowerPct ?? 100} hint="laserPower" onChange={(laserPowerPct) => param({ laserPowerPct })} />
          <NumberField label="Antal pass" step={1} min={1} max={20} value={tp.passes} hint="passes" onChange={(passes) => patch({ passes: Math.round(passes) })} />
          <NumberField label="Kerf" unit="mm" step={0.01} min={0} max={1} value={tp.kerf} hint="kerf" onChange={(kerf) => patch({ kerf })} />
        </Group>
      )}

      {tp.operation === 'laserRaster' && (
        <>
          <Group title="Bild">
            <NumberField label="Bredd" unit="mm" step={5} min={5} value={tp.widthMm} onChange={(widthMm) => patch({ widthMm })} />
            <NumberField label="Position X" unit="mm" step={1} value={tp.origin.x} onChange={(x) => patch({ origin: { ...tp.origin, x } })} />
            <NumberField label="Position Y" unit="mm" step={1} value={tp.origin.y} onChange={(y) => patch({ origin: { ...tp.origin, y } })} />
            <NumberField label="Linjeavstånd" unit="mm" step={0.01} min={0.05} max={1} value={tp.lineIntervalMm} hint="lineInterval" onChange={(lineIntervalMm) => patch({ lineIntervalMm })} />
            <SelectField label="Dithering" value={tp.dither} options={DITHERS} hint="dither" onChange={(dither) => patch({ dither })} />
            <NumberField label="Tröskel" step={4} min={1} max={254} value={tp.threshold} onChange={(threshold) => patch({ threshold: Math.round(threshold) })} />
          </Group>
          <Group title="Laser">
            <NumberField label="Hastighet" unit="mm/min" step={100} min={1} value={tp.params.feedRate} hint="laserSpeed" onChange={(feedRate) => param({ feedRate })} />
            <NumberField label="Effekt" unit="%" step={5} min={0} max={100} value={tp.params.laserPowerPct ?? 30} hint="laserPower" onChange={(laserPowerPct) => param({ laserPowerPct })} />
          </Group>
        </>
      )}

      <Group title="Resultat">
        {error && <p className="rounded-md bg-warn/10 px-2 py-1.5 text-xs text-warn">{error}</p>}
        {result && (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted">Skärlängd</dt>
            <dd className="text-right tabular-nums">{mm(result.stats.cutLengthMm, 0)}</dd>
            <dt className="text-muted">Uppskattad tid</dt>
            <dd className="text-right tabular-nums">{duration(result.stats.estimatedSeconds)}</dd>
            <dt className="text-muted">Rader G-kod</dt>
            <dd className="text-right tabular-nums">{result.stats.lineCount.toLocaleString('sv-SE')}</dd>
            <dt className="text-muted">Beräknad av</dt>
            <dd className="text-right">{result.engine === 'wasm' ? `Wasm ${engine?.version ?? ''}` : 'TypeScript'}</dd>
          </dl>
        )}
        <div className="flex gap-2 pt-1">
          <button className="btn btn-primary flex-1" onClick={() => void computeToolpath(tp.id)} disabled={busy}>
            <RefreshCw size={13} className={busy ? 'animate-spin' : ''} />
            {busy ? 'Beräknar' : 'Beräkna'}
          </button>
          <button className="btn" onClick={exportSelectedGcode} disabled={!result} title="Spara G-kod">
            <Download size={13} />
          </button>
          <button className="btn" onClick={() => remove(tp.id)} title="Ta bort verktygsbana" aria-label="Ta bort verktygsbana">
            <Trash2 size={13} />
          </button>
        </div>
      </Group>
    </div>
  );
}
