/**
 * Kommandon som Ribbon, kortkommandon och paneler anropar.
 * Samlade här så att samma handling alltid beter sig likadant.
 */
import {
  patternTransforms,
  defaultPlasmaSettings,
  plasmaDataFor,
  routerParamsFor,
  drillTipLength,
  type MachineKind,
  type PatternConfig,
  type ReliefInstance,
  plugGeometry,
  type ReliefPlug,
  defaultPocketStrategy,
  shapeHasArea,
  type ToolDefinition,
  defaultStrategy,
  defaultTabs,
  detectFormat,
  getReliefDefinition,

  makeGearShape,
  type GearOptions,
  multiply,
  rotate,
  scale,
  shapesBounds,
  transformShape,
  translate,
  uid,
  type Mat2D,
  type MachineProfile,
  type OperationType,
  type ToolpathConfig,
  type VectorShape,
  offsetShapes,
  shapeToPolylines,
  simplifyClosed,
  exportSvg,
  exportDxf,
  exportPdf,
  type ExportLayer,
  straightenAngle,
} from '@desktopcam/core';
import { imageFrame } from '../utils/imageFrame';
import { getT } from '../i18n';
import toolsJson from '../data/tools.json';
import { allShapes, getEffectiveMaterial, getMachine, useAppStore, type ImageObject } from '../store/useAppStore';
import { downloadBytes, downloadText, pickFile, slug } from '../utils/download';
import { decodeImageObjects, imageForNewToolpath } from './imageObjects';
import { exampleUrl } from '../data/examples';
import { fileGcode, planExport, type ExportOptions } from './exportGcode';
import { computeToolpath } from './toolpathService';
import { buildTextShape, ensureTextFont } from '../text/textShape';
import { activeEditor } from '../editing/EditController';
import machinesJson from '../data/machines.json';
import { decimalSep, materialName, toolName } from '../i18n';
import { cuttingLength } from './toolReach';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { loadRecent, rememberProject, type RecentEntry } from './recentProjects';

/** Räcker verktygets skärlängd (och utstick) till djupet? */
function reaches(tool: ToolDefinition, depth: number): boolean {
  const cut = cuttingLength(tool);
  if (tool.stickout && depth > tool.stickout - 1) return false;
  return !cut || depth <= cut + 0.01;
}

export const isLaserOperation = (op: OperationType) => op === 'laserCut' || op === 'laserRaster';
/** Vilken sorts maskin en operation kräver. */
export const isPenOperation = (op: OperationType) => op === 'penDraw' || op === 'penFill' || op === 'penImage';
export const machineKindFor = (op: OperationType): MachineKind => (isLaserOperation(op) ? 'laser' : op === 'plasmaCut' ? 'plasma' : isPenOperation(op) ? 'plotter' : 'router');
export const isImplemented = (_op: OperationType) => true;

const status = (msg: string) => useAppStore.getState().setStatus(msg);
const selected = () => {
  const s = useAppStore.getState();
  return allShapes(s.layers).filter((x) => s.selectedShapeIds.includes(x.id));
};

/* ───────── Design ───────── */

export function addGear(opts: GearOptions) {
  const s = useAppStore.getState();
  const t = getT();
  const n = allShapes(s.layers).filter((x) => x.name.startsWith(t.shapeNames.gear)).length + 1;
  s.addShape(makeGearShape(`${t.shapeNames.gear} ${n}`, s.material.width / 2, s.material.height / 2, opts));
  status(t.status.shapeAdded(t.shapeNames.gear));
}

export function deleteSelection() {
  const s = useAppStore.getState();
  if (s.editTool === 'nodes' && activeEditor?.deleteSelectedNode()) return;
  if (s.selectedShapeIds.length) {
    const n = s.selectedShapeIds.length;
    s.deleteShapes(s.selectedShapeIds);
    status(getT().status.deleted(n));
    return;
  }
  if (s.selectedToolpathId) s.removeToolpath(s.selectedToolpathId);
  else if (s.selectedReliefId) s.removeRelief(s.selectedReliefId);
  else if (s.selectedImageId) s.removeImageObject(s.selectedImageId);
}

export function duplicateSelection() {
  const s = useAppStore.getState();
  const shapes = selected();
  if (!shapes.length) return;
  const t = getT();
  const off = 5;
  // Kopior av en grupp blir en egen, ny grupp.
  const newGroup = new Map<string, string>();
  const groupFor = (g?: string) => (g ? (newGroup.get(g) ?? (newGroup.set(g, uid('group')), newGroup.get(g)!)) : undefined);
  const copies = new Map(
    shapes.map((sh) => {
      const moved = transformShape(sh, translate(off, -off));
      const copy: VectorShape = {
        ...moved,
        groupId: groupFor(sh.groupId),
        id: uid('shape'),
        name: `${sh.name} ${t.shapeNames.copy}`,
        paths: moved.paths.map((p) => ({ ...p, id: uid('path') })),
        text: sh.text ? { ...sh.text, x: sh.text.x + off, y: sh.text.y - off } : undefined,
      };
      return [sh.id, copy] as const;
    }),
  );
  const layers = s.layers.map((l) => {
    const mine = l.shapes.filter((sh) => copies.has(sh.id)).map((sh) => copies.get(sh.id)!);
    return mine.length ? { ...l, shapes: [...l.shapes, ...mine] } : l;
  });
  s.checkpoint();
  useAppStore.setState({ layers, selectedShapeIds: [...copies.values()].map((c) => c.id) });
  status(t.status.duplicated(copies.size));
}

/** Tillämpar en matris på markerade former runt en referenspunkt. */
export function transformSelection(m: Mat2D) {
  const shapes = selected();
  if (!shapes.length) return;
  const isTranslate = m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1;
  // Flytt: spårade foton följer med (vridning sköts av applyRotation).
  const images = isTranslate ? imagesFollowingSelection() : [];
  useAppStore.getState().replaceShapes(
    shapes.map((sh) => {
      const out = transformShape(sh, m);
      if (sh.text && isTranslate) return { ...out, text: { ...sh.text, x: sh.text.x + m[4], y: sh.text.y + m[5] } };
      return { ...out, text: undefined };
    }),
  );
  for (const im of images) useAppStore.getState().updateImageObject(im.id, { x: +(im.x + m[4]).toFixed(4), y: +(im.y + m[5]).toFixed(4) });
}

/* ───────── Grupper och markering ───────── */

/** Grupperar de markerade formerna (minst två). Befintliga grupper slås ihop. */
export function groupSelection() {
  const s = useAppStore.getState();
  const t = getT();
  const ids = s.selectedShapeIds;
  if (ids.length < 2) return status(t.group.needTwo);
  const groupId = uid('group');
  s.checkpoint();
  s.replaceShapes(selected().map((sh) => ({ ...sh, groupId })), false);
  status(t.group.grouped(ids.length));
}

/** Tar bort grupperingen för de markerade formerna (formerna finns kvar). */
export function ungroupSelection() {
  const s = useAppStore.getState();
  const t = getT();
  const grouped = selected().filter((sh) => sh.groupId);
  if (!grouped.length) return status(t.group.noGroup);
  s.checkpoint();
  s.replaceShapes(grouped.map((sh) => ({ ...sh, groupId: undefined })), false);
  // Behåll markeringen som den är (utan att den växer igen till grupper).
  useAppStore.setState({ selectedShapeIds: s.selectedShapeIds });
  status(t.group.ungrouped(grouped.length));
}

