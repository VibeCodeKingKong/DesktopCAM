import type { ReactNode } from 'react';
import type { SmartTooltipContent } from '../smartguide/SmartTooltip';

/** Bygger tooltip-innehåll från ordlistans {title, desc}. */
export const tip = (
  b: { title: string; desc: string },
  extra: { shortcut?: string; illustration?: ReactNode; disabledReason?: string } = {},
): SmartTooltipContent => ({ title: b.title, description: b.desc, ...extra });
