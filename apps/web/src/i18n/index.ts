import { useAppStore } from '../store/useAppStore';
import type { Dict } from './sv';
import { DICTS } from './dicts';
export { DICTS } from './dicts';

export type { Dict, GuideKey } from './sv';
export type { Language } from './initial';
import { LANGUAGE_CODES, type Language } from './initial';
export { initialLanguage } from './initial';

/** I väljaren: varje språk med sitt eget namn. */
export const LANGUAGES: { code: Language; name: string }[] = LANGUAGE_CODES.map((code) => ({ code, name: DICTS[code].name }));

/** Decimaltecknet för valt språk (komma i de flesta europeiska språk). */
export const decimalSep = (t: Dict) => (1.5).toLocaleString(t.locale).charAt(1);

/** Ordlistan för valt språk, i React-komponenter. */
export const useT = (): Dict => DICTS[useAppStore((s) => s.language)];

/** Ordlistan utanför React (kommandon, tjänster). */
export const getT = (): Dict => DICTS[useAppStore.getState().language];

/** Översätter felkoder från motorn ("TOOL_TOO_LARGE", "DXF_INVALID:12"). */
export function errorText(t: Dict, message: string): string {
  const code = message.split(':')[0];
  return t.errors[code] ?? message;
}

/** Namn på material och verktyg på valt språk, med JSON-namnet som reserv. */
export const materialName = (t: Dict, id: string, fallback: string) => t.materials[id]?.name ?? fallback;
/** Inbyggda verktyg visas på valt språk så länge användaren inte döpt om dem. */
export const toolName = (t: Dict, id: string, name: string) =>
  t.tools[id] && Object.values(DICTS).some((d) => d.tools[id] === name) ? t.tools[id] : name;
