/**
 * Små förklarande illustrationer för SmartTooltip. Ritas i SVG med
 * currentColor (accent) så att de följer ljust/mörkt läge. Den streckade
 * linjen animeras som en verktygsbana; animationen stängs av vid
 * prefers-reduced-motion.
 */
import type { ReactNode } from 'react';

const Frame = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 160 80" width="160" height="80" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);

const Board = () => <rect x="16" y="10" width="128" height="60" rx="3" className="fill-wood/40 stroke-wood" strokeWidth="1" />;

export const IlluProfile = () => (
  <Frame>
    <Board />
    <rect x="50" y="24" width="60" height="32" rx="2" className="stroke-ink/60" strokeWidth="1.5" />
    <rect x="45" y="19" width="70" height="42" rx="6" stroke="currentColor" strokeWidth="2" className="anim-dash" />
    <circle cx="45" cy="40" r="4" fill="currentColor" opacity=".35" />
  </Frame>
);

export const IlluPocket = () => (
  <Frame>
    <Board />
    <rect x="46" y="22" width="68" height="36" rx="4" className="fill-wood stroke-ink/60" strokeWidth="1.5" />
    <path d="M52 28h56v24H52zM58 34h44v12H58z" stroke="currentColor" strokeWidth="2" className="anim-dash" />
  </Frame>
);

export const IlluDrill = () => (
  <Frame>
    <Board />
    {[46, 80, 114].map((x) => (
      <g key={x}>
        <circle cx={x} cy="40" r="7" className="stroke-ink/60" strokeWidth="1.5" />
        <path d={`M${x} 18v22`} stroke="currentColor" strokeWidth="2" className="anim-dash" />
      </g>
    ))}
  </Frame>
);

export const IlluVCarve = () => (
  <Frame>
    <Board />
    <path d="M40 58 60 22l20 36M48 44h24" className="stroke-ink/60" strokeWidth="1.5" />
    <path d="M96 22h24M108 22v36" className="stroke-ink/60" strokeWidth="1.5" />
    <path d="M44 56 60 26 76 56" stroke="currentColor" strokeWidth="2" className="anim-dash" />
    <path d="M100 14l8 10 8-10" stroke="currentColor" strokeWidth="1.5" />
  </Frame>
);

export const IlluLaserCut = () => (
  <Frame>
    <Board />
    <circle cx="80" cy="40" r="20" className="stroke-laser" strokeWidth="2.5" strokeDasharray="5 5">
      <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="1s" repeatCount="indefinite" />
    </circle>
    <path d="M80 4v16" className="stroke-laser" strokeWidth="2" opacity=".7" />
    <circle cx="80" cy="20" r="2.5" className="fill-laser" />
  </Frame>
);

export const IlluDither = () => {
  const dots: ReactNode[] = [];
  for (let y = 0; y < 6; y++) {
    for (let x = 0; x < 14; x++) {
      const density = x / 13;
      if ((x * 7 + y * 13) % 10 < density * 10) {
        dots.push(<rect key={`${x}-${y}`} x={24 + x * 8.5} y={16 + y * 8.5} width="5" height="5" className="fill-ink/80" />);
      }
    }
  }
  return (
    <Frame>
      <Board />
      {dots}
    </Frame>
  );
};

export const IlluRelief = () => (
  <Frame>
    <Board />
    <path d="M30 58C46 58 52 22 80 22s34 36 50 36" className="fill-wood stroke-ink/60" strokeWidth="1.5" />
    {[0, 1, 2, 3, 4].map((i) => (
      <path key={i} d={`M${40 + i * 20} 64V${[52, 33, 23, 33, 52][i]}`} stroke="currentColor" strokeWidth="1.5" className="anim-dash" />
    ))}
  </Frame>
);

export const IlluImportDxf = () => (
  <Frame>
    <rect x="22" y="14" width="40" height="52" rx="3" className="stroke-muted" strokeWidth="1.5" />
    <text x="42" y="44" textAnchor="middle" className="fill-muted" fontSize="10" fontWeight="600">
      DXF
    </text>
    <path d="M70 40h18m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" />
    <path d="M98 26h34v28H98z" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3" />
    <circle cx="106" cy="34" r="2.5" stroke="currentColor" strokeWidth="1.5" />
  </Frame>
);

