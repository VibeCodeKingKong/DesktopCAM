/**
 * Ritlagret i 3D-vyn: markera, flytta, rita och redigera noder.
 *
 * Händelser fångas på behållaren i "capture"-fasen, före OrbitControls.
 * När ritlagret tar hand om en gest stoppas den så att kameran inte rör sig.
 * Med två fingrar lämnas allt åt OrbitControls (nyp-zoom och panorering).
 * Hjälpgrafik (noder, gummiband, markeringsram) ritas på en 2D-canvas
 * ovanpå WebGL efter varje bildruta.
 */
import {
  makeCircle,
  makeRect,
  cornerVertices,
  setVertexRadius,
  transformShape,
  translate,
  uid,
  type PathSegment,
  type Vec2,
  type VectorShape,
} from '@desktopcam/core';
import type { SceneController } from '../components/viewport/SceneController';
import { getT } from '../i18n';
import { onContour, setTabPositions, tabContext } from './tabs';
import { defaultMeasureRef, measure } from '../cam/commands';
import { buildTextShape } from '../text/textShape';
import { isOutlineFont } from '../text/fonts';
import { allShapes, useAppStore, type EditTool, type NodeRef } from '../store/useAppStore';
import { useDraft } from './draftStore';
import { hitShape, shapeGeometry } from './hitTest';
import { deleteNode, getNode, handlesOf, insertNode, moveHandle, moveNode, nearestOnPath, nodeCount, normalizeShape, pointOnSegment } from './nodes';

type DraftNode = { p: Vec2; hin?: Vec2; hout?: Vec2 };

type Gesture =
  | { kind: 'none' }
  | { kind: 'empty'; x0: number; y0: number; moved: boolean }
  | { kind: 'move'; x0: number; y0: number; start: Vec2; originals: VectorShape[]; moved: boolean; hitId: string; wasSelected: boolean; additive: boolean }
  | { kind: 'node'; ref: NodeRef; moved: boolean }
  | { kind: 'handle'; shapeId: string; pathIndex: number; segment: number; which: 'c1' | 'c2'; moved: boolean }
  | { kind: 'shapeTap'; shapeId: string; x0: number; y0: number; w: Vec2 }
  | { kind: 'rect'; a: Vec2; b: Vec2 }
  | { kind: 'circle'; c: Vec2; r: number }
  | { kind: 'tap'; x0: number; y0: number; moved: boolean }
  | { kind: 'curveNode'; p: Vec2; handle: Vec2 | null; x0: number; y0: number }
  | { kind: 'tab'; index: number; x0: number; y0: number; moved: boolean; added: boolean }
  | { kind: 'relief'; id: string; start: Vec2; ox: number; oy: number; x0: number; y0: number; moved: boolean };

const DRAW_TOOLS: EditTool[] = ['line', 'curve', 'rect', 'circle', 'text'];

export let activeEditor: EditController | null = null;

export class EditController {
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private pointers = new Set<number>();
  private gesture: Gesture = { kind: 'none' };
  private draft: DraftNode[] = [];
  private cursor: Vec2 | null = null;
  private snapKind: 'node' | 'grid' | 'free' | 'axis' = 'free';
  /** Hjälplinje när en linje fäst vid en vinkel (från senaste punkten). */
  private guide: { from: Vec2; angle: number } | null = null;
  private lastTap = { time: 0, x: 0, y: 0 };
  private accent = '0 113 227';
  private ink = '29 29 31';
  private surface = '255 255 255';
  private lastTheme = '';
  private unsub: () => void;

  constructor(private scene: SceneController) {
    const host = scene.element;
    this.canvas.style.cssText = 'position:absolute;inset:0;pointer-events:none;width:100%;height:100%';
    host.appendChild(this.canvas);
    this.ctx = this.canvas.getContext('2d')!;
    host.addEventListener('pointerdown', this.onDown, { capture: true });
    host.addEventListener('pointermove', this.onMove, { capture: true });
    host.addEventListener('pointerup', this.onUp, { capture: true });
    host.addEventListener('pointercancel', this.onCancel, { capture: true });
    host.addEventListener('pointerleave', this.onLeave);
    scene.onFrame = () => this.draw();
    this.applyTool(useAppStore.getState().editTool);
    this.unsub = useAppStore.subscribe((s, prev) => {
      if (s.editTool !== prev.editTool) this.applyTool(s.editTool);
      // Flikverktyget gäller den markerade profilbanan – avsluta om den inte längre finns.
      if (s.editTool === 'tabs' && (s.selectedToolpathId !== prev.selectedToolpathId || s.toolpaths !== prev.toolpaths) && !tabContext()) s.setEditTool('select');
    });
    activeEditor = this;
  }

  dispose() {
    const host = this.scene.element;
    host.removeEventListener('pointerdown', this.onDown, { capture: true });
    host.removeEventListener('pointermove', this.onMove, { capture: true });
    host.removeEventListener('pointerup', this.onUp, { capture: true });
    host.removeEventListener('pointercancel', this.onCancel, { capture: true });
    host.removeEventListener('pointerleave', this.onLeave);
    this.unsub();
    this.canvas.remove();
    if (activeEditor === this) activeEditor = null;
  }

  /* ───────── Publika kommandon (ritfält och tangenter) ───────── */

  get drafting() {
    return this.draft.length > 0;
  }

