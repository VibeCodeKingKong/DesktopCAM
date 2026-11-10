import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAppStore, type MobilePanel } from '../../store/useAppStore';
import { useT } from '../../i18n';

/**
 * Sidopanel som ligger fast bredvid 3D-vyn på stora skärmar och glider in
 * som ett ark på telefon och surfplatta.
 */
export function SidePanel({
  id,
  side,
  title,
  wide,
  children,
}: {
  id: Exclude<MobilePanel, null>;
  side: 'left' | 'right';
  title: string;
  wide?: boolean;
  children: ReactNode;
}) {
  const t = useT();
  const open = useAppStore((s) => s.mobilePanel === id);
  const close = () => useAppStore.getState().setMobilePanel(null);
  const width = wide ? 'lg:w-72' : 'lg:w-60';
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-black/25 lg:hidden" onClick={close} aria-hidden="true" />}
      <aside
        aria-label={title}
        className={`${open ? 'flex' : 'hidden'} fixed inset-y-0 z-40 w-[min(88vw,340px)] flex-col bg-surface shadow-pop lg:static lg:z-auto lg:flex lg:shadow-none ${width} shrink-0 ${
          side === 'left' ? 'left-0 border-r border-line' : 'right-0 border-l border-line'
        } pt-[env(safe-area-inset-top)] lg:pt-0`}
      >
        <div className="panel-heading">
          <span className="truncate">{title}</span>
          <button className="rounded p-1 text-muted hover:bg-app hover:text-ink lg:hidden" onClick={close} aria-label={t.common.close}>
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto pb-[env(safe-area-inset-bottom)]">{children}</div>
      </aside>
    </>
  );
}
