import { useEffect, useRef, useState } from 'react';
import { CircleHelp, Heart, Info, MessageSquarePlus, GraduationCap, Languages, ListTree, Moon, MoreHorizontal, Redo2, Settings, SlidersHorizontal, Sun, Undo2 } from 'lucide-react';
import { useAppStore, useMachine } from '../../store/useAppStore';
import { LANGUAGES, useT, type Language } from '../../i18n';
import { redo, undo } from '../../cam/commands';
import { Switch } from '../ui/Field';
import { APP_VERSION } from '../../data/changelog';
import { DONATE_URL } from '../../config/donate';

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
          className="hidden rounded px-1 py-0.5 text-2xs tabular-nums text-muted hover:bg-app hover:text-ink sm:inline-block"
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
      {DONATE_URL && (
        <button className={`${iconBtn} text-rose-500 hover:text-rose-600`} onClick={() => openDialog('donate')} aria-label={t.donate.open} title={t.donate.open}>
          <Heart size={16} />
        </button>
      )}
      {/* På telefon ligger de här i Mer-menyn. */}
      <div className="hidden sm:contents">
      <button className={iconBtn} onClick={() => openDialog('feedback')} aria-label={t.feedback.open} title={t.feedback.open}>
        <MessageSquarePlus size={16} />
      </button>
      <button className={iconBtn} onClick={() => openDialog('welcome')} aria-label={t.welcome.menu} title={t.welcome.menu} data-tour="help">
        <CircleHelp size={16} />
      </button>
      <label className="flex cursor-pointer items-center gap-1.5 text-xs" title={t.header.beginnerMode} data-tour="beginner">
        <GraduationCap size={16} className={beginner ? 'text-accent' : 'text-muted'} />
        <span className="hidden md:inline">{t.header.beginnerMode}</span>
        <Switch checked={beginner} onChange={toggleBeginner} label={t.header.beginnerMode} />
      </label>
      </div>
      <label className="relative flex items-center" title={t.header.language}>
        <Languages size={16} className="pointer-events-none absolute left-1.5 text-muted" />
        <select
          className="h-7 w-8 cursor-pointer appearance-none truncate rounded-md bg-transparent pl-7 pr-1.5 text-xs font-medium text-transparent sm:w-auto sm:text-ink [&>option]:text-ink hover:bg-app focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
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
      <MoreMenu />
      <button className={`${iconBtn} lg:hidden`} onClick={() => setMobilePanel('props')} aria-label={t.header.properties} title={t.header.properties}>
        <SlidersHorizontal size={17} />
      </button>
    </header>
  );
}

/** Telefon: hjälp, feedback, nybörjarläge, tema och maskininställning samlade i en meny. */
function MoreMenu() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const theme = useAppStore((s) => s.theme);
  const beginner = useAppStore((s) => s.beginnerMode);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);
  const s = useAppStore.getState;
  const item = 'flex h-11 w-full items-center gap-3 px-3 text-left text-sm text-ink hover:bg-app';
  const run = (f: () => void) => () => {
    setOpen(false);
    f();
  };
  return (
    <div ref={ref} className="relative sm:hidden">
      <button className={iconBtn} onClick={() => setOpen((o) => !o)} aria-label={t.header.more} title={t.header.more} aria-haspopup="menu" aria-expanded={open} data-tour="help">
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-pop">
          <button role="menuitem" className={item} onClick={run(() => s().openDialog('welcome'))}>
            <CircleHelp size={17} className="text-muted" /> {t.welcome.menu}
          </button>
          <button role="menuitem" className={item} onClick={run(() => s().openDialog('feedback'))}>
            <MessageSquarePlus size={17} className="text-muted" /> {t.feedback.open}
          </button>
          <button role="menuitemcheckbox" aria-checked={beginner} className={item} onClick={() => s().toggleBeginnerMode()}>
            <GraduationCap size={17} className={beginner ? 'text-accent' : 'text-muted'} />
            <span className="flex-1">{t.header.beginnerMode}</span>
            <span aria-hidden="true" className={`relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full transition-colors ${beginner ? 'bg-accent' : 'bg-line'}`}>
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${beginner ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </span>
          </button>
          <button role="menuitem" className={item} onClick={run(() => s().setTheme(theme === 'dark' ? 'light' : 'dark'))}>
            {theme === 'dark' ? <Sun size={17} className="text-muted" /> : <Moon size={17} className="text-muted" />} {theme === 'dark' ? t.header.toLight : t.header.toDark}
          </button>
          <button role="menuitem" className={item} onClick={run(() => s().openDialog('machineSetup'))}>
            <Settings size={17} className="text-muted" /> {t.header.machineSetup}
          </button>
          <button role="menuitem" className={`${item} border-t border-line`} onClick={run(() => s().openDialog('about'))}>
            <Info size={17} className="text-muted" /> {t.about.open} <span className="ml-auto text-2xs tabular-nums text-muted">v{APP_VERSION}</span>
          </button>
        </div>
      )}
    </div>
  );
}