  finish(closed = false) {
    const tool = useAppStore.getState().editTool;
    if (this.draft.length < 2) return this.cancelDraft();
    const nodes = this.draft;
    const segs: PathSegment[] = [];
    const seg = (a: DraftNode, b: DraftNode): PathSegment =>
      tool === 'curve' && (a.hout || b.hin) ? { type: 'cubic', c1: a.hout ?? a.p, c2: b.hin ?? b.p, to: { ...b.p } } : { type: 'line', to: { ...b.p } };
    for (let i = 1; i < nodes.length; i++) segs.push(seg(nodes[i - 1], nodes[i]));
    if (closed) segs.push(seg(nodes[nodes.length - 1], nodes[0]));
    const t = getT();
    const kindName = tool === 'curve' ? t.shapeNames.curve : t.shapeNames.line;
    const count = allShapes(useAppStore.getState().layers).filter((s) => s.name.startsWith(kindName)).length + 1;
    const shape: VectorShape = {
      id: uid('shape'),
      name: `${kindName} ${count}`,
      kind: tool === 'curve' ? 'bezier' : closed ? 'polygon' : 'line',
      paths: [{ id: uid('path'), start: { ...nodes[0].p }, segments: segs, closed }],
    };
    this.resetDraft();
    this.commitShape(shape);
  }

  cancelDraft() {
    this.resetDraft();
    this.gesture = { kind: 'none' };
  }

  undoPoint() {
    this.draft.pop();
    useDraft.getState().setPoints(this.draft.length);
  }

  deleteSelectedNode(): boolean {
    const s = useAppStore.getState();
    const ref = s.selectedNode;
    if (!ref) return false;
    const shape = allShapes(s.layers).find((x) => x.id === ref.shapeId);
    if (!shape) return false;
    const path = deleteNode(shape.paths[ref.pathIndex], ref.index);
    if (!path) {
      s.setStatus(getT().status.nodeCannotDelete);
      return true;
    }
    s.replaceShapes([{ ...shape, paths: shape.paths.map((p, i) => (i === ref.pathIndex ? path : p)) }]);
    s.selectNode(null);
    s.setStatus(getT().status.nodeDeleted);
    return true;
  }

  /* ───────── Hjälpfunktioner ───────── */

  private resetDraft() {
    this.draft = [];
    useDraft.getState().setPoints(0);
  }

  private commitShape(shape: VectorShape) {
    const s = useAppStore.getState();
    s.addShape(shape);
    s.setEditTool('select');
    s.setStatus(getT().status.shapeAdded(shape.name));
  }

  private applyTool(tool: EditTool) {
    this.resetDraft();
    this.gesture = { kind: 'none' };
    // Med ritverktyg roterar ett finger inte vyn – två fingrar zoomar och panorerar.
    this.scene.setRotateEnabled(tool === 'select');
    if (DRAW_TOOLS.includes(tool) && !this.scene.isTopView()) useAppStore.getState().sendViewCommand('top');
    if (tool === 'nodes') {
      // Gör om markerade former till redigerbara banor (bågar → kurvor).
      const s = useAppStore.getState();
      const sel = allShapes(s.layers).filter((x) => s.selectedShapeIds.includes(x.id));
      const changed = sel.filter((x) => x.kind === 'rect' || x.kind === 'circle' || x.text || x.paths.some((p) => p.segments.some((g) => g.type === 'arc')));
      if (changed.length) s.replaceShapes(changed.map(normalizeShape));
    }
  }

  private world(e: PointerEvent): Vec2 | null {
    return this.scene.screenToWorld(e.clientX, e.clientY);
  }

