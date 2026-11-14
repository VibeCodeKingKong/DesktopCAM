import { useEffect, useRef, useState } from 'react';
import { ToolIcon } from '../ui/ToolIcon';
import { cuttingLength } from '../../cam/toolReach';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { uid, type FirmwareFlavor, type MachineKind, type MachineProfile, type ToolDefinition, type ToolKind } from '@desktopcam/core';
import { toolFitsMachine, useAppStore, useExpert } from '../../store/useAppStore';
import { toolName, useT } from '../../i18n';
import { Dialog } from '../ui/Dialog';
import { FieldRow, GroupedOptions, NumberField, SelectField, Switch } from '../ui/Field';
import { IlluMachine } from '../smartguide/illustrations';

type Step = 'preset' | 'post' | 'tools';
const ALL_STEPS: Step[] = ['preset', 'post', 'tools'];

/** Maskininställning i tre steg: maskin, postprocessor och verktygsbibliotek. */
export function MachineSetupDialog() {
  const t = useT();
  const open = useAppStore((s) => s.dialog === 'machineSetup');
  const close = () => useAppStore.getState().openDialog(null);
  const machines = useAppStore((s) => s.machines);
  const machineId = useAppStore((s) => s.machineId);
  const saveMachine = useAppStore((s) => s.saveMachine);
  const expert = useExpert();
  const removeMachine = useAppStore((s) => s.removeMachine);
  const nameRef = useRef<HTMLInputElement>(null);
  const [justCreated, setJustCreated] = useState(false);

  const [step, setStep] = useState<Step>('preset');
  const [draft, setDraft] = useState<MachineProfile>(() => machines.find((m) => m.id === machineId) ?? machines[0]);

  // Läs in vald maskin när dialogen öppnas (inte vid varje ändring, så att steget behålls).
  useEffect(() => {
    if (open) {
      const s = useAppStore.getState();
      setDraft(structuredClone(s.machines.find((m) => m.id === s.machineId) ?? s.machines[0]));
      setStep(ALL_STEPS.includes(s.dialogStep as Step) ? (s.dialogStep as Step) : 'preset');
      setJustCreated(false);
    }
  }, [open]);

  /** Ny profil: kopia av vald maskin som sparas direkt, väljs och kan döpas om. */
  const createProfile = () => {
    const copy: MachineProfile = { ...structuredClone(draft), id: uid('machine'), name: t.machine.custom(draft.name), custom: true };
    saveMachine(copy);
    setDraft(copy);
    setStep('preset');
    setJustCreated(true);
    useAppStore.getState().setStatus(t.status.profileCreated(copy.name));
    setTimeout(() => {
      nameRef.current?.focus();
      nameRef.current?.select();
    }, 50);
  };
  const deleteProfile = () => {
    const name = draft.name;
    removeMachine(draft.id);
    const s = useAppStore.getState();
    setDraft(structuredClone(s.machines.find((m) => m.id === s.machineId) ?? s.machines[0]));
    setJustCreated(false);
    s.setStatus(t.status.profileDeleted(name));
  };
  const pick = (id: string) => {
    const m = machines.find((x) => x.id === id);
    if (m) setDraft(structuredClone(m));
    setJustCreated(false);
  };
  const groups: { label: string; items: MachineProfile[] }[] = [
    { label: t.machine.machineGroups.router, items: machines.filter((m) => !m.custom && m.kind === 'router') },
    { label: t.machine.machineGroups.laser, items: machines.filter((m) => !m.custom && m.kind === 'laser') },
    { label: t.machine.machineGroups.plasma, items: machines.filter((m) => !m.custom && m.kind === 'plasma') },
    { label: t.machine.machineGroups.custom, items: machines.filter((m) => m.custom) },
  ].filter((g) => g.items.length);

  const set = (p: Partial<MachineProfile>) => setDraft((d) => ({ ...d, ...p }));
  const setPost = (p: Partial<MachineProfile['postprocessor']>) => setDraft((d) => ({ ...d, postprocessor: { ...d.postprocessor, ...p } }));
  const apply = () => {
    saveMachine(draft);
    useAppStore.getState().setStatus(t.status.machine(draft.name));
  };
  // Postprocessorn är förinställd per maskin – i nybörjarläget visas den inte.
  const STEP_ORDER = expert ? ALL_STEPS : ALL_STEPS.filter((x) => x !== 'post');
  const stepIndex = STEP_ORDER.indexOf(step);
  const stepLabel = (s: Step) => t.machine.steps[s];

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t.machine.title}
      actions={
        <button className="btn border-accent/40 text-accent sm:ml-2" onClick={createProfile}>
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
          <label className="block">
            <span className="mb-1 block text-xs text-muted">{t.machine.select}</span>
            <select className="field h-9 cursor-pointer text-sm" value={draft.id} onChange={(e) => pick(e.target.value)}>
              <GroupedOptions groups={groups.map((g) => ({ label: g.label, options: g.items.map((m) => ({ value: m.id, label: `${m.name} · ${m.workArea.x} × ${m.workArea.y} mm` })) }))} />
            </select>
          </label>

          <div className={`flex gap-3 rounded-lg border p-3 ${justCreated ? 'border-accent bg-accent/5 ring-1 ring-accent' : 'border-line bg-raised'}`}>
            <div className="h-20 w-28 shrink-0 rounded-md bg-app p-1">
              <IlluMachine kind={draft.kind} />
            </div>
            <div className="min-w-0 flex-1 space-y-0.5 text-xs">
              <p className="text-sm font-semibold leading-snug">{draft.name}</p>
              <p className="text-muted">{draft.kind === 'laser' ? t.machine.kindLaser : draft.kind === 'plasma' ? t.machine.kindPlasma : t.machine.kindRouter}</p>
              <p>{t.machine.workArea(draft.workArea.x, draft.workArea.y)}</p>
              <p className="text-muted">{t.machine.controller(draft.postprocessor.flavor === 'grbl' ? 'GRBL' : 'Marlin')}</p>
              {t.machine.info[draft.id] && <p className="pt-1 leading-relaxed text-muted">{t.machine.info[draft.id]}</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <p className="min-w-0 flex-1 text-muted">{justCreated ? t.machine.newProfileHint : draft.custom ? t.machine.customNote : t.machine.builtInNote}</p>
            {draft.custom ? (
              <button className="btn text-warn" onClick={deleteProfile}>
                <Trash2 size={13} /> {t.machine.deleteProfile}
              </button>
            ) : (
              <button className="btn" onClick={createProfile}>
                <Plus size={13} /> {t.machine.newProfile}
              </button>
            )}
          </div>

          <section className="rounded-lg border border-line bg-app/60 p-4">
            <h3 className="mb-3 text-sm font-semibold">{t.machine.configTitle}</h3>
            <div className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
              <FieldRow label={t.common.name}>
                <input ref={nameRef} className="field" value={draft.name} onChange={(e) => set({ name: e.target.value })} />
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
              {draft.plasma && (
                <>
                  <FieldRow label={t.machine.plasmaZ}>
                    <Switch checked={draft.plasma.zAxis} onChange={(zAxis) => set({ plasma: { ...draft.plasma!, zAxis, ihs: zAxis && draft.plasma!.ihs } })} label={t.machine.plasmaZ} />
                  </FieldRow>
                  {draft.plasma.zAxis && (
                    <FieldRow label={t.machine.plasmaIhs} hint="plasmaIhs">
                      <Switch checked={draft.plasma.ihs} onChange={(ihs) => set({ plasma: { ...draft.plasma!, ihs } })} label={t.machine.plasmaIhs} />
                    </FieldRow>
                  )}
                  <NumberField label={t.machine.plasmaAmps} unit="A" step={5} min={10} value={draft.plasma.maxAmps} onChange={(maxAmps) => set({ plasma: { ...draft.plasma!, maxAmps } })} />
                </>
              )}
              {draft.laser && <NumberField label={t.machine.sMax} value={draft.laser.sMax} min={1} onChange={(sMax) => set({ laser: { ...draft.laser!, sMax } })} />}
            </div>
          </section>
        </div>
      )}

      {step === 'post' && (
        <div className="grid gap-5 p-4 sm:grid-cols-2 sm:p-5">
          <div className="space-y-2.5">
            <FieldRow label={t.machine.arcs} hint="gcodeArcs">
              <Switch checked={draft.postprocessor.arcs !== false} onChange={(arcs) => setPost({ arcs })} label={t.machine.arcs} />
            </FieldRow>
            <NumberField label={t.machine.decimals} value={draft.postprocessor.decimals} min={0} max={6} onChange={(decimals) => setPost({ decimals: Math.round(decimals) })} />
            {draft.kind === 'plasma' && (
              <>
                {(['torchOn', 'torchOff', 'thcOn', 'thcOff'] as const).map((key) => (
                  <FieldRow key={key} label={t.machine.plasmaCodes[key]}>
                    <input className="field font-mono" value={draft.postprocessor[key] ?? ''} placeholder={key === 'torchOn' ? 'M3 S1000' : key === 'torchOff' ? 'M5' : '–'} onChange={(e) => setPost({ [key]: e.target.value })} spellCheck={false} />
                  </FieldRow>
                ))}
                <p className="text-2xs leading-relaxed text-muted">{t.machine.plasmaCodesHint}</p>
              </>
            )}
            {draft.kind !== 'laser' && <NumberField label={t.machine.safeZ} unit="mm" value={draft.postprocessor.safeZ} min={0} hint="safeZ" onChange={(safeZ) => setPost({ safeZ })} />}
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

      {step === 'tools' && <ToolLibrary kind={draft.kind} />}
    </Dialog>
  );
}

