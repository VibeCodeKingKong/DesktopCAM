/**
 * Förklarande animationer för kalibreringsproven. Enkla SVG-animationer
 * (SMIL) som loopar: de visar vad provet mäter, inte exakt hur det ser ut.
 * Med "minska rörelse" i systemet visas en stillbild.
 */
import { useEffect, useRef, type ReactNode } from 'react';

export type CalConcept =
  | 'laserPower' | 'laserSpeed' | 'matrix' | 'focus' | 'kerf' | 'interval' | 'grayscale' | 'passes'
  | 'toolOffset' | 'slot' | 'depth' | 'feed' | 'stepOver' | 'tram' | 'circle'
  | 'plasmaSpeed' | 'plasmaHoles' | 'plasmaCorners' | 'pierce' | 'cutHeight' | 'thc';

/** Provets huvudanimation. */
export const TEST_CONCEPT: Record<string, CalConcept> = {
  'laser-power': 'laserPower',
  'laser-speed': 'laserSpeed',
  'laser-matrix': 'matrix',
  'laser-focus': 'focus',
  'laser-kerf': 'kerf',
  'laser-interval': 'interval',
  'laser-grayscale': 'grayscale',
  'laser-passes': 'passes',
  'router-accuracy': 'toolOffset',
  'router-slot': 'slot',
  'router-depth': 'depth',
  'router-feed': 'feed',
  'router-finish': 'stepOver',
  'router-tram': 'tram',
  'router-circle': 'circle',
  'plasma-speed': 'plasmaSpeed',
  'plasma-kerf': 'kerf',
  'plasma-holes': 'plasmaHoles',
  'plasma-corners': 'plasmaCorners',
  'plasma-pierce': 'pierce',
  'plasma-height': 'cutHeight',
  'plasma-thc': 'thc',
};

/** Animation till en inställning (i "i"-rutan), där det finns en som förklarar den. */
export function paramConcept(key: string, category: 'laser' | 'router' | 'plasma'): CalConcept | null {
  if (/^power/.test(key)) return 'laserPower';
  if (/^speed/.test(key)) return category === 'laser' ? 'laserSpeed' : 'plasmaSpeed';
  if (/^interval/.test(key)) return 'interval';
  if (key === 'focusMode' || key === 'zMin' || key === 'zMax') return 'focus';
  if (/^passes/.test(key)) return 'passes';
  if (key === 'kerf') return 'kerf';
  if (/^stepOver/.test(key)) return 'stepOver';
  if (/^depth/.test(key) || key === 'stepDown') return 'depth';
  if (/^feed/.test(key) || key === 'plunge') return category === 'plasma' ? 'plasmaSpeed' : 'feed';
  if (key === 'pierceDelay' || key === 'pierceHeight' || /^delay/.test(key)) return 'pierce';
  if (key === 'cutHeight' || key === 'heightMin' || key === 'heightMax') return category === 'plasma' ? 'cutHeight' : null;
  if (key === 'cornerSlowdown') return 'plasmaCorners';
  if (/^hole(Min|Max)$/.test(key)) return 'plasmaHoles';
  return null;
}

const WOOD = '#d9b98c';
const BURN = '#3b2a1a';
const BEAM = '#e5484d';
const STEEL = '#9aa4ae';
const TOOL = '#6e7781';
const ARC = '#4ea8ff';
const DUR = '4s';

/** Upprepad animation av ett attribut. */
const A = ({ attr, values, dur = DUR, keyTimes, begin }: { attr: string; values: string; dur?: string; keyTimes?: string; begin?: string }) => (
  <animate attributeName={attr} values={values} dur={dur} keyTimes={keyTimes} begin={begin} repeatCount="indefinite" />
);
/** Förflyttning längs x (translate). */
const Move = ({ values, dur = DUR, keyTimes }: { values: string; dur?: string; keyTimes?: string }) => (
  <animateTransform attributeName="transform" type="translate" values={values} dur={dur} keyTimes={keyTimes} repeatCount="indefinite" />
);

