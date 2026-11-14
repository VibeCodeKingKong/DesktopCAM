import { useState } from 'react';
import { CheckCircle2, Send } from 'lucide-react';
import { useAppStore, useMachine } from '../../store/useAppStore';
import { useT } from '../../i18n';
import { Dialog } from '../ui/Dialog';
import { Segmented } from '../ui/Field';
import { APP_VERSION } from '../../data/changelog';
import { FEEDBACK_ACCESS_KEY, FEEDBACK_ENDPOINT } from '../../config/feedback';


type Kind = 'idea' | 'bug' | 'other';
type State = 'idle' | 'sending' | 'sent' | 'error';

/** Skicka feedback till utvecklaren. Mottagaradressen finns bara hos Web3Forms. */
export function FeedbackDialog() {
  const t = useT();
  const f = t.feedback;
  const open = useAppStore((s) => s.dialog === 'feedback');
  const machine = useMachine();
  const language = useAppStore((s) => s.language);
  const [kind, setKind] = useState<Kind>('idea');
  const [message, setMessage] = useState('');
  const [replyTo, setReplyTo] = useState('');
  const [includeInfo, setIncludeInfo] = useState(true);
  const [honeypot, setHoneypot] = useState(false);
  const [state, setState] = useState<State>('idle');
  const configured = FEEDBACK_ACCESS_KEY.length > 0;

  const close = () => {
    useAppStore.getState().openDialog(null);
    if (state === 'sent') {
      setMessage('');
      setState('idle');
    }
  };

  const send = async () => {
    if (!message.trim() || !configured || state === 'sending') return;
    setState('sending');
    const info = includeInfo
      ? `\n\n---\ndesktopCAM ${APP_VERSION} · ${language} · ${machine.name} (${machine.kind})\n${navigator.userAgent}`
      : '';
    try {
      const res = await fetch(FEEDBACK_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          access_key: FEEDBACK_ACCESS_KEY,
          subject: `desktopCAM feedback: ${f.kinds[kind]}`,
          from_name: 'desktopCAM',
          ...(replyTo.trim() ? { replyto: replyTo.trim(), email: replyTo.trim() } : {}),
          message: message.trim() + info,
          botcheck: honeypot,
        }),
      });
      const json = (await res.json().catch(() => null)) as { success?: boolean } | null;
      setState(res.ok && json?.success !== false ? 'sent' : 'error');
    } catch {
      setState('error');
    }
  };

  const footer =
    state === 'sent' ? (
      <>
        <div className="flex-1" />
        <button className="btn btn-primary" onClick={close}>
          {t.common.close}
        </button>
      </>
    ) : (
      <>
        <div className="flex-1" />
        <button className="btn" onClick={close}>
          {t.common.cancel}
        </button>
        <button className="btn btn-primary" onClick={() => void send()} disabled={!configured || !message.trim() || state === 'sending'}>
          <Send size={13} /> {state === 'sending' ? f.sending : f.send}
        </button>
      </>
    );

  return (
    <Dialog open={open} onClose={close} title={f.title} width="max-w-md" footer={footer}>
      {state === 'sent' ? (
        <div className="flex flex-col items-center gap-3 p-8 text-center">
          <CheckCircle2 size={36} className="text-accent" />
          <p className="text-sm">{f.sent}</p>
        </div>
      ) : (
        <div className="space-y-3 p-4">
          <p className="text-xs leading-relaxed text-muted">{f.intro}</p>
          {!configured && <p className="rounded-md bg-warn/10 px-2 py-1.5 text-xs text-warn">{f.notConfigured}</p>}
          <Segmented
            label={f.kind}
            value={kind}
            options={(['idea', 'bug', 'other'] as Kind[]).map((k) => ({ value: k, label: f.kinds[k] }))}
            onChange={setKind}
          />
          <label className="block space-y-1">
            <span className="text-xs text-muted">{f.message}</span>
            <textarea
              className="field min-h-[140px] w-full resize-y py-2 leading-relaxed"
              value={message}
              maxLength={5000}
              placeholder={f.placeholder[kind]}
              onChange={(e) => setMessage(e.target.value)}
              autoFocus
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-muted">{f.replyTo}</span>
            <input className="field w-full" type="email" autoComplete="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder={f.replyHint} />
          </label>
          {/* Fälla för spam-robotar: dold för människor. */}
          <input type="checkbox" className="hidden" tabIndex={-1} aria-hidden="true" checked={honeypot} onChange={(e) => setHoneypot(e.target.checked)} />
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={includeInfo} onChange={(e) => setIncludeInfo(e.target.checked)} />
            {f.includeInfo}
          </label>
          {state === 'error' && <p className="rounded-md bg-warn/10 px-2 py-1.5 text-xs text-warn">{f.error}</p>}
          <p className="text-2xs leading-relaxed text-muted">{f.privacy}</p>
        </div>
      )}
    </Dialog>
  );
}
