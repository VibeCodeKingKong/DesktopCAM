import { ExternalLink, Heart } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useT } from '../../i18n';
import { Dialog } from '../ui/Dialog';
import { DONATE_URL } from '../../config/donate';

/** Stöd desktopCAM: kort förklaring och en länk till PayPal i en ny flik. */
export function DonateDialog() {
  const t = useT();
  const d = t.donate;
  const open = useAppStore((s) => s.dialog === 'donate');
  const close = () => useAppStore.getState().openDialog(null);
  if (!DONATE_URL) return null;
  return (
    <Dialog
      open={open}
      onClose={close}
      title={d.title}
      width="max-w-sm"
      footer={
        <>
          <div className="flex-1" />
          <button className="btn" onClick={close}>
            {t.common.close}
          </button>
          <a className="btn btn-primary" href={DONATE_URL} target="_blank" rel="noopener noreferrer" onClick={close}>
            {d.button} <ExternalLink size={13} />
          </a>
        </>
      }
    >
      <div className="space-y-3 p-5 text-center">
        <Heart size={32} className="mx-auto text-rose-500" fill="currentColor" />
        <p className="text-sm leading-relaxed">{d.body}</p>
        <p className="text-2xs leading-relaxed text-muted">{d.note}</p>
      </div>
    </Dialog>
  );
}
