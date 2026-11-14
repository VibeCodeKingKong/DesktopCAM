/**
 * Kärntyper för desktopCAM. Delas av UI, Web Worker och (via JSON) Rust/Wasm-motorn.
 * Alla längder är i millimeter, alla hastigheter i mm/min om inget annat anges.
 */

export type Units = 'mm' | 'inch';
export type MachineKind = 'router' | 'laser' | 'plasma';
export type FirmwareFlavor = 'grbl' | 'marlin';

export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 extends Vec2 {
  z: number;
}

/* ───────────────────────── Maskin ───────────────────────── */

export interface PostprocessorConfig {
  id: string;
  name: string;
  flavor: FirmwareFlavor;
  /** Rader som skrivs först i varje fil. */
  header: string[];
  /** Rader som skrivs sist i varje fil. */
  footer: string[];
  /** Antal decimaler i koordinater. */
  decimals: number;
  /** Säker Z-höjd för snabbförflyttningar, mm över materialets nollpunkt. */
  safeZ: number;
  /** Laser: M4 (dynamisk effekt, rekommenderas för GRBL) i stället för M3. */
  laserDynamicPower: boolean;
  /** Skriv cirkelbågar som G2/G3 (standard). Av för styrsystem utan bågar. */
  arcs?: boolean;
  /** Plasma: tänd och släck brännaren (standard "M3 S1000" och "M5"). */
  torchOn?: string;
  torchOff?: string;
  /** Plasma: slå på och av höjdregleringen (THC). Tomt = maskinen sköter den själv. */
  thcOn?: string;
  thcOff?: string;
}

export interface MachineProfile {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  kind: MachineKind;
  description?: string;
  workArea: Vec3;
  maxFeed: { xy: number; z: number };
  homing: 'none' | 'xy' | 'xyz';
  spindle?: { minRpm: number; maxRpm: number; controllable: boolean };
  laser?: { opticalPowerW: number; sMax: number };
  /** Plasmaskärare: motoriserad Z-axel, höjdavkänning och aggregatets största ström. */
  plasma?: { zAxis: boolean; ihs: boolean; maxAmps: number };
  postprocessor: PostprocessorConfig;
  /** Användarens egen profil (sparas med projektet). */
  custom?: boolean;
}

/* ───────────────────────── Verktyg ───────────────────────── */

export type ToolKind = 'endmill' | 'ballnose' | 'vbit' | 'drill' | 'laser' | 'plasma';

export interface CuttingParams {
  feedRate: number;
  plungeRate: number;
  spindleRpm?: number;
  /** Djup per pass (mm). */
  stepDown: number;
  /** Sidoförskjutning som andel av verktygsdiametern (0–1). */
  stepOver: number;
  /** Lasereffekt i procent (0–100). */
  laserPowerPct?: number;
  passes?: number;
}

export interface ToolDefinition {
  id: string;
  name: string;
  kind: ToolKind;
  /** Diameter, eller strålens bredd (kerf) för laser. */
  diameter: number;
  /** Spetsvinkel i grader för V-fräs. */
  angle?: number;
  /** Antal skär. */
  flutes?: number;
  /** Skärlängd (mm): hur djupt verktyget kan skära. */
  fluteLength?: number;
  /** Skaftdiameter (mm). */
  shankDiameter?: number;
  /** Total längd (mm). */
  overallLength?: number;
  /** Utstick (mm): hur långt verktyget sticker ut ur spännhylsan. */
  stickout?: number;
  units: Units;
  defaults: CuttingParams;
  notes?: string;
  /** Stjärnmarkerad: visas överst i verktygslistorna. */
  favorite?: boolean;
}

/* ───────────────────────── Material ───────────────────────── */

export type MaterialCategory = 'wood' | 'plastic' | 'leather' | 'composite' | 'metal' | 'stone' | 'paper';

