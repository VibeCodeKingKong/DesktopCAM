import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useT } from '../../i18n';
import { Dialog } from '../ui/Dialog';
import { APP_VERSION, CHANGELOG } from '../../data/changelog';

const SEEN_KEY = 'desktopcam.seenVersion';

/** Om desktopCAM: version och nyheter i varje uppdatering. */
export function AboutDialog() {
  const t = useT();
  const open = useAppStore((s) => s.dialog === 'about');
  const close = () => useAppStore.getState().openDialog(null);

  // Efter en uppdatering: visa nyheterna en gång. Nya användare får dem inte direkt.
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
    if (import.meta.env.DEV && CHANGELOG[0]?.version !== APP_VERSION) {
      console.warn(`[desktopCAM] Versionen i package.json (${APP_VERSION}) saknas överst i data/changelog.ts`);
    }
  }, []);

  return (
    <Dialog open={open} onClose={close} title={t.about.title} width="max-w-lg" footer={<><div className="flex-1" /><button className="btn btn-primary" onClick={close}>{t.common.close}</button></>}>
      <div className="space-y-4 p-4">
        <p className="text-sm">
          <span className="font-semibold">desktopCAM</span> <span className="tabular-nums text-muted">{t.about.version(APP_VERSION)}</span>
        </p>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{t.about.whatsNew}</h3>
        <ol className="max-h-[45vh] space-y-4 overflow-y-auto pr-1">
          {CHANGELOG.map((e) => (
            <li key={e.version}>
              <p className="mb-1 flex items-baseline gap-2 text-sm">
                <span className="font-semibold tabular-nums">{e.version}</span>
                <span className="text-2xs text-muted">{new Date(e.date).toLocaleDateString(t.locale, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                {e.version === APP_VERSION && <span className="rounded bg-accent/10 px-1.5 py-0.5 text-2xs font-medium text-accent">{t.about.current}</span>}
              </p>
              <ul className="list-disc space-y-0.5 pl-5 text-xs leading-relaxed">
                {e.text[t.code].map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
        <section className="space-y-1.5 border-t border-line pt-3 text-2xs leading-relaxed text-muted">
          <h3 className="text-xs font-semibold uppercase tracking-wide">{t.about.legalTitle}</h3>
          <p>{t.about.disclaimer}</p>
          <p>{t.about.trademarks}</p>
          <p>
            {t.about.licensesIntro}{' '}
            <a href="/licenses.txt" target="_blank" rel="noopener" className="text-accent underline">
              {t.about.licensesLink}
            </a>
          </p>
        </section>
      </div>
    </Dialog>
  );
}
