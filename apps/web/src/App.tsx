import { maybeWelcome } from './tutorial/tour';
import { lazy, Suspense, useEffect, type ComponentType, type LazyExoticComponent } from 'react';
import { AppHeader } from './components/layout/AppHeader';
import { ProjectTree } from './components/layout/ProjectTree';
import { PropertiesPanel } from './components/layout/PropertiesPanel';
import { StatusBar } from './components/layout/StatusBar';
import { UpdatePrompt } from './components/layout/UpdatePrompt';
import { MobileTabBar, Ribbon } from './components/ribbon/Ribbon';
import { SetupSheet } from './components/ribbon/tabs/SetupTab';
import { Viewport } from './components/viewport/Viewport';
import { camClient } from './engine/camClient';
import { useShortcuts } from './hooks/useShortcuts';
import { useAppStore, type DialogId } from './store/useAppStore';
import { APP_VERSION } from './data/version';
import { getT } from './i18n';
import { startAutosave } from './cam/commands';
import { computeToolpath, watchForChanges } from './cam/toolpathService';
import { watchSimulationInputs } from './cam/simController';
import { watchReliefPlugs } from './cam/commands';

/**
 * Dialogfönstren laddas först när de öppnas (mindre att hämta vid start).
 * Varje fönster monteras bara medan det är öppet.
 */
const DIALOGS: Partial<Record<DialogId, LazyExoticComponent<ComponentType>>> = {
  machineSetup: lazy(() => import('./components/dialogs/MachineSetupDialog').then((m) => ({ default: m.MachineSetupDialog }))),
  gcodeViewer: lazy(() => import('./components/dialogs/GcodeViewer').then((m) => ({ default: m.GcodeViewer }))),
  importFile: lazy(() => import('./components/dialogs/ImportDialog').then((m) => ({ default: m.ImportDialog }))),
  reliefLibrary: lazy(() => import('./components/dialogs/ReliefLibraryDialog').then((m) => ({ default: m.ReliefLibraryDialog }))),
  shapeLibrary: lazy(() => import('./components/dialogs/ShapeLibraryDialog').then((m) => ({ default: m.ShapeLibraryDialog }))),
  text: lazy(() => import('./components/dialogs/TextDialog').then((m) => ({ default: m.TextDialog }))),
  gear: lazy(() => import('./components/dialogs/GearDialog').then((m) => ({ default: m.GearDialog }))),
  imageRelief: lazy(() => import('./components/dialogs/ImageReliefDialog').then((m) => ({ default: m.ImageReliefDialog }))),
  about: lazy(() => import('./components/dialogs/AboutDialog').then((m) => ({ default: m.AboutDialog }))),
  feedback: lazy(() => import('./components/dialogs/FeedbackDialog').then((m) => ({ default: m.FeedbackDialog }))),
  donate: lazy(() => import('./components/dialogs/DonateDialog').then((m) => ({ default: m.DonateDialog }))),
  exportGcode: lazy(() => import('./components/dialogs/ExportDialog').then((m) => ({ default: m.ExportDialog }))),
  pattern: lazy(() => import('./components/dialogs/PatternDialog').then((m) => ({ default: m.PatternDialog }))),
  welcome: lazy(() => import('./components/dialogs/WelcomeDialog').then((m) => ({ default: m.WelcomeDialog }))),
  trace: lazy(() => import('./components/dialogs/TraceDialog').then((m) => ({ default: m.TraceDialog }))),
};

function OpenDialog() {
  const id = useAppStore((s) => s.dialog);
  const Dialog = id ? DIALOGS[id] : undefined;
  if (!Dialog) return null;
  return (
    <Suspense fallback={null}>
      <Dialog />
    </Suspense>
  );
}

const SEEN_KEY = 'desktopcam.seenVersion';

/** Efter en uppdatering: visa nyheterna en gång. Nya användare får dem inte direkt. */
function useNewsAfterUpdate() {
  useEffect(() => {
    try {
      const seen = localStorage.getItem(SEEN_KEY);
      const returning = seen !== null || localStorage.getItem('desktopcam.autosave.v1') !== null;
      if (seen !== APP_VERSION) {
        localStorage.setItem(SEEN_KEY, APP_VERSION);
        if (returning) useAppStore.getState().openDialog('about');
      }
    } catch {
      /* privat läge */
    }
    if (import.meta.env.DEV)
      void import('./data/changelog').then(({ CHANGELOG }) => {
        if (CHANGELOG[0]?.version !== APP_VERSION) console.warn(`[desktopCAM] Versionen i package.json (${APP_VERSION}) saknas överst i data/changelog.ts`);
      });
  }, []);
}

export default function App() {
  const theme = useAppStore((s) => s.theme);
  const language = useAppStore((s) => s.language);
  useShortcuts();
  useNewsAfterUpdate();

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
    const tourTimer = maybeWelcome();
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
      <MobileTabBar />
      <SetupSheet />
      <OpenDialog />
      <UpdatePrompt />
    </div>
  );
}
