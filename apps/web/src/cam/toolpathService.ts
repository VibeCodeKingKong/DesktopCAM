import {
  parseGcode,
  defaultPocketStrategy,
  type PocketStrategy,
  defaultStrategy,
  defaultTabs,
  shapeToPolylines,
  type RouterProfileJob,
  shapesBounds,
  transformShape,
  type VCarveJob,
  type DrillJob,
  type PlotterJob,
  type PlotterImageJob,
  defaultPlotterSettings,
  hatchLines,
  offsetFill,
  type FacingJob,
  type PocketJob,
  type PolylineInput,
  type ProfileJob,
  type PlasmaJob,
  type RasterJob,
  type ReliefJob,
  type ToolDefinition,
  type ToolpathConfig,
  type VectorShape,
  type MachineProfile,
  type PostprocessorConfig,
} from '@desktopcam/core';
import { camClient } from '../engine/camClient';
import { DEFAULT_PLUG_MATERIAL, mirrorInPlace, PLUG_BLANK_GAP, plugBlank, reliefPlugBlank, type PlugBlank } from './inlayBlank';
import { errorText, getT } from '../i18n';
import { allShapes, getMachine, useAppStore } from '../store/useAppStore';
import { rasterizeGray } from '../utils/image';
import { renderImage } from '../utils/imageFrame';
import { heightmapFor } from './reliefs';
import { toolReachWarnings, vbitConeHeight } from './toolReach';
import { toolFits } from './toolRules';

/** Postprocessorn med maskinens högsta hastigheter (för tidsberäkningen). */
const postFor = (m: MachineProfile): PostprocessorConfig => ({ ...m.postprocessor, maxFeed: m.maxFeed });

const timers = new Map<string, ReturnType<typeof setTimeout>>();

/** Räkna om efter en kort paus – används när användaren ändrar parametrar. */
export function scheduleCompute(id: string, delay = 350) {
  clearTimeout(timers.get(id));
  timers.set(id, setTimeout(() => void computeToolpath(id), delay));
}

/**
 * Varje beräkning får ett nummer. Ändras banan medan den räknas startas en ny
 * beräkning, och bara den senaste får skriva sitt resultat.
 */
const generation = new Map<string, number>();

