import { createContext, useContext, type ReactNode } from 'react';

/**
 * 'ribbon': kontrollerna i bandet (standard). 'form': samma kontroller som ett
 * vertikalt formulär, t.ex. i inställningsarket på telefon.
 */
export const RibbonLayout = createContext<'ribbon' | 'form'>('ribbon');

/** En grupp i bandet: kontroller överst, namn underst, avdelare till höger (som i Office). */
export function RibbonGroup({ label, children }: { label: string; children: ReactNode }) {
  if (useContext(RibbonLayout) === 'form')
    return (
      <section aria-label={label} className="border-b border-line px-4 py-3 last:border-b-0">
        <h3 className="mb-2 text-xs font-semibold text-muted">{label}</h3>
        <div className="flex flex-col gap-3">{children}</div>
      </section>
    );
  return (
    <section aria-label={label} className="flex shrink-0 flex-col border-r border-line px-1 last:border-r-0 sm:px-2">
      <div className="flex flex-1 items-start gap-0.5 pt-1.5">{children}</div>
      {/* Gruppnamnen tar plats på telefon – där räcker knapparnas egna namn. */}
      <p className="hidden pb-1 text-center text-2xs text-muted sm:block">{label}</p>
    </section>
  );
}

/** Staplar små knappar/fält i två eller tre rader inom en grupp. */
export function RibbonStack({ children }: { children: ReactNode }) {
  if (useContext(RibbonLayout) === 'form') return <div className="flex flex-col gap-3">{children}</div>;
  return <div className="flex flex-col justify-start gap-1 px-1">{children}</div>;
}

/** Etikett + kontroll på en rad, t.ex. "Material: [Furu ▾]" i Inställning-fliken. */
export function RibbonField({ label, children }: { label: string; children: ReactNode }) {
  if (useContext(RibbonLayout) === 'form')
    return (
      <div className="flex min-h-10 items-center gap-3">
        <span className="w-28 shrink-0 text-sm text-muted">{label}</span>
        <div className="min-w-0 flex-1 text-sm">{children}</div>
      </div>
    );
  return (
    <div className="flex h-[26px] items-center gap-2">
      <span className="w-[74px] shrink-0 text-2xs text-muted">{label}</span>
      <div className="w-[150px]">{children}</div>
    </div>
  );
}
