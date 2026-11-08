import { useMemo, useState } from 'react';
import { Copy, Download } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { exportSelectedGcode } from '../../cam/commands';
import { Dialog } from '../ui/Dialog';

const MAX_LINES = 3000;

export function GcodeViewer() {
  const open = useAppStore((s) => s.dialog === 'gcodeViewer');
  const toolpaths = useAppStore((s) => s.toolpaths);
  const results = useAppStore((s) => s.results);
  const selectedId = useAppStore((s) => s.selectedToolpathId);
  const [copied, setCopied] = useState(false);
  const tp = toolpaths.find((t) => t.id === selectedId && results[t.id]) ?? toolpaths.find((t) => results[t.id]);
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
      title={tp ? `G-kod för ${tp.name}` : 'G-kod'}
      width="max-w-2xl"
      footer={
        <>
          <p className="flex-1 text-xs text-muted">
            {truncated > 0 ? `Visar de första ${MAX_LINES.toLocaleString('sv-SE')} raderna. Filen innehåller ${truncated.toLocaleString('sv-SE')} till.` : ''}
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
            <Copy size={13} /> {copied ? 'Kopierad' : 'Kopiera'}
          </button>
          <button className="btn btn-primary" disabled={!result} onClick={exportSelectedGcode}>
            <Download size={13} /> Spara G-kod
          </button>
        </>
      }
    >
      <pre className="h-[60vh] overflow-auto bg-app px-5 py-3 font-mono text-2xs leading-relaxed text-ink/90">{text || 'Ingen G-kod beräknad ännu.'}</pre>
    </Dialog>
  );
}
