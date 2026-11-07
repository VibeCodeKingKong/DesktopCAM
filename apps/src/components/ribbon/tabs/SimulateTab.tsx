import { Box, Eye, EyeOff, Maximize, MoveRight, Square, PanelBottom } from 'lucide-react';
import { RibbonButton } from '../RibbonButton';
import { RibbonGroup } from '../RibbonGroup';
import { useAppStore } from '../../../store/useAppStore';

export function SimulateTab() {
  const view = useAppStore((s) => s.view);
  const setView = useAppStore((s) => s.setView);
  const cmd = useAppStore((s) => s.sendViewCommand);
  return (
    <>
      <RibbonGroup label="Visa">
        <RibbonButton
          icon={view.showToolpaths ? Eye : EyeOff}
          label="Verktygs­banor"
          active={view.showToolpaths}
          onClick={() => setView({ showToolpaths: !view.showToolpaths })}
          tooltip={{ title: 'Visa verktygsbanor', description: 'Visar eller döljer alla beräknade banor i 3D-vyn.' }}
        />
        <RibbonButton
          icon={MoveRight}
          label="Snabb­förflyttningar"
          active={view.showRapids}
          onClick={() => setView({ showRapids: !view.showRapids })}
          tooltip={{ title: 'Snabbförflyttningar', description: 'Visar G0-förflyttningar i luften mellan snitten som tunna grå linjer.' }}
        />
        <RibbonButton
          icon={PanelBottom}
          label="Material"
          active={view.showStock}
          onClick={() => setView({ showStock: !view.showStock })}
          tooltip={{ title: 'Visa material', description: 'Visar eller döljer arbetsstycket så att du ser banornas djup.' }}
        />
      </RibbonGroup>
      <RibbonGroup label="Kamera">
        <RibbonButton icon={Square} label="Uppifrån" onClick={() => cmd('top')} tooltip={{ title: 'Vy uppifrån', description: 'Tittar rakt ner på arbetsytan, som en ritning.', shortcut: '1' }} />
        <RibbonButton icon={Box} label="Iso" onClick={() => cmd('iso')} tooltip={{ title: 'Isometrisk vy', description: 'Snett ovanifrån – bäst för att se djup.', shortcut: '2' }} />
        <RibbonButton icon={Maximize} label="Anpassa" onClick={() => cmd('fit')} tooltip={{ title: 'Anpassa vy', description: 'Zoomar så att hela arbetsytan syns.', shortcut: 'F' }} />
      </RibbonGroup>
    </>
  );
}
