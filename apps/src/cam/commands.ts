/**
 * Kommandon som Ribbon, kortkommandon och paneler anropar.
 * Samlade här så att samma handling alltid beter sig likadant.
 */
import {
  detectFormat,
  getReliefDefinition,
  makeCircle,
  makeGear,
  makeRect,
  uid,
  type OperationType,
  type ToolpathConfig,
} from '@desktopcam/core';
import { getMachine, getMaterialPreset, useAppStore } from '../store/useAppStore';
import { downloadText, pickFile, slug } from '../utils/download';
import { computeToolpath } from './toolpathService';

const OPERATION_NAMES: Record<OperationType, string> = {
  profile: 'Profil',
  pocket: 'Ficka',
  drill: 'Borrning',
  vcarve: 'V-gravyr',
  laserCut: 'Laserskärning',
  laserRaster: 'Fotogravyr',
  relief: '3D-relief',
};

export const isLaserOperation = (op: OperationType) => op === 'laserCut' || op === 'laserRaster';
export const isImplemented = (op: OperationType) =>
  op === 'profile' || op === 'laserCut' || op === 'laserRaster' || op === 'relief';

/* ───────── Design ───────── */

function centerOfStock() {
  const { material } = useAppStore.getState();
  return { cx: material.width / 2, cy: material.height / 2 };
}

export function addRectangle() {
  const { cx, cy } = centerOfStock();
  useAppStore.getState().addShape(makeRect('Rektangel', cx - 40, cy - 25, 80, 50));
  useAppStore.getState().setStatus('Rektangel 80 × 50 mm tillagd');
}

export function addCircle() {
  const { cx, cy } = centerOfStock();
  useAppStore.getState().addShape(makeCircle('Cirkel', cx, cy, 25));
  useAppStore.getState().setStatus('Cirkel Ø 50 mm tillagd');
}

export function addGear() {
  const { cx, cy } = centerOfStock();
  useAppStore.getState().addShape(makeGear('Kugghjul', cx, cy, 40, 33, 14));
  useAppStore.getState().setStatus('Kugghjul tillagt');
}

export function notYet(feature: string) {
  useAppStore.getState().setStatus(`${feature} finns inte i prototypen ännu`);
}

/* ───────── Verktygsbanor ───────── */

