import { Download, FileCode } from 'lucide-react';
import { RibbonButton } from '../RibbonButton';
import { RibbonField, RibbonGroup, RibbonStack } from '../RibbonGroup';
import { useAppStore, useMachine } from '../../../store/useAppStore';
import { exportSelectedGcode } from '../../../cam/commands';
import { IlluExport } from '../../smartguide/illustrations';
import { useT } from '../../../i18n';
import { tip } from '../tip';

export function OutputTab() {
  const t = useT();
  const b = t.buttons;
  const machine = useMachine();
  const openDialog = useAppStore((s) => s.openDialog);
  const hasResult = useAppStore((s) => Object.keys(s.results).length > 0);
  const disabledReason = hasResult ? undefined : t.reasons.needsResult;
  return (
    <>
      <RibbonGroup label={t.groups.gcode}>
        <RibbonButton icon={Download} label={b.saveGcode.label} disabled={!hasResult} onClick={exportSelectedGcode} tooltip={tip(b.saveGcode, { shortcut: '⌘E', illustration: <IlluExport />, disabledReason })} />
        <RibbonButton icon={FileCode} label={b.viewGcode.label} disabled={!hasResult} onClick={() => openDialog('gcodeViewer')} tooltip={tip(b.viewGcode, { disabledReason })} />
      </RibbonGroup>
      <RibbonGroup label={t.groups.post}>
        <RibbonStack>
          <RibbonField label={t.output.format}>
            <p className="text-xs">{machine.postprocessor.name}</p>
          </RibbonField>
          <RibbonField label={t.output.machine}>
            <p className="truncate text-xs">{machine.name}</p>
          </RibbonField>
        </RibbonStack>
      </RibbonGroup>
    </>
  );
}