export async function computeToolpath(id: string): Promise<void> {
  const s = useAppStore.getState();
  const tp = s.toolpaths.find((t) => t.id === id);
  if (!tp) return;
  const gen = (generation.get(id) ?? 0) + 1;
  generation.set(id, gen);
  const stale = () => generation.get(id) !== gen;
  const t = getT();
  const onProgress = (value: number, message?: string) =>
    useAppStore.getState().setProgress(id, { value, message: message ? (getT().progress[message] ?? message) : undefined });

  // Fel sorts verktyg ger fel bana (t.ex. ficka med V-fräs) – räkna inte alls.
  const tool = s.tools.find((x) => x.id === tp.toolId);
  if (!toolFits(tp, tool?.kind)) {
    const message = tool ? t.toolRules.why(tp.operation, tool.kind, tp.operation === 'profile' ? tp.side : undefined) : t.errors.WRONG_TOOL;
    s.setError(id, message);
    s.setStatus(t.status.error(tp.name, message));
    return;
  }
  s.setProgress(id, { value: 0, message: t.progress.start });
  s.setStatus(t.status.computing(tp.name));
  try {
    let payload;
    switch (tp.operation) {
      case 'laserRaster':
        payload = await camClient.request({ type: 'raster', job: buildRasterJob(tp) }, { onProgress });
        break;
      case 'relief':
        payload = await camClient.request({ type: 'relief', job: buildReliefJob(tp) }, { onProgress });
        break;
      case 'pocket':
        payload = await camClient.request({ type: 'pocket', job: buildPocketJob(tp) }, { onProgress });
        break;
      case 'drill':
        payload = await camClient.request({ type: 'drill', job: buildDrillJob(tp) }, { onProgress });
        break;
      case 'penImage':
        payload = await camClient.request({ type: 'plotterImage', job: buildPenImageJob(tp) }, { onProgress });
        break;
      case 'penDraw':
      case 'penFill':
        payload = await camClient.request({ type: 'plotter', job: buildPlotterJob(tp) }, { onProgress });
        break;
      case 'facing':
        payload = await camClient.request({ type: 'facing', job: buildFacingJob(tp) }, { onProgress });
        break;
      case 'vcarve':
      case 'inlay':
        payload = await camClient.request({ type: 'vcarve', job: buildVCarveJob(tp) }, { onProgress });
        break;
      case 'profile':
        payload = await camClient.request({ type: 'routerProfile', job: buildRouterProfileJob(tp) }, { onProgress });
        break;
      case 'laserCut':
        payload = await camClient.request({ type: 'profile', job: buildProfileJob(tp) }, { onProgress });
        break;
      case 'plasmaCut':
        payload = await camClient.request({ type: 'plasma', job: buildPlasmaJob(tp) }, { onProgress });
        break;
      case 'gcode':
        // Färdig G-kod räknas inte om – den tolkas bara för vyn och statistiken.
        payload = { gcode: tp.gcode, preview: parseGcode(tp.gcode, getMachine().maxFeed), features: undefined };
        break;
      default:
        throw new Error('NOT_IMPLEMENTED');
    }
    if (stale()) return;
    const st = useAppStore.getState();
    const warnings = toolReachWarnings(st.tools.find((x) => x.id === tp.toolId), payload.preview.stats, getT());
    // Pluggen: skriv inläggsträets mått och nollpunkt överst i G-koden.
    const blank = plugBlankFor(tp);
    const note = tp.operation === 'relief' ? getT().inlaySim.gcodeNoteRelief : getT().inlaySim.gcodeNote;
    const gcode = blank ? `${note(blank.width, blank.height, blank.thickness).map((l) => `; ${l}`).join('\n')}\n${payload.gcode}` : payload.gcode;
    st.setResult(id, {
      warnings,
      gcode,
      rapids: payload.preview.rapids,
      cuts: payload.preview.cuts,
      stats: payload.preview.stats,
      features: payload.features,
      engine: st.engine?.engine ?? 'typescript',
      computedAt: Date.now(),
    });
    st.setStatus(warnings.length ? `${tp.name}: ${warnings[0]}` : getT().status.computed(tp.name, payload.preview.stats.lineCount.toLocaleString(getT().locale)));
  } catch (err) {
    if (stale()) return;
    const tt = getT();
    const message = errorText(tt, err instanceof Error ? err.message : String(err));
    useAppStore.getState().setError(id, message);
    useAppStore.getState().setStatus(tt.status.error(tp.name, message));
  } finally {
    if (!stale()) useAppStore.getState().setProgress(id, null);
  }
}

function shapesOf(tp: ToolpathConfig): VectorShape[] {
  const shapes = allShapes(useAppStore.getState().layers).filter((sh) => tp.shapeIds.includes(sh.id));
  if (!shapes.length) throw new Error('NO_SHAPES');
  return shapes;
}

// Fin uppdelning av kurvor (0,005 mm) – annars blir cirklar månghörningar som varken blir exakta eller kan skrivas som G2/G3.
const groupsOf = (shapes: VectorShape[]): PolylineInput[][] => shapes.map((sh) => shapeToPolylines(sh, 0.005));

