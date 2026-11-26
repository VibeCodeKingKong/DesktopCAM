import { AlignCenterVertical, Ellipsis, FileCode2, BoxSelect, Circle, Cog, Copy, Group, Ungroup, FileUp, Image as ImageIcon, ImageUp, ScanLine, Magnet, Mountain, Shapes, MousePointer2, PenTool, Grid3x3, Redo2, Ruler, Slash, Spline, Square, Trash2, Type, Undo2 } from 'lucide-react';
import { RibbonButton } from '../RibbonButton';
import { importImageRelief } from '../../../cam/imageRelief';
import { importImage } from '../../../cam/imageObjects';
import { RibbonMenuButton } from '../RibbonMenuButton';
import { CornerRadius, ShapeOffset, ShapesIntersect, ShapesSubtract, ShapesUnion } from '../../ui/icons';
import { RibbonGroup, RibbonStack } from '../RibbonGroup';
import { deleteSelection, duplicateSelection, groupSelection, importVectorFile, redo, selectAllShapes, undo, ungroupSelection } from '../../../cam/commands';
import { importGcodeFile } from '../../../cam/gcodeImport';
import { combineSelection } from '../../../cam/shapeOps';
import { alignSelection, distributeSelection, type AlignMode } from '../../../cam/align';
import { ALIGN_ICONS, DISTRIBUTE_ICONS } from '../../layout/AlignRow';
import { useAppStore, useMachine, type EditTool } from '../../../store/useAppStore';
import { decimalSep, useT } from '../../../i18n';
import { tip } from '../tip';
import { IlluCircle, IlluCurve, IlluDelete, IlluDuplicate, IlluFillet, IlluGear, IlluImageRelief, IlluImport, IlluLine, IlluRect, IlluRedo, IlluRelief, IlluSelect, IlluShapeLibrary, IlluSnap, IlluText, IlluUndo } from '../../smartguide/illustrations';
import { Select } from '../../ui/Field';

