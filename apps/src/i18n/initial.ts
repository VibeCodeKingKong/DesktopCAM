export type Language = 'sv' | 'en';

/** Språket användaren valt senast, annars webbläsarens språk. */
export function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem('desktopcam.lang');
    if (saved === 'sv' || saved === 'en') return saved;
  } catch {
    /* privat läge */
  }
  const nav = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : 'sv';
  return nav.startsWith('sv') || nav.startsWith('nb') || nav.startsWith('nn') || nav.startsWith('da') ? 'sv' : 'en';
}