function buildProfileJob(tp: ToolpathConfig): ProfileJob {
  const s = useAppStore.getState();
  const machine = getMachine();
  const tool = s.tools.find((t) => t.id === tp.toolId);
  const groups = groupsOf(shapesOf(tp));
  const polylines = groups.flat();
  const sMax = machine.laser?.sMax ?? 1000;

  if (tp.operation === 'profile') {
    const r = (tool?.diameter ?? 0) / 2;
    return {
      polylines,
      groups,
      offset: tp.side === 'outside' ? r : tp.side === 'inside' ? -r : 0,
      mode: 'router',
      cutDepth: tp.cutDepth,
      stepDown: tp.params.stepDown,
      feedRate: tp.params.feedRate,
      plungeRate: tp.params.plungeRate,
      spindleRpm: tp.params.spindleRpm ?? 18000,
      laserS: 0,
      passes: 1,
      post: postFor(machine),
    };
  }
  if (tp.operation === 'laserCut') {
    const half = tp.kerf / 2;
    return {
      polylines,
      groups,
      offset: tp.side === 'outside' ? half : tp.side === 'inside' ? -half : 0,
      mode: 'laser',
      materialThickness: s.material.thickness,
      cutDepth: 0,
      stepDown: 0,
      feedRate: tp.params.feedRate,
      plungeRate: 0,
      spindleRpm: 0,
      laserS: ((tp.params.laserPowerPct ?? 100) / 100) * sMax,
      passes: tp.passes,
      post: postFor(machine),
    };
  }
  throw new Error('NOT_IMPLEMENTED');
}

function buildPlasmaJob(tp: ToolpathConfig): PlasmaJob {
  if (tp.operation !== 'plasmaCut') throw new Error('NOT_IMPLEMENTED');
  const s = useAppStore.getState();
  const machine = getMachine();
  return {
    groups: groupsOf(shapesOf(tp)),
    side: tp.side,
    kerf: tp.kerf,
    feedRate: tp.params.feedRate,
    plungeRate: tp.params.plungeRate || 1000,
    settings: tp.plasma,
    zAxis: machine.plasma?.zAxis ?? true,
    thickness: s.material.thickness,
    post: {
      ...postFor(machine),
      // Strömstyrkan ställs in på aggregatet – skriv den i filen som påminnelse.
      header: [`; Plasma: ${tp.amps} A, kerf ${tp.kerf} mm`, ...machine.postprocessor.header],
    },
  };
}

/** Penplotter: linjerna att rita – formernas linjer, eller fyllningen av de slutna formerna. */
function buildPlotterJob(tp: ToolpathConfig): PlotterJob {
  if (tp.operation !== 'penDraw' && tp.operation !== 'penFill') throw new Error('NOT_IMPLEMENTED');
  const machine = getMachine();
  const groups = groupsOf(shapesOf(tp));
  let paths: PolylineInput[];
  if (tp.operation === 'penDraw') paths = groups.flat();
  else {
    const closed = groups.map((g) => g.filter((p) => p.closed)).filter((g) => g.length);
    if (!closed.length) throw new Error('NO_CLOSED');
    const tool = useAppStore.getState().tools.find((t) => t.id === tp.toolId);
    const width = tool?.diameter ?? 0.5;
    paths =
      tp.pattern === 'offset'
        ? offsetFill(closed, tp.spacing, tp.outline ? tp.spacing : width / 2)
        : [...hatchLines(closed, tp.spacing, tp.angle), ...(tp.pattern === 'cross' ? hatchLines(closed, tp.spacing, tp.angle + 90) : [])];
    if (tp.outline) paths = [...closed.flat(), ...paths];
  }
  return {
    paths,
    optimize: tp.optimize,
    settings: machine.plotter ?? defaultPlotterSettings(),
    feedRate: tp.params.feedRate,
    plungeRate: tp.params.plungeRate || 600,
    post: postFor(machine),
  };
}

/**
 * Bilden som en bild-bana ska rita: den vridna bilden (omslutande rektangel)
 * om bildobjektet är vridet, annars bilden som den är med banans läge.
 */
function imageForToolpath(imageId: string, origin: { x: number; y: number }, widthMm: number) {
  const s = useAppStore.getState();
  const img = s.images[imageId];
  if (!img) throw new Error('IMAGE_MISSING');
  const obj = s.imageObjects.find((im) => im.id === imageId);
  if (obj && obj.rotation) {
    const { canvas, frame } = renderImage(img.bitmap, obj, Math.min(20, 4000 / Math.max(frame0(obj).w, frame0(obj).h)));
    return { source: canvas as CanvasImageSource, aspect: canvas.height / canvas.width, origin: { x: frame.bbox.x0, y: frame.bbox.y0 }, widthMm: frame.bbox.x1 - frame.bbox.x0 };
  }
  return { source: img.bitmap as CanvasImageSource, aspect: img.bitmap.height / img.bitmap.width, origin, widthMm };
}
const frame0 = (o: { widthMm: number; pxWidth: number; pxHeight: number }) => ({ w: o.widthMm, h: (o.widthMm * o.pxHeight) / o.pxWidth });

