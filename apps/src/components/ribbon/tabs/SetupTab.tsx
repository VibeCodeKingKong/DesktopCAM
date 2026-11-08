import { Settings2, Wrench, Zap } from 'lucide-react';
import { RibbonButton } from '../RibbonButton';
import { RibbonField, RibbonGroup, RibbonStack } from '../RibbonGroup';
import { useAppStore, useMachine } from '../../../store/useAppStore';
import { Select } from '../../ui/Field';
import { IlluMachine } from '../../smartguide/illustrations';

export function SetupTab() {
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
      <RibbonGroup label="Maskin">
        <RibbonButton
          icon={Settings2}
          label="Maskintyp"
          onClick={() => openDialog('machineSetup')}
          tooltip={{
            title: 'Maskininställning',
            description: 'Välj förinställd maskin eller skapa en egen profil med arbetsyta, firmware och postprocessor.',
            illustration: (
              <div className="h-20 w-32">
                <IlluMachine kind={machine.kind} />
              </div>
            ),
          }}
        />
        <RibbonStack>
          <RibbonField label="Maskin">
            <Select value={machine.id} options={machines.map((m) => ({ value: m.id, label: m.name }))} onChange={setMachine} />
          </RibbonField>
          <RibbonField label="Arbetsyta">
            <p className="text-xs tabular-nums">
              {machine.workArea.x} × {machine.workArea.y} mm
            </p>
          </RibbonField>
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup label="Arbetsstycke">
        <RibbonStack>
          <RibbonField label="Material">
            <Select
              value={material.presetId}
              options={materials.map((m) => ({ value: m.id, label: m.name }))}
              onChange={(presetId) => {
                const preset = materials.find((m) => m.id === presetId);
                setMaterial({ presetId, thickness: preset?.defaultThickness ?? material.thickness });
              }}
            />
          </RibbonField>
          <RibbonField label="Tjocklek">
            <div className="relative">
              <input
                className="field pr-9"
                inputMode="decimal"
                value={material.thickness}
                onChange={(e) => {
                  const v = parseFloat(e.target.value.replace(',', '.'));
                  if (v > 0) setMaterial({ thickness: v });
                }}
                aria-label="Materialtjocklek"
              />
              <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-2xs text-muted">mm</span>
            </div>
          </RibbonField>
        </RibbonStack>
        <RibbonStack>
          <RibbonField label="Bredd × höjd">
            <div className="flex items-center gap-1">
              <input
                className="field"
                inputMode="decimal"
                value={material.width}
                aria-label="Materialbredd"
                onChange={(e) => +e.target.value > 0 && setMaterial({ width: +e.target.value })}
              />
              <span className="text-muted">×</span>
              <input
                className="field"
                inputMode="decimal"
                value={material.height}
                aria-label="Materialhöjd"
                onChange={(e) => +e.target.value > 0 && setMaterial({ height: +e.target.value })}
              />
            </div>
          </RibbonField>
          <RibbonField label="Nollpunkt Z">
            <p className="text-xs">Materialets ovansida</p>
          </RibbonField>
        </RibbonStack>
      </RibbonGroup>

      <RibbonGroup label="Verktyg">
        <RibbonStack>
          <RibbonField label="Aktivt verktyg">
            <Select
              value={activeToolId}
              options={tools.filter((t) => (isLaser ? t.kind === 'laser' : t.kind !== 'laser')).map((t) => ({ value: t.id, label: t.name }))}
              onChange={setActiveTool}
            />
          </RibbonField>
        </RibbonStack>
        <RibbonButton
          icon={Wrench}
          label="Verktygs­bibliotek"
          onClick={() => openDialog('machineSetup')}
          tooltip={{ title: 'Verktygsbibliotek', description: 'Visa och redigera fräsar, borrar och laserprofiler med standardvärden.' }}
        />
      </RibbonGroup>

      {isLaser && machine.laser && (
        <RibbonGroup label="Laser">
          <RibbonStack>
            <RibbonField label="Lasereffekt">
              <p className="flex items-center gap-1.5 text-xs">
                <Zap size={13} className="text-laser" />
                {machine.laser.opticalPowerW} W optisk
              </p>
            </RibbonField>
            <RibbonField label="S-skala">
              <p className="text-xs tabular-nums">0–{machine.laser.sMax} ({machine.postprocessor.laserDynamicPower ? 'M4 dynamisk' : 'M3 konstant'})</p>
            </RibbonField>
          </RibbonStack>
        </RibbonGroup>
      )}
    </>
  );
}
