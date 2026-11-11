/**
 * Animerade bilder till rundturen. Ritas med currentColor (accent) och appens
 * färgklasser, så att de följer ljust/mörkt läge. Animationerna (index.css)
 * stängs av vid prefers-reduced-motion.
 */
import type { CSSProperties, ReactNode } from 'react';

const Art = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 240 110" width="240" height="110" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
const d = (s: number) => ({ '--d': `${s}s` }) as CSSProperties;
const Board = ({ x = 30, y = 22, w = 180, h = 66 }) => <rect x={x} y={y} width={w} height={h} rx="4" className="fill-wood/40 stroke-wood" strokeWidth="1" />;

/** Arbetsflödet: inställning → rita → bana → simulera → G-kod, steg för steg. */
export const ArtWelcome = () => (
  <Art>
    {[
      { x: 24, icon: <path d="M-8 6h16M-6 6V-4h12V6M-3-4v-4h6v4" /> },
      { x: 72, icon: <path d="M-8 6l16-14M-8 6l3-1M5-8l3 3" /> },
      { x: 120, icon: <rect x="-8" y="-6" width="16" height="12" rx="2" strokeDasharray="3 2.5" /> },
      { x: 168, icon: <path d="M-6-7l12 7-12 7z" /> },
      { x: 216, icon: <path d="M-6-8h8l4 4v12h-12zM-3 0h6M-3 3h6" /> },
    ].map((s, i) => (
      <g key={i} transform={`translate(${s.x} 46)`} className="anim-step" style={d(i * 0.7)}>
        <circle r="17" className="fill-raised" stroke="currentColor" strokeWidth="1.5" />
        <g stroke="currentColor" strokeWidth="1.8">{s.icon}</g>
      </g>
    ))}
    {[48, 96, 144, 192].map((x) => (
      <path key={x} d={`M${x - 4} 46h8`} className="stroke-muted" strokeWidth="1.5" />
    ))}
  </Art>
);

/** Inställning: portalen kör fram och tillbaka över materialet. */
export const ArtSetup = () => (
  <Art>
    <Board />
    <g className="anim-slide" style={{ '--slide': '110px' } as CSSProperties}>
      <rect x="44" y="12" width="10" height="86" rx="2" className="fill-ink/15 stroke-ink/60" strokeWidth="1.2" />
      <rect x="41" y="46" width="16" height="16" rx="2" fill="currentColor" opacity=".85" />
      <path d="M49 62v6" stroke="currentColor" strokeWidth="2.5" />
    </g>
    <path d="M30 96h180" className="stroke-muted" strokeWidth="1" strokeDasharray="2 3" />
  </Art>
);

/** Rita: pennan ritar en rektangel och en cirkel. */
export const ArtDesign = () => (
  <Art>
    <Board />
    <rect x="52" y="34" width="70" height="42" rx="3" pathLength={100} className="anim-draw stroke-ink" strokeWidth="2" />
    <circle cx="160" cy="55" r="18" pathLength={100} className="anim-draw stroke-ink" strokeWidth="2" style={{ animationDelay: '0.6s' }} />
    <text x="66" y="60" className="fill-ink text-[13px] font-semibold anim-step" style={d(1)}>
      ABC
    </text>
  </Art>
);

/** Banor: verktyget följer konturen utanför formen. */
export const ArtToolpaths = () => (
  <Art>
    <Board />
    <rect x="70" y="36" width="100" height="38" rx="3" className="fill-wood stroke-ink/60" strokeWidth="1.5" />
    <rect x="62" y="28" width="116" height="54" rx="9" stroke="currentColor" strokeWidth="2" className="anim-dash" />
    <circle r="6" fill="currentColor" opacity=".45" className="anim-travel" style={{ offsetPath: "path('M71 28H169A9 9 0 0 1 178 37V73A9 9 0 0 1 169 82H71A9 9 0 0 1 62 73V37A9 9 0 0 1 71 28Z')" } as CSSProperties} />
  </Art>
);

