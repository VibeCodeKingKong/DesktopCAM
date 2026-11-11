import { CircleHelp, GraduationCap, Languages, ListTree, Moon, Redo2, Settings, SlidersHorizontal, Sun, Undo2 } from 'lucide-react';
import { useAppStore, useMachine } from '../../store/useAppStore';
import { LANGUAGES, useT, type Language } from '../../i18n';
import { redo, undo } from '../../cam/commands';
import { Switch } from '../ui/Field';
import { startTour } from '../../tutorial/tour';
import { APP_VERSION } from '../../data/changelog';

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="h-5 w-5 shrink-0" aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-accent" />
      <path d="M8 22h16M11 22l5-12 5 12" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="10" r="2" className="fill-laser" />
    </svg>
  );
}

const iconBtn = 'rounded-md p-1.5 text-muted hover:bg-app hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent';

export function AppHeader() {
  const t = useT();
  const projectName = useAppStore((s) => s.projectName);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const beginner = useAppStore((s) => s.beginnerMode);
  const toggleBeginner = useAppStore((s) => s.toggleBeginnerMode);
  const openDialog = useAppStore((s) => s.openDialog);
  const language = useAppStore((s) => s.language);
  const setLanguage = useAppStore((s) => s.setLanguage);
  const setMobilePanel = useAppStore((s) => s.setMobilePanel);
  const canUndo = useAppStore((s) => s.past.length > 0);
  const canRedo = useAppStore((s) => s.future.length > 0);
  const machine = useMachine();

  return (
    <header className="box-content flex h-11 shrink-0 items-center gap-1.5 border-b border-line bg-surface px-2 pt-[env(safe-area-inset-top)] sm:gap-2 sm:px-3">
      <button className={`${iconBtn} lg:hidden`} onClick={() => setMobilePanel('tree')} aria-label={t.header.project} title={t.header.project}>
        <ListTree size={17} />
      </button>
      <div className="flex min-w-0 items-center gap-2">
        <Logo />
        <span className="hidden text-sm font-semibold tracking-tight sm:inline">desktopCAM</span>
        <button
          className="rounded px-1 py-0.5 text-2xs tabular-nums text-muted hover:bg-app hover:text-ink"
          onClick={() => openDialog('about')}
          title={t.about.open}
          aria-label={t.about.open}
        >
          v{APP_VERSION}
        </button>
      </div>
      <div className="flex items-center">
        <button className={iconBtn} onClick={undo} disabled={!canUndo} aria-label={t.header.undo} title={`${t.header.undo} (⌘Z)`}>
          <Undo2 size={16} />
        </button>
        <button className={iconBtn} onClick={redo} disabled={!canRedo} aria-label={t.header.redo} title={`${t.header.redo} (⇧⌘Z)`}>
          <Redo2 size={16} />
        </button>
      </div>
      <p className="min-w-0 flex-1 truncate text-center text-xs text-muted">
        <span className="hidden sm:inline">
          {projectName || t.common.untitledProject} <span className="mx-1 text-line">|</span>
        </span>
        {machine.name}
      </p>
      <button className={iconBtn} onClick={() => startTour()} aria-label={t.tour.open} title={t.tour.open} data-tour="help">
        <CircleHelp size={16} />
      </button>
      <label className="flex cursor-pointer items-center gap-1.5 text-xs" title={t.header.beginnerMode} data-tour="beginner">
        <GraduationCap size={16} className={beginner ? 'text-accent' : 'text-muted'} />
        <span className="hidden md:inline">{t.header.beginnerMode}</span>
        <Switch checked={beginner} onChange={toggleBeginner} label={t.header.beginnerMode} />
      </label>
      <label className="relative flex items-center" title={t.header.language}>
        <Languages size={16} className="pointer-events-none absolute left-1.5 text-muted" />
        <select
          className="h-7 cursor-pointer appearance-none rounded-md bg-transparent pl-7 pr-1.5 text-xs font-medium text-ink hover:bg-app focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
          value={language}
          onChange={(e) => setLanguage(e.target.value as Language)}
          aria-label={t.header.language}
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.code.toUpperCase()} · {l.name}
            </option>
          ))}
        </select>
      </label>
      <button
        className={`${iconBtn} hidden sm:block`}
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        aria-label={theme === 'dark' ? t.header.toLight : t.header.toDark}
        title={theme === 'dark' ? t.header.toLight : t.header.toDark}
      >
        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
      </button>
      <button className={`${iconBtn} hidden sm:block`} onClick={() => openDialog('machineSetup')} aria-label={t.header.machineSetup} title={t.header.machineSetup}>
        <Settings size={16} />
      </button>
      <button className={`${iconBtn} lg:hidden`} onClick={() => setMobilePanel('props')} aria-label={t.header.properties} title={t.header.properties}>
        <SlidersHorizontal size={17} />
      </button>
    </header>
  );
}
