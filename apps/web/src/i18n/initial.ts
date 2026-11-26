/** Språken i appen. Lägg till ett nytt språk här, i index.ts och i changelog.ts. */
export const LANGUAGE_CODES = ['sv', 'en', 'fr', 'de', 'es', 'pl', 'uk'] as const;
export type Language = (typeof LANGUAGE_CODES)[number];

/** Varje språks namn på sig självt (för väljaren, utan att ladda ordlistorna). */
export const LANGUAGE_NAMES: Record<Language, string> = { sv: 'Svenska', en: 'English', fr: 'Français', de: 'Deutsch', es: 'Español', pl: 'Polski', uk: 'Українська' };

const isLanguage = (v: string | null): v is Language => !!v && (LANGUAGE_CODES as readonly string[]).includes(v);

/**
 * Sparat språk, annars webbläsarens. Norska och danska får svenska.
 * Läses en gång: ordlistan som laddas vid start och appens språk måste vara
 * samma även om en annan flik byter språk medan appen startar.
 */
let first: Language | null = null;
export function initialLanguage(): Language {
  first ??= readLanguage();
  return first;
}

function readLanguage(): Language {
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
