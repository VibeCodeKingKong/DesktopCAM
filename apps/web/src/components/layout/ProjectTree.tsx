import { useState, type ReactNode } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
  GripVertical,
  Rows3,
  Plus,
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
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ToolpathConfig } from '@desktopcam/core';
import { shapeHasArea, type OperationType, type ShapeKind } from '@desktopcam/core';
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
  plasmaCut: Zap,
  facing: Rows3,
};

function Section({
  icon: Icon,
  label,
  children,
  count,
  defaultOpen = true,
  trailing,
  labelNode,
  className = '',
}: {
  icon: LucideIcon;
  label: string;
  /** Ersätter etiketten (t.ex. ett namnfält eller en knapp). */
  labelNode?: ReactNode;
  className?: string;
  children?: ReactNode;
  count?: number;
  defaultOpen?: boolean;
  trailing?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <div className={`group flex items-center rounded-md hover:bg-app ${className}`}>
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={label} className={`flex h-8 items-center gap-1.5 px-1.5 text-xs font-medium lg:h-7 ${labelNode ? 'shrink-0' : 'min-w-0 flex-1'}`}>
          {children ? open ? <ChevronDown size={13} className="shrink-0 text-muted" /> : <ChevronRight size={13} className="shrink-0 text-muted" /> : <span className="w-[13px] shrink-0" />}
          <Icon size={14} className="shrink-0 text-muted" />
          {!labelNode && <span className="flex-1 truncate text-left">{label}</span>}
          {!labelNode && count !== undefined && <span className="text-2xs text-muted">{count}</span>}
        </button>
        {labelNode}
        {trailing && <div className="pr-1">{trailing}</div>}
      </div>
      {open && children && <div className="ml-4 border-l border-line pl-1.5">{children}</div>}
    </div>
  );
}

const row = 'flex h-8 w-full items-center gap-1.5 rounded-md px-1.5 text-xs lg:h-7';
/** Små knappar i raderna: alltid synliga men dämpade, tydliga vid hovring. */
const rowBtn = 'shrink-0 rounded p-1 text-muted hover:text-ink lg:opacity-50 lg:group-hover:opacity-100 focus:opacity-100';
const trashBtn = 'shrink-0 rounded p-1 text-muted hover:text-warn lg:opacity-50 lg:group-hover:opacity-100 focus:opacity-100';

/** En verktygsbana som kan dras till en ny plats i listan. */
function SortableToolpath({ tp, children }: { tp: ToolpathConfig; children: (handle: ReactNode) => ReactNode }) {
  const t = useT();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: tp.id });
  const handle = (
    <button
      ref={setActivatorNodeRef}
      {...attributes}
      {...listeners}
      className="shrink-0 cursor-grab touch-none rounded p-0.5 text-muted hover:text-ink active:cursor-grabbing"
      aria-label={t.tree.dragToReorder}
      title={t.tree.dragToReorder}
    >
      <GripVertical size={13} />
    </button>
  );
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={isDragging ? 'relative z-10 rounded-md bg-surface opacity-90 shadow-pop' : ''}>
      {children(handle)}
    </div>
  );
}

