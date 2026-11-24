/**
 * Spelar upp ett kalibreringsprov i förhandsvisningen: verktyget följer
 * G-koden och ritar det som skärs eller bränns. Visar i vilken ordning
 * maskinen kör provet – inte hur det slutliga resultatet ser ut.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { arcPoints } from '@desktopcam/core';
import { useT } from '../../i18n';

interface Seg {
  x0: number; y0: number; x1: number; y1: number;
  /** Verktyget arbetar (skär, bränner) – annars förflyttning. */
  on: boolean;
  /** Laserns effekt 0–1. */
  power: number;
  /** Ackumulerad längd vid segmentets slut (mm). */
  end: number;
}

const WORD = /([A-Za-z])\s*([-+]?(?:\d+\.?\d*|\.\d+))/g;

/** Tolkar G-koden till segment i ordning (G0–G3, M3/M4/M5, S). */
export function planSegments(gcode: string, category: 'laser' | 'router' | 'plasma', sMax: number): Seg[] {
  const out: Seg[] = [];
  let x = 0, y = 0, z = 5, mode = 0, s = 0, beam = false, len = 0;
  for (const raw of gcode.split('\n')) {
    const line = raw.replace(/\(.*?\)/g, '').split(';')[0].trim().toUpperCase();
    if (!line) continue;
    let nx = x, ny = y, nz = z, i = 0, j = 0, moved = false;
    WORD.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = WORD.exec(line))) {
      const v = parseFloat(m[2]);
      switch (m[1]) {
        case 'G': if (v <= 3 && Number.isInteger(v)) mode = v; break;
        case 'M': if (v === 3 || v === 4) beam = true; else if (v === 5) beam = false; break;
        case 'S': s = v; break;
        case 'X': nx = v; moved = true; break;
        case 'Y': ny = v; moved = true; break;
        case 'Z': nz = v; moved = true; break;
        case 'I': i = v; break;
        case 'J': j = v; break;
      }
    }
    if (!moved) continue;
    const working =
      mode !== 0 &&
      (category === 'laser' ? beam && s > 0 : category === 'plasma' ? beam : nz < 0.01 || z < 0.01);
    const power = category === 'laser' ? Math.min(1, s / (sMax || 1000)) : 1;
    const pts = mode === 2 || mode === 3 ? arcPoints(x, y, z, nx, ny, nz, i, j, mode === 2, 0.5) : [[nx, ny, nz] as [number, number, number]];
    let px = x, py = y;
    for (const [qx, qy] of pts) {
      const d = Math.hypot(qx - px, qy - py);
      if (d > 1e-6) {
        len += d;
        out.push({ x0: px, y0: py, x1: qx, y1: qy, on: working, power, end: len });
      }
      px = qx;
      py = qy;
    }
    x = nx;
    y = ny;
    z = nz;
  }
  return out;
}

/** Uppspelningens tid: hela provet på ungefär 12 sekunder, oavsett storlek. */
const SECONDS = 12;

/** Styr uppspelningen: framsteg 0–1, spela/pausa och börja om. */
export function usePlayback() {
  const [progress, setProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [active, setActive] = useState(false);
  const raf = useRef(0);
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setProgress((p) => {
        const n = Math.min(1, p + dt / SECONDS);
        if (n >= 1) setPlaying(false);
        return n;
      });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]);
  return {
    progress,
    playing,
    active,
    toggle: () => {
      setActive(true);
      if (progress >= 1) setProgress(0);
      setPlaying((p) => !p);
    },
    restart: () => {
      setActive(true);
      setProgress(0);
      setPlaying(true);
    },
    stop: () => {
      setActive(false);
      setPlaying(false);
      setProgress(0);
    },
  };
}

/** Ritar uppspelningen ovanpå förhandsvisningens SVG (samma koordinater, y = top − y). */
export function PlanPlayback({ gcode, category, sMax, top, scale, progress }: { gcode: string; category: 'laser' | 'router' | 'plasma'; sMax: number; top: number; scale: number; progress: number }) {
  const segs = useMemo(() => planSegments(gcode, category, sMax), [gcode, category, sMax]);
  const total = segs.length ? segs[segs.length - 1].end : 0;
  const at = progress * total;
  let k = 0;
  while (k < segs.length && segs[k].end <= at) k++;
  const cur = segs[k];
  let hx = cur ? cur.x0 : segs.length ? segs[segs.length - 1].x1 : 0;
  let hy = cur ? cur.y0 : segs.length ? segs[segs.length - 1].y1 : 0;
  const all = segs.slice(0, k);
  if (cur) {
    const startLen = cur.end - Math.hypot(cur.x1 - cur.x0, cur.y1 - cur.y0);
    const f = Math.max(0, Math.min(1, (at - startLen) / Math.max(1e-6, cur.end - startLen)));
    hx = cur.x0 + (cur.x1 - cur.x0) * f;
    hy = cur.y0 + (cur.y1 - cur.y0) * f;
    all.push({ ...cur, x1: hx, y1: hy });
  }
  const path = (on: boolean, level?: number) =>
    all
      .filter((s) => s.on === on && (level === undefined || Math.round(s.power * 10) === level))
      .map((s) => `M${s.x0.toFixed(2)} ${(top - s.y0).toFixed(2)}L${s.x1.toFixed(2)} ${(top - s.y1).toFixed(2)}`)
      .join('');
  const levels = category === 'laser' ? Array.from({ length: 11 }, (_, i) => i) : [undefined];
  return (
    <g pointerEvents="none">
      <path d={path(false)} fill="none" stroke="#0969da" strokeWidth={scale * 0.6} strokeDasharray={`${scale * 2} ${scale * 2}`} opacity={0.6} />
      {levels.map((lv) => (
        <path
          key={lv ?? 'all'}
          d={path(true, lv)}
          fill="none"
          stroke={category === 'laser' ? '#1f2328' : '#d1242f'}
          strokeOpacity={lv === undefined ? 1 : 0.15 + (lv / 10) * 0.85}
          strokeWidth={scale * (category === 'laser' ? 1.6 : 1.4)}
          strokeLinecap="round"
        />
      ))}
      <circle cx={hx} cy={top - hy} r={scale * 3} fill={category === 'laser' ? '#e5484d' : category === 'plasma' ? '#4ea8ff' : '#6e7781'} stroke="#fff" strokeWidth={scale * 0.6} />
    </g>
  );
}

/** Knappar för uppspelningen (under förhandsvisningen). */
export function PlayControls({ playing, active, onToggle, onRestart, onStop }: { playing: boolean; active: boolean; onToggle: () => void; onRestart: () => void; onStop: () => void }) {
  const C = useT().calib;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button className="btn" onClick={onToggle}>
        {playing ? <Pause size={13} /> : <Play size={13} />} {playing ? C.pause : C.play}
      </button>
      {active && (
        <>
          <button className="btn" onClick={onRestart} aria-label={C.restart} title={C.restart}>
            <RotateCcw size={13} />
          </button>
          <button className="text-2xs text-accent underline" onClick={onStop}>
            {C.showDrawing}
          </button>
        </>
      )}
    </div>
  );
}
