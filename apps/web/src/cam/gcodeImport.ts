/**
 * Färdig G-kod som verktygsbana: en importerad fil eller ett kalibreringsprov.
 * Banan räknas aldrig om – G-koden visas i 3D-vyn, simuleras och exporteras
 * precis som den är.
 */
import { parseGcode, uid, type GcodeToolpath, type ToolDefinition, type ToolKind } from '@desktopcam/core';
import { getT } from '../i18n';
import { getMachine, useAppStore } from '../store/useAppStore';
import { pickFile } from '../utils/download';
import { computeToolpath } from './toolpathService';

/** Större filer än så sparas inte i projektet (det sparas automatiskt i webbläsaren). */
const MAX_BYTES = 20 * 1024 * 1024;

export const GCODE_EXTENSIONS = ['.gcode', '.nc', '.ngc', '.gc', '.tap', '.cnc', '.g', '.txt'];
export const isGcodeFileName = (name: string) => GCODE_EXTENSIONS.some((e) => e !== '.txt' && name.toLowerCase().endsWith(e));

/** Verktyget som visas i simuleringen: det valda om det passar maskinen, annars det första som gör det. */
export function toolForMachine(): ToolDefinition | undefined {
  const s = useAppStore.getState();
  const kind = getMachine().kind;
  const want: ToolKind[] = kind === 'laser' ? ['laser'] : kind === 'plasma' ? ['plasma'] : kind === 'plotter' ? ['pen'] : ['endmill', 'ballnose', 'vbit', 'drill'];
  const active = s.tools.find((t) => t.id === s.activeToolId);
  if (active && want.includes(active.kind)) return active;
  return s.tools.find((t) => want.includes(t.kind)) ?? s.tools[0];
}

/** Lägger in färdig G-kod som en ny verktygsbana och tolkar den. Ger banans id. */
export function addGcodeToolpath(opts: { name: string; gcode: string; source: GcodeToolpath['source']; laserCut?: boolean; tool?: ToolDefinition }): string {
  const s = useAppStore.getState();
  const tool = opts.tool ?? toolForMachine();
  const tp: GcodeToolpath = {
    id: uid('tp'),
    name: `${s.toolpaths.length + 1}. ${opts.name}`,
    toolId: tool?.id ?? '',
    shapeIds: [],
    visible: true,
    params: tool ? { ...tool.defaults } : { feedRate: 1000, plungeRate: 300, stepDown: 1, stepOver: 0.5 },
    operation: 'gcode',
    gcode: opts.gcode,
    source: opts.source,
    laserCut: opts.laserCut,
  };
  s.addToolpath(tp);
  void computeToolpath(tp.id);
  return tp.id;
}

/**
 * Problem som gör att G-koden inte kan visas rätt: tum (G20) och relativa
 * koordinater (G91) – visningen och simuleringen räknar i absoluta millimeter.
 */
export function gcodeProblem(text: string): 'inches' | 'relative' | 'empty' | null {
  const code = text.replace(/\(.*?\)/g, '').replace(/;.*$/gm, '');
  if (/\bG20(?!\d)/i.test(code)) return 'inches';
  if (/\bG91(?![.\d])/i.test(code)) return 'relative';
  const { stats } = parseGcode(text);
  if (stats.cutLengthMm + stats.rapidLengthMm <= 0) return 'empty';
  return null;
}

/** Arkiv → Importera G-kod (eller en G-kodfil som dras till 3D-vyn). */
export async function importGcodeFile(file?: File | null): Promise<void> {
  const t = getT();
  const s = useAppStore.getState();
  const f = file ?? (await pickFile(GCODE_EXTENSIONS.join(',')));
  if (!f) return;
  if (f.size > MAX_BYTES) {
    s.setStatus(t.gcodeImport.tooLarge(f.name));
    return;
  }
  const text = (await f.text()).replace(/\r\n?/g, '\n');
  const problem = gcodeProblem(text);
  if (problem) {
    s.setStatus(problem === 'inches' ? t.gcodeImport.inches(f.name) : problem === 'relative' ? t.gcodeImport.relative(f.name) : t.gcodeImport.notGcode(f.name));
    return;
  }
  addGcodeToolpath({ name: f.name.replace(/\.[^.]+$/, ''), gcode: text, source: { kind: 'file', fileName: f.name } });
  // Utanför arbetsstycket? Visa det, men importera ändå – det kan vara meningen.
  const { stats } = parseGcode(text);
  const m = useAppStore.getState().material;
  const outside = stats.bounds.min.x < -0.5 || stats.bounds.min.y < -0.5 || stats.bounds.max.x > m.width + 0.5 || stats.bounds.max.y > m.height + 0.5;
  useAppStore.getState().setTab('toolpaths');
  useAppStore.getState().setStatus(outside ? t.gcodeImport.outsideStock(f.name) : t.gcodeImport.imported(f.name, stats.lineCount.toLocaleString(t.locale)));
}
