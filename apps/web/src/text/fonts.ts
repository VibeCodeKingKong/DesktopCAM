/**
 * Kontur-typsnitt för text som ska V-graveras, fickfräsas eller bli inlägg.
 *
 * Typsnitten kommer från Fontsource (OFL/Apache, får följa med programvara)
 * och läses med opentype.js (MIT). Varje typsnitt är uppdelat i delmängder
 * (latin, latin-ext, kyrilliska) – för varje tecken används den första fil
 * som har tecknet. Filerna hämtas först när typsnittet används.
 */
import { parse, type Font } from 'opentype.js';

export const LINE_FONT = 'line';

export interface FontFamily {
  id: string;
  name: string;
  /** Stil, för att visa i listan (t.ex. "smal versal", "antikva"). */
  style: 'condensed' | 'sans' | 'slab' | 'roman' | 'serif' | 'script';
  urls: string[];
}

// Bara de vikter och delmängder som används tas med i bygget.
const FILES = import.meta.glob(
  [
    '../../node_modules/@fontsource/bebas-neue/files/bebas-neue-{latin,latin-ext}-400-normal.woff',
    '../../node_modules/@fontsource/oswald/files/oswald-{latin,latin-ext,cyrillic}-600-normal.woff',
    '../../node_modules/@fontsource/montserrat/files/montserrat-{latin,latin-ext,cyrillic}-700-normal.woff',
    '../../node_modules/@fontsource/roboto-slab/files/roboto-slab-{latin,latin-ext,cyrillic}-700-normal.woff',
    '../../node_modules/@fontsource/cinzel/files/cinzel-{latin,latin-ext}-600-normal.woff',
    '../../node_modules/@fontsource/playfair-display/files/playfair-display-{latin,latin-ext,cyrillic}-700-normal.woff',
    '../../node_modules/@fontsource/pacifico/files/pacifico-{latin,latin-ext,cyrillic}-400-normal.woff',
  ],
  { eager: true, query: '?url', import: 'default' },
) as Record<string, string>;

/** Filerna för ett typsnitt, latin först. */
const urlsFor = (pkg: string) => {
  const order = (k: string) => (k.includes('-latin-ext-') ? 1 : k.includes('-latin-') ? 0 : 2);
  return Object.keys(FILES)
    .filter((k) => k.includes(`/@fontsource/${pkg}/`))
    .sort((a, b) => order(a) - order(b))
    .map((k) => FILES[k]);
};

export const FONT_FAMILIES: FontFamily[] = [
  { id: 'bebas-neue', name: 'Bebas Neue', style: 'condensed', urls: urlsFor('bebas-neue') },
  { id: 'oswald', name: 'Oswald', style: 'condensed', urls: urlsFor('oswald') },
  { id: 'montserrat', name: 'Montserrat', style: 'sans', urls: urlsFor('montserrat') },
  { id: 'roboto-slab', name: 'Roboto Slab', style: 'slab', urls: urlsFor('roboto-slab') },
  { id: 'cinzel', name: 'Cinzel', style: 'roman', urls: urlsFor('cinzel') },
  { id: 'playfair-display', name: 'Playfair Display', style: 'serif', urls: urlsFor('playfair-display') },
  { id: 'pacifico', name: 'Pacifico', style: 'script', urls: urlsFor('pacifico') },
];

export interface LoadedFont {
  id: string;
  name: string;
  faces: Font[];
}

const loaded = new Map<string, LoadedFont>();
const pending = new Map<string, Promise<LoadedFont>>();

/** Egna typsnitt som användaren läst in (finns bara i den här sessionen). */
export const customFonts: { id: string; name: string }[] = [];

export const isOutlineFont = (id?: string) => !!id && id !== LINE_FONT;
export const getLoadedFont = (id: string) => loaded.get(id) ?? null;

export function fontName(id?: string) {
  if (!isOutlineFont(id)) return 'desktopCAM Linje';
  return FONT_FAMILIES.find((f) => f.id === id)?.name ?? customFonts.find((f) => f.id === id)?.name ?? id!;
}

/** Läser in ett inbyggt typsnitt (en gång). */
export function loadFont(id: string): Promise<LoadedFont> {
  const ready = loaded.get(id);
  if (ready) return Promise.resolve(ready);
  const fam = FONT_FAMILIES.find((f) => f.id === id);
  if (!fam) return Promise.reject(new Error('FONT_MISSING'));
  let p = pending.get(id);
  if (!p) {
    p = Promise.all(fam.urls.map((u) => fetch(u).then((r) => r.arrayBuffer()).then(parse))).then((faces) => {
      const f = { id, name: fam.name, faces };
      loaded.set(id, f);
      return f;
    });
    pending.set(id, p);
    p.catch(() => pending.delete(id));
  }
  return p;
}

/** Läser in en egen TTF-, OTF- eller WOFF-fil. */
export async function loadFontFile(file: File): Promise<LoadedFont> {
  const face = parse(await file.arrayBuffer());
  const name = face.names.fontFamily?.en ?? Object.values(face.names.fontFamily ?? {})[0] ?? file.name.replace(/\.[^.]+$/, '');
  const id = `custom:${name}`;
  const f = { id, name, faces: [face] };
  loaded.set(id, f);
  if (!customFonts.some((c) => c.id === id)) customFonts.push({ id, name });
  return f;
}
