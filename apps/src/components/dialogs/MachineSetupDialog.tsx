import { useEffect, useState } from 'react';
import { CheckCircle2, Plus } from 'lucide-react';
import { uid, type FirmwareFlavor, type MachineProfile } from '@desktopcam/core';
import { useAppStore } from '../../store/useAppStore';
import { Dialog } from '../ui/Dialog';
import { NumberField, SelectField, Switch, FieldRow } from '../ui/Field';
import { IlluMachine } from '../smartguide/illustrations';

type Step = 'preset' | 'post' | 'tools';
const STEPS: { id: Step; label: string }[] = [
  { id: 'preset', label: '1. Välj maskin' },
  { id: 'post', label: '2. Postprocessor' },
  { id: 'tools', label: '3. Verktygsbibliotek' },
];

const TOOL_KIND_LABEL = { endmill: 'Pinnfräs', ballnose: 'Kulfräs', vbit: 'V-fräs', drill: 'Borr', laser: 'Laser' } as const;

/** Maskininställning i tre steg, utformad efter skissen "Machine Setup & Configuration". */
export function MachineSetupDialog() {
  const open = useAppStore((s) => s.dialog === 'machineSetup');
  const close = () => useAppStore.getState().openDialog(null);
  const machines = useAppStore((s) => s.machines);
  const machineId = useAppStore((s) => s.machineId);
  const tools = useAppStore((s) => s.tools);
  const saveMachine = useAppStore((s) => s.saveMachine);
  const setStatus = useAppStore((s) => s.setStatus);

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
    setStatus(`Maskin: ${draft.name}`);
  };
  const stepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <Dialog
      open={open}
      onClose={close}
      title="Maskininställning"
      actions={
        <button
          className="btn ml-2 border-accent/40 text-accent"
          onClick={() => setDraft({ ...structuredClone(draft), id: uid('machine'), name: `${draft.name} (egen)` })}
        >
          <Plus size={13} /> Ny profil
        </button>
      }
      footer={
        <>
          <button className="btn" onClick={close}>
            Avbryt
          </button>
          <button className="btn btn-primary" onClick={apply}>
            Verkställ
          </button>
          <div className="flex-1" />
          {stepIndex < STEPS.length - 1 ? (
            <button className="btn btn-primary" onClick={() => setStep(STEPS[stepIndex + 1].id)}>
              Nästa: {STEPS[stepIndex + 1].label.replace(/^\d\.\s/, '')}
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => {
                apply();
                close();
              }}
            >
              Klar
            </button>
          )}
        </>
      }
    >
      <nav className="flex gap-1 border-b border-line px-5" role="tablist">
        {STEPS.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={s.id === step}
            onClick={() => setStep(s.id)}
            className={`relative px-3 py-2.5 text-xs ${s.id === step ? 'font-semibold text-accent' : 'text-muted hover:text-ink'}`}
          >
            {s.label}
            {s.id === step && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-accent" />}
          </button>
        ))}
      </nav>

      {step === 'preset' && (
        <div className="space-y-5 p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {machines.map((m) => {
              const active = m.id === draft.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setDraft(structuredClone(m))}
                  aria-pressed={active}
                  className={`flex gap-3 rounded-lg border p-3 text-left transition-colors ${
                    active ? 'border-accent bg-accent/5 ring-1 ring-accent' : 'border-line bg-raised hover:border-muted/50'
                  }`}
                >
                  <div className="h-20 w-28 shrink-0 rounded-md bg-app p-1">
                    <IlluMachine kind={m.kind} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-0.5 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold leading-snug">{m.name}</p>
                      {active && <CheckCircle2 size={16} className="shrink-0 text-accent" />}
                    </div>
                    <p className="text-muted">{m.kind === 'laser' ? 'Lasergravyr och skärning' : 'CNC-fräs'}</p>
                    <p>
                      Arbetsyta {m.workArea.x} × {m.workArea.y} mm
                    </p>
                    <p className="text-muted">Styrning: {m.postprocessor.flavor === 'grbl' ? 'GRBL' : 'Marlin'}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <section className="rounded-lg border border-line bg-app/60 p-4">
            <h3 className="mb-3 text-sm font-semibold">Inställningar för vald maskin</h3>
            <div className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
              <FieldRow label="Namn">
                <input className="field" value={draft.name} onChange={(e) => set({ name: e.target.value })} />
              </FieldRow>
              <SelectField
                label="Firmware"
                value={draft.postprocessor.flavor}
                options={[
                  { value: 'grbl', label: 'GRBL 1.1' },
                  { value: 'marlin', label: 'Marlin 2.1' },
                ] satisfies { value: FirmwareFlavor; label: string }[]}
                onChange={(flavor) => setPost({ flavor })}
              />
              <NumberField label="Arbetsyta X" unit="mm" value={draft.workArea.x} min={10} onChange={(x) => set({ workArea: { ...draft.workArea, x } })} />
              <NumberField label="Arbetsyta Y" unit="mm" value={draft.workArea.y} min={10} onChange={(y) => set({ workArea: { ...draft.workArea, y } })} />
              {draft.kind === 'router' && (
                <NumberField label="Arbetsyta Z" unit="mm" value={draft.workArea.z} min={0} onChange={(z) => set({ workArea: { ...draft.workArea, z } })} />
              )}
              <NumberField label="Max matning XY" unit="mm/min" step={100} value={draft.maxFeed.xy} onChange={(xy) => set({ maxFeed: { ...draft.maxFeed, xy } })} />
              <SelectField
                label="Hemkörning"
                value={draft.homing}
                options={[
                  { value: 'none', label: 'Ingen' },
                  { value: 'xy', label: 'X och Y' },
                  { value: 'xyz', label: 'X, Y och Z' },
                ]}
                onChange={(homing) => set({ homing })}
              />
              {draft.laser && (
                <NumberField label="Max S-värde" value={draft.laser.sMax} min={1} onChange={(sMax) => set({ laser: { ...draft.laser!, sMax } })} />
              )}
            </div>
          </section>
        </div>
      )}

      {step === 'post' && (
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <div className="space-y-2.5">
            <NumberField label="Decimaler" value={draft.postprocessor.decimals} min={0} max={6} onChange={(decimals) => setPost({ decimals: Math.round(decimals) })} />
            {draft.kind === 'router' && (
              <NumberField label="Säker höjd" unit="mm" value={draft.postprocessor.safeZ} min={0} hint="safeZ" onChange={(safeZ) => setPost({ safeZ })} />
            )}
            {draft.kind === 'laser' && (
              <FieldRow label="Dynamisk effekt (M4)">
                <Switch checked={draft.postprocessor.laserDynamicPower} onChange={(laserDynamicPower) => setPost({ laserDynamicPower })} label="Dynamisk effekt" />
              </FieldRow>
            )}
            <p className="pt-2 text-xs leading-relaxed text-muted">
              Start- och slutkoden skrivs in i varje fil. Ändra bara om du vet vad din maskin behöver, t.ex. hemkörning eller att stänga av motorerna.
            </p>
          </div>
          <div className="space-y-3">
            {(['header', 'footer'] as const).map((key) => (
              <label key={key} className="block">
                <span className="mb-1 block text-xs text-muted">{key === 'header' ? 'Startkod' : 'Slutkod'}</span>
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

      {step === 'tools' && (
        <div className="p-5">
          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full text-xs">
              <thead className="bg-app text-left text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Verktyg</th>
                  <th className="px-3 py-2 font-medium">Typ</th>
                  <th className="px-3 py-2 text-right font-medium">Diameter</th>
                  <th className="px-3 py-2 text-right font-medium">Matning</th>
                  <th className="px-3 py-2 text-right font-medium">Djup/pass</th>
                </tr>
              </thead>
              <tbody>
                {tools
                  .filter((t) => (draft.kind === 'laser' ? t.kind === 'laser' : t.kind !== 'laser'))
                  .map((t) => (
                    <tr key={t.id} className="border-t border-line">
                      <td className="px-3 py-2">{t.name}</td>
                      <td className="px-3 py-2 text-muted">
                        {TOOL_KIND_LABEL[t.kind]}
                        {t.angle ? ` ${t.angle}°` : ''}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{t.diameter} mm</td>
                      <td className="px-3 py-2 text-right tabular-nums">{t.defaults.feedRate} mm/min</td>
                      <td className="px-3 py-2 text-right tabular-nums">{t.kind === 'laser' ? '–' : `${t.defaults.stepDown} mm`}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">Verktygen läses från src/data/tools.json. Redigering i gränssnittet kommer i nästa steg.</p>
        </div>
      )}
    </Dialog>
  );
}