/** Bild till linjer: bilden i lagom upplösning för metoden (ungefär tre bildpunkter per linjeavstånd). */
function buildPenImageJob(tp: ToolpathConfig): PlotterImageJob {
  if (tp.operation !== 'penImage') throw new Error('NOT_IMPLEMENTED');
  const machine = getMachine();
  const src = imageForToolpath(tp.imageId, tp.origin, tp.widthMm);
  const width = Math.max(40, Math.min(800, Math.round((src.widthMm * 3) / Math.max(0.2, tp.image.spacing))));
  const height = Math.max(2, Math.round(width * src.aspect));
  return {
    input: { gray: rasterizeGray(src.source, width, height), width, height, x: src.origin.x, y: src.origin.y, widthMm: src.widthMm, settings: tp.image },
    optimize: tp.optimize,
    settings: machine.plotter ?? defaultPlotterSettings(),
    feedRate: tp.params.feedRate,
    plungeRate: tp.params.plungeRate || 600,
    post: postFor(machine),
  };
}

/** Strategi och flikar med standardvärden för äldre projekt. */
/** Fickans strategi; äldre projekt får "balanced" med sitt gamla mönster. */
export function resolvePocket(tp: Extract<ToolpathConfig, { operation: 'pocket' }>): PocketStrategy {
  return tp.pocket ?? defaultPocketStrategy('balanced', tp.strategy === 'raster' ? 'raster' : 'offset');
}

export function resolveProfile(tp: Extract<ToolpathConfig, { operation: 'profile' }>) {
  const thickness = useAppStore.getState().material.thickness;
  const tabs = { ...defaultTabs(tp.cutDepth >= thickness - 1e-6, thickness), ...tp.tabs };
  return { strategy: tp.strategy ?? defaultStrategy('balanced'), tabs };
}

function buildRouterProfileJob(tp: ToolpathConfig): RouterProfileJob {
  if (tp.operation !== 'profile') throw new Error('NOT_IMPLEMENTED');
  const s = useAppStore.getState();
  const tool = s.tools.find((t) => t.id === tp.toolId);
  if (!tool || tool.kind === 'laser') throw new Error('WRONG_TOOL');
  const { strategy, tabs } = resolveProfile(tp);
  return {
    groups: groupsOf(shapesOf(tp)),
    materialThickness: s.material.thickness,
    side: tp.side,
    toolDiameter: tool.diameter,
    cutDepth: tp.cutDepth,
    stepDown: tp.params.stepDown,
    feedRate: tp.params.feedRate,
    plungeRate: tp.params.plungeRate,
    spindleRpm: tp.params.spindleRpm ?? 18000,
    strategy,
    tabs,
    post: postFor(getMachine()),
  };
}

function buildPocketJob(tp: ToolpathConfig): PocketJob {
  if (tp.operation !== 'pocket') throw new Error('NOT_IMPLEMENTED');
  const s = useAppStore.getState();
  const tool = s.tools.find((t) => t.id === tp.toolId);
  if (!tool || tool.kind === 'laser') throw new Error('WRONG_TOOL');
  const groups = groupsOf(shapesOf(tp)).map((g) => g.filter((p) => p.closed)).filter((g) => g.length);
  if (!groups.length) throw new Error('NO_CLOSED');
  return {
    groups,
    materialThickness: useAppStore.getState().material.thickness,
    toolDiameter: tool.diameter,
    stepOver: tp.params.stepOver,
    cutDepth: tp.cutDepth,
    stepDown: tp.params.stepDown,
    feedRate: tp.params.feedRate,
    plungeRate: tp.params.plungeRate,
    spindleRpm: tp.params.spindleRpm ?? 18000,
    post: postFor(getMachine()),
    strategy: resolvePocket(tp),
  };
}