/** Simulera: materialet fräses bort rad för rad. */
export const ArtSimulate = () => (
  <Art>
    <Board />
    <rect x="60" y="34" width="120" height="42" rx="2" className="fill-wood/60" />
    <rect x="60" y="34" width="120" height="42" rx="2" className="anim-carve fill-ink/25" />
    <path d="M60 34h120v42H60z" className="stroke-ink/50" strokeWidth="1" />
    <g className="anim-slide" style={{ '--slide': '120px' } as CSSProperties}>
      <path d="M60 8v26" stroke="currentColor" strokeWidth="5" />
    </g>
  </Art>
);

/** G-kod: rader skrivs ut och filen sparas. */
export const ArtOutput = () => (
  <Art>
    <path d="M86 10h52l18 18v72H86z" className="fill-raised stroke-ink/60" strokeWidth="1.5" />
    <path d="M138 10v18h18" className="stroke-ink/60" strokeWidth="1.5" />
    {['G21 G90', 'G0 Z5', 'G1 X40 F900', 'G1 Y20', 'M5'].map((l, i) => (
      <text key={l} x="94" y={40 + i * 12} className="fill-ink font-mono text-[8px] anim-step" style={d(i * 0.6)}>
        {l}
      </text>
    ))}
    <path d="M190 40v34m-10-10 10 10 10-10" stroke="currentColor" strokeWidth="2.5" className="anim-blink" />
  </Art>
);

/** 3D-vyn: kuben vrids. */
export const ArtViewport = () => (
  <Art>
    <g transform="translate(120 55)">
      <g className="anim-turn" style={{ '--turn': '40deg' } as CSSProperties}>
        <path d="M-30-8 0-24 30-8 0 8z" className="fill-wood/70 stroke-ink/60" strokeWidth="1.2" />
        <path d="M-30-8v26L0 34V8z" className="fill-wood stroke-ink/60" strokeWidth="1.2" />
        <path d="M30-8v26L0 34V8z" className="fill-wood/80 stroke-ink/60" strokeWidth="1.2" />
      </g>
    </g>
    <path d="M40 30a60 40 0 0 0 0 50" stroke="currentColor" strokeWidth="2" className="anim-dash" />
    <path d="M200 30a60 40 0 0 1 0 50" stroke="currentColor" strokeWidth="2" className="anim-dash" />
  </Art>
);

/** Egenskaper: reglaget ändras och inforutan tänds. */
export const ArtProperties = () => (
  <Art>
    <rect x="50" y="14" width="140" height="82" rx="6" className="fill-raised stroke-line" strokeWidth="1.2" />
    {[30, 52, 74].map((y, i) => (
      <g key={y}>
        <rect x="62" y={y - 4} width="40" height="6" rx="3" className="fill-muted/40" />
        <rect x="112" y={y - 7} width="64" height="12" rx="3" className="fill-app stroke-line" strokeWidth="1" />
        {i === 1 && (
          <g className="anim-slide" style={{ '--slide': '30px' } as CSSProperties}>
            <circle cx="126" cy={y - 1} r="5" fill="currentColor" />
          </g>
        )}
      </g>
    ))}
    <g className="anim-step" style={d(0.4)}>
      <circle cx="198" cy="28" r="9" fill="currentColor" />
      <text x="198" y="32" textAnchor="middle" className="fill-white text-[11px] font-bold">
        i
      </text>
    </g>
  </Art>
);

/** Klart: bocken dyker upp. */
export const ArtDone = () => (
  <Art>
    <circle cx="120" cy="55" r="34" stroke="currentColor" strokeWidth="3" pathLength={100} className="anim-draw" />
    <path d="M104 56l11 11 22-24" stroke="currentColor" strokeWidth="5" pathLength={100} className="anim-draw" style={{ animationDelay: '0.4s' }} />
  </Art>
);
