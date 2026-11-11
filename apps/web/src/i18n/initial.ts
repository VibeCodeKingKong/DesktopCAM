/** Språken i appen. Lägg till ett nytt språk här, i index.ts och i changelog.ts. */
export const LANGUAGE_CODES = ['sv', 'en', 'fr', 'de', 'es', 'pl', 'uk'] as const;
export type Language = (typeof LANGUAGE_CODES)[number];

const isLanguage = (v: string | null): v is Language => !!v && (LANGUAGE_CODES as readonly string[]).includes(v);

/** Sparat språk, annars webbläsarens. Norska och danska får svenska. */
export function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem('desktopcam.lang');
    if (isLanguage(saved)) return saved;
  } catch {
    /* privat läge */
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'sv';
  if (nav.startsWith('sv') || nav.startsWith('nb') || nav.startsWith('nn') || nav.startsWith('no') || nav.startsWith('da')) return 'sv';
  const prefix = nav.slice(0, 2);
  return isLanguage(prefix) ? prefix : 'en';
}
