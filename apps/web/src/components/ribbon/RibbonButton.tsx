import type { LucideIcon } from 'lucide-react';
import { SmartTooltip, type SmartTooltipContent } from '../smartguide/SmartTooltip';

interface Props {
  icon: LucideIcon;
  label: string;
  tooltip: SmartTooltipContent;
  onClick: () => void;
  size?: 'large' | 'small';
  disabled?: boolean;
  active?: boolean;
  /** Färgton för ikonen, t.ex. laseroperationer. */
  tone?: 'accent' | 'laser' | 'neutral';
}

const toneClass = { accent: 'text-accent', laser: 'text-laser', neutral: 'text-ink/80' } as const;

export function RibbonButton({ icon: Icon, label, tooltip, onClick, size = 'large', disabled, active, tone = 'accent' }: Props) {
  const base =
    'select-none rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-35 disabled:hover:bg-transparent';
  const state = active ? 'bg-accent/10 ring-1 ring-inset ring-accent/30' : 'hover:bg-app active:bg-line/60';

  return (
    <SmartTooltip content={tooltip}>
      {size === 'large' ? (
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-pressed={active}
          className={`${base} ${state} flex h-[62px] min-w-[54px] flex-col items-center justify-start gap-1 px-1.5 pt-1.5`}
        >
          <Icon size={24} strokeWidth={1.6} className={toneClass[tone]} />
          <span className="max-w-[72px] text-center text-2xs leading-tight">{label}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-pressed={active}
          className={`${base} ${state} flex h-[22px] items-center gap-1.5 px-1.5 text-2xs`}
        >
          <Icon size={14} strokeWidth={1.8} className={toneClass[tone]} />
          <span className="whitespace-nowrap">{label}</span>
        </button>
      )}
    </SmartTooltip>
  );
}