export interface MaterialPreset {
  id: string;
  name: string;
  category: MaterialCategory;
  /** Hex-färg som används i 3D-vyn. */
  color: string;
  defaultThickness: number;
  router: {
    feedRate: number;
    plungeRate: number;
    spindleRpm: number;
    stepDownFactor: number;
    /**
     * Borrning: varvtal, matning per varv för en 3 mm borr (skalas med
     * diametern) och pickdjup som andel av diametern.
     */
    drill?: { rpm: number; feedPerRev: number; peck: number };
  } | null;
  laser: {
    /** false = en diodlaser kan bara gravera/märka materialet, inte skära igenom. */
    canCut?: boolean;
    cutSpeed: number;
    cutPowerPct: number;
    cutPasses: number;
    engraveSpeed: number;
    engravePowerPct: number;
    /** Skärtabell per tjocklek vid 10 W optisk effekt (skalas efter laserns effekt). */
    chart?: LaserChartRow[];
  };
  /**
   * Plasma: riktvärden per tjocklek (interpoleras). Saknas = materialet leder
   * inte ström och kan inte plasmaskäras.
   */
  plasma?: PlasmaCutChartRow[];
  tips: string[];
}

/** En rad i en skärtabell för plasma. */
export interface PlasmaCutChartRow {
  thickness: number;
  amps: number;
  feedRate: number;
  kerf: number;
  pierceDelay: number;
  pierceHeight: number;
  cutHeight: number;
}

export interface MaterialSetup {
  presetId: string;
  width: number;
  height: number;
  thickness: number;
  /** Var Z = 0 ligger. desktopCAM använder materialets ovansida som standard. */
  zZero: 'top' | 'bottom';
  origin: 'bottom-left' | 'center';
}

/* ───────────────────────── Vektorer (CAD) ───────────────────────── */

export type PathSegment =
  | { type: 'line'; to: Vec2 }
  | { type: 'arc'; to: Vec2; center: Vec2; clockwise: boolean }
  | { type: 'cubic'; c1: Vec2; c2: Vec2; to: Vec2 };

export interface VectorPath {
  id: string;
  start: Vec2;
  segments: PathSegment[];
  closed: boolean;
}

export type ShapeKind = 'line' | 'rect' | 'circle' | 'polygon' | 'bezier' | 'text' | 'imported';

export interface TextParams {
  content: string;
  /** Versalhöjd (mm). */
  height: number;
  spacing: number;
  align: 'left' | 'center' | 'right';
  /** Linjebredd (mm). 0 eller saknas = enkellinje; större ger fyllbara konturer. */
  weight?: number;
  /**
   * Typsnitt: saknas eller 'line' = det inbyggda enkellinjiga gravyrtypsnittet.
   * Annars ett kontur-typsnitt (t.ex. 'cinzel') – bokstäverna blir slutna
   * konturer för V-gravyr, ficka och inlägg, och weight används inte.
   */
  font?: string;
  /** Vänstra baslinjen för första raden. */
  x: number;
  y: number;
}

export interface VectorShape {
  id: string;
  name: string;
  kind: ShapeKind;
  paths: VectorPath[];
  /** Finns för text som fortfarande kan redigeras som text. */
  text?: TextParams;
  /** Avrundade hörn: radien och banorna med skarpa hörn (för att kunna ändra radien). */
  corner?: {
    /** Radie för alla hörn (0 = bara de enskilda). */
    radius: number;
    base: VectorPath[];
    /** Radie för enskilda hörn, nyckel "bana:hörn" (index i base). */
    radii?: Record<string, number>;
  };
}

export interface VectorLayer {
  id: string;
  name: string;
  color: string;
  visible: boolean;
  locked: boolean;
  shapes: VectorShape[];
}

/* ───────────────────────── Reliefer (3D) ───────────────────────── */

import type { ImageReliefSource } from './imageRelief';
import type { PlasmaSettings } from './plasma';
import type { LaserChartRow } from './cutData';

export type ReliefCategory = 'geometric' | 'pattern' | 'nature';

/** En relief i projektet, placerad på materialet. Höjden ritas nedåt från Z = 0. */
export interface ReliefInstance {
  id: string;
  name: string;
  /** Id i reliefbiblioteket. */
  reliefId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Största djup i mm: lägsta punkten hamnar på Z = −depth. */
  depth: number;
  invert: boolean;
  mirror: boolean;
  visible: boolean;
  /** Relief från en bild (reliefId är då "image"). */
  image?: ImageReliefSource;
  /** Plugg för ett reliefinlägg (reliefId är då "plug"). */
  plug?: ReliefPlug;
  /**
   * Ficka i ett reliefinlägg: vassa toppar rundas av med denna radie (mm) så
   * att pluggens fräs kan följa dem. Annars krockar pluggen med topparna.
   */
  inlayRadius?: number;
}

