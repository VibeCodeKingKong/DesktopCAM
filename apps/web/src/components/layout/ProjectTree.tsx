import { useState, type ReactNode } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Circle,
  CircleDot,
  Combine,
  Cog,
  Eye,
  EyeOff,
  Flame,
  Folder,
  ImagePlus,
  Layers,
  Loader2,
  Mountain,
  PenTool,
  Scissors,
  Shapes,
  Spline,
  Square,
  Trash2,
  Triangle,
  TriangleAlert,
  Type,
  Slash,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { OperationType, ShapeKind } from '@desktopcam/core';
import { useAppStore, useMachine, useMaterialPreset } from '../../store/useAppStore';
import { materialName, useT } from '../../i18n';
import { SidePanel } from './SidePanel';

const SHAPE_ICONS: Partial<Record<ShapeKind, LucideIcon>> = {
  rect: Square,
  circle: Circle,
  polygon: PenTool,
  imported: PenTool,
  bezier: Spline,
  line: Slash,
  text: Type,
};
const OP_ICONS: Record<OperationType, LucideIcon> = {
  profile: Square,
  pocket: Layers,
  drill: CircleDot,
  vcarve: Triangle,
  laserCut: Scissors,
  laserRaster: ImagePlus,
  relief: Mountain,
  inlay: Combine,
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
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex h-8 min-w-0 flex-1 items-center gap-1.5 px-1.5 text-xs font-medium lg:h-7">
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

const row = 'flex h-8 w-full items-center gap-1.5 rounded-md px-1.5 text-xs lg:h-7';

export function ProjectTree() {
  const t = useT();
  const projectName = useAppStore((s) => s.projectName);
  const layers = useAppStore((s) => s.layers);
  const selected = useAppStore((s) => s.selectedShapeIds);
  const selectShape = useAppStore((s) => s.selectShape);
  const toggleLayer = useAppStore((s) => s.toggleLayer);
  const reliefs = useAppStore((s) => s.reliefs);
  const selectedRelief = useAppStore((s) => s.selectedReliefId);
  const selectRelief = useAppStore((s) => s.selectRelief);
  const toolpaths = useAppStore((s) => s.toolpaths);
  const selectedTp = useAppStore((s) => s.selectedToolpathId);
  const selectToolpath = useAppStore((s) => s.selectToolpath);
  const updateToolpath = useAppStore((s) => s.updateToolpath);
  const removeToolpath = useAppStore((s) => s.removeToolpath);
  const progress = useAppStore((s) => s.progress);
  const errors = useAppStore((s) => s.errors);
  const results = useAppStore((s) => s.results);
  const material = useAppStore((s) => s.material);
  const preset = useMaterialPreset();
  const machine = useMachine();
  const shapeCount = layers.reduce((n, l) => n + l.shapes.length, 0);

  return (
    <SidePanel id="tree" side="left" title={t.tree.title}>
      <div className="space-y-0.5 p-1.5">
        <Section icon={Folder} label={projectName || t.common.untitledProject} />
        <Section icon={machine.kind === 'laser' ? Flame : Cog} label={machine.name} />
        <div className="flex h-7 items-center gap-1.5 px-1.5 text-xs">
          <span className="w-[13px]" />
          <span className="h-3.5 w-3.5 rounded-sm border border-black/10" style={{ background: preset.color }} />
          <span>
            {materialName(t, preset.id, preset.name)}, {material.thickness} mm
          </span>
        </div>

        <Section icon={Shapes} label={t.tree.shapes} count={shapeCount}>
          {shapeCount === 0 && <p className="px-2 py-1.5 text-2xs text-muted">{t.tree.noShapes}</p>}
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
                    className="rounded p-1 text-muted hover:text-ink"
                    onClick={() => toggleLayer(layer.id)}
                    aria-label={layer.visible ? t.tree.hideLayer : t.tree.showLayer}
                    title={layer.visible ? t.tree.hideLayer : t.tree.showLayer}
                  >
                    {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
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
                      title={open ? t.tree.openPath : undefined}
                      className={`${row} ${isSel ? 'bg-accent/10 text-accent' : 'hover:bg-app'} ${layer.visible ? '' : 'opacity-50'}`}
                    >
                      <Icon size={13} style={{ color: isSel ? undefined : layer.color }} />
                      <span className="truncate">{sh.name}</span>
                      {open && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full border border-muted" />}
                    </button>
                  );
                })}
              </Section>
            ))}
        </Section>

        <Section icon={Mountain} label={t.tree.reliefs} count={reliefs.length}>
          {reliefs.length === 0 && <p className="px-2 py-1.5 text-2xs text-muted">{t.tree.noReliefs}</p>}
          {reliefs.map((r) => {
            const isSel = r.id === selectedRelief;
            return (
              <button
                key={r.id}
                onClick={() => selectRelief(isSel ? null : r.id)}
                aria-pressed={isSel}
                className={`${row} ${isSel ? 'bg-accent/10 text-accent' : 'hover:bg-app'} ${r.visible ? '' : 'opacity-50'}`}
              >
                <Mountain size={13} />
                <span className="flex-1 truncate text-left">{r.name}</span>
                <span className="text-2xs tabular-nums text-muted">{r.depth} mm</span>
              </button>
            );
          })}
        </Section>

        <Section icon={Layers} label={t.tree.toolpaths} count={toolpaths.length}>
          {toolpaths.length === 0 && <p className="px-2 py-1.5 text-2xs leading-relaxed text-muted">{t.tree.noToolpaths}</p>}
          {toolpaths.map((tp) => {
            const Icon = OP_ICONS[tp.operation];
            const isSel = tp.id === selectedTp;
            const busy = !!progress[tp.id];
            const failed = !!errors[tp.id] || !!results[tp.id]?.warnings?.length;
            return (
              <div key={tp.id} className={`group ${row} pr-1 ${isSel ? 'bg-accent/10 text-accent' : 'hover:bg-app'}`}>
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
                  className="rounded p-1 text-muted hover:text-ink lg:opacity-0 lg:focus:opacity-100 lg:group-hover:opacity-100"
                  onClick={() => updateToolpath(tp.id, { visible: !tp.visible })}
                  aria-label={tp.visible ? t.common.hide : t.common.show}
                >
                  {tp.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                </button>
                <button
                  className="rounded p-1 text-muted hover:text-warn lg:opacity-0 lg:focus:opacity-100 lg:group-hover:opacity-100"
                  onClick={() => removeToolpath(tp.id)}
                  aria-label={t.common.remove}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </Section>
      </div>
    </SidePanel>
  );
}
