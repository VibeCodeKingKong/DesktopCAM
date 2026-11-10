import { useEffect, useState } from 'react';
import { CheckCircle2, Pencil, Plus, Trash2 } from 'lucide-react';
import { uid, type FirmwareFlavor, type MachineProfile, type ToolDefinition, type ToolKind } from '@desktopcam/core';
import { useAppStore } from '../../store/useAppStore';
import { toolName, useT } from '../../i18n';
import { Dialog } from '../ui/Dialog';
import { FieldRow, NumberField, SelectField, Switch } from '../ui/Field';
import { IlluMachine } from '../smartguide/illustrations';

type Step = 'preset' | 'post' | 'tools';
const STEP_ORDER: Step[] = ['preset', 'post', 'tools'];

/** Maskininställning i tre steg: maskin, postprocessor och verktygsbibliotek. */
export function MachineSetupDialog() {
  const t = useT();
  const open = useAppStore((s) => s.dialog === 'machineSetup');
  const close = () => useAppStore.getState().openDialog(null);
  const machines = useAppStore((s) => s.machines);
  const machineId = useAppStore((s) => s.machineId);
  const saveMachine = useAppStore((s) => s.saveMachine);

  const [step, setStep] = useState<Step>('preset');
  const [draft, setDraft] = useState<MachineProfile>(() => machines.find((m) => m.id === machineId) ?? machines[0]);

  useEffect(() => {
    if (open) {
      setDraft(structuredClone(machines.find((m) => m.id === machineId) ?? machines[0]));
      setStep('preset');
    }
  }, [open, machineId, machines]);

  const set = (p: Partial<MachineProfile>) => setDraft((d) => ({ ...d, ...p }));
  const setPost = (p: Partial<MachineProfile['postprocessor']>) => setDraft((d) => ({ ...d, postprocessor: { ...d.postprocessor, ...p } }));
  const apply = () => {
    saveMachine(draft);
    useAppStore.getState().setStatus(t.status.machine(draft.name));
  };
  const stepIndex = STEP_ORDER.indexOf(step);
  const stepLabel = (s: Step) => t.machine.steps[s];

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t.machine.title}
      actions={
        <button className="btn border-accent/40 text-accent sm:ml-2" onClick={() => setDraft({ ...structuredClone(draft), id: uid('machine'), name: t.machine.custom(draft.name) })}>
          <Plus size={13} /> {t.machine.newProfile}
        </button>
      }
      footer={
        <>
          <button className="btn" onClick={close}>
            {t.common.cancel}
          </button>
          <button className="btn btn-primary" onClick={apply}>
            {t.common.apply}
          </button>
          <div className="flex-1" />
          {stepIndex < STEP_ORDER.length - 1 ? (
            <button className="btn btn-primary" onClick={() => setStep(STEP_ORDER[stepIndex + 1])}>
              {t.machine.next(stepLabel(STEP_ORDER[stepIndex + 1]).replace(/^\d\.\s/, ''))}
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => {
                apply();
                close();
              }}
            >
              {t.common.done}
            </button>
          )}
        </>
      }
    >
      <nav className="flex gap-1 overflow-x-auto border-b border-line px-3 sm:px-5" role="tablist">
        {STEP_ORDER.map((s) => (
          <button
            key={s}
            role="tab"
            aria-selected={s === step}
            onClick={() => setStep(s)}
            className={`relative shrink-0 px-3 py-2.5 text-xs ${s === step ? 'font-semibold text-accent' : 'text-muted hover:text-ink'}`}
          >
            {stepLabel(s)}
            {s === step && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />}
          </button>
        ))}
      </nav>

      {step === 'preset' && (
        <div className="space-y-5 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {machines.map((m) => {
              const active = m.id === draft.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setDraft(structuredClone(m))}
                  aria-pressed={active}
                  className={`flex gap-3 rounded-lg border p-3 text-left transition-colors ${active ? 'border-accent bg-accent/5 ring-1 ring-accent' : 'border-line bg-raised hover:border-muted/50'}`}
                >
                  <div className="h-20 w-28 shrink-0 rounded-md bg-app p-1">
                    <IlluMachine kind={m.kind} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold leading-snug">{m.name}</p>
                      {active && <CheckCircle2 size={16} className="shrink-0 text-accent" />}
                    </div>
                    <p className="text-muted">{m.kind === 'laser' ? t.machine.kindLaser : t.machine.kindRouter}</p>
                    <p>{t.machine.workArea(m.workArea.x, m.workArea.y)}</p>
                    <p className="text-muted">{t.machine.controller(m.postprocessor.flavor === 'grbl' ? 'GRBL' : 'Marlin')}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <section className="rounded-lg border border-line bg-app/60 p-4">
            <h3 className="mb-3 text-sm font-semibold">{t.machine.configTitle}</h3>
            <div className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
              <FieldRow label={t.common.name}>
                <input className="field" value={draft.name} onChange={(e) => set({ name: e.target.value })} />
              </FieldRow>
              <SelectField
                label={t.machine.firmware}
                value={draft.postprocessor.flavor}
                options={[
                  { value: 'grbl', label: 'GRBL 1.1' },
                  { value: 'marlin', label: 'Marlin 2.1' },
                ] satisfies { value: FirmwareFlavor; label: string }[]}
                onChange={(flavor) => setPost({ flavor })}
              />
              <NumberField label={t.machine.areaX} unit="mm" value={draft.workArea.x} min={10} onChange={(x) => set({ workArea: { ...draft.workArea, x } })} />
              <NumberField label={t.machine.areaY} unit="mm" value={draft.workArea.y} min={10} onChange={(y) => set({ workArea: { ...draft.workArea, y } })} />
              {draft.kind === 'router' && <NumberField label={t.machine.areaZ} unit="mm" value={draft.workArea.z} min={0} onChange={(z) => set({ workArea: { ...draft.workArea, z } })} />}
              <NumberField label={t.machine.maxFeed} unit="mm/min" step={100} value={draft.maxFeed.xy} onChange={(xy) => set({ maxFeed: { ...draft.maxFeed, xy } })} />
              <SelectField
                label={t.machine.homing}
                value={draft.homing}
                options={[
                  { value: 'none', label: t.machine.homingOptions.none },
                  { value: 'xy', label: t.machine.homingOptions.xy },
                  { value: 'xyz', label: t.machine.homingOptions.xyz },
                ]}
                onChange={(homing) => set({ homing })}
              />
              {draft.laser && <NumberField label={t.machine.sMax} value={draft.laser.sMax} min={1} onChange={(sMax) => set({ laser: { ...draft.laser!, sMax } })} />}
            </div>
          </section>
        </div>
      )}

      {step === 'post' && (
        <div className="grid gap-5 p-4 sm:grid-cols-2 sm:p-5">
          <div className="space-y-2.5">
            <NumberField label={t.machine.decimals} value={draft.postprocessor.decimals} min={0} max={6} onChange={(decimals) => setPost({ decimals: Math.round(decimals) })} />
            {draft.kind === 'router' && <NumberField label={t.machine.safeZ} unit="mm" value={draft.postprocessor.safeZ} min={0} hint="safeZ" onChange={(safeZ) => setPost({ safeZ })} />}
            {draft.kind === 'laser' && (
              <FieldRow label={t.machine.dynamicPower}>
                <Switch checked={draft.postprocessor.laserDynamicPower} onChange={(laserDynamicPower) => setPost({ laserDynamicPower })} label={t.machine.dynamicPower} />
              </FieldRow>
            )}
            <p className="pt-2 text-xs leading-relaxed text-muted">{t.machine.postHint}</p>
          </div>
          <div className="space-y-3">
            {(['header', 'footer'] as const).map((key) => (
              <label key={key} className="block">
                <span className="mb-1 block text-xs text-muted">{key === 'header' ? t.machine.header : t.machine.footer}</span>
                <textarea
                  className="field h-24 resize-y py-1.5 font-mono"
                  value={draft.postprocessor[key].join('\n')}
                  onChange={(e) => setPost({ [key]: e.target.value.split('\n') })}
                  spellCheck={false}
                />
              </label>
            ))}
          </div>
        </div>
      )}

      {step === 'tools' && <ToolLibrary laser={draft.kind === 'laser'} />}
    </Dialog>
  );
}

