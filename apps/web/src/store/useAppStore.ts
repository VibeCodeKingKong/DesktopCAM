import { create } from 'zustand';
import type {
  EngineInfo,
  ImportFormat,
  MachineProfile,
  MaterialPreset,
  MaterialSetup,
  ReliefInstance,
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
import { initialLanguage, type Language } from '../i18n/initial';

export type RibbonTabId = 'file' | 'design' | 'setup' | 'toolpaths' | 'simulate' | 'output';
export type ViewCommand = 'fit' | 'top' | 'iso' | 'front' | 'zoomIn' | 'zoomOut';
export type EditTool = 'select' | 'nodes' | 'line' | 'curve' | 'rect' | 'circle' | 'text' | 'tabs' | 'fillet' | 'measure';
export type DialogId = 'machineSetup' | 'gcodeViewer' | 'importFile' | 'reliefLibrary' | 'text' | 'gear' | 'imageRelief';
export type MobilePanel = 'tree' | 'props' | null;

export interface ToolpathResult {
  gcode: string;
  rapids: Float32Array;
  cuts: Float32Array;
  stats: ToolpathStats;
  engine: EngineInfo['engine'];
  computedAt: number;
  /** Varningar från kontrollerna efter beräkningen (t.ex. verktyget når inte). */
  warnings?: string[];
}

export interface RasterSource {
  id: string;
  name: string;
  bitmap: ImageBitmap;
}

export interface JobProgress {
  value: number;
  message?: string;
}

export interface PendingImport {
  fileName: string;
  format: ImportFormat;
  text: string;
}

/** Nod i en bana: index 0 = path.start, i = segments[i − 1].to. */
export interface NodeRef {
  shapeId: string;
  pathIndex: number;
  index: number;
}

/** Den del av projektet som ångra/gör om och sparning omfattar. */
export interface DocSnapshot {
  projectName: string;
  layers: VectorLayer[];
  reliefs: ReliefInstance[];
  toolpaths: ToolpathConfig[];
  material: MaterialSetup;
  tools: ToolDefinition[];
}

const HISTORY_LIMIT = 60;

interface AppState extends DocSnapshot {
  language: Language;
  theme: 'light' | 'dark';
  beginnerMode: boolean;
  activeTab: RibbonTabId;
  ribbonCollapsed: boolean;
  mobilePanel: MobilePanel;

  machines: MachineProfile[];
  machineId: string;
  activeToolId: string;
  materials: MaterialPreset[];

  selectedShapeIds: string[];
  selectedNode: NodeRef | null;
  editTool: EditTool;
  snap: { grid: boolean; step: number };
  textAnchor: { x: number; y: number } | null;

  selectedReliefId: string | null;
  pendingImport: PendingImport | null;
  selectedToolpathId: string | null;
  results: Record<string, ToolpathResult>;
  progress: Record<string, JobProgress>;
  errors: Record<string, string>;
  images: Record<string, RasterSource>;

  past: DocSnapshot[];
  future: DocSnapshot[];

  view: { showToolpaths: boolean; showRapids: boolean; showStock: boolean };
  /** Materialsimulering. progress 0–1, duration i sekunder maskintid. */
  sim: { active: boolean; playing: boolean; speed: number; progress: number; duration: number; job: string };
  /** Måttsättning mellan två former: från mitt till mitt eller mellan kanterna. */
  measureMode: 'center' | 'edge';
  setMeasureMode: (m: 'center' | 'edge') => void;
  viewCommand: { kind: ViewCommand; nonce: number } | null;
  cursor: Vec3 | null;
  status: string;
  engine: EngineInfo | null;
  dialog: DialogId | null;
  /** Vilket steg en dialog ska öppnas på (t.ex. 'tools' i maskininställningen). */
  dialogStep: string | null;

  // Gränssnitt
  setLanguage: (l: Language) => void;
  setTheme: (t: 'light' | 'dark') => void;
  toggleBeginnerMode: () => void;
  setTab: (t: RibbonTabId) => void;
  toggleRibbon: () => void;
  setMobilePanel: (p: MobilePanel) => void;
  setView: (patch: Partial<AppState['view']>) => void;
  setSim: (patch: Partial<AppState['sim']>) => void;
  sendViewCommand: (kind: ViewCommand) => void;
  setCursor: (p: Vec3 | null) => void;
  setStatus: (s: string) => void;
  setEngine: (e: EngineInfo) => void;
  openDialog: (d: DialogId | null, step?: string) => void;

  // Historik
  checkpoint: () => void;
  undo: () => boolean;
  redo: () => boolean;
  loadDocument: (doc: Partial<DocSnapshot> & { machineId?: string; customMachines?: MachineProfile[] }) => void;
  newProject: (name: string, layerName: string) => void;
  setProjectName: (name: string) => void;

  // Maskin, verktyg, material
  setMachine: (id: string) => void;
  saveMachine: (m: MachineProfile) => void;
  removeMachine: (id: string) => void;
  setActiveTool: (id: string) => void;
  saveTool: (t: ToolDefinition) => void;
  removeTool: (id: string) => void;
  setMaterial: (patch: Partial<MaterialSetup>) => void;

  // Ritning
  setEditTool: (t: EditTool) => void;
  setSnap: (patch: Partial<AppState['snap']>) => void;
  setTextAnchor: (p: { x: number; y: number } | null) => void;
  addShape: (shape: VectorShape) => void;
  addLayers: (layers: VectorLayer[]) => void;
  /** Ersätter former. history: false vid dragning (checkpoint tas vid start). */
  replaceShapes: (shapes: VectorShape[], history?: boolean) => void;
  deleteShapes: (ids: string[]) => void;
  toggleLayer: (id: string) => void;
  selectShape: (id: string, additive: boolean) => void;
  setSelection: (ids: string[]) => void;
  clearSelection: () => void;
  selectNode: (n: NodeRef | null) => void;
  setPendingImport: (p: PendingImport | null) => void;

  // Reliefer
  addRelief: (relief: ReliefInstance) => void;
  updateRelief: (id: string, patch: Partial<ReliefInstance>) => void;
  removeRelief: (id: string) => void;
  selectRelief: (id: string | null) => void;

  // Verktygsbanor
  addToolpath: (tp: ToolpathConfig) => void;
  updateToolpath: (id: string, patch: Partial<ToolpathConfig>) => void;
  removeToolpath: (id: string) => void;
  selectToolpath: (id: string | null) => void;
  setResult: (id: string, r: ToolpathResult) => void;
  setProgress: (id: string, p: JobProgress | null) => void;
  setError: (id: string, message: string | null) => void;
  addImage: (img: RasterSource) => void;
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

const snapshot = (s: DocSnapshot): DocSnapshot => ({
  projectName: s.projectName,
  layers: s.layers,
  reliefs: s.reliefs,
  toolpaths: s.toolpaths,
  material: s.material,
  tools: s.tools,
});

export const useAppStore = create<AppState>()((set, get) => {
  /** Sparar nuvarande dokument i historiken innan en ändring. */
  const push = (s: AppState) => ({ past: [...s.past, snapshot(s)].slice(-HISTORY_LIMIT), future: [] as DocSnapshot[] });

  return {
    language: initialLanguage(),
    theme: prefersDark ? 'dark' : 'light',
    beginnerMode: true,
    activeTab: 'design',
    ribbonCollapsed: false,
    mobilePanel: null,

    projectName: '',
    machines,
    machineId: machines[0].id,
    tools: toolsJson as ToolDefinition[],
    activeToolId: 'em-3175-2f',
    materials,
    material: { presetId: 'pine', width: 300, height: 200, thickness: 18, zZero: 'top', origin: 'bottom-left' },

    layers: createDemoLayers(),
    selectedShapeIds: [],
    selectedNode: null,
    editTool: 'select',
    snap: { grid: true, step: 1 },
    textAnchor: null,

    reliefs: [],
    selectedReliefId: null,
    pendingImport: null,
    toolpaths: [],
    selectedToolpathId: null,
    results: {},
    progress: {},
    errors: {},
    images: {},

    past: [],
    future: [],

    view: { showToolpaths: true, showRapids: true, showStock: true },
    sim: { active: false, playing: false, speed: 1, progress: 0, duration: 0, job: '' },
    measureMode: 'center',
    setMeasureMode: (measureMode) => set({ measureMode }),
    viewCommand: null,
    cursor: null,
    status: '',
    engine: null,
    dialog: null,
    dialogStep: null,

    setLanguage: (language) => {
      try {
        localStorage.setItem('desktopcam.lang', language);
      } catch {
        /* privat läge */
      }
      document.documentElement.lang = language;
      set({ language });
    },
    setTheme: (theme) => set({ theme }),
    toggleBeginnerMode: () => set((s) => ({ beginnerMode: !s.beginnerMode })),
    setTab: (activeTab) => set({ activeTab, ribbonCollapsed: false }),
    toggleRibbon: () => set((s) => ({ ribbonCollapsed: !s.ribbonCollapsed })),
    setMobilePanel: (mobilePanel) => set({ mobilePanel }),
    setView: (patch) => set((s) => ({ view: { ...s.view, ...patch } })),
    setSim: (patch) => set((s) => ({ sim: { ...s.sim, ...patch } })),
    sendViewCommand: (kind) => set({ viewCommand: { kind, nonce: Date.now() } }),
    setCursor: (cursor) => set({ cursor }),
    setStatus: (status) => set({ status }),
    setEngine: (engine) => set({ engine }),
    openDialog: (dialog, step) => set({ dialog, dialogStep: step ?? null }),

    checkpoint: () => set((s) => push(s)),
    undo: () => {
      const s = get();
      const prev = s.past[s.past.length - 1];
      if (!prev) return false;
      set({ ...prev, past: s.past.slice(0, -1), future: [snapshot(s), ...s.future], selectedNode: null });
      return true;
    },
    redo: () => {
      const s = get();
      const next = s.future[0];
      if (!next) return false;
      set({ ...next, past: [...s.past, snapshot(s)], future: s.future.slice(1), selectedNode: null });
      return true;
    },
    loadDocument: (doc) =>
      set((s) => {
        const customMachines = doc.customMachines ?? [];
        const allMachines = [...s.machines.filter((m) => !customMachines.some((c) => c.id === m.id)), ...customMachines];
        return {
          ...doc,
          machines: allMachines,
          machineId: doc.machineId && allMachines.some((m) => m.id === doc.machineId) ? doc.machineId : s.machineId,
          selectedShapeIds: [],
          selectedNode: null,
          selectedReliefId: null,
          selectedToolpathId: null,
          results: {},
          progress: {},
          errors: {},
          past: [],
          future: [],
        };
      }),
    newProject: (name, layerName) =>
      set((s) => ({
        ...push(s),
        projectName: name,
        layers: [{ id: `layer_${Date.now()}`, name: layerName, color: '#0071e3', visible: true, locked: false, shapes: [] }],
        selectedShapeIds: [],
        selectedNode: null,
        reliefs: [],
        selectedReliefId: null,
        toolpaths: [],
        results: {},
        progress: {},
        errors: {},
        selectedToolpathId: null,
      })),
    setProjectName: (projectName) => set({ projectName }),

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
    removeMachine: (id) =>
      set((s) => {
        const machines = s.machines.filter((m) => m.id !== id || !m.custom);
        const machineId = machines.some((m) => m.id === s.machineId) ? s.machineId : machines[0].id;
        const kind = machines.find((m) => m.id === machineId)!.kind;
        return { machines, machineId, activeToolId: toolFor(s.tools, s.activeToolId, kind) };
      }),
    setActiveTool: (activeToolId) => set({ activeToolId }),
    saveTool: (t) =>
      set((s) => ({
        ...push(s),
        tools: s.tools.some((x) => x.id === t.id) ? s.tools.map((x) => (x.id === t.id ? t : x)) : [...s.tools, t],
      })),
    removeTool: (id) => set((s) => ({ ...push(s), tools: s.tools.filter((t) => t.id !== id) })),
    setMaterial: (patch) => set((s) => ({ material: { ...s.material, ...patch } })),

    setEditTool: (editTool) => set({ editTool, selectedNode: null, textAnchor: null }),
    setSnap: (patch) => set((s) => ({ snap: { ...s.snap, ...patch } })),
    setTextAnchor: (textAnchor) => set({ textAnchor }),
    addShape: (shape) =>
      set((s) => {
        const layers = s.layers.length
          ? s.layers.map((l, i) => (i === 0 ? { ...l, shapes: [...l.shapes, shape] } : l))
          : [{ id: `layer_${Date.now()}`, name: 'Layer 1', color: '#0071e3', visible: true, locked: false, shapes: [shape] }];
        return { ...push(s), layers, selectedShapeIds: [shape.id], selectedToolpathId: null, selectedReliefId: null };
      }),
    addLayers: (layers) =>
      set((s) => ({
        ...push(s),
        layers: [...s.layers, ...layers],
        selectedShapeIds: layers.flatMap((l) => l.shapes.map((sh) => sh.id)),
        selectedToolpathId: null,
        selectedReliefId: null,
      })),
    replaceShapes: (shapes, history = true) =>
      set((s) => {
        const byId = new Map(shapes.map((sh) => [sh.id, sh]));
        return {
          ...(history ? push(s) : {}),
          layers: s.layers.map((l) => (l.shapes.some((sh) => byId.has(sh.id)) ? { ...l, shapes: l.shapes.map((sh) => byId.get(sh.id) ?? sh) } : l)),
        };
      }),
    deleteShapes: (ids) =>
      set((s) => ({
        ...push(s),
        layers: s.layers.map((l) => ({ ...l, shapes: l.shapes.filter((sh) => !ids.includes(sh.id)) })),
        selectedShapeIds: s.selectedShapeIds.filter((id) => !ids.includes(id)),
        selectedNode: null,
        toolpaths: s.toolpaths.map((t) => (t.shapeIds.some((id) => ids.includes(id)) ? { ...t, shapeIds: t.shapeIds.filter((id) => !ids.includes(id)) } : t)),
      })),
    toggleLayer: (id) => set((s) => ({ layers: s.layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)) })),
    selectShape: (id, additive) =>
      set((s) => {
        const base = { selectedToolpathId: null, selectedReliefId: null, selectedNode: null };
        if (!additive) return { ...base, selectedShapeIds: [id] };
        return {
          ...base,
          selectedShapeIds: s.selectedShapeIds.includes(id) ? s.selectedShapeIds.filter((x) => x !== id) : [...s.selectedShapeIds, id],
        };
      }),
    setSelection: (ids) => set({ selectedShapeIds: ids, selectedNode: null, selectedToolpathId: null, selectedReliefId: null }),
    clearSelection: () => set({ selectedShapeIds: [], selectedNode: null }),
    selectNode: (selectedNode) => set({ selectedNode }),
    setPendingImport: (pendingImport) => set({ pendingImport }),

    addRelief: (relief) => set((s) => ({ ...push(s), reliefs: [...s.reliefs, relief], selectedReliefId: relief.id, selectedToolpathId: null, selectedShapeIds: [] })),
    updateRelief: (id, patch) => set((s) => ({ reliefs: s.reliefs.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),
    removeRelief: (id) =>
      set((s) => ({
        ...push(s),
        reliefs: s.reliefs.filter((r) => r.id !== id),
        selectedReliefId: s.selectedReliefId === id ? null : s.selectedReliefId,
      })),
    selectRelief: (selectedReliefId) =>
      set((s) => ({ selectedReliefId, selectedToolpathId: selectedReliefId ? null : s.selectedToolpathId, selectedShapeIds: selectedReliefId ? [] : s.selectedShapeIds })),

    addToolpath: (tp) => set((s) => ({ ...push(s), toolpaths: [...s.toolpaths, tp], selectedToolpathId: tp.id, selectedReliefId: null })),
    updateToolpath: (id, patch) =>
      set((s) => ({ toolpaths: s.toolpaths.map((t) => (t.id === id ? ({ ...t, ...patch } as ToolpathConfig) : t)) })),
    removeToolpath: (id) =>
      set((s) => ({
        ...push(s),
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
  };
});

/* ───────── Härledda selektorer ───────── */

export const useMachine = () => useAppStore((s) => s.machines.find((m) => m.id === s.machineId) ?? s.machines[0]);
export const useMaterialPreset = () => useAppStore((s) => s.materials.find((m) => m.id === s.material.presetId) ?? s.materials[0]);
export const useSelectedRelief = () => useAppStore((s) => s.reliefs.find((r) => r.id === s.selectedReliefId) ?? null);
export const useSelectedToolpath = () => useAppStore((s) => s.toolpaths.find((t) => t.id === s.selectedToolpathId) ?? null);

export const getMachine = () => {
  const s = useAppStore.getState();
  return s.machines.find((m) => m.id === s.machineId) ?? s.machines[0];
};
export const getMaterialPreset = () => {
  const s = useAppStore.getState();
  return s.materials.find((m) => m.id === s.material.presetId) ?? s.materials[0];
};
export const allShapes = (layers: VectorLayer[]) => layers.flatMap((l) => l.shapes);