/** Markerar alla synliga och olåsta former (i ett lager, eller i alla). */
export function selectAllShapes(layerId?: string) {
  const s = useAppStore.getState();
  const ids = s.layers.filter((l) => (layerId ? l.id === layerId : l.visible && !l.locked)).flatMap((l) => l.shapes.map((sh) => sh.id));
  if (!ids.length) return;
  s.setSelection(ids);
  status(getT().group.selected(ids.length));
}

export function selectionBounds() {
  return shapesBounds(selected());
}

/** Sätter markeringens läge och storlek (mm). */
export function setSelectionBox(x: number, y: number, w: number, h: number) {
  const b = selectionBounds();
  if (!b) return;
  const bw = b.max.x - b.min.x || 1;
  const bh = b.max.y - b.min.y || 1;
  const sx = w > 0 && bw > 1e-9 ? w / bw : 1;
  const sy = h > 0 && bh > 1e-9 ? h / bh : 1;
  const m = multiply(translate(x, y), multiply(scale(sx, sy), translate(-b.min.x, -b.min.y)));
  transformSelection(m);
}

/**
 * Bilder som följer med när markeringen vrids: den markerade bilden, och
 * bilder som någon markerad form är spårad från (linkedImageId).
 */
export function imagesFollowingSelection(): ImageObject[] {
  const s = useAppStore.getState();
  const sel = new Set(s.selectedShapeIds);
  const all = allShapes(s.layers);
  return s.imageObjects.filter((im) => {
    if (im.id === s.selectedImageId) return true;
    return all.some((sh) => sh.linkedImageId === im.id && sel.has(sh.id));
  });
}

/** Bilden vriden `deg` grader runt punkten (bildens egen vinkel ökar lika mycket). */
export function rotatedImage(im: ImageObject, deg: number, pivot: { x: number; y: number }): Partial<ImageObject> {
  const f = imageFrame(im);
  const a = (deg * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a);
  const dx = f.cx - pivot.x, dy = f.cy - pivot.y;
  const cx = pivot.x + dx * c - dy * sn, cy = pivot.y + dx * sn + dy * c;
  const rot = ((((im.rotation ?? 0) + deg) % 360) + 540) % 360 - 180;
  return { x: +(cx - f.w / 2).toFixed(4), y: +(cy - f.h / 2).toFixed(4), rotation: +rot.toFixed(4) };
}

/** Mittpunkten som markeringen vrids runt: formernas mitt, annars den markerade bildens. */
export function rotationPivot(): { x: number; y: number } | null {
  const s = useAppStore.getState();
  const b = selectionBounds();
  if (b && s.selectedShapeIds.length) return { x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2 };
  const im = s.imageObjects.find((x) => x.id === s.selectedImageId);
  if (!im) return null;
  const f = imageFrame(im);
  return { x: f.cx, y: f.cy };
}

/**
 * Vrider utgångsläget (former och bilder) `deg` grader runt `pivot` utan
 * historik – för vridhandtaget, som tar en checkpoint när det börjar dras.
 */
export function applyRotation(deg: number, pivot: { x: number; y: number }, shapes: VectorShape[], images: ImageObject[]) {
  const s = useAppStore.getState();
  const m = multiply(translate(pivot.x, pivot.y), multiply(rotate(deg), translate(-pivot.x, -pivot.y)));
  if (shapes.length) s.replaceShapes(shapes.map((sh) => ({ ...transformShape(sh, m), text: undefined })), false);
  for (const im of images) s.updateImageObject(im.id, rotatedImage(im, deg, pivot));
}

export function rotateSelection(deg: number) {
  const pivot = rotationPivot();
  if (!pivot) return;
  useAppStore.getState().checkpoint();
  applyRotation(deg, pivot, selected(), imagesFollowingSelection());
}

/**
 * Rätar upp markerade former: vrider dem minsta möjliga vinkel så att deras
 * minsta omslutande rektangel blir axelparallell. Spårade bilder följer med.
 */
export function straightenSelection() {
  const t = getT();
  const shapes = selected();
  const pts: number[] = [];
  for (const sh of shapes) for (const p of shapeToPolylines(sh, 0.1)) for (const v of p.points) pts.push(v);
  const deg = straightenAngle(pts);
  if (!shapes.length || Math.abs(deg) < 0.05) return status(t.contour.alreadyStraight);
  rotateSelection(deg);
  status(t.contour.straightened(deg.toLocaleString(t.locale, { maximumFractionDigits: 1 })));
}

export function mirrorSelection(axis: 'h' | 'v') {
  const b = selectionBounds();
  if (!b) return;
  const cx = (b.min.x + b.max.x) / 2, cy = (b.min.y + b.max.y) / 2;
  const m: Mat2D = axis === 'h' ? [-1, 0, 0, 1, 2 * cx, 0] : [1, 0, 0, -1, 0, 2 * cy];
  transformSelection(m);
}

export function centerSelection() {
  const b = selectionBounds();
  if (!b) return;
  const { material } = useAppStore.getState();
  transformSelection(translate(material.width / 2 - (b.min.x + b.max.x) / 2, material.height / 2 - (b.min.y + b.max.y) / 2));
}

/** Enkellinjig text har öppna streck – bara t.ex. "O" blir slutna och skulle fräsas. */
export const isSingleLineText = (sh: VectorShape) => !!sh.text && !sh.text.font && !(sh.text.weight && sh.text.weight > 0) && sh.paths.some((p) => !p.closed);

/** Ritar om en textform med nya parametrar (läser in typsnittet först om det behövs). */
export async function updateText(shape: VectorShape, patch: Partial<NonNullable<VectorShape['text']>>) {
  if (!shape.text) return;
  const text = { ...shape.text, ...patch };
  if (!text.content.trim()) return;
  if (!(await ensureTextFont(text.font))) {
    status(getT().textDialog.fontMissing);
    return;
  }
  // Formen kan ha ändrats medan typsnittet laddades.
  const current = allShapes(useAppStore.getState().layers).find((x) => x.id === shape.id);
  if (!current) return;
  const fresh = buildTextShape(text);
  useAppStore.getState().replaceShapes([{ ...current, paths: fresh.paths, text, name: fresh.name }]);
}

/** Banor som ångra/gör om tagit tillbaka saknar resultat – räkna dem igen. */
function computeMissing() {
  const s = useAppStore.getState();
  for (const tp of s.toolpaths) if (!s.results[tp.id] && !s.progress[tp.id] && !s.errors[tp.id]) void computeToolpath(tp.id);
}

export function undo() {
  const ok = useAppStore.getState().undo();
  if (ok) {
    computeMissing();
    status(getT().status.undone);
  }
}

export function redo() {
  const ok = useAppStore.getState().redo();
  if (ok) {
    computeMissing();
    status(getT().status.redone);
  }
}

/* ───────── Verktygsbanor ───────── */

