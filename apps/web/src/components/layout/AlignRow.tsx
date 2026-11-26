import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignHorizontalDistributeCenter, AlignStartHorizontal, AlignStartVertical, AlignVerticalDistributeCenter, type LucideIcon } from 'lucide-react';
import { alignSelection, distributeSelection, type AlignMode } from '../../cam/align';
import { useT } from '../../i18n';

/** Ikonerna för justering (samma i bandet och i egenskapspanelen). */
export const ALIGN_ICONS: Record<AlignMode, LucideIcon> = {
  left: AlignStartVertical,
  hcenter: AlignCenterVertical,
  right: AlignEndVertical,
  top: AlignStartHorizontal,
  vcenter: AlignCenterHorizontal,
  bottom: AlignEndHorizontal,
};
export const DISTRIBUTE_ICONS = { h: AlignHorizontalDistributeCenter, v: AlignVerticalDistributeCenter } as const;

/** Justera-raden i egenskapspanelen: sex justeringar och två fördelningar. */
export function AlignRow({ count }: { count: number }) {
  const t = useT();
  const A = t.align;
  const btn = 'btn h-7 w-full justify-center px-0';
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted">{count > 1 ? A.title : A.titleStock}</p>
      <div className="grid grid-cols-8 gap-1">
        {(Object.keys(ALIGN_ICONS) as AlignMode[]).map((m) => {
          const Icon = ALIGN_ICONS[m];
          return (
            <button key={m} className={btn} onClick={() => alignSelection(m)} title={A.modes[m]} aria-label={A.modes[m]}>
              <Icon size={14} />
            </button>
          );
        })}
        {(['h', 'v'] as const).map((ax) => {
          const Icon = DISTRIBUTE_ICONS[ax];
          return (
            <button key={ax} className={btn} disabled={count < 3} onClick={() => distributeSelection(ax)} title={A.distribute[ax]} aria-label={A.distribute[ax]}>
              <Icon size={14} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
