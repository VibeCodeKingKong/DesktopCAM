/**
 * Tolkar SVG-bandata (attributet d) till banor med linjer och kubiska kurvor.
 * Stöder alla kommandon: M L H V C S Q T A Z, absoluta och relativa.
 */
import type { PathSegment, Vec2 } from '../types';

export interface RawSubpath {
  start: Vec2;
  segments: PathSegment[];
  closed: boolean;
}

class Scanner {
  i = 0;
  constructor(private s: string) {}
  private skip() {
    while (this.i < this.s.length && /[\s,]/.test(this.s[this.i])) this.i++;
  }
  atEnd() {
    this.skip();
    return this.i >= this.s.length;
  }
  peekCommand(): string | null {
    this.skip();
    const c = this.s[this.i];
    return c && /[MmZzLlHhVvCcSsQqTtAa]/.test(c) ? c : null;
  }
  nextCommand(): string {
    const c = this.peekCommand();
    if (!c) throw new Error(`Ogiltig bandata vid tecken ${this.i}`);
    this.i++;
    return c;
  }
  hasNumber(): boolean {
    this.skip();
    return /[-+.\d]/.test(this.s[this.i] ?? '');
  }
  number(): number {
    this.skip();
    const re = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/y;
    re.lastIndex = this.i;
    const m = re.exec(this.s);
    if (!m) throw new Error(`Förväntade ett tal vid tecken ${this.i}`);
    this.i = re.lastIndex;
    return parseFloat(m[0]);
  }
  /** Bågflaggor kan skrivas ihop ("a1 1 0 01 10 10"), så läs ett tecken. */
  flag(): boolean {
    this.skip();
    const c = this.s[this.i++];
    if (c !== '0' && c !== '1') throw new Error(`Ogiltig bågflagga vid tecken ${this.i - 1}`);
    return c === '1';
  }
}

/** SVG-båge (ellips) → kubiska kurvor, enligt SVG-specifikationens bilaga F.6. */
function arcToCubic(p0: Vec2, rx: number, ry: number, phiDeg: number, large: boolean, sweep: boolean, p1: Vec2): PathSegment[] {
  if (rx === 0 || ry === 0) return [{ type: 'line', to: p1 }];
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  const phi = (phiDeg * Math.PI) / 180;
  const cos = Math.cos(phi);
  const sin = Math.sin(phi);
  const dx = (p0.x - p1.x) / 2;
  const dy = (p0.y - p1.y) / 2;
  const x1 = cos * dx + sin * dy;
  const y1 = -sin * dx + cos * dy;
  const lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry);
  if (lambda > 1) {
    rx *= Math.sqrt(lambda);
    ry *= Math.sqrt(lambda);
  }
  const num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1;
  const den = rx * rx * y1 * y1 + ry * ry * x1 * x1;
  let coef = Math.sqrt(Math.max(0, num / den));
  if (large === sweep) coef = -coef;
  const cxp = (coef * rx * y1) / ry;
  const cyp = (-coef * ry * x1) / rx;
  const cx = cos * cxp - sin * cyp + (p0.x + p1.x) / 2;
  const cy = sin * cxp + cos * cyp + (p0.y + p1.y) / 2;
  const angle = (ux: number, uy: number, vx: number, vy: number) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
  const t1 = angle(1, 0, (x1 - cxp) / rx, (y1 - cyp) / ry);
  let dt = angle((x1 - cxp) / rx, (y1 - cyp) / ry, (-x1 - cxp) / rx, (-y1 - cyp) / ry);
  if (!sweep && dt > 0) dt -= 2 * Math.PI;
  if (sweep && dt < 0) dt += 2 * Math.PI;

  const n = Math.max(1, Math.ceil(Math.abs(dt) / (Math.PI / 2) - 1e-9));
  const step = dt / n;
  const k = (4 / 3) * Math.tan(step / 4);
  const map = (ux: number, uy: number): Vec2 => ({ x: cx + rx * ux * cos - ry * uy * sin, y: cy + rx * ux * sin + ry * uy * cos });
  const out: PathSegment[] = [];
  for (let i = 0; i < n; i++) {
    const a = t1 + step * i;
    const b = a + step;
    out.push({
      type: 'cubic',
      c1: map(Math.cos(a) - k * Math.sin(a), Math.sin(a) + k * Math.cos(a)),
      c2: map(Math.cos(b) + k * Math.sin(b), Math.sin(b) - k * Math.cos(b)),
      to: i === n - 1 ? { ...p1 } : map(Math.cos(b), Math.sin(b)),
    });
  }
  return out;
}

