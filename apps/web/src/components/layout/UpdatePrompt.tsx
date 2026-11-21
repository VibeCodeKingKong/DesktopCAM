import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { registerSW } from 'virtual:pwa-register';
import { useAppStore } from '../../store/useAppStore';
import { getT, useT } from '../../i18n';

/**
 * Registrerar service workern (offline och installation) och frågar innan en
 * ny version tas i bruk – en omladdning mitt i arbetet ska aldrig ske av sig själv.
 */
export function UpdatePrompt() {
  const t = useT();
  const [update, setUpdate] = useState<((reload?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
    const updateSW = registerSW({
      onNeedRefresh: () => setUpdate(() => updateSW),
      onOfflineReady: () => useAppStore.getState().setStatus(getT().pwa.offlineReady),
    });
  }, []);

  if (!update) return null;
  return (
    <div role="status" className="fixed inset-x-3 bottom-20 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-pop sm:bottom-12">
      <RefreshCw size={18} className="shrink-0 text-accent" />
      <p className="min-w-0 flex-1 text-sm">{t.pwa.updateAvailable}</p>
      <button className="btn btn-primary" onClick={() => void update(true)}>
        {t.pwa.update}
      </button>
      <button className="rounded p-1 text-muted hover:bg-app hover:text-ink" onClick={() => setUpdate(null)} aria-label={t.pwa.later} title={t.pwa.later}>
        <X size={16} />
      </button>
    </div>
  );
}
