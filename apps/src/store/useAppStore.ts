import { create } from 'zustand';
import type {
  ImportFormat,
  ReliefInstance,
  EngineInfo,
  MachineProfile,
  MaterialPreset,
  MaterialSetup,
  ToolDefinition,
  ToolpathConfig,
  ToolpathStats,
  Vec3,
  VectorLayer,
  VectorShape,
} from '@desktopcam/core';
import machinesJson from '../data/machines.json';
import toolsJson from '../data/tools.json';
import materialsJson from '../data/materials.json';
import { createDemoLayers } from '../data/demoProject';

export type RibbonTabId = 'file' | 'design' | 'setup' | 'toolpaths' | 'simulate' | 'output';
export type ViewCommand = 'fit' | 'top' | 'iso' | 'front' | 'zoomIn' | 'zoomOut';

export interface ToolpathResult {
  gcode: string;
  rapids: Float32Array;
  cuts: Float32Array;
  stats: ToolpathStats;
  engine: EngineInfo['engine'];
  computedAt: number;
}

export interface RasterSource {
  id: string;
  name: string;
  bitmap: ImageBitmap;
}

export interface PendingImport {
  fileName: string;
  format: ImportFormat;
  text: string;
}

export type DialogId = 'machineSetup' | 'gcodeViewer' | 'importFile' | 'reliefLibrary';

export interface JobProgress {
  value: number;
  message?: string;
}

interface AppState {
  theme: 'light' | 'dark';
  beginnerMode: boolean;
  activeTab: RibbonTabId;
  ribbonCollapsed: boolean;
  projectName: string;

  machines: MachineProfile[];
  machineId: string;
  tools: ToolDefinition[];
  activeToolId: string;
  materials: MaterialPreset[];
  material: MaterialSetup;

  layers: VectorLayer[];
  selectedShapeIds: string[];
  reliefs: ReliefInstance[];
  selectedReliefId: string | null;
  pendingImport: PendingImport | null;

  toolpaths: ToolpathConfig[];
  selectedToolpathId: string | null;
  results: Record<string, ToolpathResult>;
  progress: Record<string, JobProgress>;
  errors: Record<string, string>;
  images: Record<string, RasterSource>;

  view: { showToolpaths: boolean; showRapids: boolean; showStock: boolean };
  viewCommand: { kind: ViewCommand; nonce: number } | null;
  cursor: Vec3 | null;
  status: string;
  engine: EngineInfo | null;
  dialog: DialogId | null;

  setTheme: (t: 'light' | 'dark') => void;
  toggleBeginnerMode: () => void;
  setTab: (t: RibbonTabId) => void;
  toggleRibbon: () => void;
  setMachine: (id: string) => void;
  saveMachine: (m: MachineProfile) => void;
  setActiveTool: (id: string) => void;
  setMaterial: (patch: Partial<MaterialSetup>) => void;
  addShape: (shape: VectorShape) => void;
  addLayers: (layers: VectorLayer[]) => void;
  toggleLayer: (id: string) => void;
  addRelief: (relief: ReliefInstance) => void;
  updateRelief: (id: string, patch: Partial<ReliefInstance>) => void;
  removeRelief: (id: string) => void;
  selectRelief: (id: string | null) => void;
  setPendingImport: (p: PendingImport | null) => void;
  selectShape: (id: string, additive: boolean) => void;
  clearSelection: () => void;
  addToolpath: (tp: ToolpathConfig) => void;
  updateToolpath: (id: string, patch: Partial<ToolpathConfig>) => void;
  removeToolpath: (id: string) => void;
  selectToolpath: (id: string | null) => void;
  setResult: (id: string, r: ToolpathResult) => void;
  setProgress: (id: string, p: JobProgress | null) => void;
  setError: (id: string, message: string | null) => void;
  addImage: (img: RasterSource) => void;
  setView: (patch: Partial<AppState['view']>) => void;
  sendViewCommand: (kind: ViewCommand) => void;
  setCursor: (p: Vec3 | null) => void;
  setStatus: (s: string) => void;
  setEngine: (e: EngineInfo) => void;
  openDialog: (d: AppState['dialog']) => void;
  newProject: () => void;
}

