/**
 * Ordlistorna laddas var för sig (varje språk är ~100 kB): det valda språket
 * innan något annat i appen körs (top-level await nedan – store och
 * demoprojektet använder ordlistan när de skapas), övriga i bakgrunden när
 * appen är igång (main.tsx), så att t.ex. namn på andra språk känns igen.
 * Egen modul utan beroende till store.
 */
import { initialLanguage, LANGUAGE_CODES, type Language } from './initial';
import type { Dict } from './sv';

/** Inlästa ordlistor. Det valda språket finns alltid här innan appen startar. */
export const DICTS = {} as Record<Language, Dict>;

const LOADERS: Record<Language, () => Promise<Dict>> = {
  sv: () => import('./sv').then((m) => m.sv),
  en: () => import('./en').then((m) => m.en),
  fr: () => import('./fr').then((m) => m.fr),
  de: () => import('./de').then((m) => m.de),
  es: () => import('./es').then((m) => m.es),
  pl: () => import('./pl').then((m) => m.pl),
  uk: () => import('./uk').then((m) => m.uk),
};

export async function loadDict(code: Language): Promise<Dict> {
  if (!DICTS[code]) DICTS[code] = await LOADERS[code]();
  return DICTS[code];
}

export const loadAllDicts = () => Promise.all(LANGUAGE_CODES.map(loadDict));

// Det valda språket måste finnas innan moduler som importerar ordlistorna körs.
await loadDict(initialLanguage());