/** Verktygsbiblioteket: lista + formulär för att ändra eller lägga till. */
function ToolLibrary({ kind }: { kind: MachineKind }) {
  const laser = kind === 'laser';
  const plasma = kind === 'plasma';
  /** Fräsverktyg har skär, längder och spindel – laser och plasma inte. */
  const router = kind === 'router';
  const t = useT();
  const tools = useAppStore((s) => s.tools);
  const saveTool = useAppStore((s) => s.saveTool);
  const removeTool = useAppStore((s) => s.removeTool);
  const [editing, setEditing] = useState<ToolDefinition | null>(null);
  const list = tools.filter((x) => toolFitsMachine(x.kind, kind));
  const kinds: ToolKind[] = laser ? ['laser'] : plasma ? ['plasma'] : ['endmill', 'ballnose', 'vbit', 'drill'];
  const beginner = useAppStore((s) => s.beginnerMode);
  const num = (n: number) => n.toLocaleString(t.locale, { maximumFractionDigits: 2 });
  const toolDims = (x: ToolDefinition) => {
    const parts = [`Ø ${num(x.diameter)}`];
    const cut = cuttingLength(x);
    if (router && cut) parts.push(`${t.machine.cutShort} ${num(cut)}`);
    if (router && x.stickout && !beginner) parts.push(`${t.machine.stickoutShort} ${num(x.stickout)}`);
    return `${parts.join(' · ')} mm`;
  };

  const startNew = () =>
    setEditing({
      id: uid('tool'),
      name: t.machine.newToolName,
      kind: kinds[0],
      diameter: laser ? 0.1 : plasma ? 1.5 : 3.175,
      units: 'mm',
      defaults: laser
        ? { feedRate: 600, plungeRate: 0, stepDown: 0, stepOver: 1, laserPowerPct: 100, passes: 1 }
        : plasma
          ? { feedRate: 2500, plungeRate: 1000, stepDown: 0, stepOver: 1 }
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
              <th className="w-10 px-2 py-2" />
              <th className="px-3 py-2 font-medium">{t.machine.tool}</th>
              <th className="px-3 py-2 font-medium">{t.machine.type}</th>
              <th className="px-3 py-2 font-medium">{t.machine.dimensions}</th>
              {router && <th className="px-3 py-2 text-right font-medium">{t.machine.flutes}</th>}
              <th className="px-3 py-2 text-right font-medium">{t.machine.feed}</th>
              <th className="w-16 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {list.map((x) => (
              <tr key={x.id} className={`border-t border-line ${editing?.id === x.id ? 'bg-accent/5' : ''}`}>
                <td className="px-2 py-1">
                  <ToolIcon tool={x} size={40} />
                </td>
                <td className="px-3 py-2">{toolName(t, x.id, x.name)}</td>
                <td className="px-3 py-2 text-muted">
                  {t.machine.toolKinds[x.kind]}
                  {x.angle ? ` ${x.angle}°` : ''}
                </td>
                <td className="px-3 py-2 tabular-nums text-muted">{toolDims(x)}</td>
                {router && <td className="px-3 py-2 text-right tabular-nums">{x.flutes ?? '–'}</td>}
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
          <div className="flex gap-4">
          <div className="hidden shrink-0 self-start rounded-lg bg-surface px-2 py-3 sm:block">
            <ToolIcon tool={editing} size={150} dimensions />
          </div>
          <div className="min-w-0 flex-1 space-y-2.5">
          <div className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
            <FieldRow label={t.common.name}>
              <input className="field" value={editing.name} onChange={(e) => set({ name: e.target.value })} />
            </FieldRow>
            <SelectField label={t.machine.type} value={editing.kind} options={kinds.map((k) => ({ value: k, label: t.machine.toolKinds[k] }))} onChange={(kind) => set({ kind })} />
            <NumberField label={plasma ? t.props.kerf : t.machine.diameter} unit="mm" step={0.1} min={0.01} value={editing.diameter} onChange={(diameter) => set({ diameter })} />
            {editing.kind === 'vbit' && <NumberField label={t.machine.angle} unit="°" step={5} min={10} max={170} value={editing.angle ?? 90} onChange={(angle) => set({ angle })} />}
            {router && <NumberField label={t.machine.flutes} step={1} min={1} max={8} value={editing.flutes ?? 2} onChange={(flutes) => set({ flutes: Math.round(flutes) })} />}
            <NumberField label={t.machine.feed} unit="mm/min" step={50} min={1} value={editing.defaults.feedRate} onChange={(feedRate) => setDef({ feedRate })} />
            {router && (
              <>
                <NumberField label={t.props.plunge} unit="mm/min" step={25} min={1} value={editing.defaults.plungeRate} onChange={(plungeRate) => setDef({ plungeRate })} />
                <NumberField label={t.machine.stepDown} unit="mm" step={0.1} min={0.05} value={editing.defaults.stepDown} onChange={(stepDown) => setDef({ stepDown })} />
                {!beginner && <NumberField label={t.props.spindle} unit="rpm" step={1000} min={0} value={editing.defaults.spindleRpm ?? 18000} onChange={(spindleRpm) => setDef({ spindleRpm })} />}
              </>
            )}
            {laser && <NumberField label={t.props.power} unit="%" step={5} min={0} max={100} value={editing.defaults.laserPowerPct ?? 100} onChange={(laserPowerPct) => setDef({ laserPowerPct })} />}
          </div>
          {router && !beginner && (
            <div className="space-y-2.5 border-t border-line pt-3">
              <h4 className="text-xs font-semibold">{t.machine.advanced}</h4>
              <div className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
                <NumberField label={t.machine.fluteLength} unit="mm" step={0.5} min={0} value={editing.fluteLength ?? +(cuttingLength(editing) ?? 0).toFixed(2)} onChange={(fluteLength) => set({ fluteLength })} />
                <NumberField label={t.machine.shankDiameter} unit="mm" step={0.1} min={0} value={editing.shankDiameter ?? editing.diameter} onChange={(shankDiameter) => set({ shankDiameter })} />
                <NumberField label={t.machine.overallLength} unit="mm" step={1} min={0} value={editing.overallLength ?? 0} onChange={(overallLength) => set({ overallLength: overallLength || undefined })} />
                <NumberField label={t.machine.stickout} unit="mm" step={1} min={0} value={editing.stickout ?? 0} onChange={(stickout) => set({ stickout: stickout || undefined })} />
              </div>
              <p className="text-2xs leading-relaxed text-muted">{t.machine.lengthNote}</p>
            </div>
          )}
          </div>
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
