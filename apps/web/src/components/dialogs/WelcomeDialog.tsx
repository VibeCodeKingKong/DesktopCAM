import { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Compass, FilePlus, Play } from 'lucide-react';
import type { MachineKind } from '@desktopcam/core';
import { useAppStore, useMachine } from '../../store/useAppStore';
import { useT, type Dict } from '../../i18n';
import { Dialog } from '../ui/Dialog';
import { IlluMachine } from '../smartguide/illustrations';
import { DEFAULT_MACHINE, EXAMPLES, exampleUrl, type ExampleInfo } from '../../data/examples';
import { newProject, openExample } from '../../cam/commands';
import { startTour } from '../../tutorial/tour';

const KINDS: MachineKind[] = ['router', 'laser', 'plasma', 'plotter'];
const DONE_KEY = 'desktopcam.welcomeDone';

/** Funktioner per maskintyp, med namnen som redan finns i gränssnittet. */
function features(t: Dict, kind: MachineKind): string[] {
  const b = t.buttons, o = t.operations;
  const clean = (s: string) => s.replace(/­/g, '');
  const shared = [b.text.label, b.shapeLibrary.label, b.pattern.label, b.importVector.label];
  const list: Record<MachineKind, string[]> = {
    router: [o.profile, o.pocket, o.drill, o.vcarve, o.facing, o.inlay, o.relief, b.imageRelief.label, b.reliefLibrary.label, b.gear.label],
    laser: [o.laserCut, b.lineEngrave.label, o.laserRaster, b.importImage.title, b.calibration.label, t.nesting.title, b.gear.label],
    plasma: [o.plasmaCut, b.calibration.label, t.nesting.title, b.gear.label],
    plotter: [o.penDraw, o.penFill, o.penImage, b.importImage.title],
  };
  return [...list[kind], ...shared, b.simPlay.label, b.saveGcode.label, b.jobSheet.label].map(clean);
}

/**
 * Välkomstfönstret: välj maskintyp, se vad den kan göra med färdiga exempel
 * (bilderna är simuleringens slutresultat) och öppna ett exempel eller
 * starta rundturen. Visas av sig själv första gången.
 */