/** Borrpunkter: mitten av varje sluten bana i de valda formerna. */
export function drillPoints(shapes: VectorShape[]) {
  const pts: { x: number; y: number }[] = [];
  for (const sh of shapes) {
    for (const pl of shapeToPolylines(sh, 0.2)) {
      if (!pl.closed) continue;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i + 1 < pl.points.length; i += 2) {
        minX = Math.min(minX, pl.points[i]); maxX = Math.max(maxX, pl.points[i]);
        minY = Math.min(minY, pl.points[i + 1]); maxY = Math.max(maxY, pl.points[i + 1]);
      }
      pts.push({ x: (minX + maxX) / 2, y: (minY + maxY) / 2 });
    }
  }
  return pts;
}

function buildDrillJob(tp: ToolpathConfig): DrillJob {
  if (tp.operation !== 'drill') throw new Error('NOT_IMPLEMENTED');
  return {
    points: drillPoints(shapesOf(tp)),
    depth: tp.depth,
    peckDepth: tp.peckDepth,
    plungeRate: tp.params.plungeRate,
    spindleRpm: tp.params.spindleRpm ?? 12000,
    post: postFor(getMachine()),
  };
}

/** Ytan som planfräsningen täcker: hela ämnet eller de valda formernas omslutande rektangel. */
export function facingArea(tp: Extract<ToolpathConfig, { operation: 'facing' }>) {
  const m = useAppStore.getState().material;
  if (tp.area === 'shapes') {
    const b = shapesBounds(shapesOf(tp));
    if (b) return { x0: b.min.x, y0: b.min.y, x1: b.max.x, y1: b.max.y };
  }
  return { x0: 0, y0: 0, x1: m.width, y1: m.height };
}

function buildFacingJob(tp: ToolpathConfig): FacingJob {
  if (tp.operation !== 'facing') throw new Error('NOT_IMPLEMENTED');
  const s = useAppStore.getState();
  const tool = s.tools.find((t) => t.id === tp.toolId);
  return {
    ...facingArea(tp),
    toolDiameter: tool?.diameter ?? 6,
    stepOver: tp.params.stepOver,
    depth: tp.depth,
    stepDown: tp.params.stepDown,
    feedRate: tp.params.feedRate,
    plungeRate: tp.params.plungeRate,
    spindleRpm: tp.params.spindleRpm ?? 12000,
    pattern: tp.pattern,
    direction: tp.direction,
    overhang: tp.overhang,
    post: postFor(getMachine()),
  };
}

/**
 * Inläggsträet för varje plugg, med var det visas: bredvid grundträet, och
 * flera inlägg under varandra.
 */
export function plugBlankLayout(): Map<string, PlugBlank & { color: string; materialId: string }> {
  const s = useAppStore.getState();
  const out = new Map<string, PlugBlank & { color: string; materialId: string }>();
  let y = 0;
  for (const tp of s.toolpaths) {
    const b = plugBlankFor(tp);
    if (!b) continue;
    const materialId = plugMaterialOf(tp) ?? DEFAULT_PLUG_MATERIAL;
    const color = s.materials.find((m) => m.id === materialId)?.color ?? '#6e4b33';
    out.set(tp.id, { ...b, displayY: y, color, materialId });
    y += b.height + PLUG_BLANK_GAP;
  }
  return out;
}

/** Reliefen som en 3D-bana fräser, om det är pluggen i ett reliefinlägg. */
export function reliefPlugOf(tp: ToolpathConfig) {
  if (tp.operation !== 'relief') return null;
  const r = useAppStore.getState().reliefs.find((x) => x.id === tp.reliefId);
  return r?.plug ? r : null;
}

/** Inläggsträets material för en plugg (V-inlägg eller reliefinlägg). */
function plugMaterialOf(tp: ToolpathConfig): string | undefined {
  if (tp.operation === 'inlay') return tp.plugMaterial;
  return reliefPlugOf(tp)?.plug?.material;
}

