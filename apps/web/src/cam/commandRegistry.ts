/**
 * Alla kommandon som kommandosöket (⌘K) kan hitta och köra. Namn och
 * beskrivning kommer från knapparnas texter, så sökningen talar samma språk
 * som bandet. Varje kommando byter också till rätt flik, så att man ser
 * var funktionen finns nästa gång.
 */
import type { MachineKind } from '@desktopcam/core';
import type { Dict } from '../i18n';
import { useAppStore, type DialogId, type EditTool, type RibbonTabId } from '../store/useAppStore';
import {
  createInlay,
  createLineEngraving,
  createToolpath,
  deleteSelection,
  duplicateSelection,
  exportVectors,
  groupSelection,
  importImageForPlotter,
  importPhotoForEngraving,
  importVectorFile,
  newProject,
  openProject,
  redo,
  saveProject,
  selectAllShapes,
  undo,
  ungroupSelection,
} from './commands';
import { combineSelection } from './shapeOps';
import { alignSelection, distributeSelection, type AlignMode } from './align';
import { importGcodeFile } from './gcodeImport';
import { importImage } from './imageObjects';
import { importImageRelief } from './imageRelief';
import { playPause, showFinalResult } from './simController';

export interface Command {
  id: string;
  title: string;
  desc?: string;
  /** Fliken där funktionen finns (visas i listan och öppnas när kommandot körs). */
  tab?: RibbonTabId;
  shortcut?: string;
  run: () => void;
}

type Btn = { label: string; title: string; desc: string };

