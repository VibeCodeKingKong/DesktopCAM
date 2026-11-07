import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Circle, CircleDot, Cog, Eye, EyeOff, Flame, Folder, ImagePlus, Layers, Loader2, Mountain, PenTool, Scissors, Shapes, Square, Trash2, Triangle, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { OperationType, ShapeKind } from '@desktopcam/core';
import { useAppStore, useMachine, useMaterialPreset } from '../../store/useAppStore';

const SHAPE_ICONS: Partial<Record<ShapeKind, LucideIcon>> = { rect: Square, circle: Circle, polygon: Cog, imported: PenTool };
const OP_ICONS: Record<OperationType, LucideIcon> = {
  profile: Square,
  pocket: Layers,
  drill: CircleDot,
  vcarve: Triangle,
  laserCut: Scissors,
  laserRaster: ImagePlus,
  relief: Mountain,
};

function Section({
  icon: Icon,
  label,
  children,
  count,
  defaultOpen = true,
  trailing,
}: {
  icon: LucideIcon;
  label: string;
  children?: ReactNode;
  count?: number;
  defaultOpen?: boolean;
  trailing?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <div className="flex items-center rounded-md hover:bg-app">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex h-7 min-w-0 flex-1 items-center gap-1.5 px-1.5 text-xs font-medium"
        >
          {children ? open ? <ChevronDown size={13} className="shrink-0 text-muted" /> : <ChevronRight size={13} className="shrink-0 text-muted" /> : <span className="w-[13px] shrink-0" />}
          <Icon size={14} className="shrink-0 text-muted" />
          <span className="flex-1 truncate text-left">{label}</span>
          {count !== undefined && <span className="text-2xs text-muted">{count}</span>}
        </button>
        {trailing && <div className="pr-1">{trailing}</div>}
      </div>
      {open && children && <div className="ml-4 border-l border-line pl-1.5">{children}</div>}
    </div>
  );
}

