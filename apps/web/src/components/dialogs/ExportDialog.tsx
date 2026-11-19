import { useEffect, useState } from 'react';
import { Download, FileCode2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { exportToolpathsGcode } from '../../cam/commands';
import { planExport } from '../../cam/exportGcode';
import { plugBlankFor } from '../../cam/toolpathService';
import { useT } from '../../i18n';
import { Dialog } from '../ui/Dialog';

/**
 * Välj vilka banor som ska sparas som G-kod. Varje bana blir en egen fil;
 * för V-inlägg kan fickan, pluggen eller båda väljas.
 */
export function ExportDialog() {
  const t = useT();
  const e = t.exportGcode;
  const open = useAppStore((s) => s.dialog === 'exportGcode');
  const toolpaths = useAppStore((s) => s.toolpaths);
  const results = useAppStore((s) => s.results);
  const selectedId = useAppStore((s) => s.selectedToolpathId);
  const close = () => useAppStore.getState().openDialog(null);
  const done = toolpaths.filter((x) => results[x.id]);
  const [checked, setChecked] = useState<string[]>([]);

  // Förval: den markerade banan (eller den första), och i ett inlägg båda delarna.
  useEffect(() => {
    if (!open) return;
    const sel = done.find((x) => x.id === selectedId) ?? done[0];
    if (!sel) return setChecked([]);
    const pair = sel.operation === 'inlay' ? done.filter((x) => x.operation === 'inlay' && x.groupId === sel.groupId).map((x) => x.id) : [sel.id];
    setChecked(pair);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggle = (id: string) => setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const lines = (id: string) => results[id]?.stats.lineCount.toLocaleString(t.locale) ?? '';

  return (
    <Dialog
      open={open}
      onClose={close}
      title={e.title}
      width="max-w-lg"
      footer={
        <>
          <button className="btn" onClick={() => setChecked(checked.length === done.length ? [] : done.map((x) => x.id))}>
            {checked.length === done.length ? e.none : e.all}
          </button>
          <div className="flex-1" />
          <button className="btn" onClick={close}>
            {t.common.cancel}
          </button>
          <button
            className="btn btn-primary"
            disabled={!checked.length}
            onClick={() => {
              exportToolpathsGcode(done.filter((x) => checked.includes(x.id)).map((x) => x.id));
              close();
            }}
          >
            <Download size={13} /> {e.download(planExport(checked).length)}
          </button>
        </>
      }
    >
      <div className="space-y-3 p-4">
        {!done.length ? (
          <p className="text-sm text-muted">{t.status.noResult}</p>
        ) : (
          <div className="space-y-2">
            {planExport(done.map((x) => x.id)).map((file) => {
              const first = done.find((x) => x.id === file.toolpathIds[0])!;
              const blank = first.operation === 'inlay' && first.part === 'plug' ? plugBlankFor(first) : null;
              return (
                <section key={file.filename} className="overflow-hidden rounded-lg border border-line">
                  <header className="flex items-baseline gap-2 border-b border-line bg-app px-3 py-1.5">
                    <FileCode2 size={12} className="shrink-0 self-center text-muted" />
                    <span className="min-w-0 flex-1 truncate font-mono text-2xs">{file.filename}</span>
                    <span className="shrink-0 text-2xs text-muted">
                      {file.kind === 'inlay' ? (blank ? e.onInlayWood(blank.width, blank.height, blank.thickness) : e.onBase) : e.layerFile(file.toolpathIds.length)}
                    </span>
                  </header>
                  <ul className="divide-y divide-line">
                    {file.toolpathIds.map((id) => {
                      const tp = done.find((x) => x.id === id)!;
                      return (
                        <li key={id}>
                          <label className="flex cursor-pointer items-center gap-3 px-3 py-1.5 hover:bg-app">
                            <input type="checkbox" checked={checked.includes(id)} onChange={() => toggle(id)} />
                            <span className="min-w-0 flex-1 truncate text-sm">{tp.name}</span>
                            <span className="shrink-0 text-2xs text-muted">{e.lines(lines(id))}</span>
                            {!tp.visible && <span className="shrink-0 rounded bg-app px-1.5 py-0.5 text-2xs text-muted">{e.hidden}</span>}
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
        <p className="text-2xs leading-relaxed text-muted">{e.note}</p>
      </div>
    </Dialog>
  );
}
