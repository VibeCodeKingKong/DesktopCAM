import { useEffect, useState } from 'react';
import { Bug, X } from 'lucide-react';
import { DICTS } from '../i18n/dicts';
import { initialLanguage } from '../i18n/initial';
import { currentReport, dismissReport, onReport, sendReport, type ErrorReport } from './reports';

/** Ordlistan utan store (fungerar även när appen själv har kraschat). */
const dict = () => DICTS[(document.documentElement.lang as keyof typeof DICTS) || initialLanguage()] ?? DICTS[initialLanguage()];

/**
 * Frågar om en felrapport ska skickas, och visar exakt vad som skickas.
 * inline: visas i felsidan (appen har kraschat) i stället för som ruta nertill.
 */
export function ErrorPrompt({ inline = false }: { inline?: boolean }) {
  const t = dict().crash;
  const [report, setReport] = useState<ErrorReport | null>(currentReport());
  const [show, setShow] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  useEffect(() => {
    const off = onReport((r) => {
      setReport(r);
      setState('idle');
      setShow(false);
    });
    return () => void off();
  }, []);
  if (!report) return null;

  const send = async () => {
    setState('sending');
    const ok = await sendReport(report);
    setState(ok ? 'sent' : 'failed');
    if (ok && !inline) setTimeout(dismissReport, 2500);
  };

  return (
    <div
      role="alertdialog"
      aria-label={t.title}
      className={
        inline
          ? 'w-full max-w-md rounded-xl border border-line bg-surface p-4 text-left'
          : 'fixed inset-x-3 bottom-20 z-50 mx-auto max-w-md rounded-xl border border-line bg-surface p-4 shadow-pop sm:bottom-12'
      }
    >
      <div className="flex items-start gap-3">
        <Bug size={18} className="mt-0.5 shrink-0 text-warn" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-semibold">{t.title}</p>
          <p className="text-xs leading-relaxed text-muted">{state === 'sent' ? t.sent : state === 'failed' ? t.failed : t.body}</p>
          {show && <pre className="max-h-40 overflow-auto rounded-md bg-app p-2 text-2xs leading-snug">{JSON.stringify(report, null, 1)}</pre>}
          {state !== 'sent' && (
            <div className="flex flex-wrap gap-2 pt-1">
              <button className="btn btn-primary" disabled={state === 'sending'} onClick={() => void send()}>
                {t.send}
              </button>
              <button className="btn" onClick={() => setShow((s) => !s)}>
                {show ? t.hide : t.show}
              </button>
              {!inline && (
                <button className="btn" onClick={dismissReport}>
                  {t.no}
                </button>
              )}
            </div>
          )}
        </div>
        {!inline && (
          <button className="rounded p-1 text-muted hover:bg-app hover:text-ink" onClick={dismissReport} aria-label={t.no}>
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
