import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, FolderOpen, Play, Route, Settings2, PenTool, Download, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type ComponentType } from 'react';
import { useAppStore, type RibbonTabId } from '../../store/useAppStore';
import { useT } from '../../i18n';
import { FileTab } from './tabs/FileTab';
import { DesignTab } from './tabs/DesignTab';
import { SetupTab } from './tabs/SetupTab';
import { ToolpathsTab } from './tabs/ToolpathsTab';
import { SimulateTab } from './tabs/SimulateTab';
import { OutputTab } from './tabs/OutputTab';

const TABS: { id: RibbonTabId; panel: ComponentType; icon: LucideIcon }[] = [
  { id: 'file', panel: FileTab, icon: FolderOpen },
  { id: 'setup', panel: SetupTab, icon: Settings2 },
  { id: 'design', panel: DesignTab, icon: PenTool },
  { id: 'toolpaths', panel: ToolpathsTab, icon: Route },
  { id: 'simulate', panel: SimulateTab, icon: Play },
  { id: 'output', panel: OutputTab, icon: Download },
];

/**
 * Ribbon-menyn. Flikarna följer arbetsflödet från vänster till höger:
 * ställ in maskin och material → rita → skapa banor → kontrollera → exportera.
 */
export function Ribbon() {
  const t = useT();
  const active = useAppStore((s) => s.activeTab);
  const collapsed = useAppStore((s) => s.ribbonCollapsed);
  const setTab = useAppStore((s) => s.setTab);
  const toggle = useAppStore((s) => s.toggleRibbon);
  const Panel = TABS.find((x) => x.id === active)?.panel ?? DesignTab;
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  // Visar att bandet går att svepa när verktygen inte får plats (telefon, smalt fönster).
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const update = () => setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    el.scrollLeft = 0;
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [active, collapsed]);
  const scrollBy = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * scroller.current.clientWidth * 0.7, behavior: 'smooth' });

  return (
    <div className="shrink-0 border-b border-line bg-surface" data-tour="ribbon">
      <div role="tablist" aria-label="Ribbon" className="hidden h-8 items-end sm:flex gap-0.5 overflow-x-auto px-2">
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
        <div className="relative border-t border-line bg-app">
          <div ref={scroller} role="tabpanel" className="flex h-[82px] overflow-x-auto overflow-y-hidden px-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] sm:h-[92px] [&::-webkit-scrollbar]:hidden">
            <div className="flex">
              <Panel />
            </div>
          </div>
          {edges.left && (
            <button
              onClick={() => scrollBy(-1)}
              aria-label={t.tabs.moreTools}
              className="absolute inset-y-0 left-0 flex w-8 items-center justify-start bg-gradient-to-r from-app via-app/90 to-transparent pl-0.5 text-muted"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          {edges.right && (
            <button
              onClick={() => scrollBy(1)}
              aria-label={t.tabs.moreTools}
              title={t.tabs.moreTools}
              className="absolute inset-y-0 right-0 flex w-10 items-center justify-end bg-gradient-to-l from-app via-app/90 to-transparent pr-0.5 text-accent"
            >
              <ChevronRight size={20} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Telefon: flikarna som en rad längst ner, nära tummen. Tryck på den aktiva
 * fliken för att fälla ihop eller visa verktygsbandet (som på datorn).
 */
export function MobileTabBar() {
  const t = useT();
  const active = useAppStore((s) => s.activeTab);
  const collapsed = useAppStore((s) => s.ribbonCollapsed);
  const setTab = useAppStore((s) => s.setTab);
  const toggle = useAppStore((s) => s.toggleRibbon);
  return (
    <nav role="tablist" aria-label="Ribbon" className="box-content flex h-14 shrink-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden">
      {TABS.map(({ id, icon: Icon }) => {
        const selected = id === active;
        return (
          <button
            key={id}
            role="tab"
            aria-selected={selected}
            onClick={() => {
              // Inställningarna får inte plats i bandet på telefon – öppna arket direkt.
              if (id === 'setup') {
                setTab(id);
                useAppStore.getState().setMobilePanel('setup');
              } else if (selected) toggle();
              else setTab(id);
            }}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-0.5 text-[10px] leading-tight ${selected ? 'font-semibold text-accent' : 'text-muted'}`}
          >
            <span className={`flex h-7 w-12 items-center justify-center rounded-full ${selected && !collapsed ? 'bg-accent/10' : ''}`}>
              <Icon size={19} strokeWidth={selected ? 2 : 1.7} />
            </span>
            <span className="w-full truncate text-center">{t.tabs[id]}</span>
          </button>
        );
      })}
    </nav>
  );
}
