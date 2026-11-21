import { ChevronRight, Settings2, Wrench, X, Zap } from 'lucide-react';
import { useContext } from 'react';
import { RibbonButton } from '../RibbonButton';
import { RibbonField, RibbonGroup, RibbonLayout, RibbonStack } from '../RibbonGroup';
import { materialFitsMachine, toolFitsMachine, useAppStore, useMachine, favoritesFirst } from '../../../store/useAppStore';
import { Select } from '../../ui/Field';
import { IlluMachine, IlluToolLibrary } from '../../smartguide/illustrations';
import { materialName, toolName, useT } from '../../../i18n';
import { tip } from '../tip';

function MmInput({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <input
      className="field"
      inputMode="decimal"
      defaultValue={value}
      key={value}
      aria-label={label}
      onBlur={(e) => {
        const v = parseFloat(e.target.value.replace(',', '.'));
        if (v > 0 && v !== value) onChange(v);
        else e.target.value = String(value);
      }}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  );
}

/** Pappersformat (stående, mm). */
const PAPER_SIZES = [
  { id: 'A5', w: 148, h: 210 },
  { id: 'A4', w: 210, h: 297 },
  { id: 'A3', w: 297, h: 420 },
  { id: 'A2', w: 420, h: 594 },
  { id: 'Letter', w: 216, h: 279 },
];

