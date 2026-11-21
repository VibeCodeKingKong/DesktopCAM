/**
 * Felrapporter. Fel som ingen annan hanterar fångas här, och användaren får
 * frågan om en rapport ska skickas (aldrig automatiskt). Mottagare: projektets
 * egen Cloudflare Worker (/api/error, se worker/index.js) – ingen tredje part.
 *
 * Rapporten innehåller bara: appens version, språk, maskintyp, webbläsare
 * (namn och huvudversion), var felet uppstod, felmeddelandet och stackspåret
 * (adresser förkortade till filnamn). Inga projektdata, inga personuppgifter.
 */
import { APP_VERSION } from '../data/version';
import { initialLanguage } from '../i18n/initial';

export interface ErrorReport {
  version: string;
  language: string;
  machineKind: string;
  where: 'error' | 'promise' | 'render';
  browser: string;
  message: string;
  stack: string;
}

type Listener = (r: ErrorReport | null) => void;
let current: ErrorReport | null = null;
const listeners = new Set<Listener>();
const seen = new Set<string>();
let asked = 0;
/** Sätts av appen när store finns (maskintyp i rapporten). */
let context = () => ({ language: initialLanguage() as string, machineKind: '' });

export const setReportContext = (fn: typeof context) => (context = fn);
export const currentReport = () => current;
export function onReport(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export function dismissReport() {
  current = null;
  listeners.forEach((l) => l(null));
}

/** Webbläsarens namn och huvudversion – inte hela user-agent-strängen. */
function browserName(): string {
  const ua = navigator.userAgent;
  const m = /(Edg|OPR|Firefox|CriOS|FxiOS|Chrome|Version)\/(\d+)/.exec(ua);
  const name = m ? ({ Edg: 'Edge', OPR: 'Opera', CriOS: 'Chrome iOS', FxiOS: 'Firefox iOS', Version: 'Safari' } as Record<string, string>)[m[1]] ?? m[1] : 'unknown';
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'macOS' : /Win/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '';
  return `${name} ${m?.[2] ?? ''} ${os}`.trim();
}

/** Adresser i stackspåret förkortas till filnamn (inga frågesträngar eller sökvägar). */
const shortStack = (stack: string) => stack.replace(/https?:\/\/[^\s)]+\/([^/\s?)#]+)(\?[^\s):]*)?/g, '$1').slice(0, 4000);

export function report(where: ErrorReport['where'], err: unknown) {
  const e = err instanceof Error ? err : new Error(typeof err === 'string' ? err : JSON.stringify(err));
  const message = `${e.name}: ${e.message}`.slice(0, 500);
  // Brus från webbläsaren och tillägg, och samma fel en gång till.
  if (/ResizeObserver loop|^Error: Script error\.?$|extension:\/\//.test(message + (e.stack ?? ''))) return;
  if (seen.has(message) || asked >= 3) return;
  seen.add(message);
  asked++;
  const ctx = context();
  current = { version: APP_VERSION, language: ctx.language, machineKind: ctx.machineKind, where, browser: browserName(), message, stack: shortStack(e.stack ?? '') };
  listeners.forEach((l) => l(current));
}

export async function sendReport(r: ErrorReport): Promise<boolean> {
  try {
    const res = await fetch('/api/error', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Lyssnar på ohanterade fel (en gång per sida). */
export function installErrorReporting() {
  window.addEventListener('error', (e) => {
    // Bara fel från appens egna filer (inte tillägg eller andra sajter).
    if (e.filename && !e.filename.startsWith(location.origin)) return;
    report('error', e.error ?? e.message);
  });
  window.addEventListener('unhandledrejection', (e) => report('promise', e.reason));
}
