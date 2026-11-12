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

export const IlluMachine = ({ kind = 'router' }: { kind?: 'router' | 'laser' | 'plasma' }) => (
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
    ) : kind === 'plasma' ? (
      <g>
        {/* Brännare med munstycke och ljusbåge ner i plåten */}
        <rect x="57" y="22" width="8" height="18" rx="2" className="fill-surface stroke-ink/70" strokeWidth="1.5" />
        <path d="M58 40h6l-1.5 5h-3z" className="fill-ink/70" />
        <path d="M61 45l-1.5 3 2.5 1.5-1.5 3" className="stroke-accent anim-blink" strokeWidth="1.6" />
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

export const IlluPattern = () => (
  <Frame>
    <Board />
    {/* Linjärt: en rad hål som fylls i efter varandra */}
    {[34, 52, 70].map((x, i) => (
      <circle key={x} cx={x} cy="40" r="6" stroke="currentColor" strokeWidth="2" className={i ? 'anim-pop' : ''} style={{ animationDelay: `${i * 0.35}s` }} />
    ))}
    {/* Cirkulärt: hål runt en mittpunkt */}
    <circle cx="112" cy="40" r="16" className="stroke-muted" strokeWidth="1" strokeDasharray="2 3" />
    {[0, 1, 2, 3, 4, 5].map((k) => {
      const a = (k * Math.PI) / 3;
      return <circle key={k} cx={112 + 16 * Math.cos(a)} cy={40 + 16 * Math.sin(a)} r="3.5" stroke="currentColor" strokeWidth="1.8" className={k ? 'anim-pop' : ''} style={{ animationDelay: `${k * 0.2}s` }} />;
    })}
  </Frame>
);

/* ───────── Fler illustrationer (0.11) ───────── */

const Cursor = ({ x, y, className = '' }: { x: number; y: number; className?: string }) => (
  <path d={`M${x} ${y}l0 12 3.5-3.2 2.6 5.2 2-1-2.6-5.1 4.7-.4z`} className={`fill-surface stroke-ink ${className}`} strokeWidth="1" />
);

/** Ångra: formen hoppar tillbaka till sitt förra läge. */
export const IlluUndo = () => (
  <Frame>
    <rect x="34" y="26" width="30" height="28" rx="2" className="stroke-muted" strokeWidth="1.5" strokeDasharray="3 3" />
    <rect x="34" y="26" width="30" height="28" rx="2" stroke="currentColor" strokeWidth="2" className="anim-slide" style={{ ['--slide' as string]: '60px' }} />
    <path d="M112 22c-14-8-34-8-46 2m0 0 2-9m-2 9 9 1" stroke="currentColor" strokeWidth="1.8" />
  </Frame>
);

export const IlluRedo = () => (
  <Frame>
    <rect x="94" y="26" width="30" height="28" rx="2" className="stroke-muted" strokeWidth="1.5" strokeDasharray="3 3" />
    <rect x="34" y="26" width="30" height="28" rx="2" stroke="currentColor" strokeWidth="2" className="anim-slide" style={{ ['--slide' as string]: '60px' }} />
    <path d="M48 22c14-8 34-8 46 2m0 0-2-9m2 9-9 1" stroke="currentColor" strokeWidth="1.8" />
  </Frame>
);

export const IlluDuplicate = () => (
  <Frame>
    <rect x="50" y="22" width="34" height="26" rx="3" className="stroke-ink/60" strokeWidth="1.5" />
    <rect x="58" y="30" width="34" height="26" rx="3" stroke="currentColor" strokeWidth="2" className="anim-pop" />
  </Frame>
);

export const IlluDelete = () => (
  <Frame>
    <circle cx="62" cy="40" r="16" stroke="currentColor" strokeWidth="2" className="anim-blink" />
    <path d="M96 26h22m-18 0 2 26h12l2-26m-12-4h8" className="stroke-warn" strokeWidth="1.8" />
  </Frame>
);

export const IlluSelect = () => (
  <Frame>
    <rect x="44" y="22" width="44" height="30" rx="2" stroke="currentColor" strokeWidth="2" className="anim-slide" style={{ ['--slide' as string]: '28px' }} />
    <rect x="40" y="18" width="52" height="38" rx="3" stroke="currentColor" strokeWidth="1" strokeDasharray="3 3" className="anim-slide" style={{ ['--slide' as string]: '28px' }} />
    <g className="anim-slide" style={{ ['--slide' as string]: '28px' }}>
      <Cursor x={70} y={38} />
    </g>
  </Frame>
);

export const IlluLine = () => (
  <Frame>
    <path d="M30 56 70 56 104 24" stroke="currentColor" strokeWidth="2" className="anim-dash" />
    {[[30, 56], [70, 56], [104, 24]].map(([x, y]) => (
      <circle key={x} cx={x} cy={y} r="3.5" className="fill-surface" stroke="currentColor" strokeWidth="1.5" />
    ))}
    <path d="M70 56h50" className="stroke-muted" strokeWidth="1" strokeDasharray="2 3" />
    <text x="118" y="50" className="fill-muted" fontSize="9">45°</text>
  </Frame>
);

export const IlluText = () => (
  <Frame>
    <Board />
    <text x="80" y="50" textAnchor="middle" fontSize="26" fontWeight="700" fill="none" stroke="currentColor" strokeWidth="1.5">
      ABC
    </text>
    <path d="M118 30v20" stroke="currentColor" strokeWidth="1.5" className="anim-blink" />
  </Frame>
);

export const IlluGear = () => {
  const pts: string[] = [];
  for (let i = 0; i < 12; i++) {
    for (const [f, r] of [[0, 15], [0.18, 21], [0.45, 21], [0.63, 15]] as const) {
      const a = ((i + f) / 12) * Math.PI * 2;
      pts.push(`${80 + r * Math.cos(a)},${40 + r * Math.sin(a)}`);
    }
  }
  return (
    <Frame>
      <g className="anim-turn" style={{ ['--turn' as string]: '30deg' }}>
        <polygon points={pts.join(' ')} stroke="currentColor" strokeWidth="1.8" />
        <circle cx="80" cy="40" r="5" stroke="currentColor" strokeWidth="1.5" />
      </g>
    </Frame>
  );
};

export const IlluFillet = () => (
  <Frame>
    <path d="M40 62V24h80" className="stroke-muted" strokeWidth="1.5" strokeDasharray="3 3" />
    <path d="M40 62V42a18 18 0 0 1 18-18h62" stroke="currentColor" strokeWidth="2" />
    <path d="M58 42 45.3 29.3" className="stroke-muted" strokeWidth="1" />
    <text x="60" y="52" className="fill-muted" fontSize="9">R</text>
    <circle cx="40" cy="24" r="4" fill="currentColor" className="anim-blink" />
  </Frame>
);

export const IlluMeasure = () => (
  <Frame>
    <rect x="22" y="14" width="116" height="52" rx="2" className="stroke-ink/60" strokeWidth="1.5" />
    <circle cx="106" cy="30" r="7" stroke="currentColor" strokeWidth="2" />
    <path d="M138 30h-32M106 14v16" stroke="currentColor" strokeWidth="1" strokeDasharray="3 2" className="anim-dash" />
    <text x="118" y="27" className="fill-muted" fontSize="8">25</text>
    <text x="108" y="22" className="fill-muted" fontSize="8">20</text>
    <circle cx="138" cy="14" r="2.5" fill="currentColor" />
  </Frame>
);

export const IlluSnap = () => (
  <Frame>
    {[0, 1, 2, 3, 4].map((i) => (
      <path key={`v${i}`} d={`M${40 + i * 20} 12v56`} className="stroke-line" strokeWidth="1" />
    ))}
    {[0, 1, 2].map((i) => (
      <path key={`h${i}`} d={`M28 ${20 + i * 20}h104`} className="stroke-line" strokeWidth="1" />
    ))}
    <g className="anim-slide" style={{ ['--slide' as string]: '20px' }}>
      <circle cx="80" cy="40" r="4" fill="currentColor" />
      <Cursor x={82} y={42} />
    </g>
  </Frame>
);

export const IlluImageRelief = () => (
  <Frame>
    <rect x="16" y="16" width="44" height="48" rx="2" className="fill-surface stroke-muted" strokeWidth="1.2" />
    <path d="M24 54 34 34l8 12 6-8 8 16z" className="fill-ink/70" />
    <circle cx="48" cy="26" r="4" className="fill-ink/50" />
    <path d="M66 40h14m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.8" />
    <path d="M90 58c10 0 12-22 22-22s10 12 16 12 8-12 14-12" className="fill-wood stroke-ink/60" strokeWidth="1.2" />
    <path d="M90 62h52" className="stroke-wood" strokeWidth="1" />
    <path d="M90 58c10 0 12-22 22-22s10 12 16 12 8-12 14-12" stroke="currentColor" strokeWidth="1.5" className="anim-dash" />
  </Frame>
);

export const IlluLineEngrave = () => (
  <Frame>
    <Board />
    <path d="M36 52c12-30 26-30 34 0s24 22 30-8 18-16 24 4" className="stroke-laser" strokeWidth="2.2" strokeDasharray="5 5">
      <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="1s" repeatCount="indefinite" />
    </path>
  </Frame>
);

export const IlluToolLibrary = () => (
  <Frame>
    {[
      ['M38 66V36h8v30', 'M38 36l4-16 4 16'],
      ['M70 66V30h8v36', 'M70 30h8v-8h-8z'],
      ['M102 66V34h8v32', 'M102 34l4-14 4 14'],
    ].map(([a, b], i) => (
      <g key={i} className={i === 1 ? 'anim-pop' : ''}>
        <path d={a} className="stroke-ink/70" strokeWidth="1.5" />
        <path d={b} stroke="currentColor" strokeWidth="1.8" />
      </g>
    ))}
    <path d="M26 66h108" className="stroke-muted" strokeWidth="1.5" />
  </Frame>
);

/** Simuleringen: verktyget går längs banan och lämnar ett spår. */
export const IlluSimulate = () => (
  <Frame>
    <Board />
    <path d="M36 46h88" className="stroke-wood" strokeWidth="7" strokeLinecap="round" />
    <path d="M36 46h88" stroke="currentColor" strokeWidth="7" strokeLinecap="round" opacity=".35" strokeDasharray="88" strokeDashoffset="88">
      <animate attributeName="stroke-dashoffset" values="88;0;0" keyTimes="0;0.8;1" dur="2.4s" repeatCount="indefinite" />
    </path>
    <g>
      <animateTransform attributeName="transform" type="translate" values="0 0;88 0;88 0" keyTimes="0;0.8;1" dur="2.4s" repeatCount="indefinite" />
      <path d="M33 14h6v24h-6z" className="fill-ink/60" />
      <path d="M34 38h4v6h-4z" fill="currentColor" />
    </g>
  </Frame>
);

export const IlluResult = () => (
  <Frame>
    <Board />
    <rect x="44" y="26" width="72" height="28" rx="6" className="fill-wood stroke-ink/40" strokeWidth="1" />
    <rect x="52" y="32" width="56" height="16" rx="4" className="fill-ink/25" />
    <path d="M124 18l6 6 10-12" stroke="currentColor" strokeWidth="2.2" className="anim-pop" />
  </Frame>
);

export const IlluStop = () => (
  <Frame>
    <Board />
    <rect x="62" y="22" width="36" height="36" rx="4" stroke="currentColor" strokeWidth="2" />
    <path d="M72 32l16 16m0-16-16 16" stroke="currentColor" strokeWidth="2" />
  </Frame>
);

export const IlluShowToolpaths = () => (
  <Frame>
    <Board />
    <rect x="46" y="24" width="68" height="32" rx="4" stroke="currentColor" strokeWidth="2" className="anim-blink" />
  </Frame>
);

export const IlluRapids = () => (
  <Frame>
    <Board />
    <rect x="30" y="30" width="30" height="20" rx="3" className="stroke-ink/60" strokeWidth="1.5" />
    <rect x="100" y="30" width="30" height="20" rx="3" className="stroke-ink/60" strokeWidth="1.5" />
    <path d="M60 40h40" className="stroke-warn" strokeWidth="1.5" strokeDasharray="4 3">
      <animate attributeName="stroke-dashoffset" from="0" to="-14" dur="0.8s" repeatCount="indefinite" />
    </path>
  </Frame>
);

export const IlluStock = () => (
  <Frame>
    <path d="M40 50 60 34h70L110 50z" className="fill-wood/60 stroke-wood anim-blink" strokeWidth="1" />
    <path d="M40 50v10h70V50M110 60l20-16V34" className="stroke-wood" strokeWidth="1" />
    <path d="M58 44h40" stroke="currentColor" strokeWidth="2" />
  </Frame>
);

const Cube = ({ iso }: { iso: boolean }) =>
  iso ? (
    <g className="stroke-ink/70" strokeWidth="1.5">
      <path d="M80 18 104 30v26L80 68 56 56V30z" className="fill-wood/40" />
      <path d="M56 30l24 12 24-12M80 42v26" />
    </g>
  ) : (
    <rect x="56" y="18" width="48" height="48" rx="2" className="fill-wood/40 stroke-ink/70" strokeWidth="1.5" />
  );

export const IlluViewTop = () => (
  <Frame>
    <Cube iso={false} />
    <path d="M128 10v18m-5-5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" className="anim-blink" />
  </Frame>
);

export const IlluViewIso = () => (
  <Frame>
    <Cube iso />
    <path d="M128 12l-10 10m0-7v7h7" stroke="currentColor" strokeWidth="1.8" className="anim-blink" />
  </Frame>
);

export const IlluViewFit = () => (
  <Frame>
    <rect x="62" y="30" width="36" height="20" rx="2" className="fill-wood/40 stroke-ink/60" strokeWidth="1.2" />
    <path d="M30 26V16h12M130 26V16h-12M30 54v10h12M130 54v10h-12" stroke="currentColor" strokeWidth="2" className="anim-pop" />
  </Frame>
);

export const IlluZoom = ({ out = false }: { out?: boolean }) => (
  <Frame>
    <rect x="66" y="30" width="28" height="20" rx="2" className="fill-wood/40 stroke-ink/60 anim-pop" strokeWidth="1.2" style={{ animationDirection: out ? 'reverse' : 'normal' }} />
    <circle cx="118" cy="34" r="10" stroke="currentColor" strokeWidth="1.8" />
    <path d={`M112 34h12${out ? '' : 'M118 28v12'}M125 41l8 8`} stroke="currentColor" strokeWidth="1.8" />
  </Frame>
);

export const IlluGcode = () => (
  <Frame>
    <rect x="44" y="10" width="72" height="60" rx="3" className="stroke-muted" strokeWidth="1.5" />
    {['G0 X10 Y5', 'G1 Z-3', 'G1 X60', 'G1 Y40'].map((l, i) => (
      <text key={l} x="52" y={26 + i * 12} fontSize="8" fontFamily="monospace" className={i === 2 ? 'fill-accent anim-blink' : 'fill-muted'}>
        {l}
      </text>
    ))}
  </Frame>
);

export const IlluNewProject = () => (
  <Frame>
    <path d="M60 10h30l12 12v48H60z" className="fill-surface stroke-muted" strokeWidth="1.5" />
    <path d="M90 10v12h12" className="stroke-muted" strokeWidth="1.5" />
    <path d="M81 38v16m-8-8h16" stroke="currentColor" strokeWidth="2" className="anim-pop" />
  </Frame>
);

export const IlluOpen = () => (
  <Frame>
    <path d="M46 26h20l6 6h42v32H46z" className="fill-wood/30 stroke-muted" strokeWidth="1.5" />
    <path d="M80 60V40m-7 7 7-7 7 7" stroke="currentColor" strokeWidth="2" className="anim-pop" />
  </Frame>
);

export const IlluSave = () => (
  <Frame>
    <rect x="58" y="16" width="44" height="48" rx="4" className="stroke-muted" strokeWidth="1.5" />
    <rect x="66" y="16" width="28" height="14" className="stroke-muted" strokeWidth="1.2" />
    <path d="M80 36v16m-7-7 7 7 7-7" stroke="currentColor" strokeWidth="2" className="anim-pop" />
  </Frame>
);

/** Spegla: formen vänds runt en mittlinje. */
export const IlluFlip = ({ vertical = false }: { vertical?: boolean }) => (
  <Frame>
    {vertical ? (
      <>
        <path d="M40 40h80" className="stroke-muted" strokeWidth="1" strokeDasharray="3 3" />
        <path d="M60 36l20-20 20 20z" className="stroke-ink/60" strokeWidth="1.5" />
        <path d="M60 44l20 20 20-20z" stroke="currentColor" strokeWidth="2" className="anim-pop" />
      </>
    ) : (
      <>
        <path d="M80 12v56" className="stroke-muted" strokeWidth="1" strokeDasharray="3 3" />
        <path d="M76 24 52 40l24 16z" className="stroke-ink/60" strokeWidth="1.5" />
        <path d="M84 24l24 16-24 16z" stroke="currentColor" strokeWidth="2" className="anim-pop" />
      </>
    )}
  </Frame>
);

export const IlluRotate = () => (
  <Frame>
    <rect x="62" y="28" width="36" height="24" rx="2" stroke="currentColor" strokeWidth="2" className="anim-turn" style={{ ['--turn' as string]: '-30deg' }} />
    <path d="M108 26a26 26 0 0 0-14-12" className="stroke-muted" strokeWidth="1.5" />
    <path d="M94 14l1 7m-1-7 7 1" className="stroke-muted" strokeWidth="1.5" />
  </Frame>
);

export const IlluCenter = () => (
  <Frame>
    <Board />
    <path d="M80 10v60M16 40h128" className="stroke-muted" strokeWidth="1" strokeDasharray="2 3" />
    <rect x="34" y="20" width="28" height="18" rx="2" stroke="currentColor" strokeWidth="2" className="anim-slide" style={{ ['--slide' as string]: '32px' }} />
  </Frame>
);

export const IlluLockAspect = () => (
  <Frame>
    <rect x="50" y="30" width="30" height="20" rx="2" className="stroke-ink/60" strokeWidth="1.5" />
    <rect x="50" y="22" width="48" height="32" rx="2" stroke="currentColor" strokeWidth="2" className="anim-pop" />
    <path d="M120 38v-6a6 6 0 0 1 12 0v6m-15 0h18v14h-18z" className="stroke-muted" strokeWidth="1.5" />
  </Frame>
);

export const IlluPathClosed = () => (
  <Frame>
    <path d="M30 56 50 24h30l14 32" className="stroke-ink/60" strokeWidth="1.5" />
    <path d="M94 56H30" stroke="currentColor" strokeWidth="2" className="anim-dash" />
    <path d="M108 40h10m-3-3 3 3-3 3" className="stroke-muted" strokeWidth="1.2" />
    <path d="M124 56l8-20h8l6 20z" className="fill-wood/40" stroke="currentColor" strokeWidth="1.5" />
  </Frame>
);

/** Formbiblioteket: en banderoll och en ram ritas upp. */
export const IlluShapeLibrary = () => (
  <Frame>
    <Board />
    <rect x="30" y="18" width="100" height="44" rx="6" className="stroke-ink/60" strokeWidth="1.5" />
    <rect x="36" y="24" width="88" height="32" rx="3" className="stroke-ink/60" strokeWidth="1.5" />
    <path d="M52 34h56v14H52zM52 37l-10 0 4 4.5-4 4.5h10M108 37h10l-4 4.5 4 4.5h-10" stroke="currentColor" strokeWidth="2" className="anim-dash" />
  </Frame>
);

/** Plasmaskärning: inlöp i spillet, sedan runt konturen med strålkompensation. */
export const IlluPlasma = () => (
  <Frame>
    <rect x="16" y="10" width="128" height="60" rx="3" className="fill-muted/25 stroke-muted" strokeWidth="1" />
    <rect x="50" y="24" width="60" height="32" rx="2" className="stroke-ink/60" strokeWidth="1.5" />
    <path d="M38 40a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="2" className="anim-dash" />
    <rect x="46" y="20" width="68" height="40" rx="4" stroke="currentColor" strokeWidth="2" className="anim-dash" />
    <g className="anim-blink">
      <circle cx="38" cy="40" r="3" fill="currentColor" />
      <circle cx="38" cy="40" r="6" stroke="currentColor" strokeWidth="1" opacity=".5" />
    </g>
  </Frame>
);

/** Zooma till arbetsstycket: ramen dras ihop runt materialet. */
export const IlluViewFitStock = () => (
  <Frame>
    <rect x="22" y="14" width="116" height="52" rx="2" className="stroke-muted" strokeWidth="1" strokeDasharray="3 3" />
    <rect x="58" y="28" width="44" height="24" rx="2" className="fill-wood/50 stroke-ink/60" strokeWidth="1.2" />
    <path d="M52 32v-10h10M108 32v-10h-10M52 48v10h10M108 48v10h-10" stroke="currentColor" strokeWidth="2" className="anim-pop" />
  </Frame>
);