/** Inläggsträet för en plugg (null för andra banor eller om formerna saknas). */
export function plugBlankFor(tp: ToolpathConfig): PlugBlank | null {
  const relief = reliefPlugOf(tp);
  if (relief) return reliefPlugBlank(relief, useAppStore.getState().material);
  if (tp.operation !== 'inlay' || tp.part !== 'plug') return null;
  const shapes = allShapes(useAppStore.getState().layers).filter((sh) => tp.shapeIds.includes(sh.id));
  return shapes.length ? plugBlank(tp, shapes, useAppStore.getState().material) : null;
}

/** V-gravyrens största djup: valt plant djup (eller materialets tjocklek), högst konens höjd. */
export function vcarveMaxDepth(tp: Extract<ToolpathConfig, { operation: 'vcarve' }>, tool: ToolDefinition): number {
  const wanted = tp.flatDepth > 0 ? tp.flatDepth : useAppStore.getState().material.thickness;
  return +Math.min(wanted, vbitConeHeight(tool)).toFixed(3);
}

function buildVCarveJob(tp: ToolpathConfig): VCarveJob {
  if (tp.operation !== 'vcarve' && tp.operation !== 'inlay') throw new Error('NOT_IMPLEMENTED');
  const s = useAppStore.getState();
  const tool = s.tools.find((t) => t.id === tp.toolId);
  if (!tool || tool.kind !== 'vbit') throw new Error('NEEDS_VBIT');
  const shapes = shapesOf(tp);
  const plug = tp.operation === 'inlay' && tp.part === 'plug';
  // Pluggen: spegelvänd, och flyttad så att inläggsträets nedre vänstra hörn blir nollpunkten.
  const blank = plug ? plugBlank(tp, shapes, s.material) : null;
  const placed = blank ? mirrorInPlace(shapes).map((sh) => transformShape(sh, [1, 0, 0, 1, -blank.x0, -blank.y0])) : shapes;
  const groups = groupsOf(placed)
    .map((g) => g.filter((p) => p.closed))
    .filter((g) => g.length);
  if (!groups.length) throw new Error('NO_CLOSED');
  const common = {
    groups,
    angle: tool.angle ?? 60,
    stepDown: tp.params.stepDown,
    feedRate: tp.params.feedRate,
    plungeRate: tp.params.plungeRate,
    spindleRpm: tp.params.spindleRpm ?? 18000,
    post: postFor(getMachine()),
  };
  if (tp.operation === 'vcarve') {
    // Aldrig djupare än konen: där bortom blir det plan botten i stället.
    return { ...common, mode: 'pocket', maxDepth: vcarveMaxDepth(tp, tool), startDepth: 0, margin: 0, contourStep: tp.contourStep, strategy: tp.strategy };
  }
  return {
    ...common,
    mode: tp.part,
    maxDepth: tp.part === 'pocket' ? tp.pocketDepth : tp.plugDepth,
    startDepth: tp.startDepth,
    margin: tp.margin,
    contourStep: tp.contourStep,
    // Fickans botten döljs under limspalten och pluggens spillyta planas bort –
    // där räcker glesare pass, så länge åsarna inte når pluggen eller ytan.
    flatRidge: Math.max(0.05, Math.min(1, 0.4 * (tp.part === 'pocket' ? tp.pocketDepth - tp.startDepth : tp.plugDepth - tp.startDepth))),
  };
}

function buildRasterJob(tp: ToolpathConfig): RasterJob {
  if (tp.operation !== 'laserRaster') throw new Error('NOT_IMPLEMENTED');
  const machine = getMachine();
  const src = imageForToolpath(tp.imageId, tp.origin, tp.widthMm);
  const width = Math.max(1, Math.round(src.widthMm / tp.lineIntervalMm));
  const height = Math.max(1, Math.round(width * src.aspect));
  return {
    gray: rasterizeGray(src.source, width, height),
    width,
    height,
    method: tp.dither,
    threshold: tp.threshold,
    pixelSizeMm: tp.lineIntervalMm,
    originX: src.origin.x,
    originY: src.origin.y,
    feedRate: tp.params.feedRate,
    laserS: ((tp.params.laserPowerPct ?? 30) / 100) * (machine.laser?.sMax ?? 1000),
    post: postFor(machine),
  };
}

