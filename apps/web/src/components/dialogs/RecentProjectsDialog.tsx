import { useEffect, useState } from 'react';
import { FolderOpen, Trash2 } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useT } from '../../i18n';
import { Dialog } from '../ui/Dialog';
import { forgetRecent, listRecent, type RecentEntry } from '../../cam/recentProjects';
import { autosaveNow, openRecent } from '../../cam/commands';

/** Senaste projekt: sparas automatiskt i webbläsaren, öppna eller ta bort. */
export function RecentProjectsDialog() {
  const t = useT();
  const r = t.recent;
  const open = useAppStore((s) => s.dialog === 'recent');
  const currentId = useAppStore((s) => s.projectId);
  const [list, setList] = useState<RecentEntry[] | null>(null);
  const close = () => useAppStore.getState().openDialog(null);

  useEffect(() => {
    if (!open) return;
    // Spara det öppna projektet först, så att listan visar det senaste.
    void autosaveNow().then(listRecent).then(setList);
  }, [open]);

  const date = (ms: number) => new Date(ms).toLocaleString(t.locale, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <Dialog
      open={open}
      onClose={close}
      title={r.title}
      width="max-w-lg"
      footer={
        <>
          <p className="flex-1 text-2xs text-muted">{r.note}</p>
          <button className="btn" onClick={close}>
            {t.common.close}
          </button>
        </>
      }
    >
      <div className="p-3">
        {list === null ? null : !list.length ? (
          <p className="p-4 text-center text-sm text-muted">{r.empty}</p>
        ) : (
          <ul className="divide-y divide-line">
            {list.map((e) => {
              const current = e.id === currentId;
              return (
                <li key={e.id} className="flex items-center gap-2 py-2">
                  <button
                    className="flex min-w-0 flex-1 flex-col items-start rounded-md px-2 py-1.5 text-left hover:bg-app disabled:hover:bg-transparent"
                    disabled={current}
                    onClick={async () => {
                      if (await openRecent(e.id, e.name)) close();
                    }}
                  >
                    <span className="flex w-full items-center gap-2">
                      <span className="truncate text-sm font-medium">{e.name || t.common.untitledProject}</span>
                      {current && <span className="shrink-0 rounded bg-accent/10 px-1.5 py-0.5 text-2xs font-medium text-accent">{r.current}</span>}
                    </span>
                    <span className="truncate text-2xs text-muted">
                      {e.machineName} · {r.counts(e.shapes, e.toolpaths)} · {date(e.savedAt)}
                    </span>
                  </button>
                  {!current && (
                    <button
                      className="rounded p-2 text-muted hover:bg-app hover:text-ink"
                      title={r.open}
                      aria-label={`${r.open}: ${e.name || t.common.untitledProject}`}
                      onClick={async () => {
                        if (await openRecent(e.id, e.name)) close();
                      }}
                    >
                      <FolderOpen size={16} />
                    </button>
                  )}
                  <button
                    className="rounded p-2 text-muted hover:bg-app hover:text-warn disabled:opacity-30"
                    title={r.remove}
                    aria-label={`${r.remove}: ${e.name || t.common.untitledProject}`}
                    disabled={current}
                    onClick={async () => {
                      await forgetRecent(e.id);
                      setList(await listRecent());
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Dialog>
  );
}
