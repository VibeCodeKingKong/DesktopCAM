import { Circle, Cog, Copy, FileUp, Magnet, Mountain, MousePointer2, PenTool, Redo2, Slash, Spline, Square, Trash2, Type, Undo2 } from 'lucide-react';
import { RibbonButton } from '../RibbonButton';
import { RibbonGroup, RibbonStack } from '../RibbonGroup';
import { deleteSelection, duplicateSelection, importVectorFile, redo, undo } from '../../../cam/commands';
import { useAppStore, type EditTool } from '../../../store/useAppStore';
import { useT } from '../../../i18n';
import { tip } from '../tip';
import { IlluCircle, IlluCurve, IlluImport, IlluRect, IlluRelief } from '../../smartguide/illustrations';
import { Select } from '../../ui/Field';

export function DesignTab() {
  const t = useT();
  const b = t.buttons;
  const tool = useAppStore((s) => s.editTool);
  const setTool = useAppStore((s) => s.setEditTool);
  const openDialog = useAppStore((s) => s.openDialog);
  const hasSelection = useAppStore((s) => s.selectedShapeIds.length > 0 || !!s.selectedNode);
  const canUndo = useAppStore((s) => s.past.length > 0);
  const canRedo = useAppStore((s) => s.future.length > 0);
  const snap = useAppStore((s) => s.snap);
  const setSnap = useAppStore((s) => s.setSnap);
  const pick = (x: EditTool) => () => setTool(tool === x && x !== 'select' ? 'select' : x);

  return (
    <>
      <RibbonGroup label={t.groups.edit}>
        <RibbonStack>
          <RibbonButton size="small" icon={Undo2} label={b.undo.label} disabled={!canUndo} onClick={undo} tooltip={tip(b.undo, { shortcut: '⌘Z' })} tone="neutral" />
          <RibbonButton size="small" icon={Redo2} label={b.redo.label} disabled={!canRedo} onClick={redo} tooltip={tip(b.redo, { shortcut: '⇧⌘Z' })} tone="neutral" />
          <RibbonButton size="small" icon={Copy} label={b.duplicate.label} disabled={!hasSelection} onClick={duplicateSelection} tooltip={tip(b.duplicate, { shortcut: '⌘D', disabledReason: hasSelection ? undefined : t.reasons.needsSelection })} tone="neutral" />
        </RibbonStack>
        <RibbonButton icon={Trash2} label={b.remove.label} disabled={!hasSelection} onClick={deleteSelection} tooltip={tip(b.remove, { shortcut: '⌫', disabledReason: hasSelection ? undefined : t.reasons.needsSelection })} tone="neutral" />
      </RibbonGroup>
      <RibbonGroup label={t.groups.select}>
        <RibbonButton icon={MousePointer2} label={b.select.label} active={tool === 'select'} onClick={pick('select')} tooltip={tip(b.select, { shortcut: 'V' })} />
        <RibbonButton icon={PenTool} label={b.nodes.label} active={tool === 'nodes'} onClick={pick('nodes')} tooltip={tip(b.nodes, { shortcut: 'N', illustration: <IlluCurve /> })} />
      </RibbonGroup>
      <RibbonGroup label={t.groups.draw}>
        <RibbonButton icon={Slash} label={b.line.label} active={tool === 'line'} onClick={pick('line')} tooltip={tip(b.line, { shortcut: 'L' })} />
        <RibbonButton icon={Spline} label={b.curve.label} active={tool === 'curve'} onClick={pick('curve')} tooltip={tip(b.curve, { shortcut: 'B', illustration: <IlluCurve /> })} />
        <RibbonButton icon={Square} label={b.rect.label} active={tool === 'rect'} onClick={pick('rect')} tooltip={tip(b.rect, { shortcut: 'R', illustration: <IlluRect /> })} />
        <RibbonButton icon={Circle} label={b.circle.label} active={tool === 'circle'} onClick={pick('circle')} tooltip={tip(b.circle, { shortcut: 'C', illustration: <IlluCircle /> })} />
        <RibbonButton icon={Type} label={b.text.label} active={tool === 'text'} onClick={pick('text')} tooltip={tip(b.text, { shortcut: 'T' })} />
        <RibbonButton icon={Cog} label={b.gear.label} onClick={() => openDialog('gear')} tooltip={tip(b.gear)} />
      </RibbonGroup>
      <RibbonGroup label={t.groups.snap}>
        <RibbonButton icon={Magnet} label={b.snapGrid.label} active={snap.grid} onClick={() => setSnap({ grid: !snap.grid })} tooltip={tip(b.snapGrid)} />
        <RibbonStack>
          <span className="text-2xs text-muted">{t.snap.step}</span>
          <div className="w-20">
            <Select
              value={String(snap.step)}
              onChange={(v) => setSnap({ step: Number(v), grid: true })}
              options={['0.1', '0.5', '1', '2', '5', '10'].map((v) => ({ value: v, label: `${v.replace('.', t.code === 'sv' ? ',' : '.')} mm` }))}
            />
          </div>
        </RibbonStack>
      </RibbonGroup>
      <RibbonGroup label={t.groups.import}>
        <RibbonButton icon={FileUp} label={b.importVector.label} onClick={() => void importVectorFile()} tooltip={tip(b.importVector, { shortcut: '⌘I', illustration: <IlluImport /> })} />
      </RibbonGroup>
      <RibbonGroup label={t.groups.library}>
        <RibbonButton icon={Mountain} label={b.reliefLibrary.label} onClick={() => openDialog('reliefLibrary')} tooltip={tip(b.reliefLibrary, { illustration: <IlluRelief /> })} />
      </RibbonGroup>
    </>
  );
}
