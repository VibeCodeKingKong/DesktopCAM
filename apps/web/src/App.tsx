import { maybeStartTour } from './tutorial/tour';
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
import { ShapeLibraryDialog } from './components/dialogs/ShapeLibraryDialog';
import { TextDialog } from './components/dialogs/TextDialog';
import { GearDialog } from './components/dialogs/GearDialog';
import { ImageReliefDialog } from './components/dialogs/ImageReliefDialog';
import { AboutDialog } from './components/dialogs/AboutDialog';
import { PatternDialog } from './components/dialogs/PatternDialog';
import { camClient } from './engine/camClient';
import { useShortcuts } from './hooks/useShortcuts';
import { useAppStore } from './store/useAppStore';
import { getT } from './i18n';
import { startAutosave } from './cam/commands';
import { computeToolpath, watchForChanges } from './cam/toolpathService';
import { watchSimulationInputs } from './cam/simController';
import { watchReliefPlugs } from './cam/commands';

export default function App() {
  const theme = useAppStore((s) => s.theme);
  const language = useAppStore((s) => s.language);
  useShortcuts();

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#202024' : '#fbfbfd');
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    camClient
      .ping()
      .then((info) => useAppStore.getState().setEngine(info))
      .catch((err: Error) => useAppStore.getState().setStatus(getT().status.engineFailed(err.message)));
    const stopAutosave = startAutosave();
    const stopWatch = watchForChanges();
    const stopSimWatch = watchSimulationInputs();
    const stopPlugWatch = watchReliefPlugs();
    for (const tp of useAppStore.getState().toolpaths) void computeToolpath(tp.id);
    const tourTimer = maybeStartTour();
    return () => {
      stopAutosave();
      stopWatch();
      stopSimWatch();
      stopPlugWatch();
      clearTimeout(tourTimer);
    };
  }, []);

  return (
    <div className="flex h-full flex-col bg-app text-ink">
      <AppHeader />
      <Ribbon />
      <div className="relative flex min-h-0 flex-1">
        <ProjectTree />
        <main className="relative min-w-0 flex-1" data-tour="viewport">
          <Viewport />
        </main>
        <PropertiesPanel />
      </div>
      <StatusBar />
      <MachineSetupDialog />
      <GcodeViewer />
      <ImportDialog />
      <ReliefLibraryDialog />
      <ShapeLibraryDialog />
      <TextDialog />
      <GearDialog />
      <ImageReliefDialog />
      <AboutDialog />
      <PatternDialog />
    </div>
  );
}