export function createToolpath(operation: OperationType, extra: Partial<ToolpathConfig> = {}): string | null {
  const s = useAppStore.getState();
  const t = getT();
  const machine = getMachine();
  const preset = getEffectiveMaterial();
  const opName = t.operations[operation];

  if (!isImplemented(operation)) {
    status(t.status.notImplemented(opName));
    return null;
  }
  const needed = machineKindFor(operation);
  if (needed !== machine.kind) {
    status(needed === 'router' ? t.status.needRouter(opName) : needed === 'laser' ? t.status.needLaser(opName) : needed === 'plotter' ? t.status.needPlotter(opName) : t.status.needPlasma(opName));
    return null;
  }
  if (operation === 'relief' && !s.reliefs.length) {
    status(t.status.addReliefFirst);
    return null;
  }

  const shapes = allShapes(s.layers);
  const sel = s.selectedShapeIds.length ? shapes.filter((x) => s.selectedShapeIds.includes(x.id)) : shapes;
  const shapeIds = sel.map((x) => x.id);
  if (!shapeIds.length && operation !== 'laserRaster' && operation !== 'relief' && operation !== 'facing' && operation !== 'penImage') {
    status(t.status.drawFirst);
    return null;
  }
  if ((operation === 'pocket' || operation === 'drill' || operation === 'vcarve' || operation === 'inlay' || operation === 'penFill') && !sel.some(shapeHasArea)) {
    status(t.status.needClosed);
    return null;
  }
  if ((operation === 'pocket' || operation === 'vcarve' || operation === 'inlay') && sel.some(isSingleLineText)) {
    status(t.status.textNeedsOutline);
    return null;
  }

  const id = uid('tp');
  const n = s.toolpaths.length + 1;
  const base = { id, shapeIds, visible: true };
  let toolNote: { toolId: string; text: string } | null = null;
  const routerTool = (prefer: string[], depth?: number) => {
    const active = s.tools.find((x) => x.id === s.activeToolId);
    const first = active && prefer.includes(active.kind) ? active : (s.tools.find((x) => prefer.includes(x.kind)) ?? s.tools.find((x) => x.kind !== 'laser' && x.kind !== 'plasma' && x.kind !== 'pen')!);
    if (depth === undefined || reaches(first, depth)) return first;
    // Räcker inte skärlängden till djupet: närmast grövre verktyg av samma sort som gör det.
    const better = s.tools
      .filter((x) => x.kind === first.kind && x.diameter >= first.diameter - 1e-6 && x.diameter < 15 && reaches(x, depth))
      .sort((a, b) => a.diameter - b.diameter)[0];
    if (!better) return first;
    toolNote = { toolId: better.id, text: t.status.toolForDepth(toolName(t, better.id, better.name), String(+depth.toFixed(1)).replace('.', decimalSep(t))) };
    return better;
  };
  // Materialets värden skalade efter maskinen, verktygets diameter och antal skär.
  const routerParams = (tool: ReturnType<typeof routerTool>) => ({ ...tool.defaults, ...(routerParamsFor(preset, tool, machine) ?? {}) });
  let tp: ToolpathConfig;

  switch (operation) {
    case 'penImage': {
      const tool = routerTool(['pen']);
      tp = {
        ...base,
        shapeIds: [],
        operation,
        name: `${n}. ${opName}`,
        toolId: tool.id,
        imageId: '',
        origin: { x: 10, y: 10 },
        widthMm: Math.max(20, Math.min(180, s.material.width - 20)),
        image: { method: 'hatch', spacing: +Math.max(0.6, tool.diameter * 2).toFixed(1), levels: 4, dots: 6000, connect: false, invert: false, contrast: 1.2 },
        optimize: true,
        params: { ...tool.defaults, feedRate: Math.min(tool.defaults.feedRate, machine.maxFeed.xy), plungeRate: Math.min(tool.defaults.plungeRate || 600, machine.maxFeed.z || 600) },
      };
      break;
    }
    case 'penDraw':
    case 'penFill': {
      const tool = routerTool(['pen']);
      const params = { ...tool.defaults, feedRate: Math.min(tool.defaults.feedRate, machine.maxFeed.xy), plungeRate: Math.min(tool.defaults.plungeRate || 600, machine.maxFeed.z || 600) };
      tp =
        operation === 'penDraw'
          ? { ...base, operation, name: `${n}. ${opName}`, toolId: tool.id, optimize: true, params }
          : {
              ...base,
              shapeIds: sel.filter(shapeHasArea).map((x) => x.id),
              operation,
              name: `${n}. ${opName}`,
              toolId: tool.id,
              pattern: 'lines',
              angle: 45,
              // Glest nog att se linjerna, tätt nog att se ytan: ca 3 × spetsens bredd.
              spacing: +Math.max(0.6, tool.diameter * 3).toFixed(1),
              outline: true,
              optimize: true,
              params,
            };
      break;
    }
    case 'facing': {
      // Grövsta pinnfräsen (planfräsen), om inte en grov pinnfräs redan är vald.
      const active = s.tools.find((x) => x.id === s.activeToolId);
      const biggest = s.tools.filter((x) => x.kind === 'endmill').sort((a, b) => b.diameter - a.diameter)[0];
      const tool = active?.kind === 'endmill' && active.diameter >= 10 ? active : (biggest ?? routerTool(['endmill']));
      const params = routerParams(tool);
      // Bara valda former begränsar ytan – annars planas hela ämnet.
      const area = s.selectedShapeIds.length ? 'shapes' : 'stock';
      tp = {
        ...base,
        shapeIds: area === 'shapes' ? shapeIds : [],
        operation,
        name: `${n}. ${opName}`,
        toolId: tool.id,
        area,
        depth: 0.5,
        pattern: 'zigzag',
        direction: 'x',
        overhang: 2,
        params: { ...params, stepOver: tool.diameter >= 15 ? 0.75 : 0.6 },
      };
      break;
    }
    case 'relief': {
      const relief = s.reliefs.find((x) => x.id === s.selectedReliefId) ?? s.reliefs[s.reliefs.length - 1];
      const tool = routerTool(['ballnose', 'endmill']);
      const name = t.relief.items[relief.reliefId]?.name ?? relief.name;
      tp = {
        ...base,
        shapeIds: [],
        operation,
        name: `${n}. ${t.operations.relief}: ${name}`,
        toolId: tool.id,
        reliefId: relief.id,
        direction: 'x',
        roughing: relief.depth > tool.defaults.stepDown,
        allowance: 0.3,
        params: { ...routerParams(tool), stepOver: tool.kind === 'ballnose' ? 0.12 : tool.defaults.stepOver, stepDown: tool.defaults.stepDown },
      };
      break;
    }
    case 'profile': {
      const tool = routerTool(['endmill', 'ballnose'], s.material.thickness);
      tp = {
        ...base,
        operation,
        name: `${n}. ${opName}`,
        toolId: tool.id,
        side: sel.some(shapeHasArea) ? 'outside' : 'on',
        cutDepth: s.material.thickness,
        // Genomskärning: flikar på från början så att detaljen inte lossnar.
        tabs: defaultTabs(true, s.material.thickness),
        strategy: defaultStrategy('balanced'),
        params: routerParams(tool),
      };
      break;
    }
    case 'pocket': {
      const tool = routerTool(['endmill'], Math.min(3, s.material.thickness / 2));
      tp = {
        ...base,
        operation,
        name: `${n}. ${opName}`,
        toolId: tool.id,
        cutDepth: Math.min(3, s.material.thickness / 2),
        strategy: 'offset',
        pocket: defaultPocketStrategy('balanced'),
        params: { ...routerParams(tool), stepOver: 0.45 },
      };
      break;
    }
    case 'drill': {
      // Borren som passar hålen: den största som inte är grövre än det minsta hålet.
      const holeSizes = sel
        .filter(shapeHasArea)
        .map((sh) => {
          const b = shapesBounds([sh]);
          return b ? Math.min(b.max.x - b.min.x, b.max.y - b.min.y) : Infinity;
        });
      const smallest = holeSizes.length ? Math.min(...holeSizes) : Infinity;
      const drills = s.tools.filter((x) => x.kind === 'drill' && x.diameter <= smallest + 0.05).sort((a, b) => b.diameter - a.diameter);
      const active = s.tools.find((x) => x.id === s.activeToolId);
      const tool = (active?.kind === 'drill' && Math.abs(active.diameter - smallest) < 0.05 ? active : drills[0]) ?? routerTool(['drill', 'endmill']);
      const params = { ...tool.defaults, ...(routerParamsFor(preset, tool, machine) ?? {}) };
      // Genomgående hål: borrspetsen måste gå igenom, plus 0,3 mm.
      const through = s.material.thickness + drillTipLength(tool) + 0.3;
      tp = {
        ...base,
        operation,
        name: `${n}. ${opName}`,
        toolId: tool.id,
        depth: +through.toFixed(1),
        peckDepth: tool.kind === 'drill' ? params.stepDown : Math.max(0.5, +(tool.diameter * 0.5).toFixed(1)),
        params,
      };
      break;
    }
    case 'vcarve': {
      const tool = s.tools.find((x) => x.id === s.activeToolId && x.kind === 'vbit') ?? s.tools.find((x) => x.kind === 'vbit');
      if (!tool) {
        status(t.status.needsVbit);
        return null;
      }
      tp = {
        ...base,
        operation,
        name: `${n}. ${opName}`,
        toolId: tool.id,
        flatDepth: Math.min(5, s.material.thickness / 2),
        contourStep: 0.1,
        params: { ...routerParams(tool), stepDown: tool.defaults.stepDown },
      };
      break;
    }
    case 'laserCut': {
      const tool = s.tools.find((x) => x.kind === 'laser')!;
      tp = {
        ...base,
        operation,
        name: `${n}. ${opName}`,
        toolId: tool.id,
        side: sel.some(shapeHasArea) ? 'outside' : 'on',
        kerf: 0.15,
        // Material som inte kan skäras (metall, sten) får graveringsvärden i stället.
        ...(preset.laser.canCut === false
          ? { passes: 1, params: { ...tool.defaults, feedRate: preset.laser.engraveSpeed, laserPowerPct: preset.laser.engravePowerPct } }
          : { passes: preset.laser.cutPasses, params: { ...tool.defaults, feedRate: preset.laser.cutSpeed, laserPowerPct: preset.laser.cutPowerPct } }),
      };
      break;
    }
    case 'plasmaCut': {
      const tool = s.tools.find((x) => x.id === s.activeToolId && x.kind === 'plasma') ?? s.tools.find((x) => x.kind === 'plasma');
      if (!tool) {
        status(t.status.needsPlasmaTool);
        return null;
      }
      // Riktvärden ur materialets skärtabell för den aktuella tjockleken.
      const chart = plasmaDataFor(preset, machine, s.material.thickness);
      const settings = defaultPlasmaSettings();
      if (chart) Object.assign(settings, { pierceDelay: chart.pierceDelay, pierceHeight: chart.pierceHeight, cutHeight: chart.cutHeight });
      settings.ihs = machine.plasma?.ihs ?? settings.ihs;
      // Inlöp ungefär lika långt som materialet är tjockt, minst 3 mm.
      settings.leadInLength = Math.max(3, Math.min(8, Math.round(s.material.thickness)));
      settings.holeDiameter = Math.max(15, Math.round(s.material.thickness * 2.5));
      tp = {
        ...base,
        operation,
        name: `${n}. ${opName}`,
        toolId: tool.id,
        side: sel.some(shapeHasArea) ? 'outside' : 'on',
        kerf: chart?.kerf ?? tool.diameter,
        amps: chart?.amps ?? Math.min(45, machine.plasma?.maxAmps ?? 45),
        plasma: settings,
        params: { ...tool.defaults, feedRate: chart?.feedRate ?? tool.defaults.feedRate },
      };
      break;
    }
    case 'laserRaster':
    default: {
      const tool = s.tools.find((x) => x.kind === 'laser')!;
      tp = {
        ...base,
        shapeIds: [],
        operation: 'laserRaster',
        name: `${n}. ${t.operations.laserRaster}`,
        toolId: tool.id,
        imageId: '',
        origin: { x: 10, y: 10 },
        widthMm: Math.min(100, s.material.width - 20),
        lineIntervalMm: 0.2,
        dither: 'floyd-steinberg',
        threshold: 128,
        params: { ...tool.defaults, feedRate: preset.laser.engraveSpeed, laserPowerPct: preset.laser.engravePowerPct },
      };
    }
  }

  Object.assign(tp, extra);
  s.addToolpath(tp);
  if (toolNote) s.setToolNote(tp.id, toolNote);
  s.setMobilePanel(window.matchMedia('(min-width: 1024px)').matches ? null : 'props');
  void computeToolpath(id);
  const matName = materialName(t, preset.id, preset.name);
  if (operation === 'laserCut' && preset.laser.canCut === false && tp.operation === 'laserCut' && tp.side !== 'on') status(t.status.cannotCut(matName));
  else if (operation === 'laserCut' && preset.laserTooThick && tp.operation === 'laserCut' && tp.side !== 'on') status(t.status.laserTooThick(matName, s.material.thickness));
  else if (machine.kind === 'router' && !preset.router) status(t.status.notForRouter(matName));
  else if (machine.kind === 'plasma' && !preset.plasma) status(t.status.notForPlasma(matName));
  return id;
}

