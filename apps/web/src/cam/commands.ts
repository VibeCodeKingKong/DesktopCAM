/**
 * Kommandon som Ribbon, kortkommandon och paneler anropar.
 * Samlade här så att samma handling alltid beter sig likadant.
 */
import {
  patternTransforms,
  defaultPlasmaSettings,
  plasmaDataFor,
  routerParamsFor,
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
} from '@desktopcam/core';
import { getT } from '../i18n';
import toolsJson from '../data/tools.json';
import { allShapes, getEffectiveMaterial, getMachine, useAppStore } from '../store/useAppStore';
import { downloadText, pickFile, slug } from '../utils/download';
import { computeToolpath } from './toolpathService';
import { buildTextShape, ensureTextFont } from '../text/textShape';
import { activeEditor } from '../editing/EditController';
import machinesJson from '../data/machines.json';
import { materialName } from '../i18n';

export const isLaserOperation = (op: OperationType) => op === 'laserCut' || op === 'laserRaster';
/** Vilken sorts maskin en operation kräver. */
export const machineKindFor = (op: OperationType): MachineKind => (isLaserOperation(op) ? 'laser' : op === 'plasmaCut' ? 'plasma' : 'router');
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
}

export function duplicateSelection() {
  const s = useAppStore.getState();
  const shapes = selected();
  if (!shapes.length) return;
  const t = getT();
  const off = 5;
  const copies = new Map(
    shapes.map((sh) => {
      const moved = transformShape(sh, translate(off, -off));
      const copy: VectorShape = {
        ...moved,
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
  useAppStore.getState().replaceShapes(
    shapes.map((sh) => {
      const out = transformShape(sh, m);
      if (sh.text && isTranslate) return { ...out, text: { ...sh.text, x: sh.text.x + m[4], y: sh.text.y + m[5] } };
      return { ...out, text: undefined };
    }),
  );
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

export function rotateSelection(deg: number) {
  const b = selectionBounds();
  if (!b) return;
  const cx = (b.min.x + b.max.x) / 2, cy = (b.min.y + b.max.y) / 2;
  transformSelection(multiply(translate(cx, cy), multiply(rotate(deg), translate(-cx, -cy))));
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

export function undo() {
  const ok = useAppStore.getState().undo();
  if (ok) status(getT().status.undone);
}

export function redo() {
  const ok = useAppStore.getState().redo();
  if (ok) status(getT().status.redone);
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
    status(needed === 'router' ? t.status.needRouter(opName) : needed === 'laser' ? t.status.needLaser(opName) : t.status.needPlasma(opName));
    return null;
  }
  if (operation === 'relief' && !s.reliefs.length) {
    status(t.status.addReliefFirst);
    return null;
  }

  const shapes = allShapes(s.layers);
  const sel = s.selectedShapeIds.length ? shapes.filter((x) => s.selectedShapeIds.includes(x.id)) : shapes;
  const shapeIds = sel.map((x) => x.id);
  if (!shapeIds.length && operation !== 'laserRaster' && operation !== 'relief') {
    status(t.status.drawFirst);
    return null;
  }
  if ((operation === 'pocket' || operation === 'drill' || operation === 'vcarve' || operation === 'inlay') && !sel.some(shapeHasArea)) {
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
  const routerTool = (prefer: string[]) => {
    const active = s.tools.find((x) => x.id === s.activeToolId);
    if (active && prefer.includes(active.kind)) return active;
    return s.tools.find((x) => prefer.includes(x.kind)) ?? s.tools.find((x) => x.kind !== 'laser' && x.kind !== 'plasma')!;
  };
  // Materialets värden skalade efter maskinen, verktygets diameter och antal skär.
  const routerParams = (tool: ReturnType<typeof routerTool>) => ({ ...tool.defaults, ...(routerParamsFor(preset, tool, machine) ?? {}) });
  let tp: ToolpathConfig;

  switch (operation) {
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
      const tool = routerTool(['endmill', 'ballnose']);
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
      const tool = routerTool(['endmill']);
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
      const tool = routerTool(['drill', 'endmill']);
      tp = {
        ...base,
        operation,
        name: `${n}. ${opName}`,
        toolId: tool.id,
        depth: s.material.thickness,
        peckDepth: Math.max(1, +tool.diameter.toFixed(1)),
        params: { ...tool.defaults },
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
    toolpaths: [...st.toolpaths, { ...shared, id: plugId, visible: false, operation: 'inlay', part: 'plug', name: `${n + 1}. ${t.operations.inlay} – ${t.inlayParts.plug}` }],
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

export async function importPhotoForEngraving() {
  if (getMachine().kind !== 'laser') {
    status(getT().status.photoNeedsLaser);
    return;
  }
  const file = await pickFile('image/png,image/jpeg,image/webp');
  if (!file) return;
  const bitmap = await createImageBitmap(file);
  const imageId = uid('img');
  useAppStore.getState().addImage({ id: imageId, name: file.name, bitmap });
  createToolpath('laserRaster', { imageId });
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

function projectJson() {
  const s = useAppStore.getState();
  return {
    app: 'desktopCAM',
    version: 1,
    savedAt: new Date().toISOString(),
    projectName: s.projectName,
    machineId: s.machineId,
    customMachines: s.machines.filter((m) => m.custom || JSON.stringify(m) !== JSON.stringify(BUILT_IN.get(m.id))),
    material: s.material,
    tools: s.tools,
    layers: s.layers,
    reliefs: s.reliefs,
    // Fotogravyr sparas inte: bilden finns bara i minnet.
    toolpaths: s.toolpaths.filter((tp) => tp.operation !== 'laserRaster'),
  };
}

function loadProject(data: unknown): boolean {
  const d = data as ReturnType<typeof projectJson>;
  if (!d || d.app !== 'desktopCAM' || !Array.isArray(d.layers)) return false;
  useAppStore.getState().loadDocument({
    projectName: d.projectName ?? '',
    layers: d.layers,
    reliefs: d.reliefs ?? [],
    toolpaths: d.toolpaths ?? [],
    material: d.material,
    // Äldre projekt saknar verktygens längder – fyll i från de inbyggda verktygen.
    tools: d.tools?.length ? d.tools.map((x) => ({ ...(toolsJson as ToolDefinition[]).find((b) => b.id === x.id), ...x })) : useAppStore.getState().tools,
    machineId: d.machineId,
    customMachines: d.customMachines ?? [],
  });
  for (const tp of useAppStore.getState().toolpaths) void computeToolpath(tp.id);
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
  try {
    if (loadProject(JSON.parse(await f.text()))) status(t.status.projectOpened(f.name));
    else status(t.status.projectInvalid);
  } catch {
    status(t.status.projectInvalid);
  }
}

export function newProject() {
  const t = getT();
  useAppStore.getState().newProject('', t.common.layer(1));
  status(t.status.newProject);
}

/** Återställer senaste arbetet och sparar sedan automatiskt vid varje ändring. */
export function startAutosave() {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (raw && loadProject(JSON.parse(raw))) status(getT().status.restored);
  } catch {
    /* trasig autosparning ignoreras */
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  return useAppStore.subscribe((s, prev) => {
    if (s.layers === prev.layers && s.reliefs === prev.reliefs && s.toolpaths === prev.toolpaths && s.material === prev.material && s.tools === prev.tools && s.machineId === prev.machineId && s.projectName === prev.projectName) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      try {
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(projectJson()));
      } catch {
        /* fullt eller privat läge */
      }
    }, 800);
  });
}

/* ───────── Export ───────── */

export function exportSelectedGcode() {
  const s = useAppStore.getState();
  const t = getT();
  const tp = s.toolpaths.find((x) => x.id === s.selectedToolpathId) ?? s.toolpaths.find((x) => s.results[x.id]);
  const result = tp && s.results[tp.id];
  if (!tp || !result) {
    status(t.status.noResult);
    return;
  }
  const filename = `${slug(s.projectName || 'desktopcam')}-${slug(tp.name)}.gcode`;
  downloadText(filename, result.gcode);
  status(t.status.saved(filename));
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