export function ProjectTree() {
  const projectName = useAppStore((s) => s.projectName);
  const layers = useAppStore((s) => s.layers);
  const selected = useAppStore((s) => s.selectedShapeIds);
  const selectShape = useAppStore((s) => s.selectShape);
  const toolpaths = useAppStore((s) => s.toolpaths);
  const selectedTp = useAppStore((s) => s.selectedToolpathId);
  const selectToolpath = useAppStore((s) => s.selectToolpath);
  const updateToolpath = useAppStore((s) => s.updateToolpath);
  const removeToolpath = useAppStore((s) => s.removeToolpath);
  const progress = useAppStore((s) => s.progress);
  const errors = useAppStore((s) => s.errors);
  const material = useAppStore((s) => s.material);
  const preset = useMaterialPreset();
  const machine = useMachine();
  const shapes = layers.flatMap((l) => l.shapes);
  const toggleLayer = useAppStore((s) => s.toggleLayer);
  const reliefs = useAppStore((s) => s.reliefs);
  const selectedRelief = useAppStore((s) => s.selectedReliefId);
  const selectRelief = useAppStore((s) => s.selectRelief);

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface md:flex" aria-label="Projektträd">
      <div className="panel-heading">Projekt</div>
      <div className="flex-1 space-y-0.5 overflow-y-auto p-1.5">
        <Section icon={Folder} label={projectName} />
        <Section icon={machine.kind === 'laser' ? Flame : Cog} label={machine.name} />
        <div className="flex h-7 items-center gap-1.5 px-1.5 text-xs">
          <span className="w-[13px]" />
          <span className="h-3.5 w-3.5 rounded-sm border border-black/10" style={{ background: preset.color }} />
          <span>
            {preset.name}, {material.thickness} mm
          </span>
        </div>

        <Section icon={Shapes} label="Former" count={shapes.length}>
          {shapes.length === 0 && <p className="px-2 py-1.5 text-2xs text-muted">Rita en form eller importera SVG/DXF under fliken Design.</p>}
          {layers
            .filter((l) => l.shapes.length)
            .map((layer) => (
              <Section
                key={layer.id}
                icon={Layers}
                label={layer.name}
                count={layer.shapes.length}
                defaultOpen={layer.shapes.length <= 12}
                trailing={
                  <button
                    className="rounded p-0.5 text-muted hover:text-ink"
                    onClick={() => toggleLayer(layer.id)}
                    aria-label={layer.visible ? `Dölj ${layer.name}` : `Visa ${layer.name}`}
                    title={layer.visible ? 'Dölj lager' : 'Visa lager'}
                  >
                    {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                  </button>
                }
              >
                {layer.shapes.map((sh) => {
                  const Icon = SHAPE_ICONS[sh.kind] ?? Shapes;
                  const isSel = selected.includes(sh.id);
                  const open = sh.paths.some((p) => !p.closed);
                  return (
                    <button
                      key={sh.id}
                      onClick={(e) => selectShape(sh.id, e.shiftKey || e.metaKey || e.ctrlKey)}
                      aria-pressed={isSel}
                      title={open ? 'Öppen bana' : undefined}
                      className={`flex h-7 w-full items-center gap-1.5 rounded-md px-1.5 text-xs ${isSel ? 'bg-accent/10 text-accent' : 'hover:bg-app'} ${layer.visible ? '' : 'opacity-50'}`}
                    >
                      <Icon size={13} style={{ color: isSel ? undefined : layer.color }} />
                      <span className="truncate">{sh.name}</span>
                    </button>
                  );
                })}
              </Section>
            ))}
        </Section>

        <Section icon={Mountain} label="Reliefer" count={reliefs.length}>
          {reliefs.length === 0 && <p className="px-2 py-1.5 text-2xs text-muted">Välj en relief i reliefbiblioteket under fliken Design.</p>}
          {reliefs.map((r) => {
            const isSel = r.id === selectedRelief;
            return (
              <button
                key={r.id}
                onClick={() => selectRelief(isSel ? null : r.id)}
                aria-pressed={isSel}
                className={`flex h-7 w-full items-center gap-1.5 rounded-md px-1.5 text-xs ${isSel ? 'bg-accent/10 text-accent' : 'hover:bg-app'} ${r.visible ? '' : 'opacity-50'}`}
              >
                <Mountain size={13} />
                <span className="flex-1 truncate text-left">{r.name}</span>
                <span className="text-2xs tabular-nums text-muted">{r.depth} mm</span>
              </button>
            );
          })}
        </Section>

        <Section icon={Layers} label="Verktygsbanor" count={toolpaths.length}>
          {toolpaths.length === 0 && (
            <p className="px-2 py-1.5 text-2xs leading-relaxed text-muted">Markera former och välj en operation under fliken Verktygsbanor.</p>
          )}
          {toolpaths.map((tp) => {
            const Icon = OP_ICONS[tp.operation];
            const isSel = tp.id === selectedTp;
            const busy = !!progress[tp.id];
            const failed = !!errors[tp.id];
            return (
              <div
                key={tp.id}
                className={`group flex h-7 items-center gap-1.5 rounded-md pl-1.5 pr-1 text-xs ${isSel ? 'bg-accent/10 text-accent' : 'hover:bg-app'}`}
              >
                <button className="flex min-w-0 flex-1 items-center gap-1.5 text-left" onClick={() => selectToolpath(isSel ? null : tp.id)}>
                  {busy ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : failed ? (
                    <TriangleAlert size={13} className="text-warn" />
                  ) : (
                    <Icon size={13} className={tp.operation.startsWith('laser') ? 'text-laser' : ''} />
                  )}
                  <span className={`truncate ${tp.visible ? '' : 'opacity-50'}`}>{tp.name}</span>
                </button>
                <button
                  className="rounded p-0.5 text-muted opacity-0 hover:text-ink focus:opacity-100 group-hover:opacity-100"
                  onClick={() => updateToolpath(tp.id, { visible: !tp.visible })}
                  aria-label={tp.visible ? 'Dölj' : 'Visa'}
                >
                  {tp.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                </button>
                <button
                  className="rounded p-0.5 text-muted opacity-0 hover:text-warn focus:opacity-100 group-hover:opacity-100"
                  onClick={() => removeToolpath(tp.id)}
                  aria-label="Ta bort"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </Section>
      </div>
    </aside>
  );
}