/**
 * Nya riktvärden när verktyget byts i en fräsbana – annars ligger den gamla
 * fräsens (eller borrens) matning och nedmatning kvar.
 */
export function retoolPatch(tp: ToolpathConfig, toolId: string): Partial<ToolpathConfig> {
  const s = useAppStore.getState();
  const tool = s.tools.find((x) => x.id === toolId);
  const machine = getMachine();
  if (!tool || machine.kind !== 'router') return { toolId };
  const p = routerParamsFor(getEffectiveMaterial(), tool, machine);
  if (!p) return { toolId };
  const params = { ...tp.params, feedRate: p.feedRate, plungeRate: p.plungeRate, spindleRpm: p.spindleRpm };
  if (tp.operation === 'drill') {
    return { toolId, params, peckDepth: tool.kind === 'drill' ? p.stepDown : tp.peckDepth, depth: +(s.material.thickness + drillTipLength(tool) + 0.3).toFixed(1) } as Partial<ToolpathConfig>;
  }
  if (tp.operation === 'profile' || tp.operation === 'pocket' || tp.operation === 'relief' || tp.operation === 'facing') params.stepDown = p.stepDown;
  return { toolId, params } as Partial<ToolpathConfig>;
}

/**
 * V-inlägg: skapar två banor som delar inställningar – en ficka i grundträet
 * och en spegelvänd plugg i inläggsträet.
 */
export function createInlay(): void {
  const s = useAppStore.getState();
  const t = getT();
  if (getMachine().kind !== 'router') {
    status(t.status.needRouter(t.operations.inlay));
    return;
  }
  const shapes = allShapes(s.layers);
  const sel = s.selectedShapeIds.length ? shapes.filter((x) => s.selectedShapeIds.includes(x.id)) : shapes;
  if (!sel.some(shapeHasArea)) {
    status(t.status.needClosed);
    return;
  }
  if (sel.some(isSingleLineText)) {
    status(t.status.textNeedsOutline);
    return;
  }
  const tool = s.tools.find((x) => x.id === s.activeToolId && x.kind === 'vbit') ?? s.tools.find((x) => x.kind === 'vbit' && x.angle === 60) ?? s.tools.find((x) => x.kind === 'vbit');
  if (!tool) {
    status(t.status.needsVbit);
    return;
  }
  const r = getEffectiveMaterial().router;
  const groupId = uid('inlay');
  const pocketDepth = Math.min(5, Math.max(1, s.material.thickness - 3));
  const shared = {
    shapeIds: sel.map((x) => x.id),
    toolId: tool.id,
    groupId,
    pocketDepth,
    startDepth: +(pocketDepth / 2).toFixed(1),
    plugDepth: +(pocketDepth / 2 + 1).toFixed(1),
    margin: 6,
    contourStep: 0.1,
    params: {
      ...tool.defaults,
      feedRate: r?.feedRate ?? tool.defaults.feedRate,
      plungeRate: r?.plungeRate ?? tool.defaults.plungeRate,
      spindleRpm: r?.spindleRpm ?? tool.defaults.spindleRpm,
    },
  };
  const n = s.toolpaths.length + 1;
  const pocketId = uid('tp');
  const plugId = uid('tp');
  s.addToolpath({ ...shared, id: pocketId, visible: true, operation: 'inlay', part: 'pocket', name: `${n}. ${t.operations.inlay} – ${t.inlayParts.pocket}` });
  // Pluggen läggs till utan att bli markerad, så att fickan visas först.
  useAppStore.setState((st) => ({
    toolpaths: [...st.toolpaths, { ...shared, id: plugId, visible: true, operation: 'inlay', part: 'plug', name: `${n + 1}. ${t.operations.inlay} – ${t.inlayParts.plug}` }],
  }));
  s.setMobilePanel(window.matchMedia('(min-width: 1024px)').matches ? null : 'props');
  status(t.status.inlayCreated);
  void computeToolpath(pocketId);
  void computeToolpath(plugId);
}

