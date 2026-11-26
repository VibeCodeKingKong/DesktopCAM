import { ClipboardList, Download, FileCode, FileImage, FileText, Shapes } from 'lucide-react';
import { exportVectors } from '../../../cam/commands';
import { RibbonButton } from '../RibbonButton';
import { RibbonField, RibbonGroup, RibbonStack } from '../RibbonGroup';
import { useAppStore, useMachine } from '../../../store/useAppStore';
import { IlluExport, IlluGcode } from '../../smartguide/illustrations';
import { useT } from '../../../i18n';
import { tip } from '../tip';

export function OutputTab() {
  const t = useT();
  const b = t.buttons;
  const machine = useMachine();
  const openDialog = useAppStore((s) => s.openDialog);
  const hasResult = useAppStore((s) => Object.keys(s.results).length > 0);
  const disabledReason = hasResult ? undefined : t.reasons.needsResult;
  const hasShapes = useAppStore((s) => s.layers.some((l) => l.visible && l.shapes.length > 0));
  return (
    <>
      <RibbonGroup label={t.groups.gcode}>
        <RibbonButton icon={Download} label={b.saveGcode.label} disabled={!hasResult} onClick={() => openDialog('exportGcode')} tooltip={tip(b.saveGcode, { shortcut: '⌘E', illustration: <IlluExport />, disabledReason })} />
        <RibbonButton icon={FileCode} label={b.viewGcode.label} disabled={!hasResult} onClick={() => openDialog('gcodeViewer')} tooltip={tip(b.viewGcode, { illustration: <IlluGcode />,  disabledReason })} />
        <RibbonButton icon={ClipboardList} label={b.jobSheet.label} disabled={!hasResult} onClick={() => openDialog('jobSheet')} tooltip={tip(b.jobSheet, { disabledReason })} />
      </RibbonGroup>
      <RibbonGroup label={t.groups.vectors}>
        <RibbonButton icon={FileImage} label={b.exportSvg.label} disabled={!hasShapes} onClick={() => exportVectors('svg')} tooltip={tip(b.exportSvg, { disabledReason: hasShapes ? undefined : t.reasons.needsShapes })} />
        <RibbonButton icon={Shapes} label={b.exportDxf.label} disabled={!hasShapes} onClick={() => exportVectors('dxf')} tooltip={tip(b.exportDxf, { disabledReason: hasShapes ? undefined : t.reasons.needsShapes })} />
        <RibbonButton icon={FileText} label={b.exportPdf.label} disabled={!hasShapes} onClick={() => exportVectors('pdf')} tooltip={tip(b.exportPdf, { disabledReason: hasShapes ? undefined : t.reasons.needsShapes })} />
      </RibbonGroup>
      <RibbonGroup label={t.groups.post}>
        <RibbonStack>
          <RibbonField label={t.output.format}>
            <p className="text-xs">{machine.postprocessor.name}</p>
          </RibbonField>
          <RibbonField label={t.output.machine}>
            <p className="line-clamp-2 text-xs leading-tight" title={machine.name}>{machine.name}</p>
          </RibbonField>
        </RibbonStack>
      </RibbonGroup>
    </>
  );
}
