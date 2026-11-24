/**
 * Uppdateringar av appen (service workern). En ny version tas aldrig i bruk
 * av sig själv – användaren väljer "Uppdatera" – men appen letar regelbundet
 * efter nya versioner, eftersom webbläsaren annars bara gör det när sidan
 * laddas om (en flik som står öppen i dagar uppdateras aldrig).
 */
import { create } from 'zustand';
import { registerSW } from 'virtual:pwa-register';
import { APP_VERSION, compareVersions } from '../data/changelog';

/** Hur ofta appen letar efter en ny version medan den är öppen. */
const CHECK_EVERY_MS = 60 * 60 * 1000;
/** Stängs rutan "Ny version" visas den igen efter så här lång tid. */
const REMIND_AFTER_MS = 30 * 60 * 1000;

export type CheckState = 'idle' | 'checking' | 'latest' | 'found' | 'stuck' | 'offline' | 'unsupported';

interface UpdateState {
  /** Tar den nya versionen i bruk och laddar om (finns när en ny version väntar). */
  apply: ((reload?: boolean) => Promise<void>) | null;
  /** Rutan stängdes med "Senare" – tidpunkt. */
  dismissedAt: number | null;
  check: CheckState;
  /** Versionen som ligger på servern (senaste kontrollen). */
  serverVersion: string | null;
  dismiss: () => void;
}

export const useUpdates = create<UpdateState>()((set) => ({
  apply: null,
  dismissedAt: null,
  check: 'idle',
  serverVersion: null,
  dismiss: () => {
    set({ dismissedAt: Date.now() });
    setTimeout(() => set({ dismissedAt: null }), REMIND_AFTER_MS);
  },
}));

let registration: ServiceWorkerRegistration | undefined;

/** Versionen på servern (version.json skapas vid bygget och sparas aldrig i webbläsaren). */
async function fetchServerVersion(): Promise<string | null> {
  try {
    const r = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return null;
    const j = (await r.json()) as { version?: unknown };
    return typeof j.version === 'string' ? j.version : null;
  } catch {
    return null;
  }
}

/** Letar efter en ny version. Tyst = utan att visa "letar …" (automatiska kontroller). */
export async function checkForUpdate(quiet = false): Promise<void> {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) {
    if (!quiet) useUpdates.setState({ check: 'unsupported' });
    return;
  }
  if (!quiet) useUpdates.setState({ check: 'checking' });
  const serverVersion = await fetchServerVersion();
  if (serverVersion === null) {
    if (!quiet) useUpdates.setState({ check: 'offline' });
    return;
  }
  try {
    await registration?.update();
  } catch {
    /* nätfel – versionen ovan räcker för att svara */
  }
  // Vänta kort på att en ny version hinner installeras.
  const deadline = Date.now() + 15_000;
  while (registration?.installing && Date.now() < deadline) await new Promise((r) => setTimeout(r, 300));
  const newer = compareVersions(serverVersion, APP_VERSION) > 0;
  const waiting = !!registration?.waiting || !!useUpdates.getState().apply;
  const check: CheckState = !newer ? 'latest' : waiting ? 'found' : 'stuck';
  // Automatiska kontroller ändrar bara läget när något har hittats.
  useUpdates.setState(!quiet || check !== 'latest' ? { check, serverVersion } : { serverVersion });
  if (registration?.waiting) useUpdates.setState({ apply: applyUpdate, dismissedAt: null });
}

/**
 * Sista utvägen när en ny version finns på servern men inte går att installera:
 * tar bort appens sparade filer (inte projekt eller inställningar) och laddar om.
 */
export async function forceUpdate(): Promise<void> {
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  } finally {
    location.reload();
  }
}

/**
 * Tar den väntande versionen i bruk och laddar om sidan. Laddar själv om när
 * den nya versionen är aktiv i stället för att vänta på att den tar över
 * sidan – en sida som laddats förbi service workern (Ctrl+F5) tas aldrig
 * över, och då hände ingenting när man valde Uppdatera.
 */
async function applyUpdate(): Promise<void> {
  const w = registration?.waiting;
  if (w) {
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 5000);
      w.addEventListener('statechange', () => {
        if (w.state === 'activated') {
          clearTimeout(timer);
          resolve();
        }
      });
      w.postMessage({ type: 'SKIP_WAITING' });
    });
  }
  location.reload();
}

/** Registrerar service workern och startar de regelbundna kontrollerna (en gång). */
export function startUpdates(onOfflineReady: () => void): void {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  registerSW({
    onNeedRefresh: () => useUpdates.setState({ apply: applyUpdate, dismissedAt: null, check: 'found' }),
    onOfflineReady,
    onRegisteredSW: (_url, r) => {
      registration = r;
      setInterval(() => void checkForUpdate(true), CHECK_EVERY_MS);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void checkForUpdate(true);
      });
      void checkForUpdate(true);
    },
  });
}