export function createLineEngraving() {
  const preset = getEffectiveMaterial();
  const t = getT();
  createToolpath('laserCut', {
    name: `${useAppStore.getState().toolpaths.length + 1}. ${t.lineEngrave}`,
    side: 'on',
    passes: 1,
    params: { feedRate: preset.laser.engraveSpeed, laserPowerPct: preset.laser.engravePowerPct, plungeRate: 0, stepDown: 0, stepOver: 1 },
  } as Partial<ToolpathConfig>);
}

/** Bild-bana från bilden i ritningen: den markerade, den enda, eller en ny bildfil. */
async function createImageToolpath(operation: 'penImage' | 'laserRaster') {
  const im = await imageForNewToolpath();
  if (!im) return;
  createToolpath(operation, { imageId: im.id, origin: { x: im.x, y: im.y }, widthMm: im.widthMm } as Partial<ToolpathConfig>);
}

/** Penplotter: rita bilden med linjer (skraffering, spiral eller prickar). */
export async function importImageForPlotter() {
  if (getMachine().kind !== 'plotter') {
    status(getT().status.needPlotter(getT().operations.penImage));
    return;
  }
  await createImageToolpath('penImage');
}

export async function importPhotoForEngraving() {
  if (getMachine().kind !== 'laser') {
    status(getT().status.photoNeedsLaser);
    return;
  }
  await createImageToolpath('laserRaster');
}

/* ───────── Import ───────── */

export async function importVectorFile(file?: File | null) {
  const f = file ?? (await pickFile('.svg,.dxf,image/svg+xml,application/dxf'));
  if (!f) return;
  const text = await f.text();
  const format = detectFormat(f.name, text);
  if (!format) {
    status(getT().status.notVector(f.name));
    return;
  }
  useAppStore.getState().setPendingImport({ fileName: f.name, format, text });
  useAppStore.getState().openDialog('importFile');
}

/* ───────── Reliefer ───────── */

export function addRelief(reliefId: string, size: { width: number; height: number; depth: number }, options: { invert: boolean; mirror: boolean }) {
  const s = useAppStore.getState();
  const t = getT();
  const def = getReliefDefinition(reliefId);
  if (!def) return;
  const label = t.relief.items[reliefId]?.name ?? def.name;
  const n = s.reliefs.filter((r) => r.reliefId === reliefId).length + 1;
  s.addRelief({
    id: uid('relief'),
    name: n > 1 ? `${label} ${n}` : label,
    reliefId,
    x: Math.max(0, (s.material.width - size.width) / 2),
    y: Math.max(0, (s.material.height - size.height) / 2),
    ...size,
    ...options,
    visible: true,
  });
  status(size.depth > s.material.thickness ? t.status.reliefTooDeep(label) : t.status.reliefPlaced(label));
}

/* ───────── Projektfiler ───────── */

const AUTOSAVE_KEY = 'desktopcam.autosave.v1';
const BUILT_IN = new Map((machinesJson as MachineProfile[]).map((m) => [m.id, m]));

export function projectJson(withImages = true) {
  const s = useAppStore.getState();
  return {
    app: 'desktopCAM',
    version: 1,
    savedAt: new Date().toISOString(),
    projectId: s.projectId,
    projectName: s.projectName,
    machineId: s.machineId,
    customMachines: s.machines.filter((m) => m.custom || JSON.stringify(m) !== JSON.stringify(BUILT_IN.get(m.id))),
    material: s.material,
    tools: s.tools,
    layers: s.layers,
    reliefs: s.reliefs,
    imageObjects: withImages ? s.imageObjects : [],
    // Banor som ritar en bild sparas bara tillsammans med bilden.
    toolpaths: s.toolpaths.filter((tp) => (tp.operation !== 'laserRaster' && tp.operation !== 'penImage') || (withImages && s.imageObjects.some((im) => im.id === tp.imageId))),
  };
}

/**
 * Läser in ett projekt. keepId: fortsätt spara under projektets id i Senaste
 * projekt (autosparning, listan); annars – fil eller exempel – blir det ett nytt.
 */
export function loadProject(data: unknown, opts: { keepId?: boolean } = {}): boolean {
  const d = data as ReturnType<typeof projectJson>;
  if (!d || d.app !== 'desktopCAM' || !Array.isArray(d.layers)) return false;
  useAppStore.getState().loadDocument({
    projectId: opts.keepId ? d.projectId : undefined,
    projectName: d.projectName ?? '',
    layers: d.layers,
    reliefs: d.reliefs ?? [],
    imageObjects: d.imageObjects ?? [],
    toolpaths: d.toolpaths ?? [],
    material: d.material,
    // Äldre projekt saknar verktygens längder – fyll i från de inbyggda
    // verktygen – och nya inbyggda verktyg läggs till efter projektets egna.
    tools: d.tools?.length
      ? [
          ...d.tools.map((x) => ({ ...(toolsJson as ToolDefinition[]).find((b) => b.id === x.id), ...x })),
          ...(toolsJson as ToolDefinition[]).filter((b) => !d.tools!.some((x) => x.id === b.id)),
        ]
      : useAppStore.getState().tools,
    machineId: d.machineId,
    customMachines: d.customMachines ?? [],
  });
  // Bild-banor räknas när bilderna avkodats (watchForChanges ser nya bilder).
  for (const tp of useAppStore.getState().toolpaths) if (tp.operation !== 'laserRaster' && tp.operation !== 'penImage') void computeToolpath(tp.id);
  void decodeImageObjects();
  return true;
}

/**
 * Exemplen sparas med nycklar som namn (t.ex. "lib:heart", "circle:2") och
 * får namn på användarens språk när de öppnas.
 */
function localizeExample(d: ReturnType<typeof projectJson>) {
  const t = getT();
  const shapeName = (name: string) => {
    const [kind, arg] = name.split(':');
    if (kind === 'lib') return (t.shapeLib.items as Record<string, string>)[arg] ?? arg;
    if (kind === 'circle' || kind === 'rect' || kind === 'gear') return `${t.shapeNames[kind]} ${arg}`;
    return name;
  };
  return {
    ...d,
    layers: d.layers.map((l, i) => ({ ...l, name: t.common.layer(i + 1), shapes: l.shapes.map((sh) => ({ ...sh, name: shapeName(sh.name) })) })),
    reliefs: d.reliefs.map((r) => ({ ...r, name: t.relief.items[r.reliefId]?.name ?? r.name })),
    imageObjects: d.imageObjects.map((im, i) => ({ ...im, name: t.image.name(i + 1) })),
    toolpaths: d.toolpaths.map((tp, i) => ({
      ...tp,
      name: `${i + 1}. ${t.operations[tp.operation]}${tp.operation === 'inlay' ? ` – ${t.inlayParts[tp.part]}` : ''}`,
    })),
  };
}