export function DesignTab() {
  const t = useT();
  const b = t.buttons;
  const tool = useAppStore((s) => s.editTool);
  const setTool = useAppStore((s) => s.setEditTool);
  const openDialog = useAppStore((s) => s.openDialog);
  const hasShapeSelection = useAppStore((s) => s.selectedShapeIds.length > 0);
  const hasSelection = useAppStore((s) => s.selectedShapeIds.length > 0 || !!s.selectedNode);
  const canDelete = useAppStore((s) => s.selectedShapeIds.length > 0 || !!s.selectedNode || !!s.selectedImageId || !!s.selectedReliefId);
  const canUndo = useAppStore((s) => s.past.length > 0);
  const canRedo = useAppStore((s) => s.future.length > 0);
  const isRouter = useMachine().kind === 'router';
  const snap = useAppStore((s) => s.snap);
  const setSnap = useAppStore((s) => s.setSnap);
  const selCount = useAppStore((s) => s.selectedShapeIds.length);
  const hasGroup = useAppStore((s) => s.layers.some((l) => l.shapes.some((sh) => sh.groupId && s.selectedShapeIds.includes(sh.id))));
  const pick = (x: EditTool) => () => setTool(tool === x && x !== 'select' ? 'select' : x);

  return (
    <>
      <RibbonGroup label={t.groups.edit}>
        <RibbonStack>
          <RibbonButton size="small" icon={Undo2} label={b.undo.label} disabled={!canUndo} onClick={undo} tooltip={tip(b.undo, { illustration: <IlluUndo />,  shortcut: '⌘Z' })} tone="neutral" />
          <RibbonButton size="small" icon={Redo2} label={b.redo.label} disabled={!canRedo} onClick={redo} tooltip={tip(b.redo, { illustration: <IlluRedo />,  shortcut: '⇧⌘Z' })} tone="neutral" />
          <RibbonButton size="small" icon={Copy} label={b.duplicate.label} disabled={!hasSelection} onClick={duplicateSelection} tooltip={tip(b.duplicate, { illustration: <IlluDuplicate />,  shortcut: '⌘D', disabledReason: hasSelection ? undefined : t.reasons.needsSelection })} tone="neutral" />
        </RibbonStack>
        <RibbonButton icon={Trash2} label={b.remove.label} disabled={!canDelete} onClick={deleteSelection} tooltip={tip(b.remove, { illustration: <IlluDelete />,  shortcut: '⌫', disabledReason: canDelete ? undefined : t.reasons.needsSelection })} tone="neutral" />
        <RibbonStack>
          <RibbonButton size="small" icon={Group} label={b.group.label} disabled={selCount < 2} onClick={groupSelection} tooltip={tip(b.group, { shortcut: '⌘G', disabledReason: selCount < 2 ? t.group.needTwo : undefined })} tone="neutral" />
          <RibbonButton size="small" icon={Ungroup} label={b.ungroup.label} disabled={!hasGroup} onClick={ungroupSelection} tooltip={tip(b.ungroup, { shortcut: '⇧⌘G', disabledReason: hasGroup ? undefined : t.group.noGroup })} tone="neutral" />
        </RibbonStack>
      </RibbonGroup>
      <RibbonGroup label={t.groups.select}>
        <RibbonButton icon={MousePointer2} label={b.select.label} active={tool === 'select'} onClick={pick('select')} tooltip={tip(b.select, { illustration: <IlluSelect />,  shortcut: 'V' })} />
        <RibbonButton icon={PenTool} label={b.nodes.label} active={tool === 'nodes'} onClick={pick('nodes')} tooltip={tip(b.nodes, { shortcut: 'N', illustration: <IlluCurve /> })} />
        <RibbonButton icon={BoxSelect} label={b.selectAll.label} onClick={() => selectAllShapes()} tooltip={tip(b.selectAll, { shortcut: '⌘A' })} />
      </RibbonGroup>
      <RibbonGroup label={t.groups.draw}>
        <RibbonButton icon={Slash} label={b.line.label} active={tool === 'line'} onClick={pick('line')} tooltip={tip(b.line, { illustration: <IlluLine />,  shortcut: 'L' })} />
        <RibbonButton icon={Spline} label={b.curve.label} active={tool === 'curve'} onClick={pick('curve')} tooltip={tip(b.curve, { shortcut: 'B', illustration: <IlluCurve /> })} />
        <RibbonButton icon={Square} label={b.rect.label} active={tool === 'rect'} onClick={pick('rect')} tooltip={tip(b.rect, { shortcut: 'R', illustration: <IlluRect /> })} />
        <RibbonButton icon={Circle} label={b.circle.label} active={tool === 'circle'} onClick={pick('circle')} tooltip={tip(b.circle, { shortcut: 'C', illustration: <IlluCircle /> })} />
        <RibbonButton icon={Type} label={b.text.label} active={tool === 'text'} onClick={pick('text')} tooltip={tip(b.text, { illustration: <IlluText />,  shortcut: 'T' })} />
      </RibbonGroup>
      <RibbonGroup label={t.groups.modify}>
        <RibbonButton icon={CornerRadius} label={b.fillet.label} active={tool === 'fillet'} onClick={pick('fillet')} tooltip={tip(b.fillet, { illustration: <IlluFillet />,  shortcut: 'K' })} />
        <RibbonButton
          icon={ShapeOffset}
          label={b.offset.label}
          disabled={!hasShapeSelection}
          onClick={() => openDialog('offset')}
          tooltip={tip(b.offset, { disabledReason: hasShapeSelection ? undefined : t.reasons.needsSelection })}
        />
        <RibbonMenuButton
          icon={ShapesUnion}
          label={b.combine.label}
          tooltip={tip(b.combine, { disabledReason: selCount < 2 ? t.shapeOps.needTwo : undefined })}
          items={[
            { icon: ShapesUnion, label: b.union.title, desc: b.union.desc, onClick: () => combineSelection('union'), disabled: selCount < 2 },
            { icon: ShapesSubtract, label: b.subtract.title, desc: b.subtract.desc, onClick: () => combineSelection('subtract'), disabled: selCount < 2 },
            { icon: ShapesIntersect, label: b.intersect.title, desc: b.intersect.desc, onClick: () => combineSelection('intersect'), disabled: selCount < 2 },
          ]}
        />
        <RibbonMenuButton
          icon={AlignCenterVertical}
          label={b.align.label}
          tooltip={tip(b.align, { disabledReason: hasShapeSelection ? undefined : t.reasons.needsSelection })}
          items={[
            ...(Object.keys(ALIGN_ICONS) as AlignMode[]).map((m) => ({ icon: ALIGN_ICONS[m], label: t.align.modes[m], onClick: () => alignSelection(m), disabled: !hasShapeSelection })),
            { icon: DISTRIBUTE_ICONS.h, label: t.align.distribute.h, desc: t.align.distributeDesc, onClick: () => distributeSelection('h'), disabled: selCount < 3 },
            { icon: DISTRIBUTE_ICONS.v, label: t.align.distribute.v, onClick: () => distributeSelection('v'), disabled: selCount < 3 },
          ]}
        />
        {/* Verktyg som används mer sällan – så att bandet inte blir för brett. */}
        <RibbonMenuButton
          icon={Ellipsis}
          label={b.more.label}
          tooltip={tip(b.more)}
          items={[
            { icon: Grid3x3, label: b.pattern.title, desc: b.pattern.desc, onClick: () => openDialog('pattern'), disabled: !hasShapeSelection },
            { icon: Ruler, label: `${b.measure.title} (M)`, desc: b.measure.desc, onClick: pick('measure') },
          ]}
        />
      </RibbonGroup>
      <RibbonGroup label={t.groups.snap}>
        <RibbonButton icon={Magnet} label={b.snapGrid.label} active={snap.grid} onClick={() => setSnap({ grid: !snap.grid })} tooltip={tip(b.snapGrid, { illustration: <IlluSnap /> })} />
        <RibbonStack>
          <span className="text-2xs text-muted">{t.snap.step}</span>
          <div className="w-24 [@media(pointer:coarse)]:w-28">
            <Select
              value={String(snap.step)}
              onChange={(v) => setSnap({ step: Number(v), grid: true })}
              options={['0.1', '0.5', '1', '2', '5', '10'].map((v) => ({ value: v, label: `${v.replace('.', decimalSep(t))} mm` }))}
            />
          </div>
        </RibbonStack>
      </RibbonGroup>
      <RibbonGroup label={t.groups.library}>
        <RibbonButton icon={Shapes} label={b.shapeLibrary.label} onClick={() => openDialog('shapeLibrary')} tooltip={tip(b.shapeLibrary, { illustration: <IlluShapeLibrary /> })} />
        <RibbonButton icon={Cog} label={b.gear.label} onClick={() => openDialog('gear')} tooltip={tip(b.gear, { illustration: <IlluGear /> })} />
        {isRouter && <RibbonButton icon={Mountain} label={b.reliefLibrary.label} onClick={() => openDialog('reliefLibrary')} tooltip={tip(b.reliefLibrary, { illustration: <IlluRelief /> })} />}
      </RibbonGroup>
      <RibbonGroup label={t.groups.import}>
        <RibbonButton icon={FileUp} label={b.importVector.label} onClick={() => void importVectorFile()} tooltip={tip(b.importVector, { shortcut: '⌘I', illustration: <IlluImport /> })} />
        <RibbonButton icon={FileCode2} label={b.importGcode.label} onClick={() => void importGcodeFile()} tooltip={tip(b.importGcode)} />
        {/* Reliefer fräses – Bild till relief finns bara med fräs. */}
        <RibbonMenuButton
          icon={ImageIcon}
          label={b.importImage.label}
          tooltip={tip(b.importImage, { illustration: <IlluImageRelief /> })}
          items={[
            { icon: ImageIcon, label: b.importImage.title, desc: b.importImage.desc, onClick: () => void importImage() },
            { icon: ScanLine, label: b.traceImage.title, desc: b.traceImage.desc, onClick: () => openDialog('trace') },
            // Reliefer fräses – Bild till relief bara med fräs.
            ...(isRouter ? [{ icon: ImageUp, label: b.imageRelief.label, desc: b.imageRelief.desc, onClick: () => void importImageRelief() }] : []),
          ]}
        />
      </RibbonGroup>
    </>
  );
}
