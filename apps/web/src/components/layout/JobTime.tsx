import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useT } from '../../i18n';
import { duration } from '../../utils/format';

/** Klockan nu, uppdaterad var halvminut (för "klart cirka"). */
function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(id);
  }, [ms]);
  return now;
}

/**
 * Total maskintid för banorna (uppskattad ur G-koden med maskinens högsta
 * hastigheter) och när jobbet är klart om det startas nu. Verktygsbyten och
 * uppriggning ingår inte – det sägs när banorna har olika verktyg.
 */
export function JobTime({ ids, className = '' }: { ids: string[]; className?: string }) {
  const t = useT();
  const J = t.jobTime;
  const results = useAppStore((s) => s.results);
  const toolpaths = useAppStore((s) => s.toolpaths);
  const now = useNow();
  const done = ids.filter((id) => results[id]);
  const seconds = done.reduce((a, id) => a + (results[id]?.stats.estimatedSeconds ?? 0), 0);
  if (!done.length || seconds <= 0) return null;
  const tools = new Set(toolpaths.filter((tp) => done.includes(tp.id)).map((tp) => tp.toolId));
  const ready = new Date(now + seconds * 1000).toLocaleTimeString(t.locale, { hour: '2-digit', minute: '2-digit' });
  return (
    <p className={`flex items-start gap-1.5 text-2xs leading-relaxed text-muted ${className}`} data-testid="job-time">
      <Clock size={12} className="mt-px shrink-0" />
      <span>
        <span className="font-medium text-ink">{J.total(duration(seconds))}</span> · {J.ready(ready)}
        {tools.size > 1 && <> · {J.toolChanges(String(tools.size - 1))}</>}
      </span>
    </p>
  );
}
