import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { Check, CircleSlash, Plus, Spline, Trash2, Undo2, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useDraft } from '../../editing/draftStore';
import { activeEditor } from '../../editing/EditController';
import { useT } from '../../i18n';

/**
 * Flytande fält ovanför vyn medan ett ritverktyg är aktivt: förklarar vad man
 * gör och har knappar för Klar/Stäng/Ångra punkt – viktigt på pekskärm där
 * det inte finns Enter och Escape.
 */
export function DrawingBar() {
  const t = useT();
  const tool = useAppStore((s) => s.editTool);
  const setTool = useAppStore((s) => s.setEditTool);
  const selectedNode = useAppStore((s) => s.selectedNode);
  const selectedCount = useAppStore((s) => s.selectedShapeIds.length);
  const points = useDraft((s) => s.points);
  if (tool === 'select') return null;

  const hint = tool === 'nodes' && !selectedCount ? t.viewport.hints.nodesPick : t.viewport.hints[tool];
  const doneTool = tool === 'nodes' || tool === 'tabs' || tool === 'fillet' || tool === 'measure';
  const btn = 'flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium hover:bg-app';

  return (
    <div className="pointer-events-none absolute left-2 right-12 top-2 flex justify-center sm:inset-x-14 sm:top-3">
      <div className="pointer-events-auto flex max-w-full flex-wrap items-center gap-1 rounded-xl border border-line bg-surface/95 p-1 pl-3 shadow-pop backdrop-blur">
        <p className="min-w-0 flex-1 py-1 pr-2 text-xs text-muted">{hint}</p>
        {tool === 'line' && points > 0 && <PolarInput />}
        {tool === 'fillet' && <FilletInput />}
        {(tool === 'line' || tool === 'curve') && points > 0 && (
          <>
            <button className={btn} onClick={() => activeEditor?.undoPoint()} title={t.viewport.undoPoint}>
              <Undo2 size={14} />
              <span className="hidden sm:inline">{t.viewport.undoPoint}</span>
            </button>
            {points >= 3 && (
              <button className={btn} onClick={() => activeEditor?.finish(true)}>
                <Spline size={14} /> {t.viewport.closeShape}
              </button>
            )}
            {points >= 2 && (
              <button className={`${btn} bg-accent text-white hover:bg-accent/90`} onClick={() => activeEditor?.finish(false)}>
                <Check size={14} /> {t.viewport.finish}
              </button>
            )}
          </>
        )}
        {tool === 'nodes' && selectedNode && (
          <button className={btn} onClick={() => activeEditor?.deleteSelectedNode()}>
            <Trash2 size={14} /> {t.viewport.deleteNode}
          </button>
        )}
        <button
          className={btn}
          onClick={() => {
            activeEditor?.cancelDraft();
            setTool('select');
          }}
          title={doneTool ? t.common.done : t.viewport.cancel}
        >
          {doneTool ? <Check size={14} /> : points ? <X size={14} /> : <CircleSlash size={14} />}
          {doneTool ? t.common.done : t.viewport.cancel}
        </button>
      </div>
    </div>
  );
}

/** Längd och vinkel för nästa punkt, räknat från förra punkten (0° = åt höger, moturs). */
function PolarInput() {
  const t = useT();
  const [len, setLen] = useState('');
  const [ang, setAng] = useState('0');
  const lenRef = useRef<HTMLInputElement>(null);
  /** Pågår inmatning? Då läggs nya tecken till i stället för att börja om. */
  const typing = useRef(false);

  const num = (v: string) => parseFloat(v.replace(',', '.'));

  // Siffror som skrivs medan vyn har fokus hamnar här.
  // Uppdateras synkront (flushSync) innan fältet får fokus, annars kan nästa
  // tangent hamna i fältet innan den första siffran syns och skriva över den.
  useEffect(() => {
    const take = () => {
      const chars = useDraft.getState().takeTyped();
      if (!chars) return;
      const fresh = !typing.current;
      typing.current = true;
      flushSync(() => setLen((v) => (fresh ? '' : v) + chars));
      lenRef.current?.focus();
    };
    take();
    return useDraft.subscribe((s, prev) => {
      if (s.typed && s.typed !== prev.typed) take();
    });
  }, []);

  // Visa var punkten hamnar medan man skriver.
  useEffect(() => {
    const l = num(len), a = num(ang);
    activeEditor?.setPolarPreview(l > 0 && Number.isFinite(a) ? { length: l, angle: a } : null);
  }, [len, ang]);
  useEffect(() => () => activeEditor?.setPolarPreview(null), []);

  const add = () => {
    const l = num(len), a = num(ang);
    if (!(l > 0) || !Number.isFinite(a)) {
      // Enter i tomt fält avslutar linjen, som Enter i vyn.
      if (!len.trim()) {
        typing.current = false;
        activeEditor?.finish(false);
        (document.activeElement as HTMLElement | null)?.blur();
      }
      return;
    }
    activeEditor?.addPolar(l, a);
    setLen('');
    typing.current = true;
    lenRef.current?.focus();
  };
  const key = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') add();
    if (e.key === 'Escape') {
      setLen('');
      typing.current = false;
      e.currentTarget.blur();
    }
  };
  const field = 'h-8 w-16 rounded-md border border-line bg-app px-2 text-xs tabular-nums';
  return (
    <div className="flex items-center gap-1">
      <input ref={lenRef} className={field} inputMode="decimal" placeholder={t.viewport.length} aria-label={t.viewport.length} value={len} onChange={(e) => setLen(e.target.value)} onKeyDown={key} />
      <span className="text-2xs text-muted">mm ∠</span>
      <input className={`${field} w-12`} inputMode="decimal" aria-label={t.viewport.angle} value={ang} onChange={(e) => setAng(e.target.value)} onKeyDown={key} onFocus={(e) => e.currentTarget.select()} />
      <span className="text-2xs text-muted">°</span>
      <button className="flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium hover:bg-app" onClick={add} title={t.viewport.addPoint}>
        <Plus size={14} />
      </button>
    </div>
  );
}

/** Radien som verktyget Radie sätter på hörnen man klickar på. */
function FilletInput() {
  const t = useT();
  const r = useDraft((s) => s.filletRadius);
  const setR = useDraft((s) => s.setFilletRadius);
  const [v, setV] = useState(String(r));
  const commit = () => {
    const n = parseFloat(v.replace(',', '.'));
    if (n > 0) setR(n);
    else setV(String(r));
  };
  return (
    <label className="flex items-center gap-1 text-2xs text-muted">
      R
      <input
        className="h-8 w-16 rounded-md border border-line bg-app px-2 text-xs tabular-nums text-ink"
        inputMode="decimal"
        aria-label={t.fillet.radius}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
      />
      mm
    </label>
  );
}
