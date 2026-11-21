/**
 * Senaste projekt: varje projekt sparas i IndexedDB under sitt id, plus en
 * liten förteckning (namn, maskin, datum, antal) för listan under Arkiv.
 * Bibliotek: idb-keyval (Apache-2.0), samma som autosparningen.
 */
import { del, get, set, update } from 'idb-keyval';

const INDEX = 'desktopcam.recent.v1';
const key = (id: string) => `desktopcam.project.${id}`;
/** Så många projekt sparas; äldre tas bort. */
const MAX = 20;

export interface RecentEntry {
  id: string;
  name: string;
  machineName: string;
  machineKind: string;
  savedAt: number;
  shapes: number;
  toolpaths: number;
  images: number;
}

export async function listRecent(): Promise<RecentEntry[]> {
  try {
    return ((await get<RecentEntry[]>(INDEX)) ?? []).sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
}

/** Sparar projektet och för in det överst i listan. */
export async function rememberProject(data: unknown, entry: RecentEntry): Promise<void> {
  await set(key(entry.id), data);
  const dropped: string[] = [];
  await update<RecentEntry[]>(INDEX, (list = []) => {
    const next = [entry, ...list.filter((e) => e.id !== entry.id)].sort((a, b) => b.savedAt - a.savedAt);
    dropped.push(...next.slice(MAX).map((e) => e.id));
    return next.slice(0, MAX);
  });
  for (const id of dropped) await del(key(id));
}

export async function loadRecent(id: string): Promise<unknown> {
  return get(key(id));
}

export async function forgetRecent(id: string): Promise<void> {
  await update<RecentEntry[]>(INDEX, (list = []) => list.filter((e) => e.id !== id));
  await del(key(id));
}
