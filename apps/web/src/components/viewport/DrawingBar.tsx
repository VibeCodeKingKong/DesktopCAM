import { useState } from 'react';
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
  const btn = 'flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium hover:bg-app';

  return (
    <div className="pointer-events-none absolute left-2 right-12 top-2 flex justify-center sm:inset-x-14 sm:top-3">
      <div className="pointer-events-auto flex max-w-full flex-wrap items-center gap-1 rounded-xl border border-line bg-surface/95 p-1 pl-3 shadow-pop backdrop-blur">
        <p className="min-w-0 flex-1 py-1 pr-2 text-xs text-muted">{hint}</p>
        {tool === 'line' && points > 0 && <PolarInput />}
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
          title={tool === 'nodes' || tool === 'tabs' ? t.common.done : t.viewport.cancel}
        >
          {tool === 'nodes' || tool === 'tabs' ? <Check size={14} /> : points ? <X size={14} /> : <CircleSlash size={14} />}
          {tool === 'nodes' || tool === 'tabs' ? t.common.done : t.viewport.cancel}
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
  const num = (v: string) => parseFloat(v.replace(',', '.'));
  const add = () => {
    const l = num(len), a = num(ang);
    if (!(l > 0) || !Number.isFinite(a)) return;
    activeEditor?.addPolar(l, a);
    setLen('');
  };
  const key = (e: React.KeyboardEvent) => e.key === 'Enter' && add();
  const field = 'h-8 w-16 rounded-md border border-line bg-app px-2 text-xs tabular-nums';
  return (
    <div className="flex items-center gap-1">
      <input className={field} inputMode="decimal" placeholder={t.viewport.length} aria-label={t.viewport.length} value={len} onChange={(e) => setLen(e.target.value)} onKeyDown={key} />
      <span className="text-2xs text-muted">mm ∠</span>
      <input className={`${field} w-12`} inputMode="decimal" aria-label={t.viewport.angle} value={ang} onChange={(e) => setAng(e.target.value)} onKeyDown={key} />
      <span className="text-2xs text-muted">°</span>
      <button className="flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium hover:bg-app" onClick={add} title={t.viewport.addPoint}>
        <Plus size={14} />
      </button>
    </div>
  );
}
