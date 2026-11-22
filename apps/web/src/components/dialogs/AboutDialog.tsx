import { useAppStore } from '../../store/useAppStore';
import { useT } from '../../i18n';
import { Dialog } from '../ui/Dialog';
import { Heart } from 'lucide-react';
import { DONATE_URL } from '../../config/donate';
import { APP_VERSION, CHANGELOG, compareVersions } from '../../data/changelog';

/** Om desktopCAM: version och nyheter i varje uppdatering. */
export function AboutDialog() {
  const t = useT();
  const open = useAppStore((s) => s.dialog === 'about');
  const close = () => useAppStore.getState().openDialog(null);
  // Versionen användaren hade före senaste uppdateringen (sätts i App).
  let since: string | null = null;
  try {
    since = localStorage.getItem('desktopcam.newsSince');
  } catch {
    /* privat läge */
  }
  const isNew = (v: string) => !!since && compareVersions(v, since) > 0 && compareVersions(v, APP_VERSION) <= 0;

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
                {/* En post per dag: datumet som rubrik, dagens senaste version bredvid. */}
                <span className="font-semibold">{new Date(e.date).toLocaleDateString(t.locale, { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                <span className="text-2xs tabular-nums text-muted">v{e.version}</span>
                {e.version === APP_VERSION && <span className="rounded bg-accent/10 px-1.5 py-0.5 text-2xs font-medium text-accent">{t.about.current}</span>}
              </p>
              <ul className="list-disc space-y-0.5 pl-5 text-xs leading-relaxed">
                {e.text[t.code].map((x, i) => {
                  // "**Rubrik** text": rubriken i fetstil.
                  const m = /^\*\*(.+?)\*\*\s*(.*)$/s.exec(x);
                  return (
                    <li key={x}>
                      {isNew(e.since?.[i] ?? e.version) && <span className="mr-1.5 rounded bg-accent px-1.5 py-px text-2xs font-semibold text-white">{t.about.newBadge}</span>}
                      {m ? (
                        <>
                          <span className="font-semibold">{m[1]}</span> {m[2]}
                        </>
                      ) : (
                        x
                      )}
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
        <div className="flex gap-2">
          <button className="btn flex-1 justify-center" onClick={() => useAppStore.getState().openDialog('feedback')}>
            {t.feedback.open}
          </button>
          {DONATE_URL && (
            <button className="btn flex-1 justify-center" onClick={() => useAppStore.getState().openDialog('donate')}>
              <Heart size={13} className="text-rose-500" /> {t.donate.open}
            </button>
          )}
        </div>
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
