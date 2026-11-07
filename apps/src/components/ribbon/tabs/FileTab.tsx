import { FilePlus, FolderOpen, Save, Settings2 } from 'lucide-react';
import { RibbonButton } from '../RibbonButton';
import { RibbonGroup } from '../RibbonGroup';
import { useAppStore } from '../../../store/useAppStore';
import { notYet } from '../../../cam/commands';

export function FileTab() {
  const newProject = useAppStore((s) => s.newProject);
  const openDialog = useAppStore((s) => s.openDialog);
  return (
    <>
      <RibbonGroup label="Projekt">
        <RibbonButton
          icon={FilePlus}
          label="Nytt"
          onClick={newProject}
          tooltip={{ title: 'Nytt projekt', description: 'Börjar om med ett tomt lager. Maskin och material behålls.' }}
        />
        <RibbonButton
          icon={FolderOpen}
          label="Öppna"
          onClick={() => notYet('Öppna projekt')}
          tooltip={{ title: 'Öppna projekt', description: 'Öppnar en sparad .dcam-fil från datorn.' }}
        />
        <RibbonButton
          icon={Save}
          label="Spara"
          onClick={() => notYet('Spara projekt')}
          tooltip={{ title: 'Spara projekt', description: 'Sparar ritning, material och verktygsbanor i en fil på datorn.', shortcut: '⌘S' }}
        />
      </RibbonGroup>
      <RibbonGroup label="Inställningar">
        <RibbonButton
          icon={Settings2}
          label="Maskin­inställning"
          onClick={() => openDialog('machineSetup')}
          tooltip={{ title: 'Maskininställning', description: 'Välj maskin, arbetsyta, firmware och postprocessor.' }}
        />
      </RibbonGroup>
    </>
  );
}