  private local(e: PointerEvent) {
    const r = this.scene.element.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private tol(e: PointerEvent, w: Vec2) {
    return (e.pointerType === 'touch' ? 18 : 9) * this.scene.worldPerPixel(w.x, w.y);
  }

  /** Fäst mot noder (inom tol) och sedan mot rutnätet. */
  private snap(w: Vec2, tol: number, exclude?: NodeRef): Vec2 {
    const s = useAppStore.getState();
    let best: Vec2 | null = null;
    let bestD = tol;
    // Första punkten fäster bara när formen kan stängas med en yta (linje: minst 3 punkter).
    if (this.draft.length >= (useAppStore.getState().editTool === 'curve' ? 2 : 3)) {
      const f = this.draft[0].p;
      const d = Math.hypot(f.x - w.x, f.y - w.y);
      if (d < bestD) { bestD = d; best = f; }
    }
    let budget = 20000;
    for (const layer of s.layers) {
      if (!layer.visible) continue;
      for (const shape of layer.shapes) {
        const g = shapeGeometry(shape);
        if (w.x < g.min.x - tol || w.x > g.max.x + tol || w.y < g.min.y - tol || w.y > g.max.y + tol) continue;
        shape.paths.forEach((path, pi) => {
          const n = Math.min(nodeCount(path), budget);
          budget -= n;
          for (let i = 0; i < n; i++) {
            if (exclude && exclude.shapeId === shape.id && exclude.pathIndex === pi && exclude.index === i) continue;
            const q = getNode(path, i);
            const d = Math.hypot(q.x - w.x, q.y - w.y);
            if (d < bestD) { bestD = d; best = q; }
          }
        });
      }
    }
    if (best) {
      this.snapKind = 'node';
      return { ...best };
    }
    if (s.snap.grid && s.snap.step > 0) {
      this.snapKind = 'grid';
      const st = s.snap.step;
      return { x: Math.round(w.x / st) * st, y: Math.round(w.y / st) * st };
    }
    this.snapKind = 'free';
    return w;
  }

  private isDoubleTap(e: PointerEvent) {
    const now = performance.now();
    const p = this.local(e);
    const dbl = now - this.lastTap.time < 350 && Math.hypot(p.x - this.lastTap.x, p.y - this.lastTap.y) < 24;
    this.lastTap = dbl ? { time: 0, x: 0, y: 0 } : { time: now, x: p.x, y: p.y };
    return dbl;
  }

  private stop(e: PointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    try {
      this.scene.element.setPointerCapture(e.pointerId);
    } catch {
      /* ignoreras */
    }
  }

  private selectedShapes() {
    const s = useAppStore.getState();
    return allShapes(s.layers).filter((x) => s.selectedShapeIds.includes(x.id));
  }

  /* ───────── Pekarhändelser ───────── */

  private onDown = (e: PointerEvent) => {
    this.pointers.add(e.pointerId);
    if (this.pointers.size > 1) {
      // Två fingrar: lämna åt kameran och avbryt pågående gest.
      const g = this.gesture;
      if ((g.kind === 'move' || g.kind === 'node' || g.kind === 'handle') && g.moved) useAppStore.getState().undo();
      this.gesture = { kind: 'none' };
      return;
    }
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const w = this.world(e);
    if (!w) return;
    const s = useAppStore.getState();
    const tool = s.editTool;
    const tol = this.tol(e, w);
    const { x: x0, y: y0 } = this.local(e);
    const t0 = getT();

    switch (tool) {
      case 'fillet': {
        const hit = this.cornerAt(w, tol);
        if (!hit) return;
        this.stop(e);
        const want = useDraft.getState().filletRadius;
        const r = Math.abs(hit.r - want) < 1e-6 ? 0 : want;
        s.replaceShapes([setVertexRadius(hit.shape, hit.pi, hit.vi, r)]);
        s.setStatus(r > 0 ? t0.fillet.set(r) : t0.fillet.removed);
        return;
      }
      case 'measure': {
        this.stop(e);
        const hit = hitShape(s.layers, w, tol);
        if (!hit) s.clearSelection();
        else if (s.selectedShapeIds.length === 1 && s.selectedShapeIds[0] !== hit) s.selectShape(hit, true);
        else s.selectShape(hit, false);
        return;
      }
      case 'tabs': {
        const ctx = tabContext();
        if (!ctx) return;
        this.stop(e);
        const grab = Math.max(tol * 1.5, ctx.tabs.width / 2);
        let index = -1, bestD = grab;
        ctx.positions.forEach((q, i) => {
          const d = Math.hypot(q.x - w.x, q.y - w.y);
          if (d < bestD) { bestD = d; index = i; }
        });
        s.checkpoint();
        let added = false;
        if (index < 0) {
          const hit = onContour(ctx, w);
          if (!hit || hit.dist > tol * 2.5) return;
          setTabPositions(ctx, [...ctx.positions, { x: hit.x, y: hit.y }]);
          index = ctx.positions.length;
          added = true;
        } else if (ctx.tabs.mode !== 'manual') {
          setTabPositions(ctx, ctx.positions);
        }
        this.gesture = { kind: 'tab', index, x0, y0, moved: false, added };
        return;
      }
      case 'select': {
        // Reliefer: tryck inuti för att markera, dra för att flytta. Över en relief
        // träffas former bara på sin linje (som i Vectric) – annars vore reliefen
        // omöjlig att markera där en sluten form ligger ovanpå.
        const relief = this.reliefAt(w);
        const hit = hitShape(s.layers, w, tol, !!relief);
        if (relief && (!hit || (relief.id === s.selectedReliefId && !s.selectedShapeIds.includes(hit)))) {
          this.stop(e);
          if (s.selectedReliefId !== relief.id) s.selectRelief(relief.id);
          // En inläggsplugg följer sin ficka och kan inte flyttas för sig.
          if (relief.plug) return;
          this.gesture = { kind: 'relief', id: relief.id, start: w, ox: relief.x, oy: relief.y, x0, y0, moved: false };
          return;
        }
        if (!hit) {
          this.gesture = { kind: 'empty', x0, y0, moved: false };
          return;
        }
        this.stop(e);
        const additive = e.shiftKey || e.metaKey || e.ctrlKey;
        const wasSelected = s.selectedShapeIds.includes(hit);
        if (!wasSelected) s.selectShape(hit, additive);
        this.gesture = { kind: 'move', x0, y0, start: w, originals: this.selectedShapes(), moved: false, hitId: hit, wasSelected, additive };
        return;
      }
      case 'nodes': {
        for (const shape of this.selectedShapes()) {
          for (let pi = 0; pi < shape.paths.length; pi++) {
            const path = shape.paths[pi];
            const n = nodeCount(path);
            const sel = s.selectedNode;
            // Handtag först (bara för markerad nod och dess grannar).
            if (sel && sel.shapeId === shape.id && sel.pathIndex === pi) {
              for (const idx of [sel.index, (sel.index + 1) % n, (sel.index - 1 + n) % n]) {
                for (const h of handlesOf(path, idx)) {
                  if (Math.hypot(h.pos.x - w.x, h.pos.y - w.y) < tol) {
                    this.stop(e);
                    this.gesture = { kind: 'handle', shapeId: shape.id, pathIndex: pi, segment: h.segment, which: h.which, moved: false };
                    return;
                  }
                }
              }
            }
            for (let i = 0; i < n; i++) {
              const q = getNode(path, i);
              if (Math.hypot(q.x - w.x, q.y - w.y) < tol) {
                this.stop(e);
                const ref = { shapeId: shape.id, pathIndex: pi, index: i };
                s.selectNode(ref);
                this.gesture = { kind: 'node', ref, moved: false };
                return;
              }
            }
          }
        }
        const hit = hitShape(s.layers, w, tol);
        if (hit) {
          this.stop(e);
          if (!s.selectedShapeIds.includes(hit)) {
            s.selectShape(hit, false);
            this.applyTool('nodes');
          }
          this.gesture = { kind: 'shapeTap', shapeId: hit, x0, y0, w };
          return;
        }
        this.gesture = { kind: 'empty', x0, y0, moved: false };
        return;
      }
      case 'line':
      case 'text':
        this.stop(e);
        this.gesture = { kind: 'tap', x0, y0, moved: false };
        return;
      case 'curve':
        this.stop(e);
        this.gesture = { kind: 'curveNode', p: this.drawSnap(w, tol, e.shiftKey), handle: null, x0, y0 };
        return;
      case 'rect': {
        this.stop(e);
        const a = this.snap(w, tol);
        this.gesture = { kind: 'rect', a, b: a };
        return;
      }
      case 'circle':
        this.stop(e);
        this.gesture = { kind: 'circle', c: this.snap(w, tol), r: 0 };
        return;
    }
  };

  private onMove = (e: PointerEvent) => {
    const w = this.world(e);
    if (!w) return;
    const s = useAppStore.getState();
    const tol = this.tol(e, w);
    const tool = s.editTool;
    if (DRAW_TOOLS.includes(tool)) this.cursor = this.drawSnap(w, tol, e.shiftKey);
    else this.cursor = null;
    if (this.pointers.size > 1) return;
    const g = this.gesture;
    const p = this.local(e);

    if (tool === 'tabs' || tool === 'fillet') this.cursor = w;
    switch (g.kind) {
      case 'relief': {
        if (!g.moved && Math.hypot(p.x - g.x0, p.y - g.y0) < 5) return;
        if (!g.moved) {
          g.moved = true;
          s.checkpoint();
        }
        let dx = w.x - g.start.x, dy = w.y - g.start.y;
        if (s.snap.grid && s.snap.step > 0) {
          dx = Math.round((g.ox + dx) / s.snap.step) * s.snap.step - g.ox;
          dy = Math.round((g.oy + dy) / s.snap.step) * s.snap.step - g.oy;
        }
        s.updateRelief(g.id, { x: g.ox + dx, y: g.oy + dy });
        return;
      }
      case 'tab': {
        if (!g.moved && Math.hypot(p.x - g.x0, p.y - g.y0) < 5) return;
        g.moved = true;
        const ctx = tabContext();
        const hit = ctx && onContour(ctx, w);
        if (!ctx || !hit) return;
        setTabPositions(ctx, ctx.positions.map((q, i) => (i === g.index ? { x: hit.x, y: hit.y } : q)));
        return;
      }
      case 'empty':
        if (Math.hypot(p.x - g.x0, p.y - g.y0) > 5) g.moved = true;
        return;
      case 'tap':
        if (Math.hypot(p.x - g.x0, p.y - g.y0) > 10) g.moved = true;
        return;
      case 'move': {
        if (!g.moved && Math.hypot(p.x - g.x0, p.y - g.y0) < 5) return;
        if (!g.moved) {
          g.moved = true;
          s.checkpoint();
        }
        let dx = w.x - g.start.x;
        let dy = w.y - g.start.y;
        if (s.snap.grid && s.snap.step > 0) {
          dx = Math.round(dx / s.snap.step) * s.snap.step;
          dy = Math.round(dy / s.snap.step) * s.snap.step;
        }
        const m = translate(dx, dy);
        s.replaceShapes(
          g.originals.map((sh) => {
            const moved = transformShape(sh, m);
            return sh.text ? { ...moved, text: { ...sh.text, x: sh.text.x + dx, y: sh.text.y + dy } } : moved;
          }),
          false,
        );
        return;
      }
      case 'node': {
        if (!g.moved) s.checkpoint();
        g.moved = true;
        const shape = allShapes(s.layers).find((x) => x.id === g.ref.shapeId);
        if (!shape) return;
        const q = this.snap(w, tol, g.ref);
        const path = moveNode(shape.paths[g.ref.pathIndex], g.ref.index, q);
        s.replaceShapes([{ ...shape, paths: shape.paths.map((pp, i) => (i === g.ref.pathIndex ? path : pp)) }], false);
        return;
      }
      case 'handle': {
        if (!g.moved) s.checkpoint();
        g.moved = true;
        const shape = allShapes(s.layers).find((x) => x.id === g.shapeId);
        if (!shape) return;
        const path = moveHandle(shape.paths[g.pathIndex], g.segment, g.which, w);
        s.replaceShapes([{ ...shape, paths: shape.paths.map((pp, i) => (i === g.pathIndex ? path : pp)) }], false);
        return;
      }
      case 'rect':
        g.b = this.snap(w, tol);
        return;
      case 'circle': {
        const q = this.snap(w, tol);
        g.r = Math.hypot(q.x - g.c.x, q.y - g.c.y);
        return;
      }
      case 'curveNode':
        if (g.handle || Math.hypot(p.x - g.x0, p.y - g.y0) > 6) g.handle = w;
        return;
    }
  };

  private onUp = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    const g = this.gesture;
    this.gesture = { kind: 'none' };
    const s = useAppStore.getState();
    const w = this.world(e);
    const t = getT();

    switch (g.kind) {
      case 'tab': {
        const ctx = tabContext();
        if (ctx && !g.moved && !g.added) {
          setTabPositions(ctx, ctx.positions.filter((_, i) => i !== g.index));
          s.setStatus(t.tabsEdit.removed);
        } else if (ctx && g.added) s.setStatus(t.tabsEdit.added);
        return;
      }
      case 'empty':
        if (!g.moved && !(e.shiftKey || e.metaKey)) {
          if (s.editTool === 'nodes' && s.selectedNode) s.selectNode(null);
          else {
            s.clearSelection();
            if (s.selectedReliefId) s.selectRelief(null);
          }
        }
        return;
      case 'move':
        if (!g.moved && g.wasSelected) {
          if (g.additive) s.selectShape(g.hitId, true);
          else if (s.selectedShapeIds.length > 1) s.setSelection([g.hitId]);
        }
        return;
      case 'shapeTap': {
        if (!this.isDoubleTap(e)) return;
        const shape = allShapes(s.layers).find((x) => x.id === g.shapeId);
        if (!shape || !w) return;
        let best: { pi: number; segment: number; t: number; dist: number } | null = null;
        shape.paths.forEach((path, pi) => {
          const r = nearestOnPath(path, w);
          if (r && (!best || r.dist < best.dist)) best = { pi, segment: r.segment, t: r.t, dist: r.dist };
        });
        const b = best as { pi: number; segment: number; t: number; dist: number } | null;
        if (!b || b.t < 0.02 || b.t > 0.98) return;
        const normalized = shape.paths.some((p) => p.segments.some((sg) => sg.type === 'arc')) ? normalizeShape(shape) : shape;
        const path = insertNode(normalized.paths[b.pi], b.segment, b.t);
        s.replaceShapes([{ ...normalized, text: undefined, paths: normalized.paths.map((pp, i) => (i === b.pi ? path : pp)) }]);
        s.selectNode({ shapeId: shape.id, pathIndex: b.pi, index: b.segment + 1 });
        s.setStatus(t.status.nodeAdded);
        return;
      }
      case 'rect': {
        const x = Math.min(g.a.x, g.b.x), y = Math.min(g.a.y, g.b.y);
        const wdt = Math.abs(g.b.x - g.a.x), hgt = Math.abs(g.b.y - g.a.y);
        if (wdt < 0.5 || hgt < 0.5) return;
        this.commitShape(makeRect(this.nextName(t.shapeNames.rect), x, y, wdt, hgt));
        return;
      }
      case 'circle':
        if (g.r < 0.3) return;
        this.commitShape(makeCircle(this.nextName(t.shapeNames.circle), g.c.x, g.c.y, g.r));
        return;
      case 'tap': {
        if (g.moved || !w) return;
        const q = this.drawSnap(w, this.tol(e, w), e.shiftKey);
        if (s.editTool === 'text') {
          s.setTextAnchor(q);
          s.openDialog('text');
          return;
        }
        const dbl = this.isDoubleTap(e);
        if (this.draft.length >= 3 && this.snapKind === 'node' && q.x === this.draft[0].p.x && q.y === this.draft[0].p.y) {
          this.finish(true);
          return;
        }
        if (dbl && this.draft.length >= 2) {
          this.finish(false);
          return;
        }
        const last = this.draft[this.draft.length - 1];
        if (!last || Math.hypot(last.p.x - q.x, last.p.y - q.y) > 1e-6) this.draft.push({ p: q });
        useDraft.getState().setPoints(this.draft.length);
        return;
      }
      case 'curveNode': {
        const node: DraftNode = { p: g.p };
        if (g.handle) {
          node.hout = { ...g.handle };
          node.hin = { x: 2 * g.p.x - g.handle.x, y: 2 * g.p.y - g.handle.y };
        }
        const first = this.draft[0];
        if (this.draft.length >= 2 && first && Math.hypot(first.p.x - g.p.x, first.p.y - g.p.y) < 1e-6) {
          this.finish(true);
          return;
        }
        if (!g.handle && this.isDoubleTap(e) && this.draft.length >= 2) {
          this.finish(false);
          return;
        }
        this.draft.push(node);
        useDraft.getState().setPoints(this.draft.length);
        return;
      }
    }
  };