export function WelcomeDialog() {
  const t = useT();
  const w = t.welcome;
  const open = useAppStore((s) => s.dialog === 'welcome');
  const startStep = useAppStore((s) => s.dialogStep);
  const machine = useMachine();
  const [step, setStep] = useState<'machine' | 'gallery'>('machine');
  const [kind, setKind] = useState<MachineKind>(machine.kind);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(startStep === 'gallery' ? 'gallery' : 'machine');
    setKind(useAppStore.getState().machines.find((m) => m.id === useAppStore.getState().machineId)?.kind ?? 'router');
    setConfirm(null);
  }, [open, startStep]);

  const close = () => {
    try {
      localStorage.setItem(DONE_KEY, '1');
    } catch {
      /* privat läge */
    }
    useAppStore.getState().openDialog(null);
  };

  const chooseKind = (k: MachineKind) => {
    const s = useAppStore.getState();
    const current = s.machines.find((m) => m.id === s.machineId);
    if (current?.kind !== k) s.setMachine(DEFAULT_MACHINE[k]);
    setKind(k);
    setConfirm(null);
    setStep('gallery');
  };

  /** Eget arbete i projektet? Då frågar vi innan exemplet ersätter det. */
  const hasOwnWork = () => {
    const s = useAppStore.getState();
    const isExampleName = Object.values(t.welcome.examples).some((e) => e.title === s.projectName) || s.projectName === t.common.exampleProject;
    return s.past.length > 0 || (!isExampleName && (s.toolpaths.length > 0 || s.layers.some((l) => l.shapes.length > 0)));
  };

  const openEx = async (ex: ExampleInfo) => {
    if (confirm !== ex.id && hasOwnWork()) {
      setConfirm(ex.id);
      return;
    }
    setBusy(ex.id);
    const ok = await openExample(ex.id, w.examples[ex.id].title);
    setBusy(null);
    if (ok) close();
  };

  const examples = EXAMPLES.filter((e) => e.kind === kind);

  const footer = (
    <>
      <button
        className="btn"
        onClick={() => {
          close();
          void startTour();
        }}
      >
        <Compass size={14} className="text-accent" /> {w.tour}
      </button>
      <button
        className="btn"
        onClick={() => useAppStore.getState().openDialog('handbook')}
      >
        <BookOpen size={14} className="text-accent" /> {t.handbook.title}
      </button>
      <div className="flex-1" />
      <button
        className="btn"
        onClick={() => {
          newProject();
          close();
        }}
      >
        <FilePlus size={14} /> {w.empty}
      </button>
      <button className="btn btn-primary" onClick={close}>
        {w.start}
      </button>
    </>
  );

  return (
    <Dialog open={open} onClose={close} title={w.title} width="max-w-4xl" footer={footer}>
      {step === 'machine' ? (
        <div className="space-y-4 p-4 sm:p-6">
          <div>
            <p className="text-sm leading-relaxed">{w.intro}</p>
            <h3 className="mt-4 text-base font-semibold">{w.chooseMachine}</h3>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {KINDS.map((k) => {
              const thumbs = EXAMPLES.filter((e) => e.kind === k).slice(0, 3);
              return (
                <button
                  key={k}
                  onClick={() => chooseKind(k)}
                  className={`group flex flex-col gap-2 rounded-xl border p-3 text-left transition hover:border-accent hover:shadow-pop ${machine.kind === k ? 'border-accent/60 bg-accent/5' : 'border-line'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-20 shrink-0">
                      <IlluMachine kind={k} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold">{w.kinds[k].name}</p>
                      <p className="text-xs leading-snug text-muted">{w.kinds[k].desc}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {thumbs.map((e) => (
                      <img key={e.id} src={exampleUrl(e.id, 'webp')} alt="" loading="lazy" className="aspect-[3/2] w-full rounded-md border border-line object-cover" />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted">{w.machineHint}</p>
        </div>
      ) : (
        <div className="space-y-5 p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn" onClick={() => setStep('machine')}>
              <ArrowLeft size={14} /> {w.back}
            </button>
            <div className="flex flex-wrap gap-1" role="tablist">
              {KINDS.map((k) => (
                <button
                  key={k}
                  role="tab"
                  aria-selected={kind === k}
                  onClick={() => chooseKind(k)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${kind === k ? 'bg-accent text-white' : 'bg-app text-ink hover:bg-line/60'}`}
                >
                  {w.kinds[k].name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-base font-semibold">{w.galleryTitle(w.kinds[kind].name)}</h3>
            <p className="text-xs text-muted">{w.galleryHint}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {examples.map((ex) => (
              <article key={ex.id} className="flex flex-col overflow-hidden rounded-xl border border-line bg-surface">
                <img src={exampleUrl(ex.id, 'webp')} alt={w.examples[ex.id].title} loading="lazy" className="aspect-[3/2] w-full bg-app object-cover" />
                <div className="flex flex-1 flex-col gap-1.5 p-3">
                  <p className="font-semibold">{w.examples[ex.id].title}</p>
                  <p className="flex-1 text-xs leading-relaxed text-muted">{w.examples[ex.id].desc}</p>
                  {confirm === ex.id && <p className="rounded-md bg-warn/10 px-2 py-1 text-2xs text-warn">{w.replaceWarning}</p>}
                  <button className={`btn mt-1 ${confirm === ex.id ? 'text-warn' : 'btn-primary'}`} disabled={!!busy} onClick={() => void openEx(ex)}>
                    <Play size={13} /> {busy === ex.id ? w.opening : confirm === ex.id ? w.replace : w.openExample}
                  </button>
                </div>
              </article>
            ))}
          </div>
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{w.alsoTitle}</h4>
            <div className="flex flex-wrap gap-1.5">
              {features(t, kind).map((f) => (
                <span key={f} className="rounded-full border border-line bg-app px-2.5 py-1 text-xs">
                  {f}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </Dialog>
  );
}