/** Verktygsbiblioteket: lista + formulär för att ändra eller lägga till. */
function ToolLibrary({ laser }: { laser: boolean }) {
  const t = useT();
  const tools = useAppStore((s) => s.tools);
  const saveTool = useAppStore((s) => s.saveTool);
  const removeTool = useAppStore((s) => s.removeTool);
  const [editing, setEditing] = useState<ToolDefinition | null>(null);
  const list = tools.filter((x) => (laser ? x.kind === 'laser' : x.kind !== 'laser'));
  const kinds: ToolKind[] = laser ? ['laser'] : ['endmill', 'ballnose', 'vbit', 'drill'];

  const startNew = () =>
    setEditing({
      id: uid('tool'),
      name: t.machine.newToolName,
      kind: kinds[0],
      diameter: laser ? 0.1 : 3.175,
      units: 'mm',
      defaults: laser
        ? { feedRate: 600, plungeRate: 0, stepDown: 0, stepOver: 1, laserPowerPct: 100, passes: 1 }
        : { feedRate: 900, plungeRate: 250, spindleRpm: 18000, stepDown: 1.5, stepOver: 0.4 },
    });

  const set = (p: Partial<ToolDefinition>) => setEditing((e) => (e ? { ...e, ...p } : e));
  const setDef = (p: Partial<ToolDefinition['defaults']>) => setEditing((e) => (e ? { ...e, defaults: { ...e.defaults, ...p } } : e));

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full text-xs">
          <thead className="bg-app text-left text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">{t.machine.tool}</th>
              <th className="px-3 py-2 font-medium">{t.machine.type}</th>
              <th className="px-3 py-2 text-right font-medium">{t.machine.diameter}</th>
              <th className="px-3 py-2 text-right font-medium">{t.machine.feed}</th>
              <th className="w-16 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {list.map((x) => (
              <tr key={x.id} className={`border-t border-line ${editing?.id === x.id ? 'bg-accent/5' : ''}`}>
                <td className="px-3 py-2">{toolName(t, x.id, x.name)}</td>
                <td className="px-3 py-2 text-muted">
                  {t.machine.toolKinds[x.kind]}
                  {x.angle ? ` ${x.angle}°` : ''}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{x.diameter} mm</td>
                <td className="px-3 py-2 text-right tabular-nums">{x.defaults.feedRate}</td>
                <td className="px-2 py-1 text-right">
                  <button className="rounded p-1.5 text-muted hover:bg-app hover:text-ink" onClick={() => setEditing(structuredClone({ ...x, name: toolName(t, x.id, x.name) }))} aria-label={t.machine.editTool}>
                    <Pencil size={13} />
                  </button>
                  <button className="rounded p-1.5 text-muted hover:bg-app hover:text-warn" onClick={() => removeTool(x.id)} aria-label={t.common.remove} disabled={list.length <= 1}>
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing ? (
        <section className="space-y-2.5 rounded-lg border border-line bg-app/60 p-4">
          <h3 className="text-sm font-semibold">{t.machine.editTool}</h3>
          <div className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
            <FieldRow label={t.common.name}>
              <input className="field" value={editing.name} onChange={(e) => set({ name: e.target.value })} />
            </FieldRow>
            <SelectField label={t.machine.type} value={editing.kind} options={kinds.map((k) => ({ value: k, label: t.machine.toolKinds[k] }))} onChange={(kind) => set({ kind })} />
            <NumberField label={t.machine.diameter} unit="mm" step={0.1} min={0.01} value={editing.diameter} onChange={(diameter) => set({ diameter })} />
            {editing.kind === 'vbit' && <NumberField label={t.machine.angle} unit="°" step={5} min={10} max={170} value={editing.angle ?? 90} onChange={(angle) => set({ angle })} />}
            <NumberField label={t.machine.feed} unit="mm/min" step={50} min={1} value={editing.defaults.feedRate} onChange={(feedRate) => setDef({ feedRate })} />
            {!laser && (
              <>
                <NumberField label={t.props.plunge} unit="mm/min" step={25} min={1} value={editing.defaults.plungeRate} onChange={(plungeRate) => setDef({ plungeRate })} />
                <NumberField label={t.machine.stepDown} unit="mm" step={0.1} min={0.05} value={editing.defaults.stepDown} onChange={(stepDown) => setDef({ stepDown })} />
                <NumberField label={t.props.spindle} unit="rpm" step={1000} min={0} value={editing.defaults.spindleRpm ?? 18000} onChange={(spindleRpm) => setDef({ spindleRpm })} />
              </>
            )}
            {laser && <NumberField label={t.props.power} unit="%" step={5} min={0} max={100} value={editing.defaults.laserPowerPct ?? 100} onChange={(laserPowerPct) => setDef({ laserPowerPct })} />}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn" onClick={() => setEditing(null)}>
              {t.common.cancel}
            </button>
            <button
              className="btn btn-primary"
              onClick={() => {
                saveTool(editing);
                // Användarens namn ersätter det översatta standardnamnet.
                useAppStore.getState().setStatus(t.status.toolSaved(editing.name));
                setEditing(null);
              }}
            >
              {t.common.apply}
            </button>
          </div>
        </section>
      ) : (
        <button className="btn" onClick={startNew}>
          <Plus size={13} /> {t.machine.addTool}
        </button>
      )}
    </div>
  );
}
