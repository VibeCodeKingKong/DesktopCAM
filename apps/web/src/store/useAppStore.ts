import { useMemo } from 'react';
import { create } from 'zustand';
import { effectiveMaterial } from '@desktopcam/core';
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
import type { MeasureRef } from '../cam/commands';

export type RibbonTabId = 'file' | 'design' | 'setup' | 'toolpaths' | 'simulate' | 'output';
export type ViewCommand = 'fit' | 'fitStock' | 'top' | 'iso' | 'front' | 'zoomIn' | 'zoomOut';
export type EditTool = 'select' | 'nodes' | 'line' | 'curve' | 'rect' | 'circle' | 'text' | 'tabs' | 'fillet' | 'measure';
export type DialogId = 'machineSetup' | 'gcodeViewer' | 'importFile' | 'reliefLibrary' | 'text' | 'gear' | 'imageRelief' | 'about' | 'pattern' | 'shapeLibrary';
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
  /** Lagret som nya former hamnar i (saknas = första lagret). */
  activeLayerId: string | null;
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
  measureRef: MeasureRef | null;
  setMeasureRef: (r: MeasureRef | null) => void;
  /** Byt vilken av de två formerna som står still. */
  measureSwapped: boolean;
  setMeasureSwapped: (v: boolean) => void;
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
  toggleToolFavorite: (id: string) => void;
  /** Flyttar verktyget `id` till platsen där `overId` står. */
  moveTool: (id: string, overId: string) => void;
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
  addLayer: (name: string) => void;
  renameLayer: (id: string, name: string) => void;
  /** Tar bort lagret och dess former. */
  removeLayer: (id: string) => void;
  setActiveLayer: (id: string) => void;
  moveShapesToLayer: (ids: string[], layerId: string) => void;
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
  /** Flyttar en bana i listan (körordningen). Numren i standardnamnen följer med. */
  moveToolpath: (from: number, to: number) => void;
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

/** Laser och plasma har egna verktyg; fräsen tar allt annat. */
export const toolFitsMachine = (tool: ToolDefinition['kind'], machine: MachineProfile['kind']) =>
  machine === 'laser' ? tool === 'laser' : machine === 'plasma' ? tool === 'plasma' : tool !== 'laser' && tool !== 'plasma';

/** Behåll aktivt verktyg om det passar maskinen, annars välj första som passar. */
/** Favoriter först, annars bibliotekets ordning. */
export const favoritesFirst = (tools: ToolDefinition[]) => [...tools.filter((t) => t.favorite), ...tools.filter((t) => !t.favorite)];

