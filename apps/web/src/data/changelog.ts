/**
 * Versionshistorik som visas i appen (Om desktopCAM → Nyheter).
 * Lägg till en ny post överst och höj versionen i apps/web/package.json
 * (och i roten) vid varje uppdatering. Den översta posten ska ha samma
 * version som package.json – det kontrolleras när appen startar i dev-läge.
 */
export interface ChangelogEntry {
  version: string;
  date: string;
  sv: string[];
  en: string[];
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: '0.10.0',
    date: '2026-11-11',
    sv: [
      'Mått mellan former kan gå från en sida eller ett hörn – t.ex. ett hål måttsatt från plattans kanter. Välj punkterna i 3 × 3-rutorna.',
      'Versionsnummer i appen och den här listan med nyheter.',
    ],
    en: [
      'Distances between shapes can start at a side or corner – e.g. a hole dimensioned from the edges of a plate. Pick the points in the 3 × 3 grids.',
      'Version number in the app and this list of what is new.',
    ],
  },
  {
    version: '0.9.0',
    date: '2026-11-11',
    sv: ['Reliefinlägg: skapa en plugg som passar i en relief, med limspalt, marginal och hänsyn till fräsens radie.'],
    en: ['Relief inlays: create a plug that fits a relief, with glue gap, margin and allowance for the cutter radius.'],
  },
  {
    version: '0.8.0',
    date: '2026-11-11',
    sv: [
      'Bild till relief: logotyper, teckningar, höjdkartor och foton känns igen automatiskt.',
      'Beskär, vrid (−180° till 180°), ta bort bakgrund och gör svartvit vid import – t.ex. ett mobilfoto av en ritning på papper.',
      'Reliefer kan markeras och flyttas direkt i vyn.',
    ],
    en: [
      'Image to relief: logos, drawings, height maps and photos are detected automatically.',
      'Crop, rotate (−180° to 180°), remove background and make black and white on import – e.g. a phone photo of a drawing on paper.',
      'Reliefs can be selected and moved directly in the view.',
    ],
  },
  {
    version: '0.7.0',
    date: '2026-11-11',
    sv: ['Strategier för fickor: konturparallellt eller raster, finpass på väggar och botten, spiral- eller rampnedgång.'],
    en: ['Pocket strategies: offset or raster, finishing pass on walls and floor, helix or ramp entry.'],
  },
  {
    version: '0.6.0',
    date: '2026-11-10',
    sv: [
      'Linjer fäster vågrätt och lodrätt, och längd och vinkel kan skrivas direkt med tangentbordet.',
      'Hörnradie på alla hörn eller ett i taget (verktyget Radie).',
      'Mått mellan former och verktyget Mått.',
      'Bara former med yta kan fickfräsas, borras eller få radie.',
    ],
    en: [
      'Lines snap horizontal and vertical, and length and angle can be typed directly.',
      'Corner radius on all corners or one at a time (Radius tool).',
      'Distances between shapes and the Measure tool.',
      'Only shapes with an area can be pocketed, drilled or given a radius.',
    ],
  },
  {
    version: '0.5.0',
    date: '2026-11-10',
    sv: ['Placera flikar själv i vyn, som i Estlcam. Rättat: finpasset fräste bort flikarna.'],
    en: ['Place tabs yourself in the view, like Estlcam. Fixed: the finishing pass cut away the tabs.'],
  },
  {
    version: '0.4.0',
    date: '2026-11-10',
    sv: ['Strategier för profilfräsning (grov- och finpass, ramp), flikar och egna maskinprofiler.'],
    en: ['Profile strategies (roughing and finishing, ramp), tabs and custom machine profiles.'],
  },
  {
    version: '0.3.0',
    date: '2026-11-10',
    sv: ['Verktygsbibliotek med bilder, mått, antal skär och längder. Varning om verktyget inte når eller spännhylsan slår i.'],
    en: ['Tool library with pictures, dimensions, flutes and lengths. Warning if the tool cannot reach or the collet would hit.'],
  },
  {
    version: '0.2.0',
    date: '2026-11-10',
    sv: [
      'Text som kontur (för ficka, V-gravyr och inlägg), kugghjul med valfri kuggform och simulering av fräsningen.',
      'Rättat: ritade objekt hamnade fel på skärmar med skalning.',
    ],
    en: [
      'Outline text (for pocket, V-carve and inlay), gears with a choice of tooth shape and a machining simulation.',
      'Fixed: drawn objects ended up in the wrong place on scaled screens.',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-11-07',
    sv: ['Första versionen: rita och importera SVG/DXF, profil, ficka, borrning, V-gravyr, inlägg, laser, reliefbibliotek och G-kod.'],
    en: ['First version: draw and import SVG/DXF, profile, pocket, drilling, V-carve, inlay, laser, relief library and G-code.'],
  },
];

export const APP_VERSION = __APP_VERSION__;
