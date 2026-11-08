import type { MaterialPreset } from '@desktopcam/core';

/** Innehåll för Nybörjarläget: korta, stegvisa förklaringar + rekommenderade värden. */
export interface Guide {
  title: string;
  body: string;
  steps?: string[];
  /** Tabell med rekommenderade värden per material. */
  recommend?: (m: MaterialPreset) => string | null;
}

export type GuideKey =
  | 'cutDepth'
  | 'stepDown'
  | 'feedRate'
  | 'plungeRate'
  | 'spindleRpm'
  | 'cutSide'
  | 'laserPower'
  | 'laserSpeed'
  | 'passes'
  | 'kerf'
  | 'dither'
  | 'lineInterval'
  | 'safeZ'
  | 'thickness'
  | 'reliefDepth'
  | 'reliefStepOver'
  | 'roughing'
  | 'allowance'
  | 'importUnits'
  | 'importJoin';

const pct = (n: number) => `${n} %`;
const speed = (n: number) => `${n} mm/min`;

export const GUIDES: Record<GuideKey, Guide> = {
  cutDepth: {
    title: 'Skärdjup',
    body: 'Hur djupt fräsen går totalt. För att skära ut en detalj, ange materialets tjocklek.',
    steps: ['Mät materialet med skjutmått.', 'Ange samma värde här för genomskärning.', 'Lägg en offerskiva under så att bordet inte skadas.'],
  },
  stepDown: {
    title: 'Djup per pass',
    body: 'Fräsen tar materialet i flera lager. Grundare pass är skonsammare mot små hobbymaskiner.',
    steps: ['Börja med halva fräsdiametern.', 'Hör du att maskinen kämpar? Minska värdet.', 'MPCNC och 3018 mår bäst av 0,5–1,5 mm.'],
    recommend: (m) => (m.router ? `${m.router.stepDownFactor} × fräsdiameter` : null),
  },
  feedRate: {
    title: 'Matningshastighet',
    body: 'Hur snabbt verktyget rör sig i sidled genom materialet.',
    steps: ['För låg matning bränner kanterna.', 'För hög matning kan bryta fräsen.', 'Justera i steg om 10 % tills ljudet är jämnt.'],
    recommend: (m) => (m.router ? speed(m.router.feedRate) : null),
  },
  plungeRate: {
    title: 'Nedmatning',
    body: 'Hastigheten när fräsen sänks rakt ner. Brukar vara cirka en fjärdedel av matningen.',
    recommend: (m) => (m.router ? speed(m.router.plungeRate) : null),
  },
  spindleRpm: {
    title: 'Spindelvarvtal',
    body: 'Varvtal för fräsmotorn. På handöverfräsar (t.ex. Makita) ställer du in det med ratten.',
    recommend: (m) => (m.router ? `${m.router.spindleRpm} rpm` : null),
  },
  cutSide: {
    title: 'Vilken sida av linjen?',
    body: 'Utsida: detaljen får exakt rätt mått. Insida: hålet får rätt mått. På linjen: verktyget följer linjen, t.ex. för gravyr.',
    steps: ['Ska du skära ut en bit? Välj Utsida.', 'Ska du göra ett hål eller en ram? Välj Insida.'],
  },
  laserPower: {
    title: 'Lasereffekt',
    body: 'Andel av laserns maxeffekt. Hög effekt med låg hastighet skär, låg effekt med hög hastighet graverar.',
    recommend: (m) => `Skär ${pct(m.laser.cutPowerPct)} · Gravera ${pct(m.laser.engravePowerPct)}`,
  },
  laserSpeed: {
    title: 'Laserhastighet',
    body: 'Hur snabbt laserhuvudet rör sig. Långsammare ger djupare snitt men mer bränd kant.',
    recommend: (m) => `Skär ${speed(m.laser.cutSpeed)} · Gravera ${speed(m.laser.engraveSpeed)}`,
  },
  passes: {
    title: 'Antal pass',
    body: 'Diodlasrar skär oftast bättre med flera snabba pass än ett långsamt.',
    recommend: (m) => `${m.laser.cutPasses} pass`,
  },
  kerf: {
    title: 'Kerf (snittbredd)',
    body: 'Laserstrålen bränner bort en smal remsa. desktopCAM flyttar banan halva kerfen så att måtten blir rätt.',
    steps: ['Skär en 20 × 20 mm testruta.', 'Mät den med skjutmått.', 'Kerf = 20 − uppmätt mått.'],
  },
  dither: {
    title: 'Dithering',
    body: 'En laser kan bara bränna eller inte bränna. Dithering gör om gråtoner till punktmönster som ögat uppfattar som skuggor.',
    steps: ['Floyd–Steinberg: bäst för foton.', 'Ordnad: jämnt rastermönster, bra på trä.', 'Tröskel: svartvitt, för logotyper.'],
  },
  lineInterval: {
    title: 'Linjeavstånd',
    body: 'Avståndet mellan graverade rader. Ska matcha laserpunktens storlek.',
    steps: ['Diodlaser: 0,08–0,15 mm.', 'Större värde ger snabbare jobb men grövre bild.'],
  },
  safeZ: {
    title: 'Säker höjd',
    body: 'Höjden fräsen lyfts till mellan snitten, så att den inte slår i klämmor eller material.',
  },
  reliefDepth: {
    title: 'Reliefdjup',
    body: 'Hur djupt den lägsta delen av reliefen fräses. Den högsta punkten hamnar i materialets ovansida.',
    steps: ['Lämna minst 3 mm material under reliefen.', 'Grunda reliefer (2–4 mm) går snabbt och ser bra ut i lövträ.'],
  },
  reliefStepOver: {
    title: 'Sidosteg för 3D',
    body: 'Avståndet mellan raderna, i procent av fräsdiametern. Mindre steg ger slätare yta men längre tid.',
    steps: ['Kulfräs: 8–15 % ger en slät yta.', 'Halverat sidosteg ger ungefär dubbel tid.', 'Slipa bort de sista spåren med fint sandpapper.'],
  },
  roughing: {
    title: 'Grovbearbetning',
    body: 'Tar bort det mesta materialet i lager innan den fina finishbanan körs. Skonar fräsen och små maskiner.',
    steps: ['Slå på när reliefen är djupare än ett djuppass.', 'Djup per pass styr hur tjocka lagren är.'],
  },
  allowance: {
    title: 'Lämna material',
    body: 'Grovbearbetningen stannar så här långt ovanför den färdiga ytan. Finishbanan tar sedan bort resten jämnt.',
  },
  importUnits: {
    title: 'Enheter vid import',
    body: 'SVG och DXF anger inte alltid sin enhet. Kontrollera att storleken stämmer med det du ritade.',
    steps: [
      'Inkscape och moderna program: 96 px per tum.',
      'Äldre Illustrator-filer: 72 px per tum.',
      'DXF utan enhet som ser 25 gånger för liten ut: välj tum.',
    ],
  },
  importJoin: {
    title: 'Sammanfoga segment',
    body: 'Många CAD-program sparar varje linje och båge för sig. desktopCAM kopplar ihop ändar som möts till slutna konturer så att du kan skära ut dem.',
  },
  thickness: {
    title: 'Materialtjocklek',
    body: 'Mät materialet på flera ställen och ange det tjockaste värdet. Nollpunkt Z ligger på ovansidan.',
  },
};
