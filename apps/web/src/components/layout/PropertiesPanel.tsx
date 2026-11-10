import { useMemo, useState, type ReactNode } from 'react';
import { CircleDot, Copy, Crosshair, Download, FlipHorizontal2, FlipVertical2, Flame, Layers, Lock, RefreshCw, RotateCcw, RotateCw, Scissors, Square, Trash2, Unlock } from 'lucide-react';
import {
  defaultStrategy,
  inlayFit,
  matchPreset,
  shapesBounds,
  type CutDirection,
  type CutSide,
  type DitherMethod,
  type InlayToolpath,
  type ProfileStrategy,
  type ProfileToolpath,
  type ReliefInstance,
  type StrategyPreset,
  type TabSettings,
  type ToolpathConfig,
  type VectorShape,
} from '@desktopcam/core';
import { allShapes, useAppStore, useMachine, useMaterialPreset, useSelectedRelief, useSelectedToolpath } from '../../store/useAppStore';
import { computeToolpath, drillPoints, resolveProfile, scheduleCompute } from '../../cam/toolpathService';
import {
  centerSelection,
  createLineEngraving,
  createToolpath,
  deleteSelection,
  duplicateSelection,
  exportSelectedGcode,
  mirrorSelection,
  rotateSelection,
  setSelectionBox,
  updateText,
} from '../../cam/commands';
import { FieldRow, NumberField, Segmented, SelectField, Switch } from '../ui/Field';
import { duration, mm } from '../../utils/format';
import { materialName, toolName, useT, type GuideKey } from '../../i18n';
import { InfoHint } from '../smartguide/InfoHint';
import { SidePanel } from './SidePanel';
import { getNode, moveNode, nodeCount, setClosed } from '../../editing/nodes';

function Group({ title, children, hint }: { title: string; children: ReactNode; hint?: GuideKey }) {
  return (
    <fieldset className="space-y-2 border-b border-line px-3 py-3 last:border-b-0">
      <legend className="sr-only">{title}</legend>
      <p className="flex items-center gap-1 text-2xs font-semibold text-muted">
        {title}
        {hint && <InfoHint topic={hint} />}
      </p>
      {children}
    </fieldset>
  );
}

export function PropertiesPanel() {
  const t = useT();
  const tp = useSelectedToolpath();
  const relief = useSelectedRelief();
  const selectedCount = useAppStore((s) => s.selectedShapeIds.length);
  const title = tp ? t.props.toolpath : relief ? t.props.relief : selectedCount ? t.props.shapes(selectedCount) : t.props.title;
  return (
    <SidePanel id="props" side="right" title={title} wide>
      {tp ? <ToolpathEditor tp={tp} /> : relief ? <ReliefEditor relief={relief} /> : selectedCount ? <ShapeEditor /> : <EmptyState />}
    </SidePanel>
  );
}