export function buildCommands(t: Dict, kind: MachineKind): Command[] {
  const s = () => useAppStore.getState();
  const b = t.buttons as unknown as Record<string, Btn>;
  const dialog = (id: DialogId, sub?: string) => () => s().openDialog(id, sub);
  const tool = (x: EditTool) => () => s().setEditTool(x);
  const btn = (key: string, tab: RibbonTabId | undefined, run: () => void, shortcut?: string): Command | null =>
    b[key] ? { id: key, title: b[key].title || b[key].label, desc: b[key].desc, tab, shortcut, run } : null;

  const list: (Command | null)[] = [
    // Arkiv
    btn('newProject', 'file', newProject),
    btn('open', 'file', () => void openProject(), '⌘O'),
    btn('save', 'file', saveProject, '⌘S'),
    btn('recent', 'file', dialog('recent')),
    btn('examples', 'file', dialog('welcome', 'gallery')),
    // Inställning
    btn('machineSetup', 'setup', dialog('machineSetup')),
    btn('calibration', 'setup', dialog('calibration')),
    btn('materials', 'setup', dialog('materials')),
    btn('toolLibrary', 'setup', dialog('machineSetup', 'tools')),
    // Design
    btn('undo', 'design', undo, '⌘Z'),
    btn('redo', 'design', redo, '⇧⌘Z'),
    btn('duplicate', 'design', duplicateSelection, '⌘D'),
    btn('remove', 'design', deleteSelection, '⌫'),
    btn('group', 'design', groupSelection, '⌘G'),
    btn('ungroup', 'design', ungroupSelection, '⇧⌘G'),
    btn('select', 'design', tool('select'), 'V'),
    btn('nodes', 'design', tool('nodes'), 'N'),
    btn('selectAll', 'design', () => selectAllShapes(), '⌘A'),
    btn('line', 'design', tool('line'), 'L'),
    btn('curve', 'design', tool('curve'), 'B'),
    btn('rect', 'design', tool('rect'), 'R'),
    btn('circle', 'design', tool('circle'), 'C'),
    btn('text', 'design', tool('text'), 'T'),
    btn('fillet', 'design', tool('fillet'), 'K'),
    btn('offset', 'design', dialog('offset')),
    btn('union', 'design', () => combineSelection('union')),
    btn('subtract', 'design', () => combineSelection('subtract')),
    btn('intersect', 'design', () => combineSelection('intersect')),
    ...(['left', 'hcenter', 'right', 'top', 'vcenter', 'bottom'] as AlignMode[]).map((m) => ({ id: `align-${m}`, title: `${b.align.label}: ${t.align.modes[m]}`, desc: b.align.desc, tab: 'design' as const, run: () => alignSelection(m) })),
    { id: 'distribute-h', title: t.align.distribute.h, desc: t.align.distributeDesc, tab: 'design', run: () => distributeSelection('h') },
    { id: 'distribute-v', title: t.align.distribute.v, desc: t.align.distributeDesc, tab: 'design', run: () => distributeSelection('v') },
    { id: 'nest', title: t.nesting.title, desc: t.nesting.menuDesc, tab: 'design', run: dialog('nest') },
    btn('pattern', 'design', dialog('pattern')),
    btn('measure', 'design', tool('measure'), 'M'),
    btn('gear', 'design', dialog('gear')),
    btn('shapeLibrary', 'design', dialog('shapeLibrary')),
    kind === 'router' ? btn('reliefLibrary', 'design', dialog('reliefLibrary')) : null,
    btn('importVector', 'design', () => void importVectorFile(), '⌘I'),
    btn('importGcode', 'design', () => void importGcodeFile()),
    btn('importImage', 'design', () => void importImage()),
    btn('traceImage', 'design', dialog('trace')),
    kind === 'router' ? btn('imageRelief', 'design', () => void importImageRelief()) : null,
    // Verktygsbanor (bara de som passar maskinen)
    ...(kind === 'router'
      ? [
          btn('profile', 'toolpaths', () => createToolpath('profile'), 'P'),
          btn('pocket', 'toolpaths', () => createToolpath('pocket')),
          btn('drill', 'toolpaths', () => createToolpath('drill')),
          btn('vcarve', 'toolpaths', () => createToolpath('vcarve')),
          btn('facing', 'toolpaths', () => createToolpath('facing')),
          btn('inlay', 'toolpaths', createInlay),
          btn('relief3d', 'toolpaths', () => createToolpath('relief')),
        ]
      : []),
    ...(kind === 'laser'
      ? [btn('laserCut', 'toolpaths', () => createToolpath('laserCut')), btn('lineEngrave', 'toolpaths', createLineEngraving), btn('photoEngrave', 'toolpaths', () => void importPhotoForEngraving())]
      : []),
    ...(kind === 'plasma' ? [btn('plasmaCut', 'toolpaths', () => createToolpath('plasmaCut'))] : []),
    ...(kind === 'plotter'
      ? [btn('penDraw', 'toolpaths', () => createToolpath('penDraw')), btn('penFill', 'toolpaths', () => createToolpath('penFill')), btn('penImage', 'toolpaths', () => void importImageForPlotter())]
      : []),
    // Simulera
    btn('simPlay', 'simulate', playPause),
    btn('simResult', 'simulate', showFinalResult),
    // Export
    btn('saveGcode', 'output', dialog('exportGcode'), '⌘E'),
    btn('viewGcode', 'output', dialog('gcodeViewer')),
    btn('jobSheet', 'output', dialog('jobSheet')),
    btn('exportSvg', 'output', () => exportVectors('svg')),
    btn('exportDxf', 'output', () => exportVectors('dxf')),
    btn('exportPdf', 'output', () => exportVectors('pdf')),
    // Appen
    { id: 'units', title: t.units.menu, desc: t.units.switchTitle, run: () => s().setUnits(s().units === 'mm' ? 'in' : 'mm') },
    { id: 'theme', title: s().theme === 'dark' ? t.header.toLight : t.header.toDark, run: () => s().setTheme(s().theme === 'dark' ? 'light' : 'dark') },
    { id: 'beginner', title: t.header.beginnerMode, run: () => s().toggleBeginnerMode() },
    { id: 'handbook', title: t.handbook.title, desc: t.handbook.intro, run: dialog('handbook') },
    { id: 'tour', title: t.welcome.menu, run: dialog('welcome') },
    { id: 'feedback', title: t.feedback.open, run: dialog('feedback') },
    { id: 'about', title: t.about.open, run: dialog('about') },
  ];
  return list.filter((c): c is Command => !!c);
}

/** Jämför utan accenter och skiftläge ("forskjut" hittar "Förskjut"). */
export const norm = (x: string) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Poäng för en sökning: alla ord måste finnas; träff i titeln väger mest. */
export function score(c: Command, query: string): number {
  const words = norm(query).split(/\s+/).filter(Boolean);
  if (!words.length) return 1;
  const title = norm(c.title);
  const desc = norm(c.desc ?? '');
  let total = 0;
  for (const w of words) {
    if (title.startsWith(w)) total += 6;
    else if (title.split(/[\s:–\-/()]+/).some((p) => p.startsWith(w))) total += 4;
    else if (title.includes(w)) total += 3;
    else if (desc.includes(w)) total += 1;
    else return 0;
  }
  return total;
}