/** Öppnar ett exempelprojekt från välkomstfönstret. */
export async function openExample(id: string, title: string): Promise<boolean> {
  const t = getT();
  await autosaveNow();
  try {
    const res = await fetch(exampleUrl(id, 'dcam'));
    if (!res.ok || !loadProject(localizeExample(await res.json()))) throw new Error('INVALID');
  } catch {
    status(t.status.projectInvalid);
    return false;
  }
  const s = useAppStore.getState();
  s.setProjectName(title);
  s.setTab('simulate');
  s.sendViewCommand('fitStock');
  // Tipset om Simulera visas när banorna är uträknade (inlägg tar en stund).
  const stop = useAppStore.subscribe((st) => {
    if (st.projectName !== title) return stop();
    if (Object.keys(st.progress).length || !st.toolpaths.every((tp) => st.results[tp.id] || st.errors[tp.id])) return;
    stop();
    setTimeout(() => status(getT().welcome.opened(title)), 0);
  });
  return true;
}

export function saveProject() {
  const s = useAppStore.getState();
  const t = getT();
  const name = `${slug(s.projectName || t.common.untitledProject)}.dcam`;
  downloadText(name, JSON.stringify(projectJson(), null, 1), 'application/json');
  status(t.status.projectSaved(name));
}

export async function openProject() {
  const f = await pickFile('.dcam,.json,application/json');
  if (!f) return;
  const t = getT();
  await autosaveNow();
  try {
    if (loadProject(JSON.parse(await f.text()))) status(t.status.projectOpened(f.name));
    else status(t.status.projectInvalid);
  } catch {
    status(t.status.projectInvalid);
  }
}

export function newProject() {
  const t = getT();
  void autosaveNow(); // läser projektet direkt, innan det töms
  useAppStore.getState().newProject('', t.common.layer(1));
  status(t.status.newProject);
}

/** Återställer senaste arbetet och sparar sedan automatiskt vid varje ändring. */
/**
 * Autosparning. Hela projektet (med foton) sparas i IndexedDB, som rymmer
 * betydligt mer än localStorage (~5 MB). En kopia utan bilder sparas också i
 * localStorage som reserv – och som tecken på att användaren varit här förut.
 * Får något inte plats sägs det till, i stället för att bilderna tyst försvinner.
 */
/** Återställningen görs en gång per sidladdning (React StrictMode kör effekter två gånger i utvecklingsläge). */
let restoring: Promise<void> | null = null;

export function startAutosave() {
  let ready = false;
  const restore = async () => {
    try {
      const data = await idbGet(AUTOSAVE_KEY);
      if (data && loadProject(data, { keepId: true })) return status(getT().status.restored);
    } catch {
      /* IndexedDB saknas (t.ex. vissa privata lägen) */
    }
    try {
      const raw = localStorage.getItem(AUTOSAVE_KEY);
      if (raw && loadProject(JSON.parse(raw), { keepId: true })) status(getT().status.restored);
    } catch {
      /* trasig autosparning ignoreras */
    }
  };
  restoring ??= restore();
  void restoring.finally(() => (ready = true));

  return useAppStore.subscribe((s, prev) => {
    if (!ready) return;
    if (s.layers === prev.layers && s.reliefs === prev.reliefs && s.imageObjects === prev.imageObjects && s.toolpaths === prev.toolpaths && s.material === prev.material && s.tools === prev.tools && s.machineId === prev.machineId && s.projectName === prev.projectName) return;
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => void autosaveNow(), 800);
  });
}

let autosaveTimer: ReturnType<typeof setTimeout> | undefined;
let autosaveWarned = false;

/**
 * Sparar det öppna projektet nu (autosparning och Senaste projekt). Anropas
 * också innan ett annat projekt öppnas, så att inga ändringar går förlorade.
 * Projektet läses synkront innan något väntas på.
 */
export async function autosaveNow(): Promise<void> {
  clearTimeout(autosaveTimer);
  const s = useAppStore.getState();
  const full = projectJson();
  const shapes = allShapes(s.layers).length;
  const entry: RecentEntry = {
    id: s.projectId,
    name: s.projectName,
    machineName: getMachine().name,
    machineKind: getMachine().kind,
    savedAt: Date.now(),
    shapes,
    toolpaths: s.toolpaths.length,
    images: s.imageObjects.length,
  };
  let fullSaved = false;
  try {
    await idbSet(AUTOSAVE_KEY, full);
    fullSaved = true;
    // Tomma projekt hamnar inte i listan.
    if (shapes || s.toolpaths.length || s.imageObjects.length || s.reliefs.length) await rememberProject(full, entry);
  } catch {
    /* fullt eller saknas – prova localStorage nedan */
  }
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(fullSaved ? projectJson(false) : full));
    fullSaved = true;
  } catch {
    try {
      localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(projectJson(false)));
    } catch {
      /* privat läge */
    }
  }
  if (!fullSaved && !autosaveWarned) {
    autosaveWarned = true;
    status(getT().status.autosaveFull);
  }
  if (fullSaved) autosaveWarned = false;
}

/** Öppnar ett projekt ur listan Senaste projekt (fortsätter spara under samma id). */
export async function openRecent(id: string, name: string): Promise<boolean> {
  const t = getT();
  await autosaveNow();
  const data = await loadRecent(id).catch(() => null);
  if (!data || !loadProject(data, { keepId: true })) {
    status(t.status.projectInvalid);
    return false;
  }
  status(t.status.projectOpened(name || t.common.untitledProject));
  return true;
}

/* ───────── Export ───────── */

export function exportSelectedGcode() {
  const s = useAppStore.getState();
  const tp = s.toolpaths.find((x) => x.id === s.selectedToolpathId && s.results[x.id]) ?? s.toolpaths.find((x) => s.results[x.id]);
  exportToolpathsGcode(tp ? [tp.id] : []);
}

/**
 * Laddar ner G-koden för banorna: inläggets ficka och plugg som egna filer,
 * övriga banor en fil per lager (och verktyg). Filerna laddas ner en i taget
 * – annars stoppar webbläsaren alla utom den första.
 */
export function exportToolpathsGcode(ids: string[], opts: ExportOptions = {}) {
  const t = getT();
  const files = planExport(ids, opts);
  if (!files.length) {
    status(t.status.noResult);
    return;
  }
  files.forEach((f, i) => setTimeout(() => downloadText(f.filename, fileGcode(f)), i * 400));
  status(files.length === 1 ? t.status.saved(files[0].filename) : t.status.savedMany(files.length));
}

/* ───────── Mått mellan två former ───────── */

/** Referenspunkt på en form: −1 = vänster/nederkant, 0 = mitten, 1 = höger/överkant. */
export interface Anchor {
  x: -1 | 0 | 1;
  y: -1 | 0 | 1;
}
export interface MeasureRef {
  fixed: Anchor;
  moving: Anchor;
}

export interface Measure {
  /** Formen som står still och formen som flyttas. */
  fixed: VectorShape;
  moving: VectorShape;
  /** Punkterna som måttet går mellan. */
  from: { x: number; y: number };
  to: { x: number; y: number };
  dx: number;
  dy: number;
  dist: number;
}

const anchorPoint = (sh: VectorShape, a: Anchor) => {
  const b = shapesBounds([sh])!;
  const pick = (min: number, max: number, k: number) => (k < 0 ? min : k > 0 ? max : (min + max) / 2);
  return { x: pick(b.min.x, b.max.x, a.x), y: pick(b.min.y, b.max.y, a.y) };
};

