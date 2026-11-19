import { useEffect, useMemo, useState } from 'react';
import { Copy, Download } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { exportToolpathsGcode } from '../../cam/commands';
import { useT } from '../../i18n';
import { Dialog } from '../ui/Dialog';

const MAX_LINES = 3000;

export function GcodeViewer() {
  const t = useT();
  const open = useAppStore((s) => s.dialog === 'gcodeViewer');
  const toolpaths = useAppStore((s) => s.toolpaths);
  const results = useAppStore((s) => s.results);
  const selectedId = useAppStore((s) => s.selectedToolpathId);
  const [copied, setCopied] = useState(false);
  // Vilken bana som visas: den markerade från början, valbar i listan.
  const [viewId, setViewId] = useState<string | null>(null);
  useEffect(() => {
    if (open) setViewId(selectedId);
  }, [open, selectedId]);
  const done = toolpaths.filter((x) => results[x.id]);
  const tp = done.find((x) => x.id === viewId) ?? done[0];
  const result = tp ? results[tp.id] : undefined;

  const { text, truncated } = useMemo(() => {
    if (!result) return { text: '', truncated: 0 };
    const lines = result.gcode.split('\n');
    return { text: lines.slice(0, MAX_LINES).join('\n'), truncated: Math.max(0, lines.length - MAX_LINES) };
  }, [result]);

  return (
    <Dialog
      open={open}
      onClose={() => useAppStore.getState().openDialog(null)}
      title={tp ? t.gcode.title(tp.name) : t.gcode.titleEmpty}
      width="max-w-2xl"
      actions={
        done.length > 1 && (
          <select className="field h-7 w-auto max-w-[16rem] py-0 text-xs" value={tp?.id} onChange={(e) => setViewId(e.target.value)} aria-label={t.gcode.choose}>
            {done.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
          </select>
        )
      }
      footer={
        <>
          <p className="flex-1 text-xs text-muted">
            {truncated > 0 ? t.gcode.truncated(MAX_LINES.toLocaleString(t.locale), truncated.toLocaleString(t.locale)) : ''}
          </p>
          <button
            className="btn"
            disabled={!result}
            onClick={async () => {
              await navigator.clipboard.writeText(result!.gcode);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            <Copy size={13} /> {copied ? t.common.copied : t.common.copy}
          </button>
          <button className="btn btn-primary" disabled={!result} onClick={() => tp && exportToolpathsGcode([tp.id])}>
            <Download size={13} /> {t.buttons.saveGcode.label}
          </button>
        </>
      }
    >
      <pre className="h-[60vh] overflow-auto bg-app px-5 py-3 font-mono text-2xs leading-relaxed text-ink/90">{text || t.gcode.empty}</pre>
    </Dialog>
  );
}
