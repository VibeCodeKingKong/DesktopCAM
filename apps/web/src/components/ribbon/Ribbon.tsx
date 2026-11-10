import { ChevronDown, ChevronUp } from 'lucide-react';
import type { ComponentType } from 'react';
import { useAppStore, type RibbonTabId } from '../../store/useAppStore';
import { useT } from '../../i18n';
import { FileTab } from './tabs/FileTab';
import { DesignTab } from './tabs/DesignTab';
import { SetupTab } from './tabs/SetupTab';
import { ToolpathsTab } from './tabs/ToolpathsTab';
import { SimulateTab } from './tabs/SimulateTab';
import { OutputTab } from './tabs/OutputTab';

const TABS: { id: RibbonTabId; panel: ComponentType }[] = [
  { id: 'file', panel: FileTab },
  { id: 'design', panel: DesignTab },
  { id: 'setup', panel: SetupTab },
  { id: 'toolpaths', panel: ToolpathsTab },
  { id: 'simulate', panel: SimulateTab },
  { id: 'output', panel: OutputTab },
];

/**
 * Ribbon-menyn. Flikarna följer arbetsflödet från vänster till höger:
 * rita → ställ in maskin och material → skapa banor → kontrollera → exportera.
 */
export function Ribbon() {
  const t = useT();
  const active = useAppStore((s) => s.activeTab);
  const collapsed = useAppStore((s) => s.ribbonCollapsed);
  const setTab = useAppStore((s) => s.setTab);
  const toggle = useAppStore((s) => s.toggleRibbon);
  const Panel = TABS.find((x) => x.id === active)?.panel ?? DesignTab;

  return (
    <div className="shrink-0 border-b border-line bg-surface">
      <div role="tablist" aria-label="Ribbon" className="flex h-8 items-end gap-0.5 overflow-x-auto px-2">
        {TABS.map((x) => {
          const selected = x.id === active && !collapsed;
          return (
            <button
              key={x.id}
              role="tab"
              aria-selected={selected}
              onClick={() => (x.id === active ? toggle() : setTab(x.id))}
              className={`relative h-7 shrink-0 rounded-t-md px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent/40 ${
                selected ? 'bg-app font-semibold text-accent' : 'text-ink/80 hover:bg-app/60 hover:text-ink'
              }`}
            >
              {t.tabs[x.id]}
              {selected && <span className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-accent" />}
            </button>
          );
        })}
        <button
          onClick={toggle}
          className="mb-1 ml-auto shrink-0 rounded p-1 text-muted hover:bg-app hover:text-ink"
          aria-label={collapsed ? t.tabs.showRibbon : t.tabs.hideRibbon}
          title={collapsed ? t.tabs.showRibbon : t.tabs.hideRibbon}
        >
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
      </div>
      {!collapsed && (
        <div role="tabpanel" className="flex h-[92px] overflow-x-auto overflow-y-hidden border-t border-line bg-app px-1 [-webkit-overflow-scrolling:touch]">
          <Panel />
        </div>
      )}
    </div>
  );
}