/** Laserhuvud med stråle mot ytan på höjden y. */
const LaserHead = ({ y = 40 }: { y?: number }) => (
  <g>
    <rect x={-6} y={y - 22} width={12} height={10} rx={2} fill={TOOL} />
    <line x1={0} y1={y - 12} x2={0} y2={y} stroke={BEAM} strokeWidth={1.5} />
  </g>
);

function LaserPower() {
  // Rutor som blir mörkare med stigande effekt; huvudet går från ruta till ruta.
  const n = 6;
  return (
    <>
      <rect x={10} y={40} width={180} height={30} fill={WOOD} />
      {Array.from({ length: n }, (_, i) => (
        <rect key={i} x={16 + i * 29} y={46} width={22} height={18} fill={BURN} opacity={0}>
          <A attr="opacity" values={`0;0;${0.15 + (i / (n - 1)) * 0.8};${0.15 + (i / (n - 1)) * 0.8}`} keyTimes={`0;${(i / n).toFixed(3)};${((i + 1) / n).toFixed(3)};1`} />
        </rect>
      ))}
      <g>
        <Move values="27,0;172,0" />
        <LaserHead y={46} />
      </g>
      <text x={10} y={88} fontSize={9} className="fill-muted">10 %</text>
      <text x={190} y={88} fontSize={9} textAnchor="end" className="fill-muted">100 %</text>
    </>
  );
}

function LaserSpeed() {
  // Samma effekt: långsamt ger mörkt spår, snabbt ger ljust.
  return (
    <>
      <rect x={10} y={20} width={180} height={64} fill={WOOD} />
      {[0, 1].map((row) => (
        <g key={row}>
          <rect x={20} y={32 + row * 30} width={0} height={6} fill={BURN} opacity={row ? 0.3 : 0.9}>
            <A attr="width" values="0;160;160" keyTimes={row ? '0;0.3;1' : '0;0.95;1'} />
          </rect>
          <g>
            <Move values={`20,${row * 30};180,${row * 30};180,${row * 30}`} keyTimes={row ? '0;0.3;1' : '0;0.95;1'} />
            <LaserHead y={32} />
          </g>
        </g>
      ))}
    </>
  );
}

function Matrix() {
  const cols = 5, rows = 4;
  return (
    <>
      <rect x={30} y={6} width={140} height={88} fill={WOOD} />
      {Array.from({ length: rows * cols }, (_, k) => {
        const r = Math.floor(k / cols), c = k % cols;
        const dark = Math.min(0.95, 0.1 + ((r + 1) / rows) * (1 - (c / cols) * 0.7) * 0.9);
        const t0 = k / (rows * cols);
        return (
          <rect key={k} x={36 + c * 27} y={12 + r * 20} width={22} height={15} fill={BURN} opacity={0}>
            <A attr="opacity" values={`0;0;${dark.toFixed(2)};${dark.toFixed(2)}`} keyTimes={`0;${t0.toFixed(3)};${(t0 + 0.04).toFixed(3)};1`} dur="6s" />
          </rect>
        );
      })}
      <text x={100} y={99} fontSize={7} textAnchor="middle" className="fill-muted">→</text>
      <text x={24} y={52} fontSize={7} textAnchor="middle" className="fill-muted">↓</text>
    </>
  );
}

function Focus() {
  // Strålens kon: smalast i fokus. Ytan flyttas upp och ner – linjen blir tunn eller bred.
  return (
    <>
      <rect x={85} y={6} width={30} height={14} rx={2} fill={TOOL} />
      <path d="M90 20 L100 55 L110 20 Z" fill={BEAM} opacity={0.25} />
      <path d="M100 55 L88 90 L112 90 Z" fill={BEAM} opacity={0.25} />
      <g>
        <Move values="0,-18;0,0;0,18;0,0;0,-18" dur="5s" />
        <rect x={20} y={55} width={160} height={6} fill={WOOD} />
      </g>
      <rect x={20} y={92} width={160} height={6} fill={WOOD} />
      <rect x={20} y={93} width={160} height={4} fill={BURN} opacity={0.85}>
        <A attr="height" values="4;1;4;1;4" dur="5s" />
        <A attr="y" values="93;94.5;93;94.5;93" dur="5s" />
      </rect>
      <text x={185} y={58} fontSize={8} textAnchor="end" className="fill-muted">●</text>
    </>
  );
}

