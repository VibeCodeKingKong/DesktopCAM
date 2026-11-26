import { useEffect, useRef, useState } from 'react';
import { shapeToPolylines } from '@desktopcam/core';
import { buildTextShape } from '../../text/textShape';
import { getLoadedFont, isOutlineFont, LINE_FONT } from '../../text/fonts';
import { FontPicker } from '../ui/FontPicker';
import { allShapes, useAppStore } from '../../store/useAppStore';
import { canFollow, textOnPath } from '../../text/textOnPath';
import { EditController } from '../../editing/EditController';
import { useT } from '../../i18n';
import { Dialog } from '../ui/Dialog';
import { NumberField, FieldRow, Segmented, Switch } from '../ui/Field';

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
  const [font, setFont] = useState(LINE_FONT);
  const outlineFont = isOutlineFont(font);
  const weight = style === 'outline' ? (height * weightPct) / 100 : 0;
  const ref = useRef<HTMLTextAreaElement>(null);
  // Text längs en form: finns när exakt en form med en bana är markerad.
  const target = useAppStore((s) => (s.selectedShapeIds.length === 1 ? allShapes(s.layers).find((x) => x.id === s.selectedShapeIds[0]) : undefined));
  const followable = canFollow(target);
  const [follow, setFollow] = useState(false);
  const [autoPos, setAutoPos] = useState(true);
  const [pos, setPos] = useState(50);
  const [flip, setFlip] = useState(false);
  const [offset, setOffset] = useState(1);
  useEffect(() => {
    if (open) setFollow(false);
  }, [open]);
  const pathOpts = { position: autoPos ? null : pos / 100, flip, offset };

  useEffect(() => {
    if (open) setTimeout(() => ref.current?.focus(), 50);
  }, [open]);

  const close = () => {
    useAppStore.getState().openDialog(null);
    useAppStore.getState().setTextAnchor(null);
  };
  const create = () => {
    if (!content.trim()) return;
    if (outlineFont && !getLoadedFont(font)) return;
    if (follow && target) {
      const shape = textOnPath({ content, x: 0, y: 0, height, spacing: 0, align, weight, font: outlineFont ? font : undefined }, target, pathOpts);
      if (shape) useAppStore.getState().addShape(shape);
    } else EditController.createText(content, height, align, weight, font);
    useAppStore.getState().openDialog(null);
    setContent('');
  };

  // Förhandsvisning
  const sample = content.trim() ? content : outlineFont ? 'Abc 123' : '';
  const fontReady = !outlineFont || getLoadedFont(font);
  const preview =
    sample && fontReady
      ? follow && target
        ? textOnPath({ content: sample, x: 0, y: 0, height, spacing: 0, align, weight, font: outlineFont ? font : undefined }, target, pathOpts)
        : buildTextShape({ content: sample, x: 0, y: 0, height: 10, spacing: 0, align, weight: style === 'outline' ? weightPct / 10 : 0, font: outlineFont ? font : undefined })
      : null;
  let d = '';
  let vb = '0 -12 60 14';
  if (preview) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const pl of [...(follow && target ? shapeToPolylines(target, 0.3) : []), ...shapeToPolylines(preview)]) {
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
        <FontPicker value={font} onChange={setFont} />
        {followable && (
          <div className="space-y-1.5 rounded-lg border border-line p-2.5">
            <FieldRow label={t.textPath.follow}>
              <Switch checked={follow} onChange={setFollow} label={t.textPath.follow} />
            </FieldRow>
            {follow && (
              <>
                <FieldRow label={t.textPath.place}>
                  <Segmented label={t.textPath.place} value={autoPos ? 'auto' : 'manual'} onChange={(v) => setAutoPos(v === 'auto')} options={[{ value: 'auto', label: t.textPath.auto }, { value: 'manual', label: t.textPath.manual }]} />
                </FieldRow>
                {!autoPos && <NumberField label={t.textPath.position} unit="%" min={0} max={100} step={1} value={pos} onChange={setPos} />}
                <NumberField label={t.textPath.offset} unit="mm" min={-50} max={50} step={0.5} value={offset} onChange={setOffset} />
                <FieldRow label={t.textPath.flip}>
                  <Switch checked={flip} onChange={setFlip} label={t.textPath.flip} />
                </FieldRow>
                <p className="text-2xs leading-relaxed text-muted">{t.textPath.note}</p>
              </>
            )}
          </div>
        )}
        {!outlineFont && (
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
        )}
        {!outlineFont && style === 'outline' && (
          <NumberField label={t.textDialog.weight} unit="%" min={3} max={40} step={1} value={weightPct} onChange={setWeightPct} />
        )}
        <div className="flex h-24 items-center justify-center rounded-lg bg-app p-2">
          {preview && (
            <svg viewBox={vb} className="h-full w-full" aria-hidden="true">
              <path d={d} fillRule="evenodd" className={outlineFont || style === 'outline' ? 'fill-ink/15 stroke-ink' : 'fill-none stroke-ink'} strokeWidth={0.4} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <p className="text-2xs leading-relaxed text-muted">{outlineFont ? t.textDialog.noteFont : style === 'outline' ? t.textDialog.noteOutline : t.textDialog.note}</p>
      </div>
    </Dialog>
  );
}
