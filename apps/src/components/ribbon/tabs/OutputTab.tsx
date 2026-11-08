import { Download, FileCode } from 'lucide-react';
import { RibbonButton } from '../RibbonButton';
import { RibbonField, RibbonGroup, RibbonStack } from '../RibbonGroup';
import { useAppStore, useMachine } from '../../../store/useAppStore';
import { exportSelectedGcode } from '../../../cam/commands';
import { IlluExport } from '../../smartguide/illustrations';

export function OutputTab() {
  const machine = useMachine();
  const openDialog = useAppStore((s) => s.openDialog);
  const hasResult = useAppStore((s) => Object.keys(s.results).length > 0);
  const disabledReason = hasResult ? undefined : 'Skapa en verktygsbana först.';
  return (
    <>
      <RibbonGroup label="G-kod">
        <RibbonButton
          icon={Download}
          label="Spara G-kod"
          disabled={!hasResult}
          onClick={exportSelectedGcode}
          tooltip={{ title: 'Spara G-kod', description: 'Laddar ner den markerade verktygsbanan som .gcode-fil, klar för SD-kort eller sändarprogram.', shortcut: '⌘E', illustration: <IlluExport />, disabledReason }}
        />
        <RibbonButton
          icon={FileCode}
          label="Visa G-kod"
          disabled={!hasResult}
          onClick={() => openDialog('gcodeViewer')}
          tooltip={{ title: 'Visa G-kod', description: 'Granska koden rad för rad innan du kör den på maskinen.', disabledReason }}
        />
      </RibbonGroup>
      <RibbonGroup label="Postprocessor">
        <RibbonStack>
          <RibbonField label="Format">
            <p className="text-xs">{machine.postprocessor.name}</p>
          </RibbonField>
          <RibbonField label="Maskin">
            <p className="truncate text-xs">{machine.name}</p>
          </RibbonField>
        </RibbonStack>
      </RibbonGroup>
    </>
  );
}
