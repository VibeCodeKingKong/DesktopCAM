import { Settings2, Wrench, Zap } from 'lucide-react';
import { RibbonButton } from '../RibbonButton';
import { RibbonField, RibbonGroup, RibbonStack } from '../RibbonGroup';
import { useAppStore, useMachine } from '../../../store/useAppStore';
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

  return (
    <>
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
              options={materials.map((m) => ({ value: m.id, label: materialName(t, m.id, m.name) }))}
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
          <RibbonField label={t.setup.zZero}>
            <p className="text-xs">{t.setup.zTop}</p>
          </RibbonField>
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup label={t.groups.tool}>
        <RibbonStack>
          <RibbonField label={t.setup.activeTool}>
            <Select
              value={activeToolId}
              options={tools.filter((x) => (isLaser ? x.kind === 'laser' : x.kind !== 'laser')).map((x) => ({ value: x.id, label: toolName(t, x.id, x.name) }))}
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
    </>
  );
}