/** Lagrets namn: klick gör lagret aktivt och markerar formerna, dubbelklick byter namn. */
function LayerName({ id, name, active, count }: { id: string; name: string; active: boolean; count: number }) {
  const t = useT();
  const [editing, setEditing] = useState(false);
  const s = useAppStore.getState;
  if (editing)
    return (
      <input
        autoFocus
        defaultValue={name}
        className="field h-6 min-w-0 flex-1 px-1 text-xs"
        aria-label={t.tree.renameLayer}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v && v !== name) s().renameLayer(id, v);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') setEditing(false);
        }}
      />
    );
  return (
    <button
      className={`flex h-8 min-w-0 flex-1 items-center gap-1.5 text-left text-xs lg:h-7 ${active ? 'font-semibold text-accent' : 'font-medium'}`}
      title={t.tree.layerHint}
      onClick={() => {
        s().setActiveLayer(id);
        s().setSelection(s().layers.find((l) => l.id === id)?.shapes.map((sh) => sh.id) ?? []);
      }}
      onDoubleClick={() => setEditing(true)}
    >
      <span className="truncate">{name}</span>
      {active && <span className="shrink-0 rounded bg-accent/10 px-1 text-[10px] font-medium">{t.tree.activeLayer}</span>}
      <span className="ml-auto pr-1 text-2xs font-normal text-muted">{count}</span>
    </button>
  );
}

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
  const moveToolpath = useAppStore((s) => s.moveToolpath);
  const deleteShapes = useAppStore((s) => s.deleteShapes);
  const removeRelief = useAppStore((s) => s.removeRelief);
  const activeLayerId = useAppStore((s) => s.activeLayerId);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const ids = toolpaths.map((x) => x.id);
    moveToolpath(ids.indexOf(String(e.active.id)), ids.indexOf(String(e.over.id)));
  };
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
        <Section icon={machine.kind === 'laser' ? Flame : machine.kind === 'plasma' ? Zap : Cog} label={machine.name} />
        <div className="flex h-7 items-center gap-1.5 px-1.5 text-xs">
          <span className="w-[13px]" />
          <span className="h-3.5 w-3.5 rounded-sm border border-black/10" style={{ background: preset.color }} />
          <span>
            {materialName(t, preset.id, preset.name)}, {material.thickness} mm
          </span>
        </div>

        <Section
          icon={Shapes}
          label={t.tree.shapes}
          count={shapeCount}
          trailing={
            <button className={rowBtn} onClick={() => useAppStore.getState().addLayer(t.common.layer(layers.length + 1))} aria-label={t.tree.addLayer} title={t.tree.addLayer}>
              <Plus size={13} />
            </button>
          }
        >
          {shapeCount === 0 && <p className="px-2 py-1.5 text-2xs text-muted">{t.tree.noShapes}</p>}
          {layers
            .filter((l) => l.shapes.length || layers.length > 1)
            .map((layer) => {
              const isActive = (layers.find((l) => l.id === activeLayerId) ?? layers[0])?.id === layer.id;
              return (
                <Section
                  key={layer.id}
                  icon={Layers}
                  label={layer.name}
                  defaultOpen={layer.shapes.length <= 12}
                  labelNode={<LayerName id={layer.id} name={layer.name} active={isActive && layers.length > 1} count={layer.shapes.length} />}
                  trailing={
                    <div className="flex">
                      <button className={rowBtn} onClick={() => toggleLayer(layer.id)} aria-label={layer.visible ? t.tree.hideLayer : t.tree.showLayer} title={layer.visible ? t.tree.hideLayer : t.tree.showLayer}>
                        {layer.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                      </button>
                      {layers.length > 1 && (
                        <button className={trashBtn} onClick={() => useAppStore.getState().removeLayer(layer.id)} aria-label={t.tree.removeLayer} title={t.tree.removeLayer}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  }
                >
                  {layer.shapes.length === 0 && <p className="px-2 py-1 text-2xs text-muted">{t.tree.emptyLayer}</p>}
                  {layer.shapes.map((sh) => {
                    const Icon = SHAPE_ICONS[sh.kind] ?? Shapes;
                    const isSel = selected.includes(sh.id);
                    const open = !shapeHasArea(sh);
                    return (
                      <div key={sh.id} className={`group ${row} pr-1 ${isSel ? 'bg-accent/10 text-accent' : 'hover:bg-app'} ${layer.visible ? '' : 'opacity-50'}`}>
                        <button
                          onClick={(e) => selectShape(sh.id, e.shiftKey || e.metaKey || e.ctrlKey)}
                          aria-pressed={isSel}
                          title={open ? t.tree.openPath : undefined}
                          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                        >
                          <Icon size={13} className="shrink-0" style={{ color: isSel ? undefined : layer.color }} />
                          <span className="truncate">{sh.name}</span>
                          {open && <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full border border-muted" />}
                        </button>
                        <button className={trashBtn} onClick={() => deleteShapes([sh.id])} aria-label={`${t.common.remove} ${sh.name}`} title={t.common.remove}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}
                </Section>
              );
            })}
        </Section>

        <Section icon={Mountain} label={t.tree.reliefs} count={reliefs.length}>
          {reliefs.length === 0 && <p className="px-2 py-1.5 text-2xs text-muted">{t.tree.noReliefs}</p>}
          {reliefs.map((r) => {
            const isSel = r.id === selectedRelief;
            return (
              <div key={r.id} className={`group ${row} pr-1 ${isSel ? 'bg-accent/10 text-accent' : 'hover:bg-app'} ${r.visible ? '' : 'opacity-50'}`}>
                <button onClick={() => selectRelief(isSel ? null : r.id)} aria-pressed={isSel} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                  <Mountain size={13} className="shrink-0" />
                  <span className="flex-1 truncate">{r.name}</span>
                  <span className="text-2xs tabular-nums text-muted">{r.depth} mm</span>
                </button>
                <button className={trashBtn} onClick={() => removeRelief(r.id)} aria-label={`${t.common.remove} ${r.name}`} title={t.common.remove}>
                  <Trash2 size={13} />
                </button>
              </div>
            );
          })}
        </Section>

        <Section icon={Layers} label={t.tree.toolpaths} count={toolpaths.length}>
          {toolpaths.length === 0 && <p className="px-2 py-1.5 text-2xs leading-relaxed text-muted">{t.tree.noToolpaths}</p>}
          {toolpaths.length > 1 && <p className="px-2 pb-1 pt-0.5 text-2xs text-muted">{t.tree.orderHint}</p>}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={toolpaths.map((x) => x.id)} strategy={verticalListSortingStrategy}>
              {toolpaths.map((tp) => {
                const Icon = OP_ICONS[tp.operation];
                const isSel = tp.id === selectedTp;
                const busy = !!progress[tp.id];
                const failed = !!errors[tp.id] || !!results[tp.id]?.warnings?.length;
                return (
                  <SortableToolpath key={tp.id} tp={tp}>
                    {(handle) => (
                      <div className={`group ${row} pl-0.5 pr-1 ${isSel ? 'bg-accent/10 text-accent' : 'hover:bg-app'}`}>
                        {toolpaths.length > 1 && handle}
                        <button className="flex min-w-0 flex-1 items-center gap-1.5 text-left" onClick={() => selectToolpath(isSel ? null : tp.id)}>
                          {busy ? (
                            <Loader2 size={13} className="shrink-0 animate-spin" />
                          ) : failed ? (
                            <TriangleAlert size={13} className="shrink-0 text-warn" />
                          ) : (
                            <Icon size={13} className={`shrink-0 ${tp.operation.startsWith('laser') ? 'text-laser' : ''}`} />
                          )}
                          <span className={`truncate ${tp.visible ? '' : 'opacity-50'}`}>{tp.name}</span>
                        </button>
                        <button className={rowBtn} onClick={() => updateToolpath(tp.id, { visible: !tp.visible })} aria-label={tp.visible ? t.common.hide : t.common.show}>
                          {tp.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                        </button>
                        <button className={trashBtn} onClick={() => removeToolpath(tp.id)} aria-label={`${t.common.remove} ${tp.name}`} title={t.common.remove}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    )}
                  </SortableToolpath>
                );
              })}
            </SortableContext>
          </DndContext>
        </Section>
      </div>
    </SidePanel>
  );
}
