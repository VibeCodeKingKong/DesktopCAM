import { useEffect } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { getT, useT } from '../../i18n';
import { startUpdates, useUpdates } from '../../pwa/updates';

/**
 * Registrerar service workern (offline och installation) och frågar innan en
 * ny version tas i bruk – en omladdning mitt i arbetet ska aldrig ske av sig själv.
 * Appen letar efter nya versioner varje timme och när fliken visas igen;
 * stängs rutan kommer den tillbaka efter en halvtimme.
 */
export function UpdatePrompt() {
  const t = useT();
  const apply = useUpdates((s) => s.apply);
  const dismissed = useUpdates((s) => s.dismissedAt !== null);

  useEffect(() => {
    startUpdates(() => useAppStore.getState().setStatus(getT().pwa.offlineReady));
  }, []);

  if (!apply || dismissed) return null;
  return (
    <div role="status" className="fixed inset-x-3 bottom-20 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-pop sm:bottom-12">
      <RefreshCw size={18} className="shrink-0 text-accent" />
      <p className="min-w-0 flex-1 text-sm">{t.pwa.updateAvailable}</p>
      <button className="btn btn-primary" onClick={() => void apply(true)}>
        {t.pwa.update}
      </button>
      <button className="rounded p-1 text-muted hover:bg-app hover:text-ink" onClick={() => useUpdates.getState().dismiss()} aria-label={t.pwa.later} title={t.pwa.later}>
        <X size={16} />
      </button>
    </div>
  );
}