/**
 * Plugg för ett reliefinlägg: fickans relief inverterad och spegelvänd, så
 * att pluggen vänd upp och ner passar i fickan. Runt reliefen fräses en
 * marginal djupare så att resten av pluggbrädan går fri från grundträet.
 */
export interface ReliefPlug {
  /** Fickan (reliefen i grundträet) som pluggen hör till. */
  pocketId: string;
  /** Kopia av fickans form – uppdateras när fickan ändras. */
  source: {
    reliefId: string;
    image?: ImageReliefSource;
    invert: boolean;
    mirror: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
    depth: number;
    inlayRadius?: number;
  };
  /** Limspalt mellan pluggen och fickans botten (mm). */
  gap: number;
  /** Marginal runt reliefen som fräses bort på pluggbrädan (mm). */
  margin: number;
  /** Hur högt pluggbrädan går fri över grundträet utanför reliefen (mm). */
  clearance: number;
  /** Radien på kulfräsen som fräser fickan (mm) – fickan blir aldrig skarpare än så. */
  toolRadius: number;
}

/** Pluggens yttermått och djup utifrån fickan. */
export function plugGeometry(p: ReliefPlug) {
  const s = p.source;
  return {
    x: s.x - p.margin,
    y: s.y - p.margin,
    width: s.width + 2 * p.margin,
    height: s.height + 2 * p.margin,
    depth: s.depth + 2 * p.gap + p.clearance,
  };
}

/* ───────────────────────── Verktygsbanor (CAM) ───────────────────────── */

export type OperationType = 'profile' | 'pocket' | 'drill' | 'vcarve' | 'inlay' | 'laserCut' | 'laserRaster' | 'relief' | 'plasmaCut' | 'facing';
export type CutSide = 'outside' | 'inside' | 'on';
export type DitherMethod = 'floyd-steinberg' | 'ordered' | 'threshold';

interface ToolpathBase {
  id: string;
  name: string;
  toolId: string;
  shapeIds: string[];
  visible: boolean;
  params: CuttingParams;
}

export type CutDirection = 'conventional' | 'climb';
export type StrategyPreset = 'fast' | 'balanced' | 'fine' | 'custom';

export interface TabSettings {
  enabled: boolean;
  count: number;
  /** Flikens bredd mätt på detaljen (mm). */
  width: number;
  /** Flikens höjd från botten (mm). */
  height: number;
  /** Var den första fliken sitter, som andel av konturens längd (0–1). */
  offset: number;
  /** auto: jämnt fördelade (count/offset). manual: placerade för hand (positions). */
  mode?: 'auto' | 'manual';
  /** Flikarnas mittpunkter på detaljens kontur (mm), för manuell placering. */
  positions?: Vec2[];
}

/** Hur en profil fräses: grov/fin, riktning, nedgång och fasthållning. */
export interface ProfileStrategy {
  preset: StrategyPreset;
  /** Riktning för grovpassen (med medurs spindel, M3). */
  direction: CutDirection;
  finishPass: boolean;
  /** Hud som grovpassen lämnar mot kanten (mm). */
  allowance: number;
  finishDirection: CutDirection;
  /** Matning i finpasset som andel av vanlig matning. */
  finishFeedFactor: number;
  entry: 'plunge' | 'ramp';
  /** Rampvinkel i grader. */
  rampAngle: number;
  /** Tunt lager som lämnas kvar i botten (mm), 0 = av. */
  onionSkin: number;
}

export interface ProfileToolpath extends ToolpathBase {
  operation: 'profile';
  side: CutSide;
  cutDepth: number;
  tabs: TabSettings;
  /** Saknas i äldre projekt – då används förinställningen "balanced". */
  strategy?: ProfileStrategy;
}