export function parsePathData(d: string): RawSubpath[] {
  const sc = new Scanner(d);
  const out: RawSubpath[] = [];
  let cur: RawSubpath | null = null;
  let p: Vec2 = { x: 0, y: 0 };
  let lastCtrl: Vec2 | null = null;
  let lastCmd = '';

  const ensure = () => {
    if (!cur) {
      cur = { start: { ...p }, segments: [], closed: false };
      out.push(cur);
    }
    return cur;
  };

  while (!sc.atEnd()) {
    let cmd = sc.peekCommand();
    if (cmd) sc.nextCommand();
    else if (lastCmd && sc.hasNumber()) cmd = lastCmd === 'M' ? 'L' : lastCmd === 'm' ? 'l' : lastCmd;
    else throw new Error('Ogiltig bandata');
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const pt = (x: number, y: number): Vec2 => (rel ? { x: p.x + x, y: p.y + y } : { x, y });

    switch (C) {
      case 'M': {
        p = pt(sc.number(), sc.number());
        cur = { start: { ...p }, segments: [], closed: false };
        out.push(cur);
        lastCtrl = null;
        break;
      }
      case 'L': {
        p = pt(sc.number(), sc.number());
        ensure().segments.push({ type: 'line', to: { ...p } });
        lastCtrl = null;
        break;
      }
      case 'H': {
        const x = sc.number();
        p = { x: rel ? p.x + x : x, y: p.y };
        ensure().segments.push({ type: 'line', to: { ...p } });
        lastCtrl = null;
        break;
      }
      case 'V': {
        const y = sc.number();
        p = { x: p.x, y: rel ? p.y + y : y };
        ensure().segments.push({ type: 'line', to: { ...p } });
        lastCtrl = null;
        break;
      }
      case 'C': {
        const c1 = pt(sc.number(), sc.number());
        const c2 = pt(sc.number(), sc.number());
        const to = pt(sc.number(), sc.number());
        ensure().segments.push({ type: 'cubic', c1, c2, to });
        p = to;
        lastCtrl = c2;
        break;
      }
      case 'S': {
        const c1 = lastCtrl && /[CcSs]/.test(lastCmd) ? { x: 2 * p.x - lastCtrl.x, y: 2 * p.y - lastCtrl.y } : { ...p };
        const c2 = pt(sc.number(), sc.number());
        const to = pt(sc.number(), sc.number());
        ensure().segments.push({ type: 'cubic', c1, c2, to });
        p = to;
        lastCtrl = c2;
        break;
      }
      case 'Q':
      case 'T': {
        const q: Vec2 =
          C === 'Q'
            ? pt(sc.number(), sc.number())
            : lastCtrl && /[QqTt]/.test(lastCmd)
              ? { x: 2 * p.x - lastCtrl.x, y: 2 * p.y - lastCtrl.y }
              : { ...p };
        const to = pt(sc.number(), sc.number());
        ensure().segments.push({
          type: 'cubic',
          c1: { x: p.x + (2 / 3) * (q.x - p.x), y: p.y + (2 / 3) * (q.y - p.y) },
          c2: { x: to.x + (2 / 3) * (q.x - to.x), y: to.y + (2 / 3) * (q.y - to.y) },
          to,
        });
        p = to;
        lastCtrl = q;
        break;
      }
      case 'A': {
        const rx = sc.number();
        const ry = sc.number();
        const rot = sc.number();
        const large = sc.flag();
        const sweep = sc.flag();
        const to = pt(sc.number(), sc.number());
        ensure().segments.push(...arcToCubic(p, rx, ry, rot, large, sweep, to));
        p = to;
        lastCtrl = null;
        break;
      }
      case 'Z': {
        const sub = ensure();
        sub.closed = true;
        const last = sub.segments[sub.segments.length - 1];
        if (!last || Math.hypot(last.to.x - sub.start.x, last.to.y - sub.start.y) > 1e-9) {
          sub.segments.push({ type: 'line', to: { ...sub.start } });
        }
        p = { ...sub.start };
        cur = null;
        lastCtrl = null;
        break;
      }
    }
    lastCmd = cmd;
  }
  return out.filter((s) => s.segments.length > 0);
}
