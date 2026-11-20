import { Settings2, Zap, CircleDot, Rows3, PenLine, Grid3x3, Image as ImageIcon, Combine, Flame, ImagePlus, Layers, Mountain, Scissors, Square, Triangle } from 'lucide-react';
import { RibbonButton } from '../RibbonButton';
import { RibbonGroup } from '../RibbonGroup';
import { useAppStore, useMachine } from '../../../store/useAppStore';
import { createInlay, createLineEngraving, createToolpath, importImageForPlotter, importPhotoForEngraving } from '../../../cam/commands';
import { useT } from '../../../i18n';
import { tip } from '../tip';
import { IlluDither, IlluDrill, IlluFacing, IlluPenDraw, IlluPenFill, IlluPenImage, IlluInlay, IlluLaserCut, IlluLineEngrave, IlluPlasma, IlluPocket, IlluProfile, IlluRelief, IlluVCarve } from '../../smartguide/illustrations';

export function ToolpathsTab() {
  const t = useT();
  const b = t.buttons;
  const kind = useMachine().kind;
  const hasRelief = useAppStore((s) => s.reliefs.length > 0);
  const setTab = useAppStore((s) => s.setTab);

  // Bara banorna för den valda maskintypen visas – övriga finns när maskinen byts.
  return (
    <>
      {kind === 'router' && (
        <>
          <RibbonGroup label={t.groups.milling}>
            <RibbonButton icon={Square} label={b.profile.label} onClick={() => createToolpath('profile')} tooltip={tip(b.profile, { shortcut: 'P', illustration: <IlluProfile /> })} />
            <RibbonButton icon={Layers} label={b.pocket.label} onClick={() => createToolpath('pocket')} tooltip={tip(b.pocket, { illustration: <IlluPocket /> })} />
            <RibbonButton icon={CircleDot} label={b.drill.label} onClick={() => createToolpath('drill')} tooltip={tip(b.drill, { illustration: <IlluDrill /> })} />
            <RibbonButton icon={Triangle} label={b.vcarve.label} onClick={() => createToolpath('vcarve')} tooltip={tip(b.vcarve, { illustration: <IlluVCarve /> })} />
            <RibbonButton icon={Rows3} label={b.facing.label} onClick={() => createToolpath('facing')} tooltip={tip(b.facing, { illustration: <IlluFacing /> })} />
            <RibbonButton icon={Combine} label={b.inlay.label} onClick={createInlay} tooltip={tip(b.inlay, { illustration: <IlluInlay /> })} />
          </RibbonGroup>
          <RibbonGroup label={t.groups.threeD}>
            <RibbonButton
              icon={Mountain}
              label={b.relief3d.label}
              disabled={!hasRelief}
              onClick={() => createToolpath('relief')}
              tooltip={tip(b.relief3d, { illustration: <IlluRelief />, disabledReason: hasRelief ? undefined : t.reasons.needsRelief })}
            />
          </RibbonGroup>
        </>
      )}
      {kind === 'plotter' && (
        <RibbonGroup label={t.groups.plotter}>
          <RibbonButton icon={PenLine} label={b.penDraw.label} onClick={() => createToolpath('penDraw')} tooltip={tip(b.penDraw, { illustration: <IlluPenDraw /> })} />
          <RibbonButton icon={ImageIcon} label={b.penImage.label} onClick={() => void importImageForPlotter()} tooltip={tip(b.penImage, { illustration: <IlluPenImage /> })} />
          <RibbonButton icon={Grid3x3} label={b.penFill.label} onClick={() => createToolpath('penFill')} tooltip={tip(b.penFill, { illustration: <IlluPenFill /> })} />
        </RibbonGroup>
      )}
      {kind === 'plasma' && (
        <RibbonGroup label={t.groups.plasma}>
          <RibbonButton icon={Zap} label={b.plasmaCut.label} onClick={() => createToolpath('plasmaCut')} tooltip={tip(b.plasmaCut, { illustration: <IlluPlasma /> })} />
        </RibbonGroup>
      )}
      {kind === 'laser' && (
        <RibbonGroup label={t.groups.laser}>
          <RibbonButton icon={Scissors} tone="laser" label={b.laserCut.label} onClick={() => createToolpath('laserCut')} tooltip={tip(b.laserCut, { illustration: <IlluLaserCut /> })} />
          <RibbonButton icon={Flame} tone="laser" label={b.lineEngrave.label} onClick={createLineEngraving} tooltip={tip(b.lineEngrave, { illustration: <IlluLineEngrave /> })} />
          <RibbonButton icon={ImagePlus} tone="laser" label={b.photoEngrave.label} onClick={() => void importPhotoForEngraving()} tooltip={tip(b.photoEngrave, { illustration: <IlluDither /> })} />
        </RibbonGroup>
      )}
      <RibbonGroup label={t.groups.otherMachines}>
        <RibbonButton icon={Settings2} tone="neutral" label={b.otherMachines.label} onClick={() => setTab('setup')} tooltip={tip(b.otherMachines)} />
      </RibbonGroup>
    </>
  );
}
