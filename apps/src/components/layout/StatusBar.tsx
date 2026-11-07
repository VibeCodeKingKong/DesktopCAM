import { Cpu } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { Switch } from '../ui/Field';

const fmt = (n: number) => n.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function StatusBar() {
  const status = useAppStore((s) => s.status);
  const cursor = useAppStore((s) => s.cursor);
  const engine = useAppStore((s) => s.engine);
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  const engineLabel = engine ? (engine.engine === 'wasm' ? `Wasm ${engine.version}` : 'TypeScript-motor') : 'Startar motor';
  const engineTitle = engine
    ? `${engine.engine === 'wasm' ? 'Rust/WebAssembly' : 'TypeScript-reserv (kör pnpm wasm:build för Wasm)'} i Web Worker, ${engine.threads} kärnor${
        engine.crossOriginIsolated ? ', trådar möjliga' : ''
      }`
    : '';

  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-line bg-surface px-3 text-2xs text-muted">
      <span className="min-w-0 flex-1 truncate" role="status" aria-live="polite">
        {status}
      </span>
      <span className="hidden tabular-nums sm:inline">
        {cursor ? `X ${fmt(cursor.x)}   Y ${fmt(cursor.y)}   Z ${fmt(cursor.z)} mm` : 'X –   Y –   Z –'}
      </span>
      <span className="hidden md:inline">Metriskt (mm)</span>
      <span className="flex items-center gap-1" title={engineTitle}>
        <Cpu size={12} className={engine?.engine === 'wasm' ? 'text-ok' : 'text-muted'} />
        {engineLabel}
      </span>
      <label className="flex items-center gap-2">
        <span className="hidden lg:inline">Mörkt läge</span>
        <Switch checked={theme === 'dark'} onChange={(v) => setTheme(v ? 'dark' : 'light')} label="Mörkt läge" />
      </label>
    </footer>
  );
}
