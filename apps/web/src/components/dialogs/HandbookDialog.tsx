import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import type { MachineKind } from '@desktopcam/core';
import { buildCommands, type Command } from '../../cam/commandRegistry';
import { useAppStore, useMachine } from '../../store/useAppStore';
import { useT } from '../../i18n';
import { Dialog } from '../ui/Dialog';

/** Avsnitten i ordning och vilka funktioner varje avsnitt länkar till (kommandon som saknas för maskinen hoppas över). */
const SECTIONS: { id: string; cmds: string[]; kind?: MachineKind }[] = [
  { id: 'start', cmds: ['machineSetup', 'materials', 'toolLibrary', 'units'] },
  { id: 'draw', cmds: ['rect', 'text', 'shapeLibrary', 'importVector', 'traceImage'] },
  { id: 'arrange', cmds: ['align-left', 'nest', 'union', 'offset'] },
  { id: 'router', kind: 'router', cmds: ['profile', 'pocket', 'drill', 'vcarve'] },
  { id: 'laser', kind: 'laser', cmds: ['laserCut', 'lineEngrave', 'photoEngrave', 'calibration'] },
  { id: 'plasma', kind: 'plasma', cmds: ['plasmaCut', 'nest', 'calibration'] },
  { id: 'inlay', kind: 'router', cmds: ['inlay', 'reliefLibrary', 'relief3d'] },
  { id: 'run', cmds: ['simPlay', 'saveGcode', 'jobSheet'] },
];

/**
 * Handbok: korta arbetsflöden ("Skära ut delar i plåt", "Göra ett inlägg")
 * med knappar som öppnar rätt funktion. Avsnitt för andra maskintyper visas
 * också, men knapparna gäller den valda maskinen.
 */
export function HandbookDialog() {
  const t = useT();
  const H = t.handbook;
  const open = useAppStore((s) => s.dialog === 'handbook');
  const kind = useMachine().kind;
  const cmds = useMemo(() => new Map(buildCommands(t, kind).map((c) => [c.id, c])), [t, kind, open]); // eslint-disable-line react-hooks/exhaustive-deps
  const [active, setActive] = useState('start');
  const close = () => useAppStore.getState().openDialog(null);
  const run = (c: Command) => {
    close();
    const s = useAppStore.getState();
    if (c.tab && s.activeTab !== c.tab) s.setTab(c.tab);
    setTimeout(c.run, 0);
  };
  if (!open) return null;
  const sec = SECTIONS.find((x) => x.id === active) ?? SECTIONS[0];
  const text = H.sections[sec.id as keyof typeof H.sections];
  const other = !!sec.kind && sec.kind !== kind;
  const links = other ? [] : sec.cmds.map((id) => cmds.get(id)).filter((c): c is Command => !!c);
  return (
    <Dialog open={open} onClose={close} title={H.title} width="max-w-3xl">
      <div className="grid md:grid-cols-[200px_1fr]">
        <nav className="flex gap-1 overflow-x-auto border-b border-line p-2 md:block md:space-y-0.5 md:border-b-0 md:border-r md:p-3" aria-label={H.title}>
          {SECTIONS.map((x) => (
            <button
              key={x.id}
              className={`shrink-0 rounded-md px-2.5 py-1.5 text-left text-xs md:w-full md:text-sm ${x.id === active ? 'bg-accent/10 font-semibold text-accent' : 'hover:bg-app'}`}
              onClick={() => setActive(x.id)}
              aria-current={x.id === active}
            >
              {H.sections[x.id as keyof typeof H.sections].title}
            </button>
          ))}
        </nav>
        <section className="space-y-3 p-4 sm:p-5">
          <p className="text-xs leading-relaxed text-muted">{H.intro}</p>
          <h3 className="text-base font-semibold">{text.title}</h3>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
            {text.steps.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ol>
          {links.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted">{H.open}</p>
              <div className="flex flex-wrap gap-2">
                {links.map((c) => (
                  <button key={c.id} className="btn" onClick={() => run(c)} title={c.desc}>
                    {c.title} <ArrowRight size={12} />
                  </button>
                ))}
              </div>
            </div>
          )}
          {other && <p className="rounded-md bg-app px-3 py-2 text-xs text-muted">{H.otherMachine}</p>}
          <p className="border-t border-line pt-2 text-2xs text-muted">{H.searchHint}</p>
        </section>
      </div>
    </Dialog>
  );
}
