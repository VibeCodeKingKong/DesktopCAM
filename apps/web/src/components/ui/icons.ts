import { createLucideIcon } from 'lucide-react';

/** Hörn med radie (verktyget Radie). */
export const CornerRadius = createLucideIcon('CornerRadius', [
  ['path', { d: 'M4 20v-7a9 9 0 0 1 9-9h7', key: 'arc' }],
  ['path', { d: 'M4 4h3M4 4v3', key: 'tick', strokeDasharray: '1 2' }],
  ['circle', { cx: '10.4', cy: '10.4', r: '1.2', key: 'dot' }],
]);

/** Slå ihop två former till en kontur. */
export const ShapesUnion = createLucideIcon('ShapesUnion', [
  ['path', { d: 'M3 3h11v5h7v13H10v-5H3z', key: 'u' }],
]);

/** Dra ifrån: den ena formen skär ut den andra. */
export const ShapesSubtract = createLucideIcon('ShapesSubtract', [
  ['path', { d: 'M3 3h11v5h-4v8H3z', key: 's' }],
  ['path', { d: 'M10 8h11v13H10z', key: 'd', strokeDasharray: '2 2' }],
]);

/** Gemensam del: bara där formerna överlappar. */
export const ShapesIntersect = createLucideIcon('ShapesIntersect', [
  ['path', { d: 'M3 3h11v13H3z', key: 'a', strokeDasharray: '2 2' }],
  ['path', { d: 'M10 8h11v13H10z', key: 'b', strokeDasharray: '2 2' }],
  ['path', { d: 'M10 8h4v8h-4z', key: 'i', fill: 'currentColor' }],
]);


/** Förskjut kontur: en form med en kontur runt om. */
export const ShapeOffset = createLucideIcon('ShapeOffset', [
  ['rect', { x: '7', y: '7', width: '10', height: '10', rx: '1', key: 'i' }],
  ['rect', { x: '3', y: '3', width: '18', height: '18', rx: '5', key: 'o', strokeDasharray: '3 2' }],
]);
