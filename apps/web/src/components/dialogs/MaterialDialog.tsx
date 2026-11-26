import { useEffect, useMemo, useState } from 'react';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { uid, type MaterialCategory, type MaterialPreset } from '@desktopcam/core';
import { useAppStore, useMachine, materialFitsMachine } from '../../store/useAppStore';
import { materialName, useT } from '../../i18n';
import { Dialog } from '../ui/Dialog';
import { FieldRow, NumberField, SelectField, Switch } from '../ui/Field';

const CATEGORIES: MaterialCategory[] = ['wood', 'plastic', 'leather', 'composite', 'metal', 'stone', 'paper'];

/**
 * Egna material: kopiera ett befintligt material och ändra namn, färg,
 * tjocklek och skärdata. Sparas i webbläsaren (alla projekt) och följer med
 * projektfilen när materialet används.
 */
export function MaterialDialog() {
  const t = useT();
  const M = t.customMaterials;
  const open = useAppStore((s) => s.dialog === 'materials');
  const materials = useAppStore((s) => s.materials);
  const current = useAppStore((s) => s.material.presetId);
  const machine = useMachine();
  const custom = useMemo(() => materials.filter((m) => m.custom), [materials]);
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<MaterialPreset | null>(null);
  const [base, setBase] = useState(current);
  const close = () => useAppStore.getState().openDialog(null);

  useEffect(() => {
    if (!open) return;
    setBase(current);
    const cur = materials.find((m) => m.id === current);
    setSelected(cur?.custom ? cur.id : (custom[0]?.id ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => {
    const m = materials.find((x) => x.id === selected);
    setDraft(m ? structuredClone(m) : null);
  }, [selected, materials]);

  const create = () => {
    const src = materials.find((m) => m.id === base) ?? materials[0];
    const m: MaterialPreset = {
      ...structuredClone(src),
      id: uid('custom-material'),
      custom: true,
      name: M.copyName(materialName(t, src.id, src.name)),
      // Laserns tjocklekstabell gäller grundmaterialet – egna värden används i stället.
      laser: { ...src.laser, chart: undefined },
    };
    useAppStore.getState().saveMaterial(m);
    setSelected(m.id);
  };
  const save = () => {
    if (!draft) return;
    useAppStore.getState().saveMaterial(draft);
    useAppStore.getState().setStatus(M.saved(draft.name));
  };
  const use = () => {
    if (!draft) return;
    save();
    useAppStore.getState().setMaterial({ presetId: draft.id, thickness: draft.defaultThickness });
    close();
  };
  const set = (p: Partial<MaterialPreset>) => draft && setDraft({ ...draft, ...p });
  const setLaser = (p: Partial<MaterialPreset['laser']>) => draft && setDraft({ ...draft, laser: { ...draft.laser, ...p } });
  const setRouter = (p: Partial<NonNullable<MaterialPreset['router']>>) => draft?.router && setDraft({ ...draft, router: { ...draft.router, ...p } });
  const dirty = draft && JSON.stringify(draft) !== JSON.stringify(materials.find((m) => m.id === draft.id));

  if (!open) return null;
  return (
    <Dialog
      open={open}
      onClose={close}
      title={M.title}
      width="max-w-3xl"
      footer={
        <>
          <div className="flex-1" />
          <button className="btn" onClick={close}>
            {t.common.close}
          </button>
          <button className="btn" disabled={!dirty} onClick={save}>
            {M.save}
          </button>
          <button className="btn btn-primary" disabled={!draft || (!materialFitsMachine(draft, machine.kind) && machine.kind !== 'plotter')} onClick={use}>
            {M.use}
          </button>
        </>
      }
    >
      <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,220px)_1fr]">
        <aside className="space-y-2">
          <p className="text-xs leading-relaxed text-muted">{M.intro}</p>
          <SelectField label={M.base} value={base} options={materials.map((m) => ({ value: m.id, label: materialName(t, m.id, m.name) }))} onChange={setBase} />
          <button className="btn w-full" onClick={create}>
            <Plus size={13} /> {M.create}
          </button>
          <ul className="space-y-0.5" aria-label={M.list}>
            {custom.length === 0 && <li className="text-2xs text-muted">{M.none}</li>}
            {custom.map((m) => (
              <li key={m.id}>
                <button className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${m.id === selected ? 'bg-accent/10 font-medium text-accent' : 'hover:bg-app'}`} onClick={() => setSelected(m.id)}>
                  <span className="h-3 w-3 shrink-0 rounded-sm border border-line" style={{ background: m.color }} />
                  <span className="min-w-0 flex-1 truncate">{m.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>
        {draft ? (
          <section className="space-y-3">
            <div className="space-y-1.5">
              <FieldRow label={M.name}>
                <input className="field" value={draft.name} onChange={(e) => set({ name: e.target.value })} aria-label={M.name} />
              </FieldRow>
              <SelectField label={M.category} value={draft.category} options={CATEGORIES.map((c) => ({ value: c, label: M.categories[c] }))} onChange={(category) => set({ category })} />
              <FieldRow label={M.color}>
                <input type="color" className="h-8 w-16 cursor-pointer rounded border border-line bg-transparent" value={draft.color} onChange={(e) => set({ color: e.target.value })} aria-label={M.color} />
              </FieldRow>
              <NumberField label={M.thickness} unit="mm" step={0.5} min={0.1} max={200} value={draft.defaultThickness} onChange={(defaultThickness) => set({ defaultThickness })} />
            </div>
            {machine.kind === 'router' && (
              <fieldset className="space-y-1.5 rounded-lg border border-line p-3">
                <legend className="px-1 text-xs font-semibold">{M.router}</legend>
                <FieldRow label={M.routerOk}>
                  <Switch
                    checked={!!draft.router}
                    onChange={(v) => set({ router: v ? { feedRate: 1200, plungeRate: 400, spindleRpm: 18000, stepDownFactor: 0.5 } : null })}
                    label={M.routerOk}
                  />
                </FieldRow>
                {draft.router && (
                  <>
                    <NumberField label={t.props.feed} unit="mm/min" step={50} min={10} value={draft.router.feedRate} onChange={(feedRate) => setRouter({ feedRate })} />
                    <NumberField label={t.props.plunge} unit="mm/min" step={25} min={10} value={draft.router.plungeRate} onChange={(plungeRate) => setRouter({ plungeRate })} />
                    <NumberField label={t.props.spindle} unit="rpm" step={1000} min={0} value={draft.router.spindleRpm} onChange={(spindleRpm) => setRouter({ spindleRpm })} />
                    <NumberField label={M.stepDown} step={0.05} min={0.05} max={2} value={draft.router.stepDownFactor} onChange={(stepDownFactor) => setRouter({ stepDownFactor })} />
                  </>
                )}
              </fieldset>
            )}
            {machine.kind === 'laser' && (
              <fieldset className="space-y-1.5 rounded-lg border border-line p-3">
                <legend className="px-1 text-xs font-semibold">{M.laser}</legend>
                <FieldRow label={M.canCut}>
                  <Switch checked={draft.laser.canCut !== false} onChange={(v) => setLaser({ canCut: v })} label={M.canCut} />
                </FieldRow>
                {draft.laser.canCut !== false && (
                  <>
                    <NumberField label={M.cutSpeed} unit="mm/min" step={50} min={1} value={draft.laser.cutSpeed} onChange={(cutSpeed) => setLaser({ cutSpeed })} />
                    <NumberField label={M.cutPower} unit="%" step={5} min={0} max={100} value={draft.laser.cutPowerPct} onChange={(cutPowerPct) => setLaser({ cutPowerPct })} />
                    <NumberField label={t.props.passes} step={1} min={1} max={20} value={draft.laser.cutPasses} onChange={(v) => setLaser({ cutPasses: Math.round(v) })} />
                  </>
                )}
                <NumberField label={M.engraveSpeed} unit="mm/min" step={100} min={1} value={draft.laser.engraveSpeed} onChange={(engraveSpeed) => setLaser({ engraveSpeed })} />
                <NumberField label={M.engravePower} unit="%" step={5} min={0} max={100} value={draft.laser.engravePowerPct} onChange={(engravePowerPct) => setLaser({ engravePowerPct })} />
                <p className="text-2xs leading-relaxed text-muted">{M.laserNote}</p>
              </fieldset>
            )}
            {machine.kind === 'plasma' && <p className="rounded-md bg-app px-3 py-2 text-xs leading-relaxed text-muted">{draft.plasma?.length ? M.plasmaCopied : M.plasmaNone}</p>}
            {!materialFitsMachine(draft, machine.kind) && machine.kind !== 'plotter' && <p className="rounded-md bg-warn/10 px-2 py-1.5 text-xs text-warn">{M.notForMachine}</p>}
            <div className="flex flex-wrap gap-2">
              <button
                className="btn"
                onClick={() => {
                  const m: MaterialPreset = { ...structuredClone(draft), id: uid('custom-material'), name: M.copyName(draft.name) };
                  useAppStore.getState().saveMaterial(m);
                  setSelected(m.id);
                }}
              >
                <Copy size={13} /> {M.duplicate}
              </button>
              <button
                className="btn text-warn"
                onClick={() => {
                  if (!window.confirm(M.confirmRemove(draft.name))) return;
                  useAppStore.getState().removeMaterial(draft.id);
                  setSelected(null);
                }}
              >
                <Trash2 size={13} /> {M.remove}
              </button>
            </div>
          </section>
        ) : (
          <p className="self-center text-sm text-muted">{M.pick}</p>
        )}
      </div>
    </Dialog>
  );
}