  private onCancel = (e: PointerEvent) => {
    this.pointers.delete(e.pointerId);
    this.gesture = { kind: 'none' };
  };

  private onLeave = () => {
    this.cursor = null;
  };

  private nextName(base: string) {
    const n = allShapes(useAppStore.getState().layers).filter((s) => s.name.startsWith(base)).length + 1;
    return `${base} ${n}`;
  }

  /** Skapar text vid ankarpunkten (anropas från textdialogen). Ett kontur-typsnitt måste vara inläst. */
  static createText(content: string, height: number, align: 'left' | 'center' | 'right', weight = 0, font?: string) {
    const s = useAppStore.getState();
    const a = s.textAnchor ?? { x: 10, y: 10 };
    const text = { content, height, spacing: 0, align, weight: isOutlineFont(font) ? 0 : weight, font: isOutlineFont(font) ? font : undefined, x: a.x, y: a.y };
    const shape = buildTextShape(text);
    shape.text = text;
    s.addShape(shape);
    s.setTextAnchor(null);
    s.setEditTool('select');
    s.setStatus(getT().status.shapeAdded(shape.name));
  }

  /* ───────── Ritning av hjälpgrafik ───────── */

  private readColors() {
    const theme = useAppStore.getState().theme;
    if (theme === this.lastTheme) return;
    this.lastTheme = theme;
    const cs = getComputedStyle(document.documentElement);
    this.accent = cs.getPropertyValue('--c-accent').trim() || this.accent;
    this.ink = cs.getPropertyValue('--c-ink').trim() || this.ink;
    this.surface = cs.getPropertyValue('--c-raised').trim() || this.surface;
  }