/** Avståndet från en punkt på den fasta formen till en punkt på den rörliga. */
export function measure(fixed: VectorShape, moving: VectorShape, ref: MeasureRef): Measure {
  const from = anchorPoint(fixed, ref.fixed), to = anchorPoint(moving, ref.moving);
  const dx = to.x - from.x, dy = to.y - from.y;
  return { fixed, moving, from, to, dx, dy, dist: Math.hypot(dx, dy) };
}

/**
 * Förvalda referenspunkter:
 *  - center: mitt till mitt
 *  - side: närmaste sidor/hörn på den fasta formen till mitten av den rörliga
 *    (t.ex. ett hål i en platta, måttsatt från plattans kanter)
 *  - edge: fritt mellanrum mellan de motstående kanterna
 */
export function measurePreset(fixed: VectorShape, moving: VectorShape, preset: 'center' | 'side' | 'edge'): MeasureRef {
  const a = shapesBounds([fixed])!, b = shapesBounds([moving])!;
  const ac = { x: (a.min.x + a.max.x) / 2, y: (a.min.y + a.max.y) / 2 };
  const bc = { x: (b.min.x + b.max.x) / 2, y: (b.min.y + b.max.y) / 2 };
  const side = (v: number, c: number): -1 | 1 => (v >= c ? 1 : -1);
  if (preset === 'center') return { fixed: { x: 0, y: 0 }, moving: { x: 0, y: 0 } };
  if (preset === 'side') return { fixed: { x: side(bc.x, ac.x), y: side(bc.y, ac.y) }, moving: { x: 0, y: 0 } };
  const sx = side(bc.x, ac.x), sy = side(bc.y, ac.y);
  return { fixed: { x: sx, y: sy }, moving: { x: (-sx) as -1 | 1, y: (-sy) as -1 | 1 } };
}

/** Bästa förval: ligger den rörliga formens mitt inuti den fasta måttsätts den från närmaste sidor. */
export function defaultMeasureRef(fixed: VectorShape, moving: VectorShape): MeasureRef {
  const a = shapesBounds([fixed])!, b = shapesBounds([moving])!;
  const bx = (b.min.x + b.max.x) / 2, by = (b.min.y + b.max.y) / 2;
  const inside = bx > a.min.x && bx < a.max.x && by > a.min.y && by < a.max.y;
  return measurePreset(fixed, moving, inside ? 'side' : 'center');
}

function moveShape(sh: VectorShape, dx: number, dy: number) {
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return;
  const out = transformShape(sh, translate(dx, dy));
  useAppStore.getState().replaceShapes([sh.text ? { ...out, text: { ...sh.text, x: sh.text.x + dx, y: sh.text.y + dy } } : out]);
}

/** Flyttar den rörliga formen så att måttet blir det angivna. */
export function setMeasure(m: Measure, patch: { dx?: number; dy?: number; dist?: number }) {
  if (patch.dist !== undefined) {
    const ang = m.dist > 1e-9 ? Math.atan2(m.dy, m.dx) : 0;
    moveShape(m.moving, m.from.x + patch.dist * Math.cos(ang) - m.to.x, m.from.y + patch.dist * Math.sin(ang) - m.to.y);
    return;
  }
  moveShape(m.moving, patch.dx !== undefined ? patch.dx - m.dx : 0, patch.dy !== undefined ? patch.dy - m.dy : 0);
}

/* ───────── Reliefinlägg ───────── */

const plugSource = (r: ReliefInstance): ReliefPlug['source'] => ({
  reliefId: r.reliefId,
  image: r.image,
  invert: r.invert,
  mirror: r.mirror,
  x: r.x,
  y: r.y,
  width: r.width,
  height: r.height,
  depth: r.depth,
  inlayRadius: r.inlayRadius,
});

/** Skapar pluggen till ett reliefinlägg. Den döljs tills man väljer att visa den. */
export function createReliefPlug(pocketId: string) {
  const s = useAppStore.getState();
  const t = getT();
  const pocket = s.reliefs.find((r) => r.id === pocketId);
  if (!pocket || pocket.plug) return;
  const existing = s.reliefs.find((r) => r.plug?.pocketId === pocketId);
  if (existing) {
    s.selectRelief(existing.id);
    return;
  }
  // Fräsradien: från fickans 3D-bana om den finns, annars en kulfräs på 3,175 mm.
  const tp = s.toolpaths.find((x) => x.operation === 'relief' && x.reliefId === pocketId);
  const tool = s.tools.find((x) => x.id === tp?.toolId) ?? s.tools.find((x) => x.kind === 'ballnose');
  const plug: ReliefPlug = { pocketId, source: plugSource(pocket), gap: 0.2, margin: 4, clearance: 1, toolRadius: (tool?.diameter ?? 3.175) / 2 };
  // Fickans vassa toppar rundas av så att pluggens fräs kan följa dem.
  s.updateRelief(pocket.id, { inlayRadius: plug.toolRadius });
  plug.source = plugSource({ ...pocket, inlayRadius: plug.toolRadius });
  s.addRelief({
    id: uid('relief'),
    name: `${pocket.name} – ${t.reliefInlay.plugSuffix}`,
    reliefId: 'plug',
    ...plugGeometry(plug),
    invert: false,
    mirror: false,
    visible: false,
    plug,
  });
  status(t.reliefInlay.created(pocket.name));
}

/** Visar fickan eller pluggen (de ligger på samma ställe, så bara en åt gången). */
export function showInlayPart(plugId: string, part: 'pocket' | 'plug') {
  const s = useAppStore.getState();
  const plug = s.reliefs.find((r) => r.id === plugId);
  if (!plug?.plug) return;
  s.updateRelief(plug.id, { visible: part === 'plug' });
  const pocket = s.reliefs.find((r) => r.id === plug.plug!.pocketId);
  if (pocket) s.updateRelief(pocket.id, { visible: part === 'pocket' });
}

/** Ändrar pluggens limspalt, marginal eller frigång och räknar om dess mått. */
export function updateReliefPlug(plugId: string, patch: Partial<Pick<ReliefPlug, 'gap' | 'margin' | 'clearance' | 'toolRadius'>>) {
  const s = useAppStore.getState();
  const r = s.reliefs.find((x) => x.id === plugId);
  if (!r?.plug) return;
  const plug = { ...r.plug, ...patch };
  s.checkpoint();
  // Byts fräsen, rundas fickans toppar med den nya radien (pluggen följer via watchReliefPlugs).
  if (patch.toolRadius !== undefined) s.updateRelief(plug.pocketId, { inlayRadius: patch.toolRadius });
  s.updateRelief(r.id, { plug, ...plugGeometry(plug) });
}

/** Pluggen följer fickan: flyttas, skalas eller ändras fickan, uppdateras pluggen. */
export function watchReliefPlugs() {
  return useAppStore.subscribe((s, prev) => {
    if (s.reliefs === prev.reliefs) return;
    for (const r of s.reliefs) {
      if (!r.plug) continue;
      const pocket = s.reliefs.find((x) => x.id === r.plug!.pocketId);
      if (!pocket) continue;
      const src = plugSource(pocket);
      const old = r.plug.source;
      if ((Object.keys(src) as (keyof typeof src)[]).every((k) => src[k] === old[k])) continue;
      const plug = { ...r.plug, source: src };
      useAppStore.getState().updateRelief(r.id, { plug, ...plugGeometry(plug) });
    }
  });
}

/* ───────── Mönster ───────── */

