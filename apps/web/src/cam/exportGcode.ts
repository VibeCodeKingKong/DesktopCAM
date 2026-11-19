/**
 * Hur G-koden delas upp i filer när den sparas.
 *
 *  - V-inlägg: fickan och pluggen blir var sin fil – de fräses i olika
 *    trästycken med var sin nollpunkt.
 *  - Övriga banor: en fil per lager, med banorna i listans ordning. Byts
 *    verktyget inom ett lager blir det en fil per verktyg, eftersom Z måste
 *    nollställas på nytt efter ett verktygsbyte.
 *
 * När banor slås ihop får postprocessorns början (t.ex. Marlins G28 och
 * G92 Z0) bara stå först och slutet (M84/M30) bara sist – en G92 Z0 mitt i
 * filen skulle nollställa Z på fel höjd.
 */
import type { PostprocessorConfig, ToolpathConfig } from '@desktopcam/core';
import { getMachine, useAppStore } from '../store/useAppStore';
import { getT, toolName } from '../i18n';
import { slug } from '../utils/download';

export interface ExportFile {
  /** Rubrik i dialogen. */
  title: string;
  filename: string;
  toolpathIds: string[];
  kind: 'inlay' | 'layer';
}

/** Lagret en bana hör till: dess första forms lager (null för t.ex. reliefer och planfräsning av hela ämnet). */
function layerOf(tp: ToolpathConfig) {
  const s = useAppStore.getState();
  for (const id of tp.shapeIds) {
    const layer = s.layers.find((l) => l.shapes.some((sh) => sh.id === id));
    if (layer) return layer;
  }
  return null;
}

export interface ExportOptions {
  /** Olika verktyg i samma lager i samma fil, med paus för verktygsbyte. */
  toolChangePause?: boolean;
}

/** Filerna som de valda banorna blir, i listans ordning. */
export function planExport(ids: string[], opts: ExportOptions = {}): ExportFile[] {
  const s = useAppStore.getState();
  const t = getT();
  const project = slug(s.projectName || 'desktopcam');
  const files: ExportFile[] = [];
  const byKey = new Map<string, ExportFile>();
  for (const tp of s.toolpaths) {
    if (!ids.includes(tp.id) || !s.results[tp.id]) continue;
    if (tp.operation === 'inlay') {
      files.push({ title: tp.name, filename: `${project}-${slug(tp.name)}.gcode`, toolpathIds: [tp.id], kind: 'inlay' });
      continue;
    }
    const layer = layerOf(tp);
    const layerName = layer?.name ?? t.exportGcode.noLayer;
    const key = opts.toolChangePause ? `${layer?.id ?? '-'}` : `${layer?.id ?? '-'}|${tp.toolId}`;
    let file = byKey.get(key);
    if (!file) {
      file = { title: layerName, filename: '', toolpathIds: [], kind: 'layer' };
      byKey.set(key, file);
      files.push(file);
    }
    file.toolpathIds.push(tp.id);
  }
  // Lager med flera verktyg: verktygets namn i rubrik och filnamn.
  const layerCount = new Map<string, number>();
  for (const f of files) if (f.kind === 'layer') layerCount.set(f.title, (layerCount.get(f.title) ?? 0) + 1);
  for (const f of files) {
    if (f.kind !== 'layer') continue;
    const tp = s.toolpaths.find((x) => x.id === f.toolpathIds[0])!;
    const tool = s.tools.find((x) => x.id === tp.toolId);
    const split = (layerCount.get(f.title) ?? 0) > 1;
    const tName = tool ? toolName(t, tool.id, tool.name) : '';
    if (split) f.title = `${f.title} – ${tName}`;
    f.filename = `${project}-${slug(f.title)}.gcode`;
  }
  // Samma filnamn två gånger (t.ex. två lager med samma namn): numrera.
  const used = new Map<string, number>();
  for (const f of files) {
    const n = used.get(f.filename) ?? 0;
    used.set(f.filename, n + 1);
    if (n) f.filename = f.filename.replace(/\.gcode$/, `-${n + 1}.gcode`);
  }
  return files;
}

/** Index där en följd av rader börjar (exakt likadana rader), eller −1. */
function findSeq(lines: string[], seq: string[], from = 0, to = lines.length): number {
  if (!seq.length) return -1;
  for (let i = from; i + seq.length <= to; i++) if (seq.every((l, k) => lines[i + k].trim() === l.trim())) return i;
  return -1;
}

/**
 * Paus för verktygsbyte: lyft till säker höjd, stäng av spindeln och vänta.
 * Marlin visar texten på displayen (M117); GRBL har ingen M117, där blir
 * texten en kommentar. Nästa bana startar spindeln igen själv.
 */
function toolChangeLines(post: PostprocessorConfig, message: string): string[] {
  const z = `G0 Z${post.safeZ}`;
  // Displayen klarar oftast bara ASCII: ä → a, och övriga tecken bort.
  const ascii = message.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '').replace(/\s+/g, ' ').trim();
  return post.flavor === 'marlin' ? [z, 'M5', `M117 ${ascii}`, `; ${message}`, 'M0'] : [z, 'M5', `; ${message}`, 'M0'];
}

/**
 * Slår ihop flera banors G-kod till en fil: postprocessorns början bara
 * först, slutet bara sist, och en kommentar före varje bana. Byts verktyget
 * mellan två banor läggs en paus in (toolChange ger meddelandet).
 */
export function combineGcode(parts: { name: string; gcode: string; toolId?: string; toolChange?: string }[], post: PostprocessorConfig): string {
  if (parts.length === 1) return parts[0].gcode;
  const out: string[] = [];
  parts.forEach((part, i) => {
    const lines = part.gcode.replace(/\n+$/, '').split('\n');
    let end = lines.length;
    if (i < parts.length - 1) {
      const f = findSeq(lines, post.footer, Math.max(0, lines.length - post.footer.length - 3));
      if (f >= 0) end = f;
    }
    let body = lines.slice(0, end);
    if (i > 0) {
      const h = findSeq(body, post.header, 0, Math.min(body.length, post.header.length + 6));
      if (h >= 0) body = [...body.slice(0, h), ...body.slice(h + post.header.length)];
    }
    if (i > 0 && part.toolChange && part.toolId !== parts[i - 1].toolId) out.push(...toolChangeLines(post, part.toolChange));
    out.push(`; ===== ${part.name} =====`, ...body);
  });
  return out.join('\n') + '\n';
}

/** G-koden för en fil. */
export function fileGcode(file: ExportFile): string {
  const s = useAppStore.getState();
  const t = getT();
  const parts = file.toolpathIds.map((id) => {
    const tp = s.toolpaths.find((x) => x.id === id);
    const tool = s.tools.find((x) => x.id === tp?.toolId);
    return {
      name: tp?.name ?? '',
      gcode: s.results[id]?.gcode ?? '',
      toolId: tp?.toolId,
      toolChange: t.exportGcode.toolChangeMessage(tool ? toolName(t, tool.id, tool.name) : ''),
    };
  });
  return combineGcode(parts, getMachine().postprocessor);
}

