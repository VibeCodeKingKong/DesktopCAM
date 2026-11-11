import { FilePlus, FolderOpen, Save, Settings2 } from 'lucide-react';
import { RibbonButton } from '../RibbonButton';
import { RibbonField, RibbonGroup, RibbonStack } from '../RibbonGroup';
import { useAppStore } from '../../../store/useAppStore';
import { newProject, openProject, saveProject } from '../../../cam/commands';
import { useT } from '../../../i18n';
import { tip } from '../tip';
import { IlluMachine, IlluNewProject, IlluOpen, IlluSave } from '../../smartguide/illustrations';

export function FileTab() {
  const t = useT();
  const b = t.buttons;
  const openDialog = useAppStore((s) => s.openDialog);
  const projectName = useAppStore((s) => s.projectName);
  const setProjectName = useAppStore((s) => s.setProjectName);
  return (
    <>
      <RibbonGroup label={t.groups.project}>
        <RibbonButton icon={FilePlus} label={b.newProject.label} onClick={newProject} tooltip={tip(b.newProject, { illustration: <IlluNewProject /> })} />
        <RibbonButton icon={FolderOpen} label={b.open.label} onClick={() => void openProject()} tooltip={tip(b.open, { illustration: <IlluOpen />,  shortcut: '⌘O' })} />
        <RibbonButton icon={Save} label={b.save.label} onClick={saveProject} tooltip={tip(b.save, { illustration: <IlluSave />,  shortcut: '⌘S' })} />
        <RibbonStack>
          <RibbonField label={t.setup.projectName}>
            <input
              className="field"
              value={projectName}
              placeholder={t.common.untitledProject}
              onChange={(e) => setProjectName(e.target.value)}
              aria-label={t.setup.projectName}
            />
          </RibbonField>
        </RibbonStack>
      </RibbonGroup>
      <RibbonGroup label={t.groups.settings}>
        <RibbonButton icon={Settings2} label={b.machineSetup.label} onClick={() => openDialog('machineSetup')} tooltip={tip(b.machineSetup, { illustration: <IlluMachine /> })} />
      </RibbonGroup>
    </>
  );
}