/** Kopierar markeringen i ett linjärt eller cirkulärt mönster. Kopiorna markeras tillsammans med originalet. */
export function applyPattern(cfg: PatternConfig) {
  const s = useAppStore.getState();
  const t = getT();
  const shapes = selected();
  const b = shapesBounds(shapes);
  if (!shapes.length || !b) return;
  const { origin, copies: transforms } = patternTransforms(cfg, b);
  if (!transforms.length && !origin) return;
  const isTranslate = (m: Mat2D) => m[0] === 1 && m[1] === 0 && m[2] === 0 && m[3] === 1;
  const copies: VectorShape[] = [];
  const byShape = new Map<string, VectorShape[]>();
  transforms.forEach((m, k) => {
    for (const sh of shapes) {
      const moved = transformShape(sh, m);
      const copy: VectorShape = {
        ...moved,
        id: uid('shape'),
        name: `${sh.name} (${k + 2})`,
        paths: moved.paths.map((p) => ({ ...p, id: uid('path') })),
        text: sh.text && isTranslate(m) ? { ...sh.text, x: sh.text.x + m[4], y: sh.text.y + m[5] } : undefined,
      };
      copies.push(copy);
      byShape.set(sh.id, [...(byShape.get(sh.id) ?? []), copy]);
    }
  });
  // Cirkulärt mönster med radie: originalet flyttas ut på cirkeln.
  const movedOriginal = (sh: VectorShape): VectorShape => {
    if (!origin) return sh;
    const out = transformShape(sh, origin);
    return sh.text ? { ...out, text: { ...sh.text, x: sh.text.x + origin[4], y: sh.text.y + origin[5] } } : out;
  };
  const ids = new Set(shapes.map((x) => x.id));
  const layers = s.layers.map((l) => {
    const mine = l.shapes.flatMap((sh) => byShape.get(sh.id) ?? []);
    if (!mine.length && !l.shapes.some((sh) => ids.has(sh.id))) return l;
    return { ...l, shapes: [...l.shapes.map((sh) => (ids.has(sh.id) ? movedOriginal(sh) : sh)), ...mine] };
  });
  s.checkpoint();
  useAppStore.setState({ layers, selectedShapeIds: [...shapes.map((x) => x.id), ...copies.map((c) => c.id)] });
  status(t.pattern.created(transforms.length + 1));
}

/* ───────── Kontur: förskjutning, slå ihop, dela upp ───────── */

const linePath = (pts: number[], closed: boolean): VectorShape['paths'][number] => ({
  id: uid('path'),
  start: { x: pts[0], y: pts[1] },
  segments: Array.from({ length: pts.length / 2 - 1 }, (_, i) => ({ type: 'line' as const, to: { x: pts[2 * i + 2], y: pts[2 * i + 3] } })),
  closed,
});

/**
 * Förskjuter markerade formers slutna banor (positivt = utåt, negativt =
 * inåt) och lägger till resultatet som nya former i samma lager. Avstånds-
 * fältet ger giltiga konturer även där den ursprungliga konturen skär sig själv.
 */
export function offsetSelection(distance: number) {
  const s = useAppStore.getState();
  const t = getT();
  const shapes = selected().filter(shapeHasArea);
  if (!shapes.length) return status(t.status.needClosed);
  // Varje ny form hamnar i samma lager som formen den kommer från.
  const adds: { layerId: string; shape: VectorShape }[] = [];
  for (const sh of shapes) {
    const closed = shapeToPolylines(sh, 0.005).filter((p) => p.closed);
    const loops = offsetShapes([closed], distance);
    const layer = s.layers.find((l) => l.shapes.some((x) => x.id === sh.id));
    if (!loops.length || !layer) continue;
    adds.push({
      layerId: layer.id,
      shape: {
        id: uid('shape'),
        name: `${sh.name} ${t.contour.offsetSuffix(distance.toLocaleString(t.locale))}`,
        kind: 'imported',
        paths: loops.map((l) => linePath(simplifyClosed(l.points, 0.005), true)),
      },
    });
  }
  if (!adds.length) return status(t.contour.offsetEmpty);
  const created = adds.map((a) => a.shape);
  s.checkpoint();
  useAppStore.setState((st) => ({
    layers: st.layers.map((l) => {
      const add = adds.filter((a) => a.layerId === l.id).map((a) => a.shape);
      return add.length ? { ...l, shapes: [...l.shapes, ...add] } : l;
    }),
    selectedShapeIds: created.map((c) => c.id),
  }));
  status(t.contour.offsetDone(created.length));
}

/** Slår ihop markerade former till en form (alla banor i den första formens lager). */
export function combineSelection() {
  const s = useAppStore.getState();
  const shapes = selected();
  if (shapes.length < 2) return;
  const first = shapes[0];
  const merged: VectorShape = { id: first.id, name: first.name, kind: 'imported', paths: shapes.flatMap((sh) => sh.paths) };
  const gone = new Set(shapes.slice(1).map((sh) => sh.id));
  s.checkpoint();
  useAppStore.setState((st) => ({
    layers: st.layers.map((l) => ({ ...l, shapes: l.shapes.filter((sh) => !gone.has(sh.id)).map((sh) => (sh.id === first.id ? merged : sh)) })),
    selectedShapeIds: [first.id],
    toolpaths: st.toolpaths.map((tp) => (tp.shapeIds.some((id) => gone.has(id)) ? { ...tp, shapeIds: [...new Set(tp.shapeIds.map((id) => (gone.has(id) ? first.id : id)))] } : tp)),
  }));
  status(getT().contour.combined(shapes.length));
}

/** Delar upp markerade former med flera banor till en form per bana. */
export function separateSelection() {
  const s = useAppStore.getState();
  const shapes = selected().filter((sh) => sh.paths.length > 1);
  if (!shapes.length) return;
  const parts = new Map(shapes.map((sh) => [sh.id, sh.paths.map((p, i) => ({ id: i ? uid('shape') : sh.id, name: i ? `${sh.name} ${i + 1}` : sh.name, kind: 'imported' as const, paths: [p] }))]));
  s.checkpoint();
  useAppStore.setState((st) => ({
    layers: st.layers.map((l) => ({ ...l, shapes: l.shapes.flatMap((sh) => parts.get(sh.id) ?? [sh]) })),
    selectedShapeIds: [...parts.values()].flat().map((x) => x.id),
  }));
  status(getT().contour.separated([...parts.values()].flat().length));
}

/* ───────── Export av vektorer ───────── */

/** Markerade former, annars alla synliga lager. */
function exportLayers(): ExportLayer[] {
  const s = useAppStore.getState();
  const sel = new Set(s.selectedShapeIds);
  return s.layers
    .filter((l) => l.visible)
    .map((l) => ({ name: l.name, color: l.color, shapes: sel.size ? l.shapes.filter((sh) => sel.has(sh.id)) : l.shapes }))
    .filter((l) => l.shapes.length);
}

export function exportVectors(format: 'svg' | 'dxf' | 'pdf') {
  const s = useAppStore.getState();
  const t = getT();
  const layers = exportLayers();
  if (!layers.length) return status(t.status.drawFirst);
  const name = slug(s.projectName || t.common.untitledProject);
  if (format === 'svg') downloadText(`${name}.svg`, exportSvg(layers), 'image/svg+xml');
  else if (format === 'dxf') downloadText(`${name}.dxf`, exportDxf(layers), 'application/dxf');
  else downloadBytes(`${name}.pdf`, exportPdf(layers, { title: s.projectName || 'desktopCAM', note: t.vectorExport.pdfNote, labels: true }), 'application/pdf');
  status(t.vectorExport.saved(`${name}.${format}`));
}