function Kerf() {
  // En kvadrat skärs ut: snittet tar bort material – biten blir mindre, hålet större.
  return (
    <>
      <rect x={20} y={10} width={160} height={80} fill={STEEL} opacity={0.35} />
      <rect x={60} y={25} width={80} height={50} fill="none" stroke={BEAM} strokeWidth={4} strokeDasharray="260" strokeDashoffset={260}>
        <A attr="stroke-dashoffset" values="260;0;0" keyTimes="0;0.6;1" />
      </rect>
      <g opacity={0}>
        <A attr="opacity" values="0;0;1;1" keyTimes="0;0.6;0.7;1" />
        <line x1={62} y1={86} x2={138} y2={86} stroke="currentColor" strokeWidth={0.8} markerStart="url(#calArrow)" markerEnd="url(#calArrow)" />
        <text x={100} y={97} fontSize={7} textAnchor="middle" className="fill-muted">− ½ ÷ ½</text>
      </g>
    </>
  );
}

function Interval() {
  // Gravyr i rader: stort radavstånd ger ränder, litet ger jämn yta.
  return (
    <>
      <rect x={10} y={10} width={180} height={80} fill={WOOD} />
      {[0, 1, 2].map((g) => {
        const gap = [8, 4, 1.6][g];
        const lines = Math.floor(70 / gap);
        return (
          <g key={g}>
            {Array.from({ length: lines }, (_, i) => (
              <rect key={i} x={18 + g * 58} y={15 + i * gap} width={0} height={1.4} fill={BURN}>
                <A attr="width" values="0;0;48;48" keyTimes={`0;${((i / lines) * 0.8).toFixed(3)};${((i / lines) * 0.8 + 0.05).toFixed(3)};1`} dur="5s" />
              </rect>
            ))}
          </g>
        );
      })}
    </>
  );
}

function Grayscale() {
  const n = 8;
  return (
    <>
      <rect x={10} y={30} width={180} height={40} fill={WOOD} />
      {Array.from({ length: n }, (_, i) => (
        <rect key={i} x={14 + i * 22} y={36} width={18} height={28} fill={BURN} opacity={0}>
          <A attr="opacity" values={`0;0;${((i + 1) / n).toFixed(2)};${((i + 1) / n).toFixed(2)}`} keyTimes={`0;${(i / n).toFixed(3)};${((i + 1) / n).toFixed(3)};1`} />
        </rect>
      ))}
    </>
  );
}

function Passes() {
  // Genomskärning: varje pass skär djupare tills det går igenom.
  return (
    <>
      <rect x={10} y={40} width={180} height={30} fill={WOOD} />
      <rect x={96} y={40} width={8} height={0} style={{ fill: 'var(--cal-bg)' }}>
        <A attr="height" values="0;0;10;10;20;20;30;30" keyTimes="0;0.1;0.2;0.4;0.5;0.7;0.8;1" />
      </rect>
      <g transform="translate(100,0)">
        <LaserHead y={40} />
      </g>
      <text x={100} y={88} fontSize={8} textAnchor="middle" className="fill-muted">1 · 2 · 3</text>
    </>
  );
}

function ToolOffset() {
  // Fräsen går en radie utanför konturen: rätt diameter ger rätt mått.
  return (
    <>
      <rect x={20} y={10} width={160} height={80} fill={WOOD} opacity={0.5} />
      <rect x={70} y={30} width={60} height={40} fill={WOOD} stroke="currentColor" strokeWidth={0.6} strokeDasharray="2 2" />
      <path id="calOffsetPath" d="M62 22 H138 V78 H62 Z" fill="none" stroke={BEAM} strokeWidth={0.8} strokeDasharray="3 2" />
      <circle r={8} fill={TOOL} opacity={0.85}>
        <animateMotion dur={DUR} repeatCount="indefinite" path="M62 22 H138 V78 H62 Z" />
      </circle>
    </>
  );
}