/** Hur en ficka rensas: mönster, riktning, finpass och nedgång. */
export interface PocketStrategy {
  preset: StrategyPreset;
  /** offset: ringar som följer formen. raster: parallella linjer (zigzag). */
  pattern: 'offset' | 'raster';
  /** Rasterlinjernas vinkel i grader (0 = längs X). */
  rasterAngle: number;
  /** Riktning för grovpassen (med medurs spindel, M3). */
  direction: CutDirection;
  finishPass: boolean;
  /** Hud som grovpassen lämnar mot väggarna (mm). */
  wallAllowance: number;
  /** Hud som grovpassen lämnar mot botten (mm). */
  floorAllowance: number;
  finishDirection: CutDirection;
  /** Matning i finpasset som andel av vanlig matning. */
  finishFeedFactor: number;
  /** Nedgång: rakt ner, ramp längs banan eller spiral (helix). */
  entry: 'plunge' | 'ramp' | 'helix';
  /** Ramp- och spiralvinkel i grader. */
  rampAngle: number;
}

export interface PocketToolpath extends ToolpathBase {
  operation: 'pocket';
  cutDepth: number;
  /** Äldre fält: mönstret. Används om pocket saknas. */
  strategy: 'offset' | 'raster';
  /** Strategi (saknas i äldre projekt – då används "balanced"). */
  pocket?: PocketStrategy;
}

export interface DrillToolpath extends ToolpathBase {
  operation: 'drill';
  depth: number;
  peckDepth: number;
}

export interface VCarveToolpath extends ToolpathBase {
  operation: 'vcarve';
  /** Största djup; 0 = materialets tjocklek. Breda partier får plan botten här. */
  flatDepth: number;
  contourStep: number;
}

/** V-inlägg: två banor (ficka och plugg) som delar inställningar via groupId. */
export interface InlayToolpath extends ToolpathBase {
  operation: 'inlay';
  part: 'pocket' | 'plug';
  groupId: string;
  pocketDepth: number;
  startDepth: number;
  plugDepth: number;
  /** Bredd som fräses bort runt pluggen. */
  margin: number;
  contourStep: number;
}

export interface LaserCutToolpath extends ToolpathBase {
  operation: 'laserCut';
  side: CutSide;
  kerf: number;
  passes: number;
}

export interface PlasmaCutToolpath extends ToolpathBase {
  operation: 'plasmaCut';
  side: CutSide;
  /** Snittbredd (mm) – banan flyttas en halv snittbredd. */
  kerf: number;
  /** Strömstyrka (A) – ställs in på aggregatet, skrivs som kommentar. */
  amps: number;
  plasma: PlasmaSettings;
}

export interface LaserRasterToolpath extends ToolpathBase {
  operation: 'laserRaster';
  imageId: string;
  origin: Vec2;
  widthMm: number;
  lineIntervalMm: number;
  dither: DitherMethod;
  threshold: number;
}

/** 3D-bearbetning av en relief: valfri grovbearbetning i lager + rasterfinish. */
export interface ReliefToolpath extends ToolpathBase {
  operation: 'relief';
  reliefId: string;
  direction: 'x' | 'y';
  roughing: boolean;
  /** Material som lämnas kvar för finishpasset vid grovbearbetning (mm). */
  allowance: number;
}

/** Planfräsning: jämnar ämnets ovansida (eller offerbordet) i grunda pass. */
export interface FacingToolpath extends ToolpathBase {
  operation: 'facing';
  /** Hela ämnet eller de valda formernas omslutande rektangel. */
  area: 'stock' | 'shapes';
  /** Hur mycket som tas bort från ovansidan totalt (mm). */
  depth: number;
  /** zigzag: fram och tillbaka. oneway: samma riktning varje rad (jämnare yta). */
  pattern: 'zigzag' | 'oneway';
  /** Radernas riktning. */
  direction: 'x' | 'y';
  /** Hur långt verktygets kant går förbi ytan i radernas ändar (mm). */
  overhang: number;
}

export type ToolpathConfig =
  | FacingToolpath
  | InlayToolpath
  | ReliefToolpath
  | ProfileToolpath
  | PocketToolpath
  | DrillToolpath
  | VCarveToolpath
  | LaserCutToolpath
  | PlasmaCutToolpath
  | LaserRasterToolpath;

export interface ToolpathStats {
  cutLengthMm: number;
  rapidLengthMm: number;
  estimatedSeconds: number;
  lineCount: number;
  bounds: { min: Vec3; max: Vec3 };
}