export function createToolpath(operation: OperationType, extra: Partial<ToolpathConfig> = {}): string | null {
  const s = useAppStore.getState();
  const machine = getMachine();
  const preset = getMaterialPreset();

  if (!isImplemented(operation)) {
    notYet(OPERATION_NAMES[operation]);
    return null;
  }
  if (isLaserOperation(operation) !== (machine.kind === 'laser')) {
    s.setStatus(
      machine.kind === 'laser'
        ? `${OPERATION_NAMES[operation]} kräver en fräs – byt maskin under Inställning`
        : `${OPERATION_NAMES[operation]} kräver en laser – byt maskin under Inställning`,
    );
    return null;
  }

  const allShapeIds = s.layers.flatMap((l) => l.shapes.map((sh) => sh.id));
  const shapeIds = s.selectedShapeIds.length ? s.selectedShapeIds : allShapeIds;
  if (operation === 'relief' && !s.reliefs.length) {
    s.setStatus('Lägg till en relief från reliefbiblioteket först');
    return null;
  }
  if (!shapeIds.length && operation !== 'laserRaster' && operation !== 'relief') {
    s.setStatus('Rita eller importera en form först');
    return null;
  }

  const id = uid('tp');
  const n = s.toolpaths.length + 1;
  const base = { id, shapeIds, visible: true };
  let tp: ToolpathConfig;

  if (operation === 'relief') {
    const relief = s.reliefs.find((r) => r.id === s.selectedReliefId) ?? s.reliefs[s.reliefs.length - 1];
    const active = s.tools.find((t) => t.id === s.activeToolId);
    const tool = active && (active.kind === 'ballnose' || active.kind === 'endmill') ? active : s.tools.find((t) => t.kind === 'ballnose')!;
    const r = preset.router;
    tp = {
      ...base,
      shapeIds: [],
      operation,
      name: `${n}. Relief: ${relief.name}`,
      toolId: tool.id,
      reliefId: relief.id,
      direction: 'x',
      roughing: relief.depth > tool.defaults.stepDown,
      allowance: 0.3,
      params: {
        ...tool.defaults,
        stepOver: tool.kind === 'ballnose' ? 0.12 : tool.defaults.stepOver,
        feedRate: r?.feedRate ?? tool.defaults.feedRate,
        plungeRate: r?.plungeRate ?? tool.defaults.plungeRate,
        spindleRpm: r?.spindleRpm ?? tool.defaults.spindleRpm,
      },
    };
  } else if (operation === 'profile') {
    const tool =
      s.tools.find((t) => t.id === s.activeToolId && t.kind !== 'laser') ?? s.tools.find((t) => t.kind === 'endmill')!;
    const r = preset.router;
    tp = {
      ...base,
      operation,
      name: `${n}. Profil`,
      toolId: tool.id,
      side: 'outside',
      cutDepth: s.material.thickness,
      tabs: { enabled: false, count: 4, width: 6, height: 2 },
      params: {
        ...tool.defaults,
        feedRate: r?.feedRate ?? tool.defaults.feedRate,
        plungeRate: r?.plungeRate ?? tool.defaults.plungeRate,
        spindleRpm: r?.spindleRpm ?? tool.defaults.spindleRpm,
        stepDown: r ? +(tool.diameter * r.stepDownFactor).toFixed(2) : tool.defaults.stepDown,
      },
    };
  } else if (operation === 'laserCut') {
    const tool = s.tools.find((t) => t.kind === 'laser')!;
    tp = {
      ...base,
      operation,
      name: `${n}. Laserskärning`,
      toolId: tool.id,
      side: 'outside',
      kerf: 0.15,
      passes: preset.laser.cutPasses,
      params: { ...tool.defaults, feedRate: preset.laser.cutSpeed, laserPowerPct: preset.laser.cutPowerPct },
    };
  } else {
    const tool = s.tools.find((t) => t.kind === 'laser')!;
    tp = {
      ...base,
      shapeIds: [],
      operation: 'laserRaster',
      name: `${n}. Fotogravyr`,
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

  Object.assign(tp, extra);
  s.addToolpath(tp);
  void computeToolpath(id);
  return id;
}

export async function importPhotoForEngraving() {
  if (getMachine().kind !== 'laser') {
    useAppStore.getState().setStatus('Fotogravyr kräver en laser – välj t.ex. Creality Falcon2 under Inställning');
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
  const f = file ?? (await pickFile('.svg,.dxf,image/svg+xml'));
  if (!f) return;
  const text = await f.text();
  const format = detectFormat(f.name, text);
  if (!format) {
    useAppStore.getState().setStatus(`${f.name} är varken SVG eller DXF`);
    return;
  }
  useAppStore.getState().setPendingImport({ fileName: f.name, format, text });
  useAppStore.getState().openDialog('importFile');
}

/* ───────── Reliefer ───────── */

export function addRelief(reliefId: string, size: { width: number; height: number; depth: number }, options: { invert: boolean; mirror: boolean }) {
  const s = useAppStore.getState();
  const def = getReliefDefinition(reliefId);
  if (!def) return;
  const x = Math.max(0, (s.material.width - size.width) / 2);
  const y = Math.max(0, (s.material.height - size.height) / 2);
  const n = s.reliefs.filter((r) => r.reliefId === reliefId).length + 1;
  s.addRelief({
    id: uid('relief'),
    name: n > 1 ? `${def.name} ${n}` : def.name,
    reliefId,
    x,
    y,
    ...size,
    ...options,
    visible: true,
  });
  if (size.depth > s.material.thickness) s.setStatus(`Varning: ${def.name} är djupare än materialet`);
  else s.setStatus(`${def.name} placerad mitt på materialet`);
}

/* ───────── Export ───────── */

export function exportSelectedGcode() {
  const s = useAppStore.getState();
  const tp = s.toolpaths.find((t) => t.id === s.selectedToolpathId) ?? s.toolpaths[0];
  const result = tp && s.results[tp.id];
  if (!tp || !result) {
    s.setStatus('Det finns ingen beräknad verktygsbana att spara');
    return;
  }
  const filename = `${slug(s.projectName)}-${slug(tp.name)}.gcode`;
  downloadText(filename, result.gcode);
  s.setStatus(`Sparade ${filename}`);
}
