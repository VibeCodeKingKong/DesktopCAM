import { createLucideIcon } from 'lucide-react';

/** Hörn med radie (verktyget Radie). */
export const CornerRadius = createLucideIcon('CornerRadius', [
  ['path', { d: 'M4 20v-7a9 9 0 0 1 9-9h7', key: 'arc' }],
  ['path', { d: 'M4 4h3M4 4v3', key: 'tick', strokeDasharray: '1 2' }],
  ['circle', { cx: '10.4', cy: '10.4', r: '1.2', key: 'dot' }],
]);
