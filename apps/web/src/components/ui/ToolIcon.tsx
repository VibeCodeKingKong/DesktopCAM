import type { ToolDefinition } from '@desktopcam/core';
import { cuttingLength } from '../../cam/toolReach';
import { useT } from '../../i18n';

/**
 * Sidovy av ett verktyg: skaft, skärande del med spiralskär och spetsens form.
 * Proportionerna följer verktygets mått när de finns. Med `dimensions` ritas
 * måttlinjer för diameter, skärlängd och utstick.
 */
export function ToolIcon({ tool, size = 40, dimensions = false }: { tool: ToolDefinition; size?: number; dimensions?: boolean }) {
  const t = useT();
  const H = 100;
  const W = dimensions ? 90 : 40;
  const cx = dimensions ? 34 : 20;

  if (tool.kind === 'laser') {
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width={(size * W) / H} height={size} aria-hidden="true">
        <rect x={cx - 13} y={6} width={26} height={34} rx={3} className="fill-ink/70" />
        <rect x={cx - 6} y={40} width={12} height={10} className="fill-ink/50" />
        <path d={`M${cx - 5} 50 L${cx} 88 L${cx + 5} 50 Z`} className="fill-laser/50" />
        <circle cx={cx} cy={90} r={3} className="fill-laser" />
      </svg>
    );
  }

  const d = tool.diameter;
  const shank = tool.shankDiameter ?? (tool.kind === 'vbit' ? Math.min(d, 6.35) : d);
  const cut = cuttingLength(tool) ?? d * 3;
  const overall = Math.max(tool.overallLength ?? cut + 25, cut + 5);
  const stick = tool.stickout;
  // Skala: hela längden ryms i 88 enheter, diametern max 34 enheter bred.
  const k = Math.min(88 / overall, 34 / Math.max(d, shank));
  const tipY = 94;
  const rC = (d / 2) * k;
  const rS = (shank / 2) * k;
  const cutTop = tipY - cut * k;
  const topY = tipY - overall * k;

  let body: string;
  if (tool.kind === 'vbit') {
    body = `M${cx} ${tipY} L${cx + rC} ${cutTop} L${cx + rS} ${cutTop} L${cx + rS} ${topY} L${cx - rS} ${topY} L${cx - rS} ${cutTop} L${cx - rC} ${cutTop} Z`;
  } else if (tool.kind === 'ballnose') {
    body = `M${cx - rC} ${tipY - rC} A${rC} ${rC} 0 0 0 ${cx + rC} ${tipY - rC} L${cx + rC} ${cutTop} L${cx + rS} ${cutTop - 2} L${cx + rS} ${topY} L${cx - rS} ${topY} L${cx - rS} ${cutTop - 2} L${cx - rC} ${cutTop} Z`;
  } else if (tool.kind === 'drill') {
    const tip = rC * 0.6;
    body = `M${cx} ${tipY} L${cx + rC} ${tipY - tip} L${cx + rC} ${cutTop} L${cx + rS} ${cutTop - 2} L${cx + rS} ${topY} L${cx - rS} ${topY} L${cx - rS} ${cutTop - 2} L${cx - rC} ${cutTop} L${cx - rC} ${tipY - tip} Z`;
  } else {
    body = `M${cx - rC} ${tipY} L${cx + rC} ${tipY} L${cx + rC} ${cutTop} L${cx + rS} ${cutTop - 2} L${cx + rS} ${topY} L${cx - rS} ${topY} L${cx - rS} ${cutTop - 2} L${cx - rC} ${cutTop} Z`;
  }

  // Spiralskär: snedställda linjer över den skärande delen.
  const flutes: string[] = [];
  if (tool.kind !== 'vbit') {
    const pitch = Math.max(5, rC * 1.6);
    const end = tool.kind === 'ballnose' ? tipY - rC : tipY;
    for (let y = cutTop + 2; y < end - 1; y += pitch) {
      flutes.push(`M${cx - rC} ${Math.min(end, y + pitch * 0.7)} L${cx + rC} ${y}`);
    }
  } else {
    flutes.push(`M${cx} ${tipY} L${cx + rC * 0.15} ${cutTop}`);
  }

  const collet = stick ? tipY - stick * k : null;
  const dimX = cx + Math.max(rC, rS) + 8;
  const label = (n: number) => (+n.toFixed(2)).toLocaleString(t.locale);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={(size * W) / H} height={size} aria-hidden="true" className="overflow-visible">
      {collet !== null && collet > topY && (
        <rect x={cx - Math.max(rS + 5, 8)} y={Math.max(0, collet - 10)} width={2 * Math.max(rS + 5, 8)} height={10} rx={1.5} className="fill-ink/25" />
      )}
      <path d={body} className="fill-ink/15 stroke-ink/70" strokeWidth={1.2} strokeLinejoin="round" />
      <path d={`M${cx - rC} ${cutTop} L${cx + rC} ${cutTop}`} className="stroke-ink/40" strokeWidth={0.8} />
      <path d={flutes.join('')} className="stroke-accent" strokeWidth={1.3} strokeLinecap="round" />
      {dimensions && (
        <g className="fill-muted stroke-muted text-[7px]" strokeWidth={0.6}>
          {/* Diameter under spetsen */}
          <path d={`M${cx - rC} ${tipY + 3} L${cx + rC} ${tipY + 3}`} />
          <text x={cx} y={tipY + 10} textAnchor="middle" stroke="none">
            Ø{label(d)}
          </text>
          {/* Skärlängd */}
          <path d={`M${dimX} ${cutTop} L${dimX} ${tipY} M${dimX - 2} ${cutTop} L${dimX + 2} ${cutTop} M${dimX - 2} ${tipY} L${dimX + 2} ${tipY}`} />
          <text x={dimX + 3} y={(cutTop + tipY) / 2 + 2} stroke="none">
            {label(cut)}
          </text>
          {collet !== null && collet > topY && (
            <>
              <path d={`M${dimX + 18} ${collet} L${dimX + 18} ${tipY} M${dimX + 16} ${collet} L${dimX + 20} ${collet}`} strokeDasharray="2 1.5" />
              <text x={dimX + 21} y={collet + 8} stroke="none">
                {label(stick!)}
              </text>
            </>
          )}
        </g>
      )}
    </svg>
  );
}
