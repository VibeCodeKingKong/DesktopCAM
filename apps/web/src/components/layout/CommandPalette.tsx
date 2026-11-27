import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CornerDownLeft, Search } from 'lucide-react';
import { buildCommands, score, type Command } from '../../cam/commandRegistry';
import { useAppStore, useMachine } from '../../store/useAppStore';
import { useT } from '../../i18n';

/**
 * Kommandosök (⌘K / Ctrl+K): skriv vad du vill göra – "förskjut", "bryggor",
 * "material" – och kör funktionen direkt. Fliken där den finns öppnas också.
 */
export function CommandPalette() {
  const t = useT();
  const open = useAppStore((s) => s.dialog === 'commands');
  const kind = useMachine().kind;
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const close = () => {
    setQ('');
    setSel(0);
    useAppStore.getState().openDialog(null);
  };

  // Töm när sökningen stängs, så att det man skriver direkt efter ⌘K inte går förlorat.
  useEffect(() => {
    if (open) return;
    setQ('');
    setSel(0);
  }, [open]);

  const all = useMemo(() => buildCommands(t, kind), [t, kind, open]); // eslint-disable-line react-hooks/exhaustive-deps
  const hits = useMemo(() => {
    if (!q.trim()) return all.slice(0, 60);
    return all
      .map((c) => ({ c, s: score(c, q) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 40)
      .map((x) => x.c);
  }, [all, q]);
  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${sel}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  const run = (c: Command) => {
    close();
    const s = useAppStore.getState();
    if (c.tab && s.activeTab !== c.tab) s.setTab(c.tab);
    // Efter stängningen, så att ett fönster som kommandot öppnar inte stängs direkt.
    setTimeout(c.run, 0);
  };

  if (!open) return null;
  const tabName = (tab?: string) => (tab ? (t.tabs as Record<string, string>)[tab] : '');
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/30 px-3 pt-[12vh]" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div role="dialog" aria-label={t.commands.title} className="w-full max-w-xl overflow-hidden rounded-xl border border-line bg-surface shadow-pop">
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Search size={16} className="shrink-0 text-muted" />
          <input
            ref={input}
            autoFocus
            className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
            placeholder={t.commands.placeholder}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label={t.commands.title}
            role="combobox"
            aria-expanded="true"
            aria-controls="command-list"
            aria-activedescendant={hits[sel] ? `cmd-${hits[sel].id}` : undefined}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                close();
              } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSel((i) => Math.min(hits.length - 1, i + 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSel((i) => Math.max(0, i - 1));
              } else if (e.key === 'Enter' && hits[sel]) {
                e.preventDefault();
                run(hits[sel]);
              }
            }}
          />
          <kbd className="hidden rounded border border-line px-1.5 py-0.5 text-2xs text-muted sm:inline">Esc</kbd>
        </div>
        <ul ref={listRef} id="command-list" role="listbox" className="max-h-[55vh] overflow-y-auto py-1">
          {hits.length === 0 && <li className="px-4 py-6 text-center text-sm text-muted">{t.commands.none}</li>}
          {hits.map((c, i) => (
            <li key={c.id} id={`cmd-${c.id}`} role="option" aria-selected={i === sel} data-i={i}>
              <button
                className={`flex w-full items-start gap-3 px-4 py-2 text-left ${i === sel ? 'bg-accent/10' : 'hover:bg-app'}`}
                onMouseMove={() => setSel(i)}
                onClick={() => run(c)}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{c.title}</span>
                  {c.desc && <span className="block truncate text-2xs text-muted">{c.desc}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-2 pt-0.5 text-2xs text-muted">
                  {c.tab && <span className="rounded bg-app px-1.5 py-0.5">{tabName(c.tab)}</span>}
                  {c.shortcut && <kbd className="rounded border border-line px-1 font-sans">{c.shortcut}</kbd>}
                  {i === sel && <CornerDownLeft size={12} />}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="border-t border-line px-4 py-1.5 text-2xs text-muted">{t.commands.hint}</p>
      </div>
    </div>,
    document.body,
  );
}