  private draw() {
    const host = this.scene.element;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = host.clientWidth, h = host.clientHeight;
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr);
      this.canvas.height = Math.round(h * dpr);
    }
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    this.readColors();
    const s = useAppStore.getState();
    const accent = `rgb(${this.accent.split(/\s+/).join(',')})`;
    const surface = `rgb(${this.surface.split(/\s+/).join(',')})`;
    const P = (v: Vec2) => this.scene.worldToScreen(v.x, v.y);

    // Inskriven längd/vinkel: visa punkten där markören annars sitter.
    if (this.polarPreview && s.editTool === 'line' && this.draft.length) {
      const a = this.draft[this.draft.length - 1].p;
      const rad = (this.polarPreview.angle * Math.PI) / 180;
      this.cursor = { x: a.x + this.polarPreview.length * Math.cos(rad), y: a.y + this.polarPreview.length * Math.sin(rad) };
      this.guide = { from: a, angle: this.polarPreview.angle };
      this.snapKind = 'axis';
    }


    // Markeringsram
    if (s.editTool === 'select' && s.selectedShapeIds.length && !s.sim.active) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const sh of this.selectedShapes()) {
        const g = shapeGeometry(sh);
        minX = Math.min(minX, g.min.x); minY = Math.min(minY, g.min.y);
        maxX = Math.max(maxX, g.max.x); maxY = Math.max(maxY, g.max.y);
      }
      if (Number.isFinite(minX)) {
        const pad = 4 * this.scene.worldPerPixel((minX + maxX) / 2, (minY + maxY) / 2);
        const corners = [
          { x: minX - pad, y: minY - pad }, { x: maxX + pad, y: minY - pad },
          { x: maxX + pad, y: maxY + pad }, { x: minX - pad, y: maxY + pad },
        ].map(P);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        corners.forEach((c, i) => (i ? ctx.lineTo(c.x, c.y) : ctx.moveTo(c.x, c.y)));
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // Markerad relief: ram och namn
    if (s.selectedReliefId && s.editTool === 'select' && !s.sim.active) {
      const r = s.reliefs.find((x) => x.id === s.selectedReliefId);
      if (r) {
        const c = [{ x: r.x, y: r.y }, { x: r.x + r.width, y: r.y }, { x: r.x + r.width, y: r.y + r.height }, { x: r.x, y: r.y + r.height }].map(P);
        ctx.strokeStyle = accent;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        c.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = surface;
        for (const q of c) { ctx.fillRect(q.x - 3.5, q.y - 3.5, 7, 7); ctx.strokeRect(q.x - 3.5, q.y - 3.5, 7, 7); }
        const loc = getT().locale;
        const f = (n: number) => n.toLocaleString(loc, { maximumFractionDigits: 1 });
        this.label(`${r.name}  X ${f(r.x)}  Y ${f(r.y)}`, { x: Math.min(...c.map((q) => q.x)), y: Math.max(...c.map((q) => q.y)) });
      }
    }

    // Måttlinje mellan två markerade former: från punkten på den fasta formen till den rörliga
    if ((s.editTool === 'select' || s.editTool === 'measure') && s.selectedShapeIds.length === 2 && !s.sim.active) {
      const all = allShapes(s.layers);
      let [a, b] = s.selectedShapeIds.map((id) => all.find((x) => x.id === id));
      if (s.measureSwapped) [a, b] = [b, a];
      if (a && b) {
        const m = measure(a, b, s.measureRef ?? defaultMeasureRef(a, b));
        const loc = getT().locale;
        const f = (n: number) => Math.abs(n).toLocaleString(loc, { maximumFractionDigits: 2 });
        const pa = P(m.from), pb = P(m.to), pc = P({ x: m.to.x, y: m.from.y });
        ctx.save();
        ctx.strokeStyle = accent;
        ctx.fillStyle = accent;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        // X-mått vågrätt från den fasta punkten, Y-mått lodrätt upp till den rörliga.
        ctx.beginPath(); ctx.moveTo(pa.x, pa.y); ctx.lineTo(pc.x, pc.y); ctx.lineTo(pb.x, pb.y); ctx.stroke();
        ctx.setLineDash([]);
        for (const q of [pa, pb]) { ctx.beginPath(); ctx.arc(q.x, q.y, 3.5, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
        if (Math.abs(m.dx) > 0.005) this.label(`X ${f(m.dx)}`, { x: (pa.x + pc.x) / 2 - 24, y: pc.y - 26 });
        if (Math.abs(m.dy) > 0.005) this.label(`Y ${f(m.dy)}`, { x: pc.x, y: (pc.y + pb.y) / 2 - 13 });
      }
    }

    // Flikar på den markerade profilbanan
    const tabCtx = s.sim.active ? null : tabContext();
    if (tabCtx) {
      const editing = s.editTool === 'tabs';
      const half = tabCtx.tabs.width / 2;
      const marker = (q: Vec2, ghost: boolean) => {
        const hit = onContour(tabCtx, q);
        if (!hit) return;
        const a = P({ x: hit.x - hit.tx * half, y: hit.y - hit.ty * half });
        const b = P({ x: hit.x + hit.tx * half, y: hit.y + hit.ty * half });
        ctx.lineCap = 'butt';
        ctx.lineWidth = ghost ? 6 : 9;
        ctx.strokeStyle = ghost ? accent.replace('rgb', 'rgba').replace(')', ',0.35)') : '#f59e0b';
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        if (!ghost) {
          ctx.lineWidth = 1.5;
          ctx.strokeStyle = editing ? accent : 'rgba(0,0,0,0.45)';
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
      };
      tabCtx.positions.forEach((q) => marker(q, false));
      if (editing && this.cursor && this.gesture.kind === 'none') {
        const hit = onContour(tabCtx, this.cursor);
        const near = tabCtx.positions.some((q) => Math.hypot(q.x - this.cursor!.x, q.y - this.cursor!.y) < Math.max(half, 3));
        if (hit && !near && hit.dist < 6 * this.scene.worldPerPixel(hit.x, hit.y) * 2.5) marker({ x: hit.x, y: hit.y }, true);
      }
      ctx.lineCap = 'butt';
    }

    // Noder
    if (s.editTool === 'nodes') {
      let budget = 4000;
      for (const sh of this.selectedShapes()) {
        sh.paths.forEach((path, pi) => {
          const n = nodeCount(path);
          if (budget <= 0) return;
          budget -= n;
          const sel = s.selectedNode && s.selectedNode.shapeId === sh.id && s.selectedNode.pathIndex === pi ? s.selectedNode.index : -1;
          if (sel >= 0) {
            for (const idx of [sel, (sel + 1) % n, (sel - 1 + n) % n]) {
              for (const hd of handlesOf(path, idx)) {
                const a = P(hd.anchor), b = P(hd.pos);
                ctx.strokeStyle = accent;
                ctx.lineWidth = 1;
                ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
                ctx.fillStyle = surface;
                ctx.beginPath(); ctx.arc(b.x, b.y, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
              }
            }
          }
          for (let i = 0; i < n; i++) {
            const q = P(getNode(path, i));
            const size = i === sel ? 10 : 8;
            ctx.fillStyle = i === sel ? accent : surface;
            ctx.strokeStyle = accent;
            ctx.lineWidth = 1.5;
            ctx.fillRect(q.x - size / 2, q.y - size / 2, size, size);
            ctx.strokeRect(q.x - size / 2, q.y - size / 2, size, size);
          }
        });
      }
    }

    // Pågående ritning
    const g = this.gesture;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    if (g.kind === 'rect') {
      const c = [g.a, { x: g.b.x, y: g.a.y }, g.b, { x: g.a.x, y: g.b.y }].map(P);
      ctx.beginPath();
      c.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.stroke();
      this.label(`${Math.abs(g.b.x - g.a.x).toFixed(1)} × ${Math.abs(g.b.y - g.a.y).toFixed(1)} mm`, P(g.b));
    } else if (g.kind === 'circle' && g.r > 0) {
      ctx.beginPath();
      for (let k = 0; k <= 64; k++) {
        const a = (k / 64) * Math.PI * 2;
        const p = P({ x: g.c.x + g.r * Math.cos(a), y: g.c.y + g.r * Math.sin(a) });
        k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
      }
      ctx.stroke();
      this.label(`Ø ${(g.r * 2).toFixed(1)} mm`, P({ x: g.c.x + g.r, y: g.c.y }));
    }

    if (this.draft.length || g.kind === 'curveNode') {
      const nodes: DraftNode[] = [...this.draft];
      if (g.kind === 'curveNode') {
        const n: DraftNode = { p: g.p };
        if (g.handle) {
          n.hout = g.handle;
          n.hin = { x: 2 * g.p.x - g.handle.x, y: 2 * g.p.y - g.handle.y };
        }
        nodes.push(n);
      }
      ctx.beginPath();
      nodes.forEach((n, i) => {
        if (i === 0) {
          const p = P(n.p);
          ctx.moveTo(p.x, p.y);
          return;
        }
        this.traceSegment(ctx, nodes[i - 1], n, P);
      });
      const last = nodes[nodes.length - 1];
      if (this.cursor && g.kind !== 'curveNode') this.traceSegment(ctx, last, { p: this.cursor }, P);
      ctx.stroke();
      nodes.forEach((n, i) => {
        const p = P(n.p);
        const r = i === 0 && nodes.length >= 2 ? 6 : 4;
        ctx.fillStyle = i === 0 && nodes.length >= 2 ? accent : surface;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        for (const hnd of [n.hin, n.hout]) {
          if (!hnd) continue;
          const q = P(hnd);
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          ctx.beginPath(); ctx.arc(q.x, q.y, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
      });
    }

    // Vinkelhjälp och längd/vinkel för linjen som ritas
    if (this.cursor && (s.editTool === 'line' || s.editTool === 'curve') && this.draft.length) {
      const a = this.draft[this.draft.length - 1].p;
      if (this.guide) {
        const rad = (this.guide.angle * Math.PI) / 180;
        const far = 5000;
        const p0 = P({ x: a.x - Math.cos(rad) * far, y: a.y - Math.sin(rad) * far });
        const p1 = P({ x: a.x + Math.cos(rad) * far, y: a.y + Math.sin(rad) * far });
        ctx.save();
        ctx.strokeStyle = accent;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 5]);
        ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
        ctx.restore();
      }
      const len = Math.hypot(this.cursor.x - a.x, this.cursor.y - a.y);
      if (len > 1e-6) {
        let deg = (Math.atan2(this.cursor.y - a.y, this.cursor.x - a.x) * 180) / Math.PI;
        if (deg < 0) deg += 360;
        const loc = getT().locale;
        this.label(`${len.toLocaleString(loc, { maximumFractionDigits: 2 })} mm  ∠ ${deg.toLocaleString(loc, { maximumFractionDigits: 1 })}°`, P(this.cursor));
      }
    }

    // Fästmarkör
    if (this.cursor && DRAW_TOOLS.includes(s.editTool)) {
      const p = P(this.cursor);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1;
      if (this.snapKind === 'node') {
        ctx.strokeRect(p.x - 6, p.y - 6, 12, 12);
      } else {
        ctx.beginPath();
        ctx.moveTo(p.x - 7, p.y); ctx.lineTo(p.x + 7, p.y);
        ctx.moveTo(p.x, p.y - 7); ctx.lineTo(p.x, p.y + 7);
        ctx.stroke();
      }
    }
  }

  private traceSegment(ctx: CanvasRenderingContext2D, a: DraftNode, b: DraftNode, P: (v: Vec2) => { x: number; y: number }) {
    const tool = useAppStore.getState().editTool;
    if (tool === 'curve' && (a.hout || b.hin)) {
      const seg: PathSegment = { type: 'cubic', c1: a.hout ?? a.p, c2: b.hin ?? b.p, to: b.p };
      for (let k = 1; k <= 24; k++) {
        const q = P(pointOnSegment(a.p, seg, k / 24));
        ctx.lineTo(q.x, q.y);
      }
    } else {
      const q = P(b.p);
      ctx.lineTo(q.x, q.y);
    }
  }

  /**
   * Fästning medan man ritar linjer: först noder, sedan vågrätt/lodrätt från
   * förra punkten (inom 4°), med Skift i steg om 15°. Längden följer rutnätet.
   */
  private drawSnap(w: Vec2, tol: number, shift: boolean): Vec2 {
    const q = this.snap(w, tol);
    this.guide = null;
    const tool = useAppStore.getState().editTool;
    if ((tool !== 'line' && tool !== 'curve') || !this.draft.length || this.snapKind === 'node') return q;
    const a = this.draft[this.draft.length - 1].p;
    const dx = w.x - a.x, dy = w.y - a.y;
    const L = Math.hypot(dx, dy);
    if (L < 1e-6) return q;
    const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    const step = shift ? 15 : 90;
    const snapped = Math.round(ang / step) * step;
    const diff = ang - snapped;
    if (!shift && Math.abs(diff) > 4) return q;
    let len = L * Math.cos((diff * Math.PI) / 180);
    const s = useAppStore.getState().snap;
    if (s.grid && s.step > 0) len = Math.round(len / s.step) * s.step;
    const rad = (snapped * Math.PI) / 180;
    this.snapKind = 'axis';
    this.guide = { from: a, angle: snapped };
    return { x: a.x + len * Math.cos(rad), y: a.y + len * Math.sin(rad) };
  }

  private polarPreview: { length: number; angle: number } | null = null;
  /** Förhandsvisning av punkten som skrivs in med längd och vinkel. */
  setPolarPreview(p: { length: number; angle: number } | null) {
    this.polarPreview = p;
  }

  /** Översta synliga relief under punkten. */
  private reliefAt(w: Vec2) {
    const rs = useAppStore.getState().reliefs;
    for (let i = rs.length - 1; i >= 0; i--) {
      const r = rs[i];
      if (r.visible && w.x >= r.x && w.x <= r.x + r.width && w.y >= r.y && w.y <= r.y + r.height) return r;
    }
    return null;
  }

  /** Hörnet närmast punkten (för verktyget Radie). Rundade hörn träffas även på bågen. */
  private cornerAt(w: Vec2, tol: number) {
    const s = useAppStore.getState();
    let best: { shape: VectorShape; pi: number; vi: number; r: number; x: number; y: number } | null = null;
    let bestD = Infinity;
    for (const layer of s.layers) {
      if (!layer.visible || layer.locked) continue;
      for (const shape of layer.shapes) {
        const g = shapeGeometry(shape);
        if (w.x < g.min.x - tol * 3 || w.x > g.max.x + tol * 3 || w.y < g.min.y - tol * 3 || w.y > g.max.y + tol * 3) continue;
        for (const v of cornerVertices(shape)) {
          const d = Math.hypot(v.x - w.x, v.y - w.y);
          const reach = Math.max(tol * 1.8, v.r * 0.75);
          if (d < reach && d < bestD) { bestD = d; best = { shape, ...v }; }
        }
      }
    }
    return best;
  }

  /** Lägger till en punkt med längd och vinkel från förra punkten (ritfältets fält). */
  addPolar(length: number, angleDeg: number) {
    const last = this.draft[this.draft.length - 1];
    if (!last || !(length > 0)) return;
    const rad = (angleDeg * Math.PI) / 180;
    this.draft.push({ p: { x: last.p.x + length * Math.cos(rad), y: last.p.y + length * Math.sin(rad) } });
    useDraft.getState().setPoints(this.draft.length);
  }

  private label(text: string, at: { x: number; y: number }) {
    const ctx = this.ctx;
    ctx.font = '11px -apple-system, "Segoe UI", sans-serif';
    const w = ctx.measureText(text).width + 10;
    ctx.fillStyle = `rgb(${this.surface.split(/\s+/).join(',')})`;
    ctx.fillRect(at.x + 8, at.y + 8, w, 18);
    ctx.fillStyle = `rgb(${this.ink.split(/\s+/).join(',')})`;
    ctx.fillText(text, at.x + 13, at.y + 21);
  }
}