const toolFor = (tools: ToolDefinition[], current: string, kind: MachineProfile['kind']) => {
  const fits = (t: ToolDefinition) => toolFitsMachine(t.kind, kind);
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
    activeLayerId: null,
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
    measureRef: null,
    setMeasureRef: (measureRef) => set({ measureRef }),
    measureSwapped: false,
    setMeasureSwapped: (measureSwapped) => set({ measureSwapped }),
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
    toggleToolFavorite: (id) => set((s) => ({ tools: s.tools.map((t) => (t.id === id ? { ...t, favorite: !t.favorite } : t)) })),
    moveTool: (id, overId) =>
      set((s) => {
        const from = s.tools.findIndex((t) => t.id === id);
        const to = s.tools.findIndex((t) => t.id === overId);
        if (from < 0 || to < 0 || from === to) return {};
        const tools = [...s.tools];
        const [tool] = tools.splice(from, 1);
        tools.splice(to, 0, tool);
        return { ...push(s), tools };
      }),
    setMaterial: (patch) => set((s) => ({ material: { ...s.material, ...patch } })),

    setEditTool: (editTool) => set({ editTool, selectedNode: null, textAnchor: null }),
    setSnap: (patch) => set((s) => ({ snap: { ...s.snap, ...patch } })),
    setTextAnchor: (textAnchor) => set({ textAnchor }),
    addShape: (shape) =>
      set((s) => {
        const target = s.layers.find((l) => l.id === s.activeLayerId) ?? s.layers[0];
        const layers = s.layers.length
          ? s.layers.map((l) => (l === target ? { ...l, shapes: [...l.shapes, shape] } : l))
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
    addLayer: (name) =>
      set((s) => {
        const colors = ['#0071e3', '#2e9d5b', '#b35ad6', '#d4572a', '#0b8f9c', '#8a6d1d'];
        const layer: VectorLayer = { id: `layer_${Date.now()}`, name, color: colors[s.layers.length % colors.length], visible: true, locked: false, shapes: [] };
        return { ...push(s), layers: [...s.layers, layer], activeLayerId: layer.id };
      }),
    renameLayer: (id, name) => set((s) => ({ ...push(s), layers: s.layers.map((l) => (l.id === id ? { ...l, name } : l)) })),
    removeLayer: (id) =>
      set((s) => {
        const gone = new Set(s.layers.find((l) => l.id === id)?.shapes.map((sh) => sh.id) ?? []);
        return {
          ...push(s),
          layers: s.layers.filter((l) => l.id !== id),
          activeLayerId: s.activeLayerId === id ? null : s.activeLayerId,
          selectedShapeIds: s.selectedShapeIds.filter((x) => !gone.has(x)),
          selectedNode: null,
          toolpaths: s.toolpaths.map((t) => (t.shapeIds.some((x) => gone.has(x)) ? { ...t, shapeIds: t.shapeIds.filter((x) => !gone.has(x)) } : t)),
        };
      }),
    setActiveLayer: (activeLayerId) => set({ activeLayerId }),
    moveShapesToLayer: (ids, layerId) =>
      set((s) => {
        const moving = s.layers.flatMap((l) => l.shapes.filter((sh) => ids.includes(sh.id) && l.id !== layerId));
        if (!moving.length) return {};
        return {
          ...push(s),
          layers: s.layers.map((l) => (l.id === layerId ? { ...l, shapes: [...l.shapes, ...moving] } : { ...l, shapes: l.shapes.filter((sh) => !moving.includes(sh)) })),
        };
      }),
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
    moveToolpath: (from, to) =>
      set((s) => {
        if (from === to || from < 0 || to < 0 || from >= s.toolpaths.length || to >= s.toolpaths.length) return {};
        const list = [...s.toolpaths];
        const [tp] = list.splice(from, 1);
        list.splice(to, 0, tp);
        // "3. Ficka" → nytt nummer efter platsen; egna namn lämnas orörda.
        return { ...push(s), toolpaths: list.map((t, i) => (/^\d+\. /.test(t.name) ? { ...t, name: t.name.replace(/^\d+\. /, `${i + 1}. `) } : t)) };
      }),
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

/**
 * Maskinklass för tips: lätta fräsar (MPCNC, LowRider, 3018) tål inte samma
 * skärdata som styva (Shapeoko, LongMill, Onefinity, 4040), och lasrar skiljer
 * sig mycket mellan 10 W och 20–40 W.
 */
export type MachineClass = 'routerLight' | 'routerRigid' | 'laserLow' | 'laserHigh' | 'plasma';
export function machineClass(m: MachineProfile): MachineClass {
  if (m.kind === 'laser') return (m.laser?.opticalPowerW ?? 0) >= 20 ? 'laserHigh' : 'laserLow';
  if (m.kind === 'plasma') return 'plasma';
  return m.maxFeed.xy >= 3000 || /4040|shapeoko|longmill|onefinity/i.test(m.name) ? 'routerRigid' : 'routerLight';
}

/** Avancerade inställningar visas bara när nybörjarläget är av. */
export const useExpert = () => !useAppStore((s) => s.beginnerMode);

export const getMachine = () => {
  const s = useAppStore.getState();
  return s.machines.find((m) => m.id === s.machineId) ?? s.machines[0];
};
/** Materialets riktvärden anpassade efter vald maskin och tjocklek (React). */
export const useEffectiveMaterial = () => {
  const preset = useMaterialPreset();
  const machine = useMachine();
  const thickness = useAppStore((s) => s.material.thickness);
  return useMemo(() => effectiveMaterial(preset, machine, thickness), [preset, machine, thickness]);
};

/** Materialets riktvärden anpassade efter vald maskin och tjocklek. */
export const getEffectiveMaterial = () => {
  const s = useAppStore.getState();
  return effectiveMaterial(getMaterialPreset(), getMachine(), s.material.thickness);
};
export const getMaterialPreset = () => {
  const s = useAppStore.getState();
  return s.materials.find((m) => m.id === s.material.presetId) ?? s.materials[0];
};
export const allShapes = (layers: VectorLayer[]) => layers.flatMap((l) => l.shapes);