function Slot() {
  // Ett spår blir lika brett som fräsen – eller bredare om den kastar.
  return (
    <>
      <rect x={10} y={20} width={180} height={60} fill={WOOD} />
      <rect x={20} y={44} width={0} height={12} style={{ fill: 'var(--cal-bg)' }}>
        <A attr="width" values="0;160;160" keyTimes="0;0.8;1" />
      </rect>
      <g>
        <Move values="20,0;180,0;180,0" keyTimes="0;0.8;1" />
        <circle cx={0} cy={50} r={6} fill={TOOL} />
        <circle cx={0} cy={50} r={6} fill="none" stroke={BEAM} strokeWidth={0.6}>
          <A attr="r" values="6;6.8;6" dur="0.25s" />
        </circle>
      </g>
    </>
  );
}

function Depth() {
  // Genomskärning: trappsteg på olika djup – mät och jämför med det inställda.
  return (
    <>
      <path d="M10 30 H190 V80 H10 Z" fill={WOOD} />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={20 + i * 42} y={30} width={36} height={0} style={{ fill: 'var(--cal-bg)' }}>
          <A attr="height" values={`0;0;${6 + i * 8};${6 + i * 8}`} keyTimes={`0;${(i * 0.2).toFixed(2)};${(i * 0.2 + 0.15).toFixed(2)};1`} />
        </rect>
      ))}
      <g>
        <Move values="38,0;80,0;122,0;164,0;164,0" keyTimes="0;0.25;0.5;0.75;1" />
        <rect x={-3} y={4} width={6} height={22} fill={TOOL} />
      </g>
    </>
  );
}

function Feed() {
  // Matning: för långsamt bränner, för snabbt river – lagom ger ren kant.
  return (
    <>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={20 + i * 58} y={20} width={46} height={60} fill={WOOD} />
          <path d={`M${43 + i * 58} 20 V80`} stroke={i === 0 ? BURN : i === 1 ? TOOL : '#b5835a'} strokeWidth={i === 2 ? 5 : 4} strokeDasharray={i === 2 ? '3 2' : undefined} opacity={0}>
            <A attr="opacity" values="0;1;1" keyTimes="0;0.4;1" />
          </path>
        </g>
      ))}
      <g>
        <Move values="0,0;0,60;0,60" keyTimes="0;0.4;1" />
        {[0, 1, 2].map((i) => <circle key={i} cx={43 + i * 58} cy={20} r={3.5} fill={TOOL} />)}
      </g>
    </>
  );
}

function StepOver() {
  // Sidosteg: stora steg lämnar åsar mellan banorna, små ger jämn yta.
  return (
    <>
      <path d="M10 60 H190 V85 H10 Z" fill={WOOD} />
      {Array.from({ length: 6 }, (_, i) => (
        <path key={i} d={`M${20 + i * 28} 60 a14 14 0 0 0 28 0`} style={{ fill: 'var(--cal-bg)' }} opacity={0}>
          <A attr="opacity" values={`0;0;1;1`} keyTimes={`0;${(i / 6).toFixed(3)};${((i + 1) / 6).toFixed(3)};1`} />
        </path>
      ))}
      <g>
        <Move values="34,0;174,0" />
        <rect x={-14} y={30} width={28} height={16} rx={3} fill={TOOL} />
        <path d="M-14 46 a14 14 0 0 0 28 0" fill={TOOL} />
      </g>
    </>
  );
}

function Tram() {
  // Lutande spindel: planfräsningen lämnar steg mellan raderna.
  return (
    <>
      <path d="M10 60 H190 V85 H10 Z" fill={WOOD} />
      {Array.from({ length: 6 }, (_, i) => (
        <path key={i} d={`M${20 + i * 28} 60 L${48 + i * 28} 63 V60 Z`} style={{ fill: 'var(--cal-bg)' }} opacity={0}>
          <A attr="opacity" values="0;0;1;1" keyTimes={`0;${(i / 6).toFixed(3)};${((i + 1) / 6).toFixed(3)};1`} />
        </path>
      ))}
      <g>
        <Move values="34,0;174,0" />
        <g transform="rotate(4 0 60)">
          <rect x={-14} y={22} width={28} height={36} rx={3} fill={TOOL} />
        </g>
      </g>
    </>
  );
}

