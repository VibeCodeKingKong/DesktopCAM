import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ComponentType } from 'react';
import { useAppStore, type RibbonTabId } from '../../store/useAppStore';
import { FileTab } from './tabs/FileTab';
import { DesignTab } from './tabs/DesignTab';
import { SetupTab } from './tabs/SetupTab';
import { ToolpathsTab } from './tabs/ToolpathsTab';
import { SimulateTab } from './tabs/SimulateTab';
import { OutputTab } from './tabs/OutputTab';

const TABS: { id: RibbonTabId; label: string; panel: ComponentType }[] = [
  { id: 'file', label: 'Arkiv', panel: FileTab },
  { id: 'design', label: 'Design', panel: DesignTab },
  { id: 'setup', label: 'Inställning', panel: SetupTab },
  { id: 'toolpaths', label: 'Verktygsbanor', panel: ToolpathsTab },
  { id: 'simulate', label: 'Simulera', panel: SimulateTab },
  { id: 'output', label: 'Export', panel: OutputTab },
];

/**
 * Ribbon-menyn. Flikarna följer arbetsflödet från vänster till höger:
 * rita → ställ in maskin och material → skapa banor → kontrollera → exportera.
 */
export function Ribbon() {
  const active = useAppStore((s) => s.activeTab);
  const collapsed = useAppStore((s) => s.ribbonCollapsed);
  const setTab = useAppStore((s) => s.setTab);
  const toggle = useAppStore((s) => s.toggleRibbon);
  const Panel = TABS.find((t) => t.id === active)?.panel ?? ToolpathsTab;

  return (
    <div className="shrink-0 border-b border-line bg-surface">
      <div role="tablist" aria-label="Menyflikar" className="flex h-8 items-end gap-0.5 px-2">
        {TABS.map((t) => {
          const selected = t.id === active && !collapsed;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={selected}
              onClick={() => (t.id === active ? toggle() : setTab(t.id))}
              onDoubleClick={toggle}
              className={`relative h-7 rounded-t-md px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40 ${
                selected ? 'bg-app font-semibold text-accent' : 'text-ink/80 hover:bg-app/60 hover:text-ink'
              }`}
            >
              {t.label}
              {selected && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent" />}
            </button>
          );
        })}
        <button
          onClick={toggle}
          className="ml-auto mb-1 rounded p-1 text-muted hover:bg-app hover:text-ink"
          aria-label={collapsed ? 'Visa menyband' : 'Dölj menyband'}
          title={collapsed ? 'Visa menyband' : 'Dölj menyband'}
        >
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>
      {!collapsed && (
        <div role="tabpanel" className="flex h-[92px] overflow-x-auto overflow-y-hidden border-t border-line bg-app px-1">
          <Panel />
        </div>
      )}
    </div>
  );
}
