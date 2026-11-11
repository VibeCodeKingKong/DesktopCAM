import { Box, Eye, EyeOff, Maximize, MoveRight, PanelBottom, Pause, Play, SkipForward, Square, X } from 'lucide-react';
import { playPause, showFinalResult, stopSimulation } from '../../../cam/simController';
import { RibbonButton } from '../RibbonButton';
import { RibbonGroup } from '../RibbonGroup';
import { useAppStore } from '../../../store/useAppStore';
import { useT } from '../../../i18n';
import { tip } from '../tip';
import { IlluRapids, IlluResult, IlluShowToolpaths, IlluSimulate, IlluStock, IlluStop, IlluViewFit, IlluViewIso, IlluViewTop } from '../../smartguide/illustrations';

export function SimulateTab() {
  const t = useT();
  const b = t.buttons;
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const cmd = useAppStore((s) => s.sendViewCommand);
  const sim = useAppStore((s) => s.sim);
  return (
    <>
      <RibbonGroup label={t.groups.simulation}>
        <RibbonButton icon={sim.playing ? Pause : Play} label={sim.playing ? t.sim.pause : b.simPlay.label} active={sim.active} onClick={playPause} tooltip={tip(b.simPlay, { illustration: <IlluSimulate /> })} />
        <RibbonButton icon={SkipForward} label={b.simResult.label} onClick={showFinalResult} tooltip={tip(b.simResult, { illustration: <IlluResult /> })} />
        <RibbonButton icon={X} label={b.simStop.label} disabled={!sim.active} onClick={stopSimulation} tooltip={tip(b.simStop, { illustration: <IlluStop /> })} />
      </RibbonGroup>
      <RibbonGroup label={t.groups.show}>
        <RibbonButton icon={view.showToolpaths ? Eye : EyeOff} label={b.showToolpaths.label} active={view.showToolpaths} onClick={() => setView({ showToolpaths: !view.showToolpaths })} tooltip={tip(b.showToolpaths, { illustration: <IlluShowToolpaths /> })} />
        <RibbonButton icon={MoveRight} label={b.showRapids.label} active={view.showRapids} onClick={() => setView({ showRapids: !view.showRapids })} tooltip={tip(b.showRapids, { illustration: <IlluRapids /> })} />
        <RibbonButton icon={PanelBottom} label={b.showStock.label} active={view.showStock} onClick={() => setView({ showStock: !view.showStock })} tooltip={tip(b.showStock, { illustration: <IlluStock /> })} />
      </RibbonGroup>
      <RibbonGroup label={t.groups.camera}>
        <RibbonButton icon={Square} label={b.viewTop.label} onClick={() => cmd('top')} tooltip={tip(b.viewTop, { illustration: <IlluViewTop />,  shortcut: '1' })} />
        <RibbonButton icon={Box} label={b.viewIso.label} onClick={() => cmd('iso')} tooltip={tip(b.viewIso, { illustration: <IlluViewIso />,  shortcut: '2' })} />
        <RibbonButton icon={Maximize} label={b.viewFit.label} onClick={() => cmd('fit')} tooltip={tip(b.viewFit, { illustration: <IlluViewFit />,  shortcut: 'F' })} />
      </RibbonGroup>
    </>
  );
}