function buildReliefJob(tp: ToolpathConfig): ReliefJob {
  if (tp.operation !== 'relief') throw new Error('NOT_IMPLEMENTED');
  const s = useAppStore.getState();
  const relief = s.reliefs.find((r) => r.id === tp.reliefId);
  if (!relief) throw new Error('RELIEF_MISSING');
  const tool = s.tools.find((t) => t.id === tp.toolId);
  if (!tool || tool.kind === 'laser' || tool.kind === 'drill') throw new Error('WRONG_TOOL');
  const hm = heightmapFor(relief);
  // Pluggen i ett reliefinlägg fräses i eget inläggsträ: nollpunkten i dess nedre vänstra hörn.
  const blank = relief.plug ? reliefPlugBlank(relief, s.material) : null;
  return {
    heights: hm.heights,
    nx: hm.nx,
    ny: hm.ny,
    x: blank ? relief.x - blank.x0 : relief.x,
    y: blank ? relief.y - blank.y0 : relief.y,
    width: relief.width,
    height: relief.height,
    depth: relief.depth,
    tool: { kind: tool.kind, diameter: tool.diameter, angle: tool.angle },
    stepOverMm: Math.max(0.02, tool.diameter * tp.params.stepOver),
    roughStepOverMm: Math.max(0.1, tool.diameter * 0.4),
    direction: tp.direction,
    roughing: tp.roughing,
    stepDown: tp.params.stepDown,
    allowance: tp.allowance,
    feedRate: tp.params.feedRate,
    plungeRate: tp.params.plungeRate,
    spindleRpm: tp.params.spindleRpm ?? 18000,
    post: postFor(getMachine()),
  };
}

/**
 * Räknar om verktygsbanor automatiskt när deras former, reliefer, material
 * eller verktyg ändras (t.ex. efter flytt, nodredigering eller ångra).
 */
export function watchForChanges() {
  return useAppStore.subscribe((s, prev) => {
    if (s.layers === prev.layers && s.reliefs === prev.reliefs && s.tools === prev.tools && s.machineId === prev.machineId && s.material === prev.material && s.toolpaths === prev.toolpaths && s.images === prev.images) return;
    const prevShapes = new Map(allShapes(prev.layers).map((sh) => [sh.id, sh]));
    const changedShapes = new Set(allShapes(s.layers).filter((sh) => prevShapes.get(sh.id) !== sh).map((sh) => sh.id));
    for (const id of prevShapes.keys()) if (!allShapes(s.layers).some((x) => x.id === id)) changedShapes.add(id);
    const prevTp = new Map(prev.toolpaths.map((t) => [t.id, t]));
    const global = s.tools !== prev.tools || s.machineId !== prev.machineId || s.material.thickness !== prev.material.thickness;
    for (const tp of s.toolpaths) {
      // Nya banor (skapade, inlästa med projektet, återställda med ångra) räknas
      // av den som lade till dem – annars räknas allt två gånger när ett projekt
      // laddas, eftersom maskin, verktyg och material byts samtidigt.
      if (!prevTp.has(tp.id)) continue;
      // Även under en pågående beräkning: den nya ersätter den gamla.
      const configChanged = prevTp.get(tp.id) !== tp && prevTp.has(tp.id);
      const reliefChanged =
        (tp.operation === 'relief' && s.reliefs !== prev.reliefs) ||
        (tp.operation === 'facing' && tp.area === 'stock' && s.material !== prev.material) ||
        ((tp.operation === 'laserRaster' || tp.operation === 'penImage') && s.images[tp.imageId] !== prev.images[tp.imageId]);
      if (global || configChanged || reliefChanged || tp.shapeIds.some((id) => changedShapes.has(id))) scheduleCompute(tp.id, 400);
    }
  });
}
