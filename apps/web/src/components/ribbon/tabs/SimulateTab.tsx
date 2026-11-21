import { Box, Eye, EyeOff, Maximize, MoveRight, Focus, PanelBottom, Pause, Play, SkipForward, Square, X } from 'lucide-react';
import { playPause, showFinalResult, stopSimulation } from '../../../cam/simController';
import { RibbonButton } from '../RibbonButton';
import { RibbonGroup } from '../RibbonGroup';
import { useAppStore } from '../../../store/useAppStore';
import { useT } from '../../../i18n';
import { tip } from '../tip';
import { IlluRapids, IlluResult, IlluShowToolpaths, IlluSimulate, IlluStock, IlluStop, IlluViewFit, IlluViewFitStock, IlluViewIso, IlluViewTop } from '../../smartguide/illustrations';

export function SimulateTab() {
  const t = useT();
  const b = t.buttons;
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const cmd = useAppStore((s) => s.sendViewCommand);
  const sim = useAppStore((s) => s.sim);
  // Under simuleringen ritas det frästa materialet i stället och banorna döljs – visningsvalen gäller då inte.
  const duringSim = sim.active ? t.reasons.duringSim : undefined;
  return (
    <>
      <RibbonGroup label={t.groups.simulation}>
        <RibbonButton icon={sim.playing ? Pause : Play} label={sim.playing ? t.sim.pause : b.simPlay.label} active={sim.active} onClick={playPause} tooltip={tip(b.simPlay, { illustration: <IlluSimulate /> })} />
        <RibbonButton icon={SkipForward} label={b.simResult.label} onClick={showFinalResult} tooltip={tip(b.simResult, { illustration: <IlluResult /> })} />
        <RibbonButton icon={X} label={b.simStop.label} disabled={!sim.active} onClick={stopSimulation} tooltip={tip(b.simStop, { illustration: <IlluStop /> })} />
      </RibbonGroup>
      <RibbonGroup label={t.groups.show}>
        {/* Telefon: kompakta av/på-knappar i två rader, så att allt får plats. */}
        <div className="flex flex-col gap-1 pt-1 sm:hidden">
          {(
            [
              [
                ['showToolpaths', view.showToolpaths ? Eye : EyeOff, b.showToolpaths.label],
                ['showStock', PanelBottom, b.showStock.label],
              ],
              [['showRapids', MoveRight, b.showRapids.label]],
            ] as const
          ).map((row, r) => (
            <div key={r} className="flex gap-1">
              {row.map(([key, Icon, label]) => (
                <button
                  key={key}
                  disabled={sim.active}
                  aria-pressed={view[key]}
                  onClick={() => setView({ [key]: !view[key] })}
                  className={`flex h-8 items-center gap-1 whitespace-nowrap rounded-md px-1.5 text-xs disabled:opacity-35 ${
                    view[key] ? 'bg-accent/10 text-accent ring-1 ring-inset ring-accent/30' : 'text-ink/80'
                  }`}
                >
                  <Icon size={14} className="shrink-0" /> {label}
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="hidden sm:contents">
        <RibbonButton icon={view.showToolpaths ? Eye : EyeOff} label={b.showToolpaths.label} disabled={sim.active} active={view.showToolpaths} onClick={() => setView({ showToolpaths: !view.showToolpaths })} tooltip={tip(b.showToolpaths, { disabledReason: duringSim, illustration: <IlluShowToolpaths /> })} />
        <RibbonButton icon={MoveRight} label={b.showRapids.label} disabled={sim.active} active={view.showRapids} onClick={() => setView({ showRapids: !view.showRapids })} tooltip={tip(b.showRapids, { disabledReason: duringSim, illustration: <IlluRapids /> })} />
        <RibbonButton icon={PanelBottom} label={b.showStock.label} disabled={sim.active} active={view.showStock} onClick={() => setView({ showStock: !view.showStock })} tooltip={tip(b.showStock, { disabledReason: duringSim, illustration: <IlluStock /> })} />
        </div>
      </RibbonGroup>
      {/* Kameran finns i vyns egen knapp på telefon. */}
      <div className="hidden sm:contents">
      <RibbonGroup label={t.groups.camera}>
        <RibbonButton icon={Square} label={b.viewTop.label} onClick={() => cmd('top')} tooltip={tip(b.viewTop, { illustration: <IlluViewTop />,  shortcut: '1' })} />
        <RibbonButton icon={Box} label={b.viewIso.label} onClick={() => cmd('iso')} tooltip={tip(b.viewIso, { illustration: <IlluViewIso />,  shortcut: '2' })} />
        <RibbonButton icon={Focus} label={b.viewFitStock.label} onClick={() => cmd('fitStock')} tooltip={tip(b.viewFitStock, { illustration: <IlluViewFitStock />, shortcut: 'S' })} />
        <RibbonButton icon={Maximize} label={b.viewFit.label} onClick={() => cmd('fit')} tooltip={tip(b.viewFit, { illustration: <IlluViewFit />,  shortcut: 'F' })} />
      </RibbonGroup>
      </div>
    </>
  );
}