function EmptyState() {
  const t = useT();
  const preset = useMaterialPreset();
  const tips = t.materials[preset.id]?.tips ?? preset.tips;
  return (
    <div className="space-y-4 p-4 text-xs leading-relaxed">
      <p className="text-muted">{t.props.emptyHint}</p>
      <div className="rounded-lg border border-line bg-app p-3">
        <p className="mb-1.5 font-semibold">{t.props.tipsFor(materialName(t, preset.id, preset.name))}</p>
        <ul className="list-disc space-y-1 pl-4 text-muted">
          {tips.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ───────── Former ───────── */

function ShapeEditor() {
  const t = useT();
  const layers = useAppStore((s) => s.layers);
  const ids = useAppStore((s) => s.selectedShapeIds);
  const editTool = useAppStore((s) => s.editTool);
  const selectedNode = useAppStore((s) => s.selectedNode);
  const machine = useMachine();
  const [lock, setLock] = useState(true);
  const [angle, setAngle] = useState(15);
  const shapes = useMemo(() => allShapes(layers).filter((x) => ids.includes(x.id)), [layers, ids]);
  const b = useMemo(() => shapesBounds(shapes), [shapes]);
  if (!b) return null;
  const w = b.max.x - b.min.x;
  const h = b.max.y - b.min.y;
  const single: VectorShape | undefined = shapes.length === 1 ? shapes[0] : undefined;
  const nodeShape = selectedNode ? shapes.find((x) => x.id === selectedNode.shapeId) : undefined;
  const nodePath = nodeShape?.paths[selectedNode!.pathIndex];
  const nodePos = nodePath && selectedNode && selectedNode.index < nodeCount(nodePath) ? getNode(nodePath, selectedNode.index) : null;
  const setNode = (x: number, y: number) => {
    if (!nodeShape || !nodePath || !selectedNode) return;
    const path = moveNode(nodePath, selectedNode.index, { x, y });
    useAppStore.getState().replaceShapes([{ ...nodeShape, paths: nodeShape.paths.map((p, i) => (i === selectedNode.pathIndex ? path : p)) }]);
  };
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const isLaser = machine.kind === 'laser';
  const anyClosed = shapes.some((x) => x.paths.some((p) => p.closed));

  return (
    <div>
      {editTool === 'nodes' && nodePos && (
        <Group title={t.props.nodeSelected}>
          <NumberField label={t.props.x} unit="mm" step={0.5} value={r2(nodePos.x)} onChange={(x) => setNode(x, nodePos.y)} />
          <NumberField label={t.props.y} unit="mm" step={0.5} value={r2(nodePos.y)} onChange={(y) => setNode(nodePos.x, y)} />
          <button className="btn w-full" onClick={deleteSelection}>
            <Trash2 size={13} /> {t.props.deleteNode}
          </button>
        </Group>
      )}

      {single?.text && (
        <Group title={t.props.text}>
          <FieldRow label={t.props.textContent}>
            <textarea
              className="field h-16 resize-y py-1"
              defaultValue={single.text.content}
              key={single.id + single.text.content}
              onBlur={(e) => e.target.value !== single.text!.content && updateText(single, { content: e.target.value })}
            />
          </FieldRow>
          <NumberField label={t.props.textHeight} unit="mm" min={1} step={1} value={single.text.height} onChange={(height) => updateText(single, { height })} />
          <NumberField label={t.props.textSpacing} unit="mm" step={0.5} value={single.text.spacing} onChange={(spacing) => updateText(single, { spacing })} />
          <FieldRow label={t.props.textAlign}>
            <Segmented
              label={t.props.textAlign}
              value={single.text.align}
              options={[
                { value: 'left', label: t.props.align.left },
                { value: 'center', label: t.props.align.center },
                { value: 'right', label: t.props.align.right },
              ]}
              onChange={(align) => updateText(single, { align })}
            />
          </FieldRow>
        </Group>
      )}

      <Group title={t.props.placement}>
        <NumberField label={t.props.x} unit="mm" step={1} value={r2(b.min.x)} onChange={(x) => setSelectionBox(x, b.min.y, w, h)} />
        <NumberField label={t.props.y} unit="mm" step={1} value={r2(b.min.y)} onChange={(y) => setSelectionBox(b.min.x, y, w, h)} />
        <NumberField
          label={t.props.width}
          unit="mm"
          step={1}
          min={0.1}
          value={r2(w)}
          onChange={(nw) => setSelectionBox(b.min.x, b.min.y, nw, lock && w > 0 ? (h * nw) / w : h)}
        />
        <NumberField
          label={t.props.height}
          unit="mm"
          step={1}
          min={0.1}
          value={r2(h)}
          onChange={(nh) => setSelectionBox(b.min.x, b.min.y, lock && h > 0 ? (w * nh) / h : w, nh)}
        />
        <FieldRow label={t.props.lockAspect}>
          <button className="btn h-6 px-2" onClick={() => setLock((l) => !l)} aria-pressed={lock}>
            {lock ? <Lock size={12} /> : <Unlock size={12} />}
            {lock ? t.common.locked : t.common.free}
          </button>
        </FieldRow>
        <FieldRow label={t.props.rotate}>
          <div className="flex items-center gap-1">
            <button className="btn h-7 px-2" onClick={() => rotateSelection(angle)} title={`+${angle}°`} aria-label={`${t.props.rotate} +${angle}°`}>
              <RotateCcw size={13} />
            </button>
            <input
              className="field w-14 text-center"
              inputMode="decimal"
              value={angle}
              aria-label={t.props.rotateBy}
              onChange={(e) => {
                const v = parseFloat(e.target.value.replace(',', '.'));
                if (Number.isFinite(v)) setAngle(v);
              }}
            />
            <button className="btn h-7 px-2" onClick={() => rotateSelection(-angle)} title={`−${angle}°`} aria-label={`${t.props.rotate} −${angle}°`}>
              <RotateCw size={13} />
            </button>
          </div>
        </FieldRow>
        <div className="grid grid-cols-2 gap-2">
          <button className="btn" onClick={() => mirrorSelection('h')} title={t.props.mirrorH}>
            <FlipHorizontal2 size={13} /> <span className="truncate">{t.props.mirrorH}</span>
          </button>
          <button className="btn" onClick={() => mirrorSelection('v')} title={t.props.mirrorV}>
            <FlipVertical2 size={13} /> <span className="truncate">{t.props.mirrorV}</span>
          </button>
          <button className="btn" onClick={centerSelection}>
            <Crosshair size={13} /> <span className="truncate">{t.props.alignCenter}</span>
          </button>
          <button className="btn" onClick={duplicateSelection}>
            <Copy size={13} /> {t.common.duplicate}
          </button>
        </div>
        {single && single.paths.length === 1 && (
          <FieldRow label={t.props.pathStatus}>
            <Segmented
              label={t.props.pathStatus}
              value={single.paths[0].closed ? 'closed' : 'open'}
              options={[
                { value: 'closed', label: t.props.closed },
                { value: 'open', label: t.props.open },
              ]}
              onChange={(v) => useAppStore.getState().replaceShapes([{ ...single, text: undefined, paths: [setClosed(single.paths[0], v === 'closed')] }])}
            />
          </FieldRow>
        )}
        <button className="btn w-full text-warn" onClick={deleteSelection}>
          <Trash2 size={13} /> {t.common.remove}
        </button>
      </Group>

      <Group title={t.props.machining}>
        <p className="text-2xs text-muted">{t.props.operationsHint}</p>
        <div className="grid grid-cols-2 gap-2">
          {isLaser ? (
            <>
              <button className="btn" onClick={() => createToolpath('laserCut')}>
                <Scissors size={13} className="text-laser" /> {t.buttons.laserCut.label.replace('\u00ad', '')}
              </button>
              <button className="btn" onClick={createLineEngraving}>
                <Flame size={13} className="text-laser" /> {t.buttons.lineEngrave.label.replace('\u00ad', '')}
              </button>
            </>
          ) : (
            <>
              <button className="btn" onClick={() => createToolpath('profile')}>
                <Square size={13} className="text-accent" /> {t.operations.profile}
              </button>
              <button className="btn" onClick={() => createToolpath('pocket')} disabled={!anyClosed}>
                <Layers size={13} className="text-accent" /> {t.operations.pocket}
              </button>
              <button className="btn" onClick={() => createToolpath('drill')} disabled={!anyClosed}>
                <CircleDot size={13} className="text-accent" /> {t.operations.drill}
              </button>
            </>
          )}
        </div>
      </Group>
    </div>
  );
}

/* ───────── Reliefer ───────── */

function ReliefEditor({ relief }: { relief: ReliefInstance }) {
  const t = useT();
  const update = useAppStore((s) => s.updateRelief);
  const remove = useAppStore((s) => s.removeRelief);
  const material = useAppStore((s) => s.material);
  const isLaser = useMachine().kind === 'laser';
  const patch = (p: Partial<ReliefInstance>) => {
    useAppStore.getState().checkpoint();
    update(relief.id, p);
  };
  return (
    <div>
      <Group title={t.props.general}>
        <FieldRow label={t.common.name}>
          <input className="field" value={relief.name} onChange={(e) => update(relief.id, { name: e.target.value })} />
        </FieldRow>
        <FieldRow label={t.props.visible}>
          <Switch checked={relief.visible} onChange={(visible) => update(relief.id, { visible })} label={t.props.visible} />
        </FieldRow>
      </Group>
      <Group title={t.props.placement}>
        <NumberField label={t.props.x} unit="mm" value={relief.x} onChange={(x) => patch({ x })} />
        <NumberField label={t.props.y} unit="mm" value={relief.y} onChange={(y) => patch({ y })} />
        <NumberField label={t.props.width} unit="mm" min={5} value={relief.width} onChange={(width) => patch({ width })} />
        <NumberField label={t.props.height} unit="mm" min={5} value={relief.height} onChange={(height) => patch({ height })} />
        <button className="btn w-full" onClick={() => patch({ x: (material.width - relief.width) / 2, y: (material.height - relief.height) / 2 })}>
          {t.props.centerOnStock}
        </button>
      </Group>
      <Group title={t.props.form}>
        <NumberField label={t.props.depth} unit="mm" min={0.2} step={0.5} value={relief.depth} hint="reliefDepth" onChange={(depth) => patch({ depth })} />
        <FieldRow label={t.props.invert}>
          <Switch checked={relief.invert} onChange={(invert) => patch({ invert })} label={t.props.invert} />
        </FieldRow>
        <FieldRow label={t.props.mirror}>
          <Switch checked={relief.mirror} onChange={(mirror) => patch({ mirror })} label={t.props.mirror} />
        </FieldRow>
        {relief.depth > material.thickness && <p className="rounded-md bg-warn/10 px-2 py-1.5 text-xs text-warn">{t.props.tooDeep(material.thickness)}</p>}
      </Group>
      <Group title={t.props.machining}>
        <div className="flex gap-2">
          <button className="btn btn-primary flex-1" onClick={() => createToolpath('relief')} disabled={isLaser} title={isLaser ? t.reasons.needsRouter : undefined}>
            {t.props.createRelief}
          </button>
          <button className="btn" onClick={() => remove(relief.id)} title={t.props.removeRelief} aria-label={t.props.removeRelief}>
            <Trash2 size={13} />
          </button>
        </div>
      </Group>
    </div>
  );
}

/* ───────── Verktygsbanor ───────── */

function ToolpathEditor({ tp }: { tp: ToolpathConfig }) {
  const t = useT();
  const tools = useAppStore((s) => s.tools);
  const layers = useAppStore((s) => s.layers);
  const update = useAppStore((s) => s.updateToolpath);
  const remove = useAppStore((s) => s.removeToolpath);
  const result = useAppStore((s) => s.results[tp.id]);
  const busy = useAppStore((s) => !!s.progress[tp.id]);
  const error = useAppStore((s) => s.errors[tp.id]);
  const engine = useAppStore((s) => s.engine);

  const patch = (p: Partial<ToolpathConfig>) => {
    update(tp.id, p);
    scheduleCompute(tp.id);
    // Inlägg: fickan och pluggen delar allt utom vilken del de är.
    if (tp.operation === 'inlay') {
      const shared = { ...p } as Partial<InlayToolpath>;
      delete shared.name;
      delete shared.part;
      delete shared.visible;
      if (Object.keys(shared).length) {
        for (const sib of useAppStore.getState().toolpaths) {
          if (sib.id !== tp.id && sib.operation === 'inlay' && sib.groupId === tp.groupId) {
            update(sib.id, shared);
            scheduleCompute(sib.id);
          }
        }
      }
    }
  };
  const param = (p: Partial<ToolpathConfig['params']>) => patch({ params: { ...tp.params, ...p } });
  const isLaser = tp.operation === 'laserCut' || tp.operation === 'laserRaster';
  const toolFilter = (kind: string) =>
    tp.operation === 'vcarve' || tp.operation === 'inlay'
      ? kind === 'vbit'
      : isLaser
      ? kind === 'laser'
      : tp.operation === 'relief'
        ? kind === 'ballnose' || kind === 'endmill' || kind === 'vbit'
        : tp.operation === 'drill'
          ? kind === 'drill' || kind === 'endmill'
          : kind !== 'laser';
  const sides: { value: CutSide; label: string }[] = [
    { value: 'outside', label: t.props.sides.outside },
    { value: 'inside', label: t.props.sides.inside },
    { value: 'on', label: t.props.sides.on },
  ];
  const dithers = (Object.keys(t.props.ditherMethods) as DitherMethod[]).map((value) => ({ value, label: t.props.ditherMethods[value] }));
  const preset = useMaterialPreset();
  const machineKind = useMachine().kind;
  const materialWarning =
    tp.operation === 'laserCut' && tp.side !== 'on' && preset.laser.canCut === false
      ? t.props.cannotCut
      : machineKind === 'router' && !preset.router
        ? t.props.notForRouter
        : null;
  const holes = tp.operation === 'drill' ? drillPoints(allShapes(layers).filter((s) => tp.shapeIds.includes(s.id))).length : 0;
  const speedGroup = (
    <Group title={t.props.speed}>
      <NumberField label={t.props.feed} unit="mm/min" step={50} min={1} value={tp.params.feedRate} hint="feedRate" onChange={(feedRate) => param({ feedRate })} />
      <NumberField label={t.props.plunge} unit="mm/min" step={25} min={1} value={tp.params.plungeRate} hint="plungeRate" onChange={(plungeRate) => param({ plungeRate })} />
      <NumberField label={t.props.spindle} unit="rpm" step={1000} min={0} value={tp.params.spindleRpm ?? 18000} hint="spindleRpm" onChange={(spindleRpm) => param({ spindleRpm })} />
    </Group>
  );

  return (
    <div>
      <Group title={t.props.general}>
        <FieldRow label={t.common.name}>
          <input className="field" value={tp.name} onChange={(e) => update(tp.id, { name: e.target.value })} />
        </FieldRow>
        <SelectField
          label={t.props.tool}
          value={tp.toolId}
          options={tools.filter((x) => toolFilter(x.kind)).map((x) => ({ value: x.id, label: toolName(t, x.id, x.name) }))}
          onChange={(toolId) => patch({ toolId })}
        />
        {(tp.operation === 'profile' || tp.operation === 'laserCut') && (
          <FieldRow label={t.props.side} hint="cutSide">
            <Segmented label={t.props.side} value={tp.side} options={sides} onChange={(side) => patch({ side })} />
          </FieldRow>
        )}
        {materialWarning && <p className="rounded-md bg-warn/10 px-2 py-1.5 text-xs text-warn">{materialWarning}</p>}
      </Group>

      {tp.operation === 'profile' && (
        <>
          <Group title={t.props.depth}>
            <NumberField label={t.props.cutDepth} unit="mm" step={0.5} min={0} value={tp.cutDepth} hint="cutDepth" onChange={(cutDepth) => patch({ cutDepth })} />
            <NumberField label={t.props.stepDown} unit="mm" step={0.1} min={0.05} value={tp.params.stepDown} hint="stepDown" onChange={(stepDown) => param({ stepDown })} />
          </Group>
          <ProfileStrategyEditor tp={tp} patch={patch} />
          <TabsEditor tp={tp} patch={patch} />
          {speedGroup}
        </>
      )}

      {tp.operation === 'pocket' && (
        <>
          <Group title={t.props.depth}>
            <NumberField label={t.props.cutDepth} unit="mm" step={0.5} min={0.1} value={tp.cutDepth} hint="cutDepth" onChange={(cutDepth) => patch({ cutDepth })} />
            <NumberField label={t.props.stepDown} unit="mm" step={0.1} min={0.05} value={tp.params.stepDown} hint="stepDown" onChange={(stepDown) => param({ stepDown })} />
            <NumberField
              label={t.props.stepOver}
              unit="%"
              step={5}
              min={5}
              max={90}
              value={Math.round(tp.params.stepOver * 100)}
              hint="stepOver"
              onChange={(pct) => param({ stepOver: pct / 100 })}
            />
          </Group>
          {speedGroup}
        </>
      )}

      {tp.operation === 'vcarve' && (
        <>
          <Group title={t.props.depth}>
            <NumberField label={t.props.flatDepth} unit="mm" step={0.5} min={0} value={tp.flatDepth} hint="vFlatDepth" onChange={(flatDepth) => patch({ flatDepth })} />
            <p className="-mt-1 text-2xs text-muted">{t.props.flatDepthNote}</p>
            <NumberField label={t.props.contourStep} unit="mm" step={0.05} min={0.03} max={1} value={tp.contourStep} hint="contourStep" onChange={(contourStep) => patch({ contourStep })} />
            <NumberField label={t.props.stepDown} unit="mm" step={0.5} min={0.1} value={tp.params.stepDown} hint="stepDown" onChange={(stepDown) => param({ stepDown })} />
          </Group>
          {speedGroup}
        </>
      )}

      {tp.operation === 'inlay' && <InlaySettings tp={tp} patch={patch} param={param} />}
      {tp.operation === 'inlay' && speedGroup}

      {tp.operation === 'drill' && (
        <>
          <Group title={t.props.holes}>
            <p className="text-xs text-muted">{t.props.holeCount(holes)}</p>
            <NumberField label={t.props.drillDepth} unit="mm" step={0.5} min={0.1} value={tp.depth} hint="cutDepth" onChange={(depth) => patch({ depth })} />
            <NumberField label={t.props.peck} unit="mm" step={0.5} min={0} value={tp.peckDepth} hint="peck" onChange={(peckDepth) => patch({ peckDepth })} />
            <NumberField label={t.props.plunge} unit="mm/min" step={25} min={1} value={tp.params.plungeRate} hint="plungeRate" onChange={(plungeRate) => param({ plungeRate })} />
            <NumberField label={t.props.spindle} unit="rpm" step={1000} min={0} value={tp.params.spindleRpm ?? 12000} hint="spindleRpm" onChange={(spindleRpm) => param({ spindleRpm })} />
          </Group>
        </>
      )}

      {tp.operation === 'relief' && (
        <>
          <Group title={t.props.threeD}>
            <NumberField
              label={t.props.stepOver}
              unit="%"
              step={1}
              min={2}
              max={60}
              value={Math.round(tp.params.stepOver * 1000) / 10}
              hint="reliefStepOver"
              onChange={(pct) => param({ stepOver: pct / 100 })}
            />
            <FieldRow label={t.props.direction}>
              <Segmented
                label={t.props.direction}
                value={tp.direction}
                options={[
                  { value: 'x', label: t.props.alongX },
                  { value: 'y', label: t.props.alongY },
                ]}
                onChange={(direction) => patch({ direction })}
              />
            </FieldRow>
            <FieldRow label={t.props.roughing} hint="roughing">
              <Switch checked={tp.roughing} onChange={(roughing) => patch({ roughing })} label={t.props.roughing} />
            </FieldRow>
            {tp.roughing && (
              <>
                <NumberField label={t.props.stepDown} unit="mm" step={0.1} min={0.1} value={tp.params.stepDown} hint="stepDown" onChange={(stepDown) => param({ stepDown })} />
                <NumberField label={t.props.allowance} unit="mm" step={0.05} min={0} max={2} value={tp.allowance} hint="allowance" onChange={(allowance) => patch({ allowance })} />
              </>
            )}
          </Group>
          {speedGroup}
        </>
      )}

      {tp.operation === 'laserCut' && (
        <Group title={t.props.laser}>
          <NumberField label={t.props.laserSpeed} unit="mm/min" step={50} min={1} value={tp.params.feedRate} hint="laserSpeed" onChange={(feedRate) => param({ feedRate })} />
          <NumberField label={t.props.power} unit="%" step={5} min={0} max={100} value={tp.params.laserPowerPct ?? 100} hint="laserPower" onChange={(laserPowerPct) => param({ laserPowerPct })} />
          <NumberField label={t.props.passes} step={1} min={1} max={20} value={tp.passes} hint="passes" onChange={(passes) => patch({ passes: Math.round(passes) })} />
          {tp.side !== 'on' && <NumberField label={t.props.kerf} unit="mm" step={0.01} min={0} max={1} value={tp.kerf} hint="kerf" onChange={(kerf) => patch({ kerf })} />}
        </Group>
      )}

      {tp.operation === 'laserRaster' && (
        <>
          <Group title={t.props.image}>
            <NumberField label={t.props.width} unit="mm" step={5} min={5} value={tp.widthMm} onChange={(widthMm) => patch({ widthMm })} />
            <NumberField label={t.props.posX} unit="mm" step={1} value={tp.origin.x} onChange={(x) => patch({ origin: { ...tp.origin, x } })} />
            <NumberField label={t.props.posY} unit="mm" step={1} value={tp.origin.y} onChange={(y) => patch({ origin: { ...tp.origin, y } })} />
            <NumberField label={t.props.lineInterval} unit="mm" step={0.01} min={0.05} max={1} value={tp.lineIntervalMm} hint="lineInterval" onChange={(lineIntervalMm) => patch({ lineIntervalMm })} />
            <SelectField label={t.props.dither} value={tp.dither} options={dithers} hint="dither" onChange={(dither) => patch({ dither })} />
            <NumberField label={t.props.threshold} step={4} min={1} max={254} value={tp.threshold} onChange={(threshold) => patch({ threshold: Math.round(threshold) })} />
          </Group>
          <Group title={t.props.laser}>
            <NumberField label={t.props.laserSpeed} unit="mm/min" step={100} min={1} value={tp.params.feedRate} hint="laserSpeed" onChange={(feedRate) => param({ feedRate })} />
            <NumberField label={t.props.power} unit="%" step={5} min={0} max={100} value={tp.params.laserPowerPct ?? 30} hint="laserPower" onChange={(laserPowerPct) => param({ laserPowerPct })} />
          </Group>
        </>
      )}

      <Group title={t.props.result}>
        {error && <p className="rounded-md bg-warn/10 px-2 py-1.5 text-xs text-warn">{error}</p>}
        {result && (
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted">{t.props.cutLength}</dt>
            <dd className="text-right tabular-nums">{mm(result.stats.cutLengthMm, 0, t.locale)}</dd>
            <dt className="text-muted">{t.props.estTime}</dt>
            <dd className="text-right tabular-nums">{duration(result.stats.estimatedSeconds)}</dd>
            <dt className="text-muted">{t.props.gcodeLines}</dt>
            <dd className="text-right tabular-nums">{result.stats.lineCount.toLocaleString(t.locale)}</dd>
            <dt className="text-muted">{t.props.computedBy}</dt>
            <dd className="text-right">{result.engine === 'wasm' ? `Wasm ${engine?.version ?? ''}` : 'TypeScript'}</dd>
          </dl>
        )}
        <div className="flex gap-2 pt-1">
          <button className="btn btn-primary flex-1" onClick={() => void computeToolpath(tp.id)} disabled={busy}>
            <RefreshCw size={13} className={busy ? 'animate-spin' : ''} />
            {busy ? t.props.computing : t.props.compute}
          </button>
          <button className="btn" onClick={exportSelectedGcode} disabled={!result} title={t.props.saveGcode} aria-label={t.props.saveGcode}>
            <Download size={13} />
          </button>
          <button className="btn" onClick={() => remove(tp.id)} title={t.props.removeToolpath} aria-label={t.props.removeToolpath}>
            <Trash2 size={13} />
          </button>
        </div>
      </Group>
    </div>
  );
}

/* ───────── Inlägg ───────── */

function InlaySettings({
  tp,
  patch,
  param,
}: {
  tp: InlayToolpath;
  patch: (p: Partial<ToolpathConfig>) => void;
  param: (p: Partial<ToolpathConfig['params']>) => void;
}) {
  const t = useT();
  const tools = useAppStore((s) => s.tools);
  const toolpaths = useAppStore((s) => s.toolpaths);
  const selectToolpath = useAppStore((s) => s.selectToolpath);
  const sibling = toolpaths.find((x) => x.id !== tp.id && x.operation === 'inlay' && x.groupId === tp.groupId);
  const angle = tools.find((x) => x.id === tp.toolId)?.angle ?? 60;
  const tanA = Math.tan((angle * Math.PI) / 360);
  const fit = inlayFit(tp.pocketDepth, tp.startDepth, tp.plugDepth);
  const f1 = (n: number) => n.toLocaleString(t.locale, { maximumFractionDigits: 2 });

  return (
    <>
      <Group title={t.props.inlay}>
        <FieldRow label={t.props.inlayPart} hint="inlay">
          <p className="text-xs font-medium">{t.props.inlayParts[tp.part]}</p>
        </FieldRow>
        {sibling && (
          <button className="btn w-full" onClick={() => selectToolpath(sibling.id)}>
            {t.props.openPair(t.inlayParts[tp.part === 'pocket' ? 'plug' : 'pocket'])}
          </button>
        )}
        <NumberField label={t.props.pocketDepth} unit="mm" step={0.5} min={0.5} value={tp.pocketDepth} hint="inlayPocketDepth" onChange={(pocketDepth) => patch({ pocketDepth })} />
        <NumberField label={t.props.startDepth} unit="mm" step={0.1} min={0} value={tp.startDepth} hint="startDepth" onChange={(startDepth) => patch({ startDepth })} />
        <NumberField label={t.props.plugDepth} unit="mm" step={0.1} min={0.1} value={tp.plugDepth} hint="plugDepth" onChange={(plugDepth) => patch({ plugDepth })} />
        <NumberField label={t.props.plugMargin} unit="mm" step={1} min={1} value={tp.margin} hint="plugMargin" onChange={(margin) => patch({ margin })} />
        <NumberField label={t.props.contourStep} unit="mm" step={0.05} min={0.03} max={1} value={tp.contourStep} hint="contourStep" onChange={(contourStep) => patch({ contourStep })} />
        <NumberField label={t.props.stepDown} unit="mm" step={0.5} min={0.1} value={tp.params.stepDown} hint="stepDown" onChange={(stepDown) => param({ stepDown })} />

        <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 rounded-md bg-app p-2 text-xs">
          <dt className="text-muted">{t.props.glueGap}</dt>
          <dd className={`text-right tabular-nums ${fit.glueGap < 0 ? 'text-warn' : ''}`}>{f1(fit.glueGap)} mm</dd>
          <dt className="text-muted">{t.props.protrusion}</dt>
          <dd className={`text-right tabular-nums ${fit.protrusion <= 0 ? 'text-warn' : ''}`}>{f1(fit.protrusion)} mm</dd>
          <dt className="text-muted">{t.props.plugWidth}</dt>
          <dd className="text-right tabular-nums">{f1(2 * tp.startDepth * tanA)} mm</dd>
        </dl>
        {fit.glueGap < 0 && <p className="rounded-md bg-warn/10 px-2 py-1.5 text-xs text-warn">{t.props.inlayNoGap}</p>}
        {fit.protrusion <= 0 && <p className="rounded-md bg-warn/10 px-2 py-1.5 text-xs text-warn">{t.props.inlayNoProtrusion}</p>}
        {tp.part === 'plug' && <p className="text-2xs leading-relaxed text-muted">{t.props.plugMirrored}</p>}
        <p className="text-2xs text-muted">{t.props.sharedSettings}</p>
      </Group>
    </>
  );
}

/* ───────── Profilstrategi ───────── */

function Chip({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-line bg-app px-2 py-0.5 text-2xs text-ink/80">{children}</span>;
}

function ProfileStrategyEditor({ tp, patch }: { tp: ProfileToolpath; patch: (p: Partial<ToolpathConfig>) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const { strategy: st, tabs } = resolveProfile(tp);
  const fmt = (n: number) => n.toLocaleString(t.locale, { maximumFractionDigits: 2 });
  const presets: StrategyPreset[] = ['fast', 'balanced', 'fine'];
  const set = (p: Partial<ProfileStrategy>) => {
    const next = { ...st, ...p };
    patch({ strategy: { ...next, preset: matchPreset(next) } });
  };
  const onLine = tp.side === 'on';
  const dirOptions = (['conventional', 'climb'] as CutDirection[]).map((value) => ({ value, label: t.props.directions[value] }));
  const finishActive = st.finishPass && st.allowance > 0 && !onLine;

  return (
    <Group title={t.props.strategy} hint="profileStrategy">
      <Segmented
        label={t.props.strategy}
        value={st.preset === 'custom' ? ('custom' as StrategyPreset) : st.preset}
        options={[...presets, ...(st.preset === 'custom' ? (['custom'] as StrategyPreset[]) : [])].map((value) => ({ value, label: t.props.presets[value] }))}
        onChange={(preset) => preset !== 'custom' && patch({ strategy: { ...defaultStrategy(preset), onionSkin: st.onionSkin } })}
      />
      <p className="text-xs leading-relaxed text-muted">{t.props.presetDesc[st.preset]}</p>
      <div className="flex flex-wrap gap-1">
        {!onLine && <Chip>{t.props.chips.rough(t.props.directions[st.direction])}</Chip>}
        {!onLine && <Chip>{finishActive ? t.props.chips.finish(t.props.directions[st.finishDirection], fmt(st.allowance)) : t.props.chips.single}</Chip>}
        <Chip>{st.entry === 'ramp' ? t.props.chips.ramp(st.rampAngle) : t.props.chips.plunge}</Chip>
        {!onLine && <Chip>{tabs.enabled ? t.props.chips.tabs(tabs.count) : t.props.chips.noTabs}</Chip>}
        {st.onionSkin > 0 && <Chip>{t.props.chips.onion(fmt(st.onionSkin))}</Chip>}
      </div>

      <button className="text-left text-xs font-medium text-accent" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? t.props.hideDetails : t.props.showDetails}
      </button>
      {open && (
        <div className="space-y-2 rounded-lg border border-line p-2.5">
          {!onLine && (
            <>
              <FieldRow label={t.props.finishPass} hint="profileAllowance">
                <Switch checked={st.finishPass} onChange={(finishPass) => set({ finishPass, allowance: finishPass && st.allowance <= 0 ? 0.3 : st.allowance })} label={t.props.finishPass} />
              </FieldRow>
              {st.finishPass && (
                <>
                  <NumberField label={t.props.profileAllowance} unit="mm" step={0.05} min={0.05} max={2} value={st.allowance} hint="profileAllowance" onChange={(allowance) => set({ allowance })} />
                  <FieldRow label={t.props.finishDirection} hint="cutDirection">
                    <Segmented label={t.props.finishDirection} value={st.finishDirection} options={dirOptions} onChange={(finishDirection) => set({ finishDirection })} />
                  </FieldRow>
                  <NumberField
                    label={t.props.finishFeed}
                    unit="%"
                    step={5}
                    min={20}
                    max={150}
                    value={Math.round(st.finishFeedFactor * 100)}
                    onChange={(pct) => set({ finishFeedFactor: pct / 100 })}
                  />
                </>
              )}
              <FieldRow label={t.props.roughDirection} hint="cutDirection">
                <Segmented label={t.props.roughDirection} value={st.direction} options={dirOptions} onChange={(direction) => set({ direction })} />
              </FieldRow>
            </>
          )}
          <FieldRow label={t.props.entry} hint="rampEntry">
            <Segmented
              label={t.props.entry}
              value={st.entry}
              options={(['ramp', 'plunge'] as const).map((value) => ({ value, label: t.props.entries[value] }))}
              onChange={(entry) => set({ entry })}
            />
          </FieldRow>
          {st.entry === 'ramp' && <NumberField label={t.props.rampAngle} unit="°" step={1} min={1} max={45} value={st.rampAngle} hint="rampEntry" onChange={(rampAngle) => set({ rampAngle })} />}
          <NumberField label={t.props.onionSkin} unit="mm" step={0.1} min={0} max={Math.max(0, tp.cutDepth - 0.1)} value={st.onionSkin} hint="onionSkin" onChange={(onionSkin) => set({ onionSkin })} />
          {!onLine && <p className="text-2xs text-muted">{t.props.spindleNote}</p>}
        </div>
      )}
    </Group>
  );
}

function TabsEditor({ tp, patch }: { tp: ProfileToolpath; patch: (p: Partial<ToolpathConfig>) => void }) {
  const t = useT();
  const thickness = useAppStore((s) => s.material.thickness);
  const { strategy: st, tabs } = resolveProfile(tp);
  if (tp.side === 'on') return null;
  const set = (p: Partial<TabSettings>) => patch({ tabs: { ...tabs, ...p } });
  const throughCut = tp.cutDepth - st.onionSkin >= thickness - 0.01;
  const loose = throughCut && !tabs.enabled && st.onionSkin <= 0;

  return (
    <Group title={t.props.tabs} hint="tabs">
      <FieldRow label={t.props.useTabs}>
        <Switch checked={tabs.enabled} onChange={(enabled) => set({ enabled })} label={t.props.useTabs} />
      </FieldRow>
      {loose && (
        <div className="space-y-2 rounded-md bg-warn/10 p-2 text-xs text-warn">
          <p>{t.props.looseWarning}</p>
          <button className="btn h-7 text-ink" onClick={() => set({ enabled: true })}>
            {t.props.enableTabs}
          </button>
        </div>
      )}
      {tabs.enabled && (
        <>
          <NumberField label={t.props.tabCount} step={1} min={1} max={20} value={tabs.count} onChange={(count) => set({ count: Math.round(count) })} />
          <NumberField label={t.props.tabWidth} unit="mm" step={1} min={1} value={tabs.width} onChange={(width) => set({ width })} />
          <NumberField label={t.props.tabHeight} unit="mm" step={0.5} min={0.2} max={Math.max(0.2, tp.cutDepth)} value={tabs.height} onChange={(height) => set({ height })} />
          <FieldRow label={t.props.tabPosition}>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={Math.round((tabs.offset ?? 0) * 100)}
              onChange={(e) => set({ offset: Number(e.target.value) / 100 })}
              className="h-7 w-full accent-[rgb(var(--c-accent))]"
              aria-label={t.props.tabPosition}
            />
          </FieldRow>
          <p className="text-2xs leading-relaxed text-muted">{t.props.tabsHint}</p>
        </>
      )}
    </Group>
  );
}