function Circle() {
  // Glapp: cirkeln får platta partier där axlarna byter riktning.
  return (
    <>
      <rect x={30} y={5} width={140} height={90} fill={WOOD} opacity={0.5} />
      <circle cx={100} cy={50} r={36} fill="none" stroke="currentColor" strokeWidth={0.6} strokeDasharray="2 2" />
      <path d="M136 50 A36 36 0 0 1 102 86 L98 86 A36 36 0 0 1 64 52 L64 48 A36 36 0 0 1 98 14 L102 14 A36 36 0 0 1 136 48 Z" fill="none" stroke={BEAM} strokeWidth={1.4} strokeDasharray="230" strokeDashoffset={230}>
        <A attr="stroke-dashoffset" values="230;0;0" keyTimes="0;0.8;1" />
      </path>
    </>
  );
}

const Torch = ({ y = 40 }: { y?: number }) => (
  <g>
    <rect x={-5} y={y - 26} width={10} height={20} rx={2} fill={TOOL} />
    <path d={`M-3 ${y - 6} L0 ${y} L3 ${y - 6} Z`} fill={ARC} />
  </g>
);

function PlasmaSpeed() {
  // För långsamt: slagg under plåten. För snabbt: strålen släpar efter.
  return (
    <>
      <rect x={10} y={40} width={180} height={10} fill={STEEL} />
      <g>
        <Move values="20,0;180,0" />
        <Torch y={40} />
        <path d="M0 50 q4 10 -2 22" stroke={ARC} strokeWidth={1.5} fill="none">
          <A attr="d" values="M0 50 q4 10 -2 22;M0 50 q-8 8 -14 20;M0 50 q4 10 -2 22" dur="2s" />
        </path>
      </g>
      {[30, 60, 90, 120, 150].map((x) => (
        <circle key={x} cx={x} cy={53} r={0} fill={BURN}>
          <A attr="r" values="0;0;2.5;2.5" keyTimes={`0;${((x - 20) / 160).toFixed(3)};${((x - 10) / 160).toFixed(3)};1`} />
        </circle>
      ))}
    </>
  );
}

function PlasmaHoles() {
  // Små hål blir koniska och ovala – provet visar minsta hål som blir bra.
  return (
    <>
      <rect x={10} y={20} width={180} height={60} fill={STEEL} opacity={0.4} />
      {[4, 7, 11, 15, 20].map((r, i) => (
        <circle key={i} cx={30 + i * 35} cy={50} r={r} fill="none" stroke={BEAM} strokeWidth={1.2} strokeDasharray={2 * Math.PI * r} strokeDashoffset={2 * Math.PI * r}>
          <A attr="stroke-dashoffset" values={`${2 * Math.PI * r};${2 * Math.PI * r};0;0`} keyTimes={`0;${(i / 5).toFixed(2)};${((i + 1) / 5).toFixed(2)};1`} />
        </circle>
      ))}
    </>
  );
}

function PlasmaCorners() {
  // Utan inbromsning rundas hörnet av; med inbromsning blir det skarpt.
  return (
    <>
      <rect x={10} y={10} width={180} height={80} fill={STEEL} opacity={0.4} />
      <path d="M20 80 V25 H85" fill="none" stroke={BEAM} strokeWidth={2} strokeDasharray="0 2" />
      <path d="M20 80 V36 Q20 25 31 25 H85" fill="none" stroke={BEAM} strokeWidth={2} strokeDasharray="130" strokeDashoffset={130}>
        <A attr="stroke-dashoffset" values="130;0;0" keyTimes="0;0.6;1" />
      </path>
      <path d="M110 80 V25 H175" fill="none" stroke={ARC} strokeWidth={2} strokeDasharray="130" strokeDashoffset={130}>
        <A attr="stroke-dashoffset" values="130;0;0" keyTimes="0;0.6;1" />
      </path>
    </>
  );
}