export function SetupTab() {
  const t = useT();
  const b = t.buttons;
  const machines = useAppStore((s) => s.machines);
  const setMachine = useAppStore((s) => s.setMachine);
  const materials = useAppStore((s) => s.materials);
  const material = useAppStore((s) => s.material);
  const setMaterial = useAppStore((s) => s.setMaterial);
  const tools = useAppStore((s) => s.tools);
  const activeToolId = useAppStore((s) => s.activeToolId);
  const setActiveTool = useAppStore((s) => s.setActiveTool);
  const openDialog = useAppStore((s) => s.openDialog);
  const machine = useMachine();
  const isLaser = machine.kind === 'laser';
  const form = useContext(RibbonLayout) === 'form';
  const preset = materials.find((m) => m.id === material.presetId);

  return (
    <>
      {!form && (
        // Telefon: en sammanfattning som öppnar inställningarna som ett ark (fälten får inte plats i bandet).
        <button
          onClick={() => useAppStore.getState().setMobilePanel('setup')}
          className="my-1.5 ml-1 mr-2 flex min-w-0 max-w-[calc(100vw-1.5rem)] items-center gap-3 rounded-lg border border-line bg-surface px-3 text-left sm:hidden"
        >
          <Settings2 size={22} className="shrink-0 text-accent" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{machine.name}</span>
            <span className="block truncate text-xs text-muted">
              {preset ? materialName(t, preset.id, preset.name) : ''} · {material.thickness} mm · {material.width} × {material.height} mm
            </span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-muted" />
        </button>
      )}
      <div className={form ? 'contents' : 'hidden sm:contents'}>
      <RibbonGroup label={t.groups.machine}>
        <RibbonButton
          icon={Settings2}
          label={b.machineType.label}
          onClick={() => openDialog('machineSetup')}
          tooltip={tip(b.machineType, {
            illustration: (
              <div className="h-20 w-32">
                <IlluMachine kind={machine.kind} />
              </div>
            ),
          })}
        />
        <RibbonStack>
          <RibbonField label={t.setup.machine}>
            <Select
              value={machine.id}
              groups={[
                { label: t.machine.machineGroups.router, options: machines.filter((m) => !m.custom && m.kind === 'router').map((m) => ({ value: m.id, label: m.name })) },
                { label: t.machine.machineGroups.laser, options: machines.filter((m) => !m.custom && m.kind === 'laser').map((m) => ({ value: m.id, label: m.name })) },
                { label: t.machine.machineGroups.plasma, options: machines.filter((m) => !m.custom && m.kind === 'plasma').map((m) => ({ value: m.id, label: m.name })) },
                { label: t.machine.machineGroups.plotter, options: machines.filter((m) => !m.custom && m.kind === 'plotter').map((m) => ({ value: m.id, label: m.name })) },
                { label: t.machine.machineGroups.custom, options: machines.filter((m) => m.custom).map((m) => ({ value: m.id, label: m.name })) },
              ]}
              onChange={setMachine}
            />
          </RibbonField>
          <RibbonField label={t.setup.workArea}>
            <p className="text-xs tabular-nums">
              {machine.workArea.x} × {machine.workArea.y} mm
            </p>
          </RibbonField>
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup label={t.groups.workpiece}>
        <RibbonStack>
          <RibbonField label={t.setup.material}>
            <Select
              value={material.presetId}
              // Bara material som maskinen kan bearbeta (och det valda, om det inte passar).
              options={materials.filter((m) => materialFitsMachine(m, machine.kind) || m.id === material.presetId).map((m) => ({ value: m.id, label: materialName(t, m.id, m.name) }))}
              onChange={(presetId) => {
                const preset = materials.find((m) => m.id === presetId);
                setMaterial({ presetId, thickness: preset?.defaultThickness ?? material.thickness });
              }}
            />
          </RibbonField>
          <RibbonField label={`${t.setup.thickness} (mm)`}>
            <MmInput value={material.thickness} onChange={(thickness) => setMaterial({ thickness })} label={t.setup.thickness} />
          </RibbonField>
        </RibbonStack>
        <RibbonStack>
          <RibbonField label={`${t.setup.size} (mm)`}>
            <div className="flex items-center gap-1">
              <MmInput value={material.width} onChange={(width) => setMaterial({ width })} label={t.props.width} />
              <span className="text-muted">×</span>
              <MmInput value={material.height} onChange={(height) => setMaterial({ height })} label={t.props.height} />
            </div>
          </RibbonField>
          {machine.kind === 'plotter' ? (
            <RibbonField label={t.setup.paperSize}>
              <Select
                value={PAPER_SIZES.find((p) => (p.w === material.width && p.h === material.height) || (p.h === material.width && p.w === material.height))?.id ?? 'custom'}
                options={[
                  ...PAPER_SIZES.map((p) => ({ value: p.id, label: `${p.id} · ${p.w} × ${p.h}` })),
                  { value: 'custom', label: t.setup.paperCustom },
                ]}
                onChange={(id) => {
                  const p = PAPER_SIZES.find((x) => x.id === id);
                  // Liggande om materialet redan är bredare än högt.
                  if (p) setMaterial(material.width >= material.height ? { width: p.h, height: p.w } : { width: p.w, height: p.h });
                }}
              />
            </RibbonField>
          ) : (
            <RibbonField label={t.setup.zZero}>
              <p className="text-xs">{t.setup.zTop}</p>
            </RibbonField>
          )}
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup label={t.groups.tool}>
        <RibbonStack>
          <RibbonField label={t.setup.activeTool}>
            <Select
              value={activeToolId}
              options={favoritesFirst(tools.filter((x) => toolFitsMachine(x.kind, machine.kind))).map((x) => ({ value: x.id, label: `${x.favorite ? '★ ' : ''}${toolName(t, x.id, x.name)}` }))}
              onChange={setActiveTool}
            />
          </RibbonField>
        </RibbonStack>
        <RibbonButton icon={Wrench} label={b.toolLibrary.label} onClick={() => openDialog('machineSetup', 'tools')} tooltip={tip(b.toolLibrary, { illustration: <IlluToolLibrary /> })} />
      </RibbonGroup>

      {isLaser && machine.laser && (
        <RibbonGroup label={t.groups.laser}>
          <RibbonStack>
            <RibbonField label={t.setup.laserPower}>
              <p className="flex items-center gap-1.5 text-xs">
                <Zap size={13} className="text-laser" />
                {t.setup.optical(machine.laser.opticalPowerW)}
              </p>
            </RibbonField>
            <RibbonField label={t.setup.sScale}>
              <p className="text-xs tabular-nums">
                0–{machine.laser.sMax} ({machine.postprocessor.laserDynamicPower ? t.setup.dynamic : t.setup.constant})
              </p>
            </RibbonField>
          </RibbonStack>
        </RibbonGroup>
      )}
      </div>
    </>
  );
}

/** Telefon: Inställning som ett ark nerifrån med samma fält som i bandet. */
export function SetupSheet() {
  const t = useT();
  const open = useAppStore((s) => s.mobilePanel === 'setup');
  if (!open) return null;
  const close = () => useAppStore.getState().setMobilePanel(null);
  return (
    <div className="sm:hidden">
      <div className="fixed inset-0 z-30 bg-black/25" onClick={close} aria-hidden="true" />
      <section role="dialog" aria-label={t.tabs.setup} className="fixed inset-x-0 bottom-0 z-40 flex max-h-[85dvh] flex-col rounded-t-2xl bg-surface shadow-pop">
        <div className="panel-heading">
          <span>{t.tabs.setup}</span>
          <button className="rounded p-1 text-muted hover:bg-app hover:text-ink" onClick={close} aria-label={t.common.close}>
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
          <RibbonLayout.Provider value="form">
            <SetupTab />
          </RibbonLayout.Provider>
        </div>
      </section>
    </div>
  );
}
