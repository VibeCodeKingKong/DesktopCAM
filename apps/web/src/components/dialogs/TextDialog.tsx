import { useEffect, useRef, useState } from 'react';
import { textToShape, shapeToPolylines } from '@desktopcam/core';
import { useAppStore } from '../../store/useAppStore';
import { EditController } from '../../editing/EditController';
import { useT } from '../../i18n';
import { Dialog } from '../ui/Dialog';
import { NumberField, FieldRow, Segmented } from '../ui/Field';

type Align = 'left' | 'center' | 'right';

/** Skriv in text efter att ha tryckt i vyn med textverktyget. */
export function TextDialog() {
  const t = useT();
  const open = useAppStore((s) => s.dialog === 'text');
  const [content, setContent] = useState('');
  const [height, setHeight] = useState(10);
  const [align, setAlign] = useState<Align>('left');
  const [style, setStyle] = useState<'outline' | 'single'>('outline');
  const [weightPct, setWeightPct] = useState(15);
  const weight = style === 'outline' ? (height * weightPct) / 100 : 0;
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => ref.current?.focus(), 50);
  }, [open]);

  const close = () => {
    useAppStore.getState().openDialog(null);
    useAppStore.getState().setTextAnchor(null);
  };
  const create = () => {
    if (!content.trim()) return;
    EditController.createText(content, height, align, weight);
    useAppStore.getState().openDialog(null);
    setContent('');
  };

  // Förhandsvisning
  const preview = content.trim() ? textToShape(content, 0, 0, { height: 10, align, weight: style === 'outline' ? weightPct / 10 : 0 }) : null;
  let d = '';
  let vb = '0 -12 60 14';
  if (preview) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pl of shapeToPolylines(preview)) {
      const pts: string[] = [];
      for (let i = 0; i + 1 < pl.points.length; i += 2) {
        const x = pl.points[i], y = -pl.points[i + 1];
        minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
        pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
      }
      d += `M${pts.join('L')}${pl.closed ? 'Z' : ''}`;
    }
    vb = `${minX - 2} ${minY - 2} ${maxX - minX + 4} ${maxY - minY + 4}`;
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t.textDialog.title}
      width="max-w-md"
      footer={
        <>
          <div className="flex-1" />
          <button className="btn" onClick={close}>
            {t.common.cancel}
          </button>
          <button className="btn btn-primary" onClick={create} disabled={!content.trim()}>
            {t.textDialog.create}
          </button>
        </>
      }
    >
      <div className="space-y-3 p-4">
        <label className="block">
          <span className="mb-1 block text-xs text-muted">{t.textDialog.content}</span>
          <textarea
            ref={ref}
            className="field h-20 resize-y py-1.5 text-sm"
            value={content}
            placeholder={t.textDialog.placeholder}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) create();
            }}
          />
        </label>
        <NumberField label={t.textDialog.height} unit="mm" min={1} step={1} value={height} onChange={setHeight} />
        <FieldRow label={t.textDialog.align}>
          <Segmented
            label={t.textDialog.align}
            value={align}
            onChange={setAlign}
            options={[
              { value: 'left', label: t.props.align.left },
              { value: 'center', label: t.props.align.center },
              { value: 'right', label: t.props.align.right },
            ]}
          />
        </FieldRow>
        <FieldRow label={t.textDialog.style}>
          <Segmented
            label={t.textDialog.style}
            value={style}
            onChange={setStyle}
            options={[
              { value: 'outline', label: t.textDialog.styles.outline },
              { value: 'single', label: t.textDialog.styles.single },
            ]}
          />
        </FieldRow>
        {style === 'outline' && (
          <NumberField label={t.textDialog.weight} unit="%" min={3} max={40} step={1} value={weightPct} onChange={setWeightPct} />
        )}
        <div className="flex h-20 items-center justify-center rounded-lg bg-app p-2">
          {preview && (
            <svg viewBox={vb} className="h-full w-full" aria-hidden="true">
              <path d={d} fill="none" className="stroke-ink" strokeWidth={0.6} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <p className="text-2xs leading-relaxed text-muted">{style === 'outline' ? t.textDialog.noteOutline : t.textDialog.note}</p>
      </div>
    </Dialog>
  );
}
