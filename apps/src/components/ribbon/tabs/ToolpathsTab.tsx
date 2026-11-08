import { CircleDot, Flame, ImagePlus, Layers, Mountain, Scissors, Square, Triangle } from 'lucide-react';
import { RibbonButton } from '../RibbonButton';
import { RibbonGroup } from '../RibbonGroup';
import { useAppStore, useMachine } from '../../../store/useAppStore';
import { createToolpath, importPhotoForEngraving } from '../../../cam/commands';
import { IlluDither, IlluDrill, IlluLaserCut, IlluPocket, IlluProfile, IlluRelief, IlluVCarve } from '../../smartguide/illustrations';

export function ToolpathsTab() {
  const machine = useMachine();
  const isLaser = machine.kind === 'laser';
  const needsRouter = isLaser ? 'Kräver en fräs. Byt maskin under Inställning.' : undefined;
  const needsLaser = isLaser ? undefined : 'Kräver en laser. Byt maskin under Inställning.';
  const soon = 'Kommer i nästa version av motorn.';
  const hasRelief = useAppStore((s) => s.reliefs.length > 0);

  return (
    <>
      <RibbonGroup label="Fräsning">
        <RibbonButton
          icon={Square}
          label="Profil"
          disabled={isLaser}
          onClick={() => createToolpath('profile')}
          tooltip={{
            title: 'Profilbana',
            description: 'Skär längs formens kontur – på utsidan för att skära ut en detalj, på insidan för hål.',
            shortcut: 'P',
            illustration: <IlluProfile />,
            disabledReason: needsRouter,
          }}
        />
        <RibbonButton
          icon={Layers}
          label="Ficka"
          disabled={isLaser}
          onClick={() => createToolpath('pocket')}
          tooltip={{ title: 'Ficka', description: 'Fräser bort allt material innanför formen till ett jämnt djup.', illustration: <IlluPocket />, disabledReason: needsRouter ?? soon }}
        />
        <RibbonButton
          icon={CircleDot}
          label="Borrning"
          disabled={isLaser}
          onClick={() => createToolpath('drill')}
          tooltip={{ title: 'Borrning', description: 'Borrar hål i cirklarnas mittpunkter, med hackborrning för djupa hål.', illustration: <IlluDrill />, disabledReason: needsRouter ?? soon }}
        />
        <RibbonButton
          icon={Triangle}
          label="V-gravyr"
          disabled={isLaser}
          onClick={() => createToolpath('vcarve')}
          tooltip={{ title: 'V-gravyr', description: 'En V-fräs går djupare där formen är bred – ger skarpa hörn och skyltlik text.', illustration: <IlluVCarve />, disabledReason: needsRouter ?? soon }}
        />
      </RibbonGroup>
      <RibbonGroup label="3D">
        <RibbonButton
          icon={Mountain}
          label="3D-relief"
          disabled={isLaser || !hasRelief}
          onClick={() => createToolpath('relief')}
          tooltip={{
            title: '3D-reliefbana',
            description: 'Kulfräsen följer reliefens yta rad för rad. Djupa reliefer grovbearbetas först i lager.',
            illustration: <IlluRelief />,
            disabledReason: needsRouter ?? (hasRelief ? undefined : 'Lägg till en relief från reliefbiblioteket under Design.'),
          }}
        />
      </RibbonGroup>
      <RibbonGroup label="Laser">
        <RibbonButton
          icon={Scissors}
          tone="laser"
          label="Laser­skärning"
          disabled={!isLaser}
          onClick={() => createToolpath('laserCut')}
          tooltip={{ title: 'Laserskärning', description: 'Skär längs konturen med kerf-kompensation så att måtten blir exakta.', shortcut: 'L', illustration: <IlluLaserCut />, disabledReason: needsLaser }}
        />
        <RibbonButton
          icon={Flame}
          tone="laser"
          label="Linje­gravyr"
          disabled={!isLaser}
          onClick={() => createToolpath('laserCut', { name: 'Linjegravyr', side: 'on', passes: 1 })}
          tooltip={{ title: 'Linjegravyr', description: 'Bränner linjerna med låg effekt, på linjen och utan kompensation.', disabledReason: needsLaser }}
        />
        <RibbonButton
          icon={ImagePlus}
          tone="laser"
          label="Foto­gravyr"
          disabled={!isLaser}
          onClick={() => void importPhotoForEngraving()}
          tooltip={{
            title: 'Fotogravyr',
            description: 'Välj ett foto. Det görs om till punktmönster (dithering) som lasern bränner rad för rad.',
            illustration: <IlluDither />,
            disabledReason: needsLaser,
          }}
        />
      </RibbonGroup>
    </>
  );
}