const machines = machinesJson as MachineProfile[];
const materials = materialsJson as MaterialPreset[];
const prefersDark = typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;

const without = <T,>(rec: Record<string, T>, key: string): Record<string, T> => {
  const next = { ...rec };
  delete next[key];
  return next;
};

/** Behåll aktivt verktyg om det passar maskinen, annars välj första som passar. */
const toolFor = (tools: ToolDefinition[], current: string, kind: MachineProfile['kind']) => {
  const fits = (t: ToolDefinition) => (kind === 'laser' ? t.kind === 'laser' : t.kind !== 'laser');
  const cur = tools.find((t) => t.id === current);
  return cur && fits(cur) ? cur.id : (tools.find(fits)?.id ?? current);
};

export const useAppStore = create<AppState>()((set) => ({
  theme: prefersDark ? 'dark' : 'light',
  beginnerMode: true,
  activeTab: 'toolpaths',
  ribbonCollapsed: false,
  projectName: 'Namnlöst projekt',

  machines,
  machineId: machines[0].id,
  tools: toolsJson as ToolDefinition[],
  activeToolId: 'em-3175-2f',
  materials,
  material: { presetId: 'pine', width: 300, height: 200, thickness: 18, zZero: 'top', origin: 'bottom-left' },

  layers: createDemoLayers(),
  selectedShapeIds: [],
  reliefs: [],
  selectedReliefId: null,
  pendingImport: null,

  toolpaths: [],
  selectedToolpathId: null,
  results: {},
  progress: {},
  errors: {},
  images: {},

  view: { showToolpaths: true, showRapids: true, showStock: true },
  viewCommand: null,
  cursor: null,
  status: 'Klar',
  engine: null,
  dialog: null,

  setTheme: (theme) => set({ theme }),
  toggleBeginnerMode: () => set((s) => ({ beginnerMode: !s.beginnerMode })),
  setTab: (activeTab) => set({ activeTab, ribbonCollapsed: false }),
  toggleRibbon: () => set((s) => ({ ribbonCollapsed: !s.ribbonCollapsed })),
  setMachine: (machineId) =>
    set((s) => {
      const m = s.machines.find((x) => x.id === machineId);
      return { machineId, activeToolId: m ? toolFor(s.tools, s.activeToolId, m.kind) : s.activeToolId };
    }),
  saveMachine: (m) =>
    set((s) => ({
      machines: s.machines.some((x) => x.id === m.id) ? s.machines.map((x) => (x.id === m.id ? m : x)) : [...s.machines, m],
      machineId: m.id,
      activeToolId: toolFor(s.tools, s.activeToolId, m.kind),
    })),
  setActiveTool: (activeToolId) => set({ activeToolId }),
  setMaterial: (patch) => set((s) => ({ material: { ...s.material, ...patch } })),

  addShape: (shape) =>
    set((s) => ({
      layers: s.layers.map((l, i) => (i === 0 ? { ...l, shapes: [...l.shapes, shape] } : l)),
      selectedShapeIds: [shape.id],
    })),
  addLayers: (layers) =>
    set((s) => ({
      layers: [...s.layers, ...layers],
      selectedShapeIds: layers.flatMap((l) => l.shapes.map((sh) => sh.id)),
      selectedToolpathId: null,
      selectedReliefId: null,
    })),
  toggleLayer: (id) => set((s) => ({ layers: s.layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)) })),
  addRelief: (relief) => set((s) => ({ reliefs: [...s.reliefs, relief], selectedReliefId: relief.id, selectedToolpathId: null })),
  updateRelief: (id, patch) => set((s) => ({ reliefs: s.reliefs.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
  removeRelief: (id) =>
    set((s) => ({
      reliefs: s.reliefs.filter((r) => r.id !== id),
      selectedReliefId: s.selectedReliefId === id ? null : s.selectedReliefId,
    })),
  selectRelief: (selectedReliefId) =>
    set((s) => ({ selectedReliefId, selectedToolpathId: selectedReliefId ? null : s.selectedToolpathId })),
  setPendingImport: (pendingImport) => set({ pendingImport }),
  selectShape: (id, additive) =>
    set((s) => {
      if (!additive) return { selectedShapeIds: s.selectedShapeIds.length === 1 && s.selectedShapeIds[0] === id ? [] : [id] };
      return {
        selectedShapeIds: s.selectedShapeIds.includes(id)
          ? s.selectedShapeIds.filter((x) => x !== id)
          : [...s.selectedShapeIds, id],
      };
    }),
  clearSelection: () => set({ selectedShapeIds: [] }),

  addToolpath: (tp) => set((s) => ({ toolpaths: [...s.toolpaths, tp], selectedToolpathId: tp.id, selectedReliefId: null })),
  updateToolpath: (id, patch) =>
    set((s) => ({
      toolpaths: s.toolpaths.map((t) => (t.id === id ? ({ ...t, ...patch } as ToolpathConfig) : t)),
    })),
  removeToolpath: (id) =>
    set((s) => ({
      toolpaths: s.toolpaths.filter((t) => t.id !== id),
      results: without(s.results, id),
      progress: without(s.progress, id),
      errors: without(s.errors, id),
      selectedToolpathId: s.selectedToolpathId === id ? null : s.selectedToolpathId,
    })),
  selectToolpath: (selectedToolpathId) =>
    set((s) => ({ selectedToolpathId, selectedReliefId: selectedToolpathId ? null : s.selectedReliefId })),
  setResult: (id, r) => set((s) => ({ results: { ...s.results, [id]: r }, errors: without(s.errors, id) })),
  setProgress: (id, p) => set((s) => ({ progress: p ? { ...s.progress, [id]: p } : without(s.progress, id) })),
  setError: (id, message) => set((s) => ({ errors: message ? { ...s.errors, [id]: message } : without(s.errors, id) })),
  addImage: (img) => set((s) => ({ images: { ...s.images, [img.id]: img } })),

  setView: (patch) => set((s) => ({ view: { ...s.view, ...patch } })),
  sendViewCommand: (kind) => set({ viewCommand: { kind, nonce: Date.now() } }),
  setCursor: (cursor) => set({ cursor }),
  setStatus: (status) => set({ status }),
  setEngine: (engine) => set({ engine }),
  openDialog: (dialog) => set({ dialog }),
  newProject: () =>
    set({
      projectName: 'Namnlöst projekt',
      layers: [{ id: 'layer_1', name: 'Lager 1', color: '#0071e3', visible: true, locked: false, shapes: [] }],
      selectedShapeIds: [],
      reliefs: [],
      selectedReliefId: null,
      toolpaths: [],
      results: {},
      progress: {},
      errors: {},
      selectedToolpathId: null,
      status: 'Nytt projekt skapat',
    }),
}));

/* ───────── Härledda selektorer ───────── */

export const useMachine = () => useAppStore((s) => s.machines.find((m) => m.id === s.machineId) ?? s.machines[0]);
export const useMaterialPreset = () =>
  useAppStore((s) => s.materials.find((m) => m.id === s.material.presetId) ?? s.materials[0]);
export const useSelectedRelief = () => useAppStore((s) => s.reliefs.find((r) => r.id === s.selectedReliefId) ?? null);
export const useSelectedToolpath = () =>
  useAppStore((s) => s.toolpaths.find((t) => t.id === s.selectedToolpathId) ?? null);

export const getMachine = () => {
  const s = useAppStore.getState();
  return s.machines.find((m) => m.id === s.machineId) ?? s.machines[0];
};
export const getMaterialPreset = () => {
  const s = useAppStore.getState();
  return s.materials.find((m) => m.id === s.material.presetId) ?? s.materials[0];
};
