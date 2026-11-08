import { useEffect } from 'react';
import { AppHeader } from './components/layout/AppHeader';
import { ProjectTree } from './components/layout/ProjectTree';
import { PropertiesPanel } from './components/layout/PropertiesPanel';
import { StatusBar } from './components/layout/StatusBar';
import { Ribbon } from './components/ribbon/Ribbon';
import { Viewport } from './components/viewport/Viewport';
import { MachineSetupDialog } from './components/dialogs/MachineSetupDialog';
import { GcodeViewer } from './components/dialogs/GcodeViewer';
import { ImportDialog } from './components/dialogs/ImportDialog';
import { ReliefLibraryDialog } from './components/dialogs/ReliefLibraryDialog';
import { camClient } from './engine/camClient';
import { useShortcuts } from './hooks/useShortcuts';
import { useAppStore } from './store/useAppStore';

export default function App() {
  const theme = useAppStore((s) => s.theme);
  useShortcuts();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#202024' : '#fbfbfd');
  }, [theme]);

  useEffect(() => {
    camClient
      .ping()
      .then((info) => useAppStore.getState().setEngine(info))
      .catch((err: Error) => useAppStore.getState().setStatus(`CAM-motorn kunde inte starta: ${err.message}`));
  }, []);

  return (
    <div className="flex h-full flex-col bg-app text-ink">
      <AppHeader />
      <Ribbon />
      <div className="flex min-h-0 flex-1">
        <ProjectTree />
        <main className="relative min-w-0 flex-1">
          <Viewport />
        </main>
        <PropertiesPanel />
      </div>
      <StatusBar />
      <MachineSetupDialog />
      <GcodeViewer />
      <ImportDialog />
      <ReliefLibraryDialog />
    </div>
  );
}
