import { Cpu } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useT } from '../../i18n';

export function StatusBar() {
  const t = useT();
  const status = useAppStore((s) => s.status);
  const cursor = useAppStore((s) => s.cursor);
  const engine = useAppStore((s) => s.engine);
  const fmt = (n: number) => n.toLocaleString(t.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const engineLabel = engine ? (engine.engine === 'wasm' ? `Wasm ${engine.version}` : t.statusbar.engineTs) : t.statusbar.engineStarting;
  const engineTitle = engine ? t.statusbar.engineTitle(engine.engine === 'wasm', engine.threads) : '';

  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-line bg-surface px-3 pb-[env(safe-area-inset-bottom)] text-2xs text-muted box-content">
      <span className="min-w-0 flex-1 truncate" role="status" aria-live="polite">
        {status || t.status.ready}
      </span>
      <span className="hidden tabular-nums sm:inline">
        {cursor ? `X ${fmt(cursor.x)}   Y ${fmt(cursor.y)}   Z ${fmt(cursor.z)} mm` : 'X –   Y –   Z –'}
      </span>
      <span className="hidden md:inline">{t.statusbar.unit}</span>
      <span className="hidden items-center gap-1 sm:flex" title={engineTitle}>
        <Cpu size={12} className={engine?.engine === 'wasm' ? 'text-ok' : 'text-muted'} />
        {engineLabel}
      </span>
    </footer>
  );
}
