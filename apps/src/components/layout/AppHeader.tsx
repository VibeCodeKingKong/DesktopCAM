import { GraduationCap, Moon, Settings, Sun } from 'lucide-react';
import { useAppStore, useMachine } from '../../store/useAppStore';
import { Switch } from '../ui/Field';

function Logo() {
  return (
    <svg viewBox="0 0 32 32" className="h-5 w-5" aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-accent" />
      <path d="M8 22h16M11 22l5-12 5 12" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="16" cy="10" r="2" className="fill-laser" />
    </svg>
  );
}

export function AppHeader() {
  const projectName = useAppStore((s) => s.projectName);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);
  const beginner = useAppStore((s) => s.beginnerMode);
  const toggleBeginner = useAppStore((s) => s.toggleBeginnerMode);
  const openDialog = useAppStore((s) => s.openDialog);
  const machine = useMachine();

  return (
    <header className="flex h-10 shrink-0 items-center gap-3 border-b border-line bg-surface px-3">
      <div className="flex items-center gap-2">
        <Logo />
        <span className="text-sm font-semibold tracking-tight">desktopCAM</span>
      </div>
      <p className="min-w-0 flex-1 truncate text-center text-xs text-muted">
        {projectName} <span className="mx-1 text-line">|</span> {machine.name}
      </p>
      <label className="flex cursor-pointer items-center gap-2 text-xs">
        <GraduationCap size={15} className={beginner ? 'text-accent' : 'text-muted'} />
        <span className="hidden sm:inline">Nybörjarläge</span>
        <Switch checked={beginner} onChange={toggleBeginner} label="Nybörjarläge" />
      </label>
      <button
        className="rounded-md p-1.5 text-muted hover:bg-app hover:text-ink"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        aria-label={theme === 'dark' ? 'Byt till ljust läge' : 'Byt till mörkt läge'}
        title={theme === 'dark' ? 'Ljust läge' : 'Mörkt läge'}
      >
        {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
      </button>
      <button
        className="rounded-md p-1.5 text-muted hover:bg-app hover:text-ink"
        onClick={() => openDialog('machineSetup')}
        aria-label="Maskininställning"
        title="Maskininställning"
      >
        <Settings size={15} />
      </button>
    </header>
  );
}
