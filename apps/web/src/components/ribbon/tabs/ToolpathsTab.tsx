import { CircleDot, Combine, Flame, ImagePlus, Layers, Mountain, Scissors, Square, Triangle } from 'lucide-react';
import { RibbonButton } from '../RibbonButton';
import { RibbonGroup } from '../RibbonGroup';
import { useAppStore, useMachine } from '../../../store/useAppStore';
import { createInlay, createLineEngraving, createToolpath, importPhotoForEngraving } from '../../../cam/commands';
import { useT } from '../../../i18n';
import { tip } from '../tip';
import { IlluDither, IlluDrill, IlluInlay, IlluLaserCut, IlluPocket, IlluProfile, IlluRelief, IlluVCarve } from '../../smartguide/illustrations';

export function ToolpathsTab() {
  const t = useT();
  const b = t.buttons;
  const machine = useMachine();
  const isLaser = machine.kind === 'laser';
  const hasRelief = useAppStore((s) => s.reliefs.length > 0);
  const needsRouter = isLaser ? t.reasons.needsRouter : undefined;
  const needsLaser = isLaser ? undefined : t.reasons.needsLaser;

  return (
    <>
      <RibbonGroup label={t.groups.milling}>
        <RibbonButton icon={Square} label={b.profile.label} disabled={isLaser} onClick={() => createToolpath('profile')} tooltip={tip(b.profile, { shortcut: 'P', illustration: <IlluProfile />, disabledReason: needsRouter })} />
        <RibbonButton icon={Layers} label={b.pocket.label} disabled={isLaser} onClick={() => createToolpath('pocket')} tooltip={tip(b.pocket, { illustration: <IlluPocket />, disabledReason: needsRouter })} />
        <RibbonButton icon={CircleDot} label={b.drill.label} disabled={isLaser} onClick={() => createToolpath('drill')} tooltip={tip(b.drill, { illustration: <IlluDrill />, disabledReason: needsRouter })} />
        <RibbonButton icon={Triangle} label={b.vcarve.label} disabled={isLaser} onClick={() => createToolpath('vcarve')} tooltip={tip(b.vcarve, { illustration: <IlluVCarve />, disabledReason: needsRouter })} />
        <RibbonButton icon={Combine} label={b.inlay.label} disabled={isLaser} onClick={createInlay} tooltip={tip(b.inlay, { illustration: <IlluInlay />, disabledReason: needsRouter })} />
      </RibbonGroup>
      <RibbonGroup label={t.groups.threeD}>
        <RibbonButton
          icon={Mountain}
          label={b.relief3d.label}
          disabled={isLaser || !hasRelief}
          onClick={() => createToolpath('relief')}
          tooltip={tip(b.relief3d, { illustration: <IlluRelief />, disabledReason: needsRouter ?? (hasRelief ? undefined : t.reasons.needsRelief) })}
        />
      </RibbonGroup>
      <RibbonGroup label={t.groups.laser}>
        <RibbonButton icon={Scissors} tone="laser" label={b.laserCut.label} disabled={!isLaser} onClick={() => createToolpath('laserCut')} tooltip={tip(b.laserCut, { illustration: <IlluLaserCut />, disabledReason: needsLaser })} />
        <RibbonButton icon={Flame} tone="laser" label={b.lineEngrave.label} disabled={!isLaser} onClick={createLineEngraving} tooltip={tip(b.lineEngrave, { disabledReason: needsLaser })} />
        <RibbonButton icon={ImagePlus} tone="laser" label={b.photoEngrave.label} disabled={!isLaser} onClick={() => void importPhotoForEngraving()} tooltip={tip(b.photoEngrave, { illustration: <IlluDither />, disabledReason: needsLaser })} />
      </RibbonGroup>
    </>
  );
}
