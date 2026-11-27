import { Cpu } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useT } from '../../i18n';

export function StatusBar() {
  const t = useT();
  const status = useAppStore((s) => s.status);
  const cursor = useAppStore((s) => s.cursor);
  const engine = useAppStore((s) => s.engine);
  const units = useAppStore((s) => s.units);
  const k = units === 'in' ? 1 / 25.4 : 1;
  const d = units === 'in' ? 3 : 2;
  const fmt = (n: number) => (n * k).toLocaleString(t.locale, { minimumFractionDigits: d, maximumFractionDigits: d });

  const engineLabel = engine ? (engine.engine === 'wasm' ? `Wasm ${engine.version}` : t.statusbar.engineTs) : t.statusbar.engineStarting;
  const engineTitle = engine ? t.statusbar.engineTitle(engine.engine === 'wasm', engine.threads) : '';

  return (
    <footer className="flex h-7 shrink-0 items-center gap-4 border-t border-line bg-surface px-3 text-2xs sm:pb-[env(safe-area-inset-bottom)] text-muted box-content">
      <span className="min-w-0 flex-1 truncate" role="status" aria-live="polite">
        {status || t.status.ready}
      </span>
      <span className="hidden tabular-nums sm:inline">
        {cursor ? `X ${fmt(cursor.x)}   Y ${fmt(cursor.y)}   Z ${fmt(cursor.z)} ${units}` : 'X –   Y –   Z –'}
      </span>
      <button
        className="hidden rounded px-1.5 py-0.5 hover:bg-app hover:text-ink md:inline"
        onClick={() => useAppStore.getState().setUnits(units === 'mm' ? 'in' : 'mm')}
        title={t.units.switchTitle}
        aria-label={t.units.switchTitle}
      >
        {units === 'in' ? t.units.imperial : t.statusbar.unit}
      </button>
      <span className="hidden items-center gap-1 sm:flex" title={engineTitle}>
        <Cpu size={12} className={engine?.engine === 'wasm' ? 'text-ok' : 'text-muted'} />
        {engineLabel}
      </span>
    </footer>
  );
}
