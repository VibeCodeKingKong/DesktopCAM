export interface FloatingPosition {
  left: number;
  top: number;
  placement: 'below' | 'above';
}

/** Placera ett flytande element under (eller över) ankaret och håll det inom fönstret. */
export function placeFloating(anchor: DOMRect, width: number, height: number, gap = 8): FloatingPosition {
  const margin = 8;
  const left = Math.min(Math.max(margin, anchor.left + anchor.width / 2 - width / 2), window.innerWidth - width - margin);
  const below = anchor.bottom + gap;
  if (below + height <= window.innerHeight - margin) return { left, top: below, placement: 'below' };
  return { left, top: Math.max(margin, anchor.top - gap - height), placement: 'above' };
}