function Pierce() {
  // Genomstickning: brännaren går upp, tänder, väntar och sänks till skärhöjd.
  return (
    <>
      <rect x={10} y={70} width={180} height={10} fill={STEEL} />
      <g>
        <Move values="60,-14;60,-14;60,-14;60,0;140,0" keyTimes="0;0.2;0.5;0.6;1" dur="5s" />
        <Torch y={68} />
        <path d="M0 68 L0 82" stroke={ARC} strokeWidth={2} opacity={0}>
          <A attr="opacity" values="0;0;1;1;1" keyTimes="0;0.2;0.25;0.6;1" dur="5s" />
        </path>
      </g>
      <rect x={58} y={70} width={0} height={10} style={{ fill: 'var(--cal-bg)' }}>
        <A attr="width" values="0;0;4;4;84" keyTimes="0;0.2;0.5;0.6;1" dur="5s" />
      </rect>
    </>
  );
}

function CutHeight() {
  // Skärhöjd: för högt ger snett snitt, rätt höjd ger rak kant.
  return (
    <>
      {[0, 1].map((i) => (
        <g key={i} transform={`translate(${i * 95},0)`}>
          <rect x={10} y={60} width={80} height={20} fill={STEEL} />
          <path d={i ? 'M48 60 L48 80 L52 80 L52 60 Z' : 'M44 60 L49 80 L51 80 L56 60 Z'} style={{ fill: 'var(--cal-bg)' }} />
          <g transform={`translate(50,${i ? 0 : -14})`}>
            <Torch y={i ? 58 : 58} />
          </g>
          <path d={`M50 ${i ? 58 : 44} L50 82`} stroke={ARC} strokeWidth={1.5}>
            <A attr="opacity" values="1;0.5;1" dur="0.4s" />
          </path>
        </g>
      ))}
    </>
  );
}

function Thc() {
  // Höjdreglering: brännaren följer en buktig plåt på samma avstånd.
  return (
    <>
      <path d="M10 70 Q55 50 100 70 T190 70 V82 H10 Z" fill={STEEL} />
      <g>
        <animateMotion dur={DUR} repeatCount="indefinite" path="M20 52 Q55 38 100 58 T180 52" />
        <Torch y={10} />
      </g>
    </>
  );
}

const DRAW: Record<CalConcept, () => JSX.Element> = {
  laserPower: LaserPower,
  laserSpeed: LaserSpeed,
  matrix: Matrix,
  focus: Focus,
  kerf: Kerf,
  interval: Interval,
  grayscale: Grayscale,
  passes: Passes,
  toolOffset: ToolOffset,
  slot: Slot,
  depth: Depth,
  feed: Feed,
  stepOver: StepOver,
  tram: Tram,
  circle: Circle,
  plasmaSpeed: PlasmaSpeed,
  plasmaHoles: PlasmaHoles,
  plasmaCorners: PlasmaCorners,
  pierce: Pierce,
  cutHeight: CutHeight,
  thc: Thc,
};

/** En animation med bildtext. */
export function CalAnimation({ concept, caption, className = '' }: { concept: CalConcept; caption?: ReactNode; className?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    // Minska rörelse: stillbild en bit in i förloppet (där något syns).
    let reduce = false;
    try {
      reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      /* gamla webbläsare */
    }
    if (reduce && typeof svg.pauseAnimations === 'function') {
      svg.setCurrentTime(3);
      svg.pauseAnimations();
    }
  }, [concept]);
  const Draw = DRAW[concept];
  return (
    <figure className={`rounded-md bg-app p-2 ${className}`}>
      <svg key={concept} ref={ref} viewBox="0 0 200 100" className="mx-auto block h-auto w-full max-w-[260px] text-muted" style={{ ['--cal-bg' as string]: 'rgb(var(--c-app))' }} role="img" aria-label={typeof caption === 'string' ? caption : undefined}>
        <defs>
          <marker id="calArrow" viewBox="0 0 6 6" refX="3" refY="3" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
            <path d="M0 0 L6 3 L0 6 Z" fill="currentColor" />
          </marker>
        </defs>
        <Draw />
      </svg>
      {caption && <figcaption className="mt-1 text-2xs leading-relaxed text-muted">{caption}</figcaption>}
    </figure>
  );
}
