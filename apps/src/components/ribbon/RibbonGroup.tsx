import type { ReactNode } from 'react';

/** En grupp i bandet: kontroller överst, namn underst, avdelare till höger (som i Office). */
export function RibbonGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section aria-label={label} className="flex shrink-0 flex-col border-r border-line px-2 last:border-r-0">
      <div className="flex flex-1 items-start gap-0.5 pt-1.5">{children}</div>
      <p className="pb-1 text-center text-2xs text-muted">{label}</p>
    </section>
  );
}

/** Staplar små knappar/fält i två eller tre rader inom en grupp. */
export function RibbonStack({ children }: { children: ReactNode }) {
  return <div className="flex flex-col justify-start gap-1 px-1">{children}</div>;
}

/** Etikett + kontroll på en rad, t.ex. "Material: [Furu ▾]" i Inställning-fliken. */
export function RibbonField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex h-[26px] items-center gap-2">
      <span className="w-[74px] shrink-0 text-2xs text-muted">{label}</span>
      <div className="w-[150px]">{children}</div>
    </div>
  );
}