export const IlluInlay = () => (
  <Frame>
    <rect x="12" y="44" width="62" height="22" rx="2" className="fill-wood/50 stroke-wood" strokeWidth="1" />
    <path d="M26 44 34 58h18l8-14" className="fill-surface stroke-ink/60" strokeWidth="1.5" />
    <path d="M86 18h62v12H86z" className="fill-ink/70" />
    <path d="M98 30l8 14h22l8-14" className="fill-ink/70" />
    <path d="M117 50v8m-4-4 4 4 4-4" stroke="currentColor" strokeWidth="1.8" />
    <path d="M24 40 34 56h18l10-16" stroke="currentColor" strokeWidth="1.5" className="anim-dash" />
  </Frame>
);

export const IlluRect = () => (
  <Frame>
    <rect x="40" y="18" width="80" height="44" rx="2" stroke="currentColor" strokeWidth="2" />
    {[
      [40, 18],
      [120, 18],
      [40, 62],
      [120, 62],
    ].map(([x, y]) => (
      <rect key={`${x}${y}`} x={x - 3} y={y - 3} width="6" height="6" className="fill-surface" stroke="currentColor" strokeWidth="1.5" />
    ))}
  </Frame>
);

export const IlluCircle = () => (
  <Frame>
    <circle cx="80" cy="40" r="24" stroke="currentColor" strokeWidth="2" />
    <path d="M80 40h24" stroke="currentColor" strokeWidth="1" strokeDasharray="2 3" />
    <circle cx="80" cy="40" r="2" fill="currentColor" />
  </Frame>
);

export const IlluCurve = () => (
  <Frame>
    <path d="M30 58C50 10 110 70 130 22" stroke="currentColor" strokeWidth="2" />
    <path d="M30 58 50 18M130 22 110 62" className="stroke-muted" strokeWidth="1" strokeDasharray="2 3" />
    <circle cx="50" cy="18" r="3" className="fill-surface stroke-muted" />
    <circle cx="110" cy="62" r="3" className="fill-surface stroke-muted" />
  </Frame>
);

export const IlluImport = () => (
  <Frame>
    <rect x="30" y="14" width="40" height="52" rx="3" className="stroke-muted" strokeWidth="1.5" />
    <text x="50" y="44" textAnchor="middle" className="fill-muted" fontSize="10" fontWeight="600">
      SVG
    </text>
    <path d="M78 40h22m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" />
    <path d="M110 56c4-24 20-24 24-8" stroke="currentColor" strokeWidth="2" />
  </Frame>
);

export const IlluExport = () => (
  <Frame>
    <rect x="56" y="10" width="48" height="60" rx="3" className="stroke-muted" strokeWidth="1.5" />
    {[22, 30, 38, 46].map((y, i) => (
      <path key={y} d={`M64 ${y}h${[30, 22, 26, 18][i]}`} className="stroke-muted" strokeWidth="2" />
    ))}
    <path d="M80 50v12m-6-6 6 6 6-6" stroke="currentColor" strokeWidth="2" />
  </Frame>
);

export const IlluMachine = ({ kind = 'router' }: { kind?: 'router' | 'laser' }) => (
  <svg viewBox="0 0 120 80" className="h-full w-full" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 62 34 46h72L86 62z" className="fill-wood/50 stroke-wood" />
    <path d="M14 62v6h72v-6M106 46v6l-20 16" className="stroke-muted" strokeWidth="1.5" />
    <path d="M28 52 52 18h40l-4 0" className="stroke-muted" strokeWidth="2" />
    <path d="M92 18 70 52" className="stroke-muted" strokeWidth="2" />
    <path d="M40 34h44" className="stroke-ink/70" strokeWidth="3" />
    {kind === 'router' ? (
      <g>
        <rect x="56" y="24" width="10" height="16" rx="2" className="fill-surface stroke-ink/70" strokeWidth="1.5" />
        <path d="M61 40v8" className="stroke-ink" strokeWidth="2" />
      </g>
    ) : (
      <g>
        <rect x="56" y="28" width="10" height="10" rx="1.5" className="fill-surface stroke-ink/70" strokeWidth="1.5" />
        <path d="M61 38v12" className="stroke-laser" strokeWidth="1.5" />
        <circle cx="61" cy="51" r="1.8" className="fill-laser" />
      </g>
    )}
  </svg>
);
