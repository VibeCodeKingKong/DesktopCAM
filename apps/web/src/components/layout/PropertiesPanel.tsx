import { FontPicker } from '../ui/FontPicker';
import { isOutlineFont, LINE_FONT } from '../../text/fonts';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CircleDot, Copy, Crosshair, Download, FlipHorizontal2, FlipVertical2, Flame, Layers, Lock, RefreshCw, RotateCcw, RotateCw, Scissors, Square, Trash2, TriangleAlert, Unlock, MousePointerClick, ArrowLeftRight, Combine, Zap } from 'lucide-react';
import {
  defaultPocketStrategy,
  matchPocketPreset,
  type PocketStrategy,
  type PocketToolpath,
  shapeHasArea,
  canFillet,
  setCornerRadius,
  autoTabPositions,
  distributeTabs,
  shapeToPolylines,
  defaultStrategy,
  inlayFit,
  matchPreset,
  shapesBounds,
  type CutDirection,
  type CutSide,
  type DitherMethod,
  type InlayToolpath,
  type PlasmaCutToolpath,
  type PlasmaSettings,
  plasmaDataFor,
  withPlasmaDefaults,
  type ProfileStrategy,
  type ProfileToolpath,
  type ReliefInstance,
  type StrategyPreset,
  type TabSettings,
  type ToolpathConfig,
  type VectorShape,
} from '@desktopcam/core';
import { allShapes, favoritesFirst, machineClass, useAppStore, useEffectiveMaterial, useExpert, useMachine, useMaterialPreset, useSelectedRelief, useSelectedToolpath } from '../../store/useAppStore';
import { toolFits } from '../../cam/toolRules';
import { computeToolpath, drillPoints, resolvePocket, resolveProfile, scheduleCompute } from '../../cam/toolpathService';
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
  measure,
  setMeasure,
  measurePreset,
  defaultMeasureRef,
  type Anchor,
  type MeasureRef,
  createReliefPlug,
  showInlayPart,
  updateReliefPlug,
  retoolPatch,
} from '../../cam/commands';
import { FieldRow, NumberField, Segmented, SelectField, Switch } from '../ui/Field';
import { duration, mm } from '../../utils/format';
import { materialName, toolName, useT, type GuideKey } from '../../i18n';
import { InfoHint } from '../smartguide/InfoHint';
import { SidePanel } from './SidePanel';
import { SmartTooltip } from '../smartguide/SmartTooltip';
import { tip } from '../ribbon/tip';
import { IlluCenter, IlluDuplicate, IlluFlip, IlluLockAspect, IlluRotate } from '../smartguide/illustrations';
import { reliefEdgeAtTop } from '../../cam/reliefs';
import { ImageReliefFields } from '../dialogs/ImageReliefDialog';
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
  const machine = useMachine();
  const laser = machine.kind === 'laser';
  // Materialets tips för den valda maskintypen, och tips för just den här maskinen.
  const own = t.materials[preset.id]?.tips;
  const materialTips = own ? own[machine.kind] : preset.tips;
  const mt = t.machineTips;
  const machineTips = [...mt[machineClass(machine)], ...(laser ? mt.laserCommon : machine.kind === 'plasma' ? mt.plasmaCommon : mt.routerCommon), ...mt.common];
  const box = (title: string, tips: string[]) => (
    <div className="rounded-lg border border-line bg-app p-3">
      <p className="mb-1.5 font-semibold">{title}</p>
      <ul className="list-disc space-y-1 pl-4 text-muted">
        {tips.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </div>
  );
  return (
    <div className="space-y-4 p-4 text-xs leading-relaxed">
      <p className="text-muted">{t.props.emptyHint}</p>
      {box(t.materialTips(materialName(t, preset.id, preset.name), machine.kind), materialTips)}
      {box(mt.title(machine.name), machineTips)}
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
  const machineKind = machine.kind;
  const anyClosed = shapes.some(shapeHasArea);

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
          <FontPicker value={single.text.font ?? LINE_FONT} onChange={(font) => updateText(single, { font: isOutlineFont(font) ? font : undefined, weight: isOutlineFont(font) ? 0 : single.text!.weight })} />
          {!single.text.font && (
          <FieldRow label={t.textDialog.style}>
            <Segmented
              label={t.textDialog.style}
              value={(single.text.weight ?? 0) > 0 ? 'outline' : 'single'}
              options={[
                { value: 'outline', label: t.textDialog.styles.outline },
                { value: 'single', label: t.textDialog.styles.single },
              ]}
              onChange={(v) => updateText(single, { weight: v === 'outline' ? Math.round(single.text!.height * 1.5) / 10 : 0 })}
            />
          </FieldRow>
          )}
          {!single.text.font && (single.text.weight ?? 0) > 0 && (
            <NumberField label={t.props.textWeight} unit="mm" min={0.2} step={0.1} value={single.text.weight!} onChange={(weight) => updateText(single, { weight: Math.max(0.2, weight) })} />
          )}
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

      {ids.length === 2 && !selectedNode && <MeasureGroup ids={ids} />}

      <Group title={t.props.placement}>
        {layers.length > 1 && (
          <SelectField
            label={t.tree.layer}
            value={(() => {
              const owners = new Set(layers.filter((l) => l.shapes.some((sh) => ids.includes(sh.id))).map((l) => l.id));
              return owners.size === 1 ? [...owners][0] : '';
            })()}
            options={[{ value: '', label: '–' }, ...layers.map((l) => ({ value: l.id, label: l.name }))]}
            onChange={(id) => id && useAppStore.getState().moveShapesToLayer(ids, id)}
          />
        )}
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
          <SmartTooltip content={tip(t.hover.lock, { illustration: <IlluLockAspect /> })}>
          <button className="btn h-6 px-2" onClick={() => setLock((l) => !l)} aria-pressed={lock}>
            {lock ? <Lock size={12} /> : <Unlock size={12} />}
            {lock ? t.common.locked : t.common.free}
          </button>
          </SmartTooltip>
        </FieldRow>
        {single && canFillet(single) && (
          <NumberField
            label={t.props.cornerRadius}
            unit="mm"
            step={0.5}
            min={0}
            value={single.corner?.radius ?? 0}
            onChange={(r) => useAppStore.getState().replaceShapes([setCornerRadius(single, Math.max(0, r))])}
          />
        )}
        <FieldRow label={t.props.rotate}>
          <div className="flex items-center gap-1">
            <SmartTooltip content={tip(t.hover.rotate, { illustration: <IlluRotate /> })}>
            <button className="btn h-7 px-2" onClick={() => rotateSelection(angle)} title={`+${angle}°`} aria-label={`${t.props.rotate} +${angle}°`}>
              <RotateCcw size={13} />
            </button>
            </SmartTooltip>
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
            <SmartTooltip content={tip(t.hover.rotate, { illustration: <IlluRotate /> })}>
            <button className="btn h-7 px-2" onClick={() => rotateSelection(-angle)} title={`−${angle}°`} aria-label={`${t.props.rotate} −${angle}°`}>
              <RotateCw size={13} />
            </button>
            </SmartTooltip>
          </div>
        </FieldRow>
        <div className="grid grid-cols-2 gap-2">
          <SmartTooltip className="flex [&>*]:min-w-0 [&>*]:flex-1" content={tip(t.hover.mirrorH, { illustration: <IlluFlip /> })}>
          <button className="btn" onClick={() => mirrorSelection('h')} title={t.props.mirrorH}>
            <FlipHorizontal2 size={13} /> <span className="truncate">{t.props.mirrorH}</span>
          </button>
          </SmartTooltip>
          <SmartTooltip className="flex [&>*]:min-w-0 [&>*]:flex-1" content={tip(t.hover.mirrorV, { illustration: <IlluFlip vertical /> })}>
          <button className="btn" onClick={() => mirrorSelection('v')} title={t.props.mirrorV}>
            <FlipVertical2 size={13} /> <span className="truncate">{t.props.mirrorV}</span>
          </button>
          </SmartTooltip>
          <SmartTooltip className="flex [&>*]:min-w-0 [&>*]:flex-1" content={tip(t.hover.center, { illustration: <IlluCenter /> })}>
          <button className="btn" onClick={centerSelection}>
            <Crosshair size={13} /> <span className="truncate">{t.props.alignCenter}</span>
          </button>
          </SmartTooltip>
          <SmartTooltip className="flex [&>*]:min-w-0 [&>*]:flex-1" content={tip(t.hover.duplicate, { shortcut: '⌘D', illustration: <IlluDuplicate /> })}>
          <button className="btn" onClick={duplicateSelection}>
            <Copy size={13} /> {t.common.duplicate}
          </button>
          </SmartTooltip>
        </div>
        {single && single.paths.length === 1 && nodeCount(single.paths[0]) < 3 && !shapeHasArea(single) && (
          <FieldRow label={t.props.pathStatus}>
            <p className="text-xs">{t.props.lineOnly}</p>
          </FieldRow>
        )}
        {single && single.paths.length === 1 && nodeCount(single.paths[0]) >= 3 && (
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
        <p className="text-2xs text-muted">{anyClosed || machineKind !== 'router' ? t.props.operationsHint : t.props.openHint}</p>
        <div className="grid grid-cols-2 gap-2">
          {machineKind === 'plasma' ? (
            <button className="btn col-span-2" onClick={() => createToolpath('plasmaCut')}>
              <Zap size={13} className="text-accent" /> {t.operations.plasmaCut}
            </button>
          ) : isLaser ? (
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
  const isLaser = useMachine().kind !== 'router';
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
      {relief.plug && <PlugEditor relief={relief} />}
      {!relief.plug && (
      <>
      <Group title={t.props.placement}>
        <NumberField label={t.props.x} unit="mm" value={relief.x} onChange={(x) => patch({ x })} />
        <NumberField label={t.props.y} unit="mm" value={relief.y} onChange={(y) => patch({ y })} />
        <NumberField
          label={t.props.width}
          unit="mm"
          min={5}
          value={relief.width}
          onChange={(width) => patch(relief.image ? { width, height: (width * relief.image.height) / relief.image.width } : { width })}
        />
        <NumberField
          label={t.props.height}
          unit="mm"
          min={5}
          value={Math.round(relief.height * 100) / 100}
          onChange={(height) => patch(relief.image ? { height, width: (height * relief.image.width) / relief.image.height } : { height })}
        />
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
      </>
      )}
      {relief.image && (
        <Group title={t.imageRelief.settings}>
          <ImageReliefFields
            settings={relief.image.settings}
            detected={relief.image.detected}
            lightBackground={relief.image.lightBackground ?? true}
            onChange={(settings) => patch({ image: { ...relief.image!, settings } })}
          />
        </Group>
      )}
      {!relief.plug && <InlayGroup relief={relief} />}
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
  const expert = useExpert();
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
  // Bara verktyg som fungerar för operationen. Ett olämpligt verktyg som redan
  // är valt (t.ex. från ett äldre projekt) visas markerat, med förklaring nedan.
  const currentTool = tools.find((x) => x.id === tp.toolId);
  const toolOk = toolFits(tp, currentTool?.kind);
  const toolOptions = [
    ...favoritesFirst(tools.filter((x) => toolFits(tp, x.kind))).map((x) => ({ value: x.id, label: `${x.favorite ? '★ ' : ''}${toolName(t, x.id, x.name)}` })),
    ...(currentTool && !toolOk ? [{ value: currentTool.id, label: `${toolName(t, currentTool.id, currentTool.name)} – ${t.toolRules.notSuitable}` }] : []),
  ];
  const sides: { value: CutSide; label: string }[] = [
    { value: 'outside', label: t.props.sides.outside },
    { value: 'inside', label: t.props.sides.inside },
    { value: 'on', label: t.props.sides.on },
  ];
  const dithers = (Object.keys(t.props.ditherMethods) as DitherMethod[]).map((value) => ({ value, label: t.props.ditherMethods[value] }));
  const preset = useMaterialPreset();
  const machineKind = useMachine().kind;
  const eff = useEffectiveMaterial();
  const thickness = useAppStore((s) => s.material.thickness);
  const materialWarning =
    tp.operation === 'laserCut' && tp.side !== 'on' && preset.laser.canCut === false
      ? t.props.cannotCut
      : tp.operation === 'laserCut' && tp.side !== 'on' && eff.laserTooThick
        ? t.props.laserTooThick(thickness.toLocaleString(t.locale))
      : machineKind === 'router' && !preset.router
        ? t.props.notForRouter
        : machineKind === 'plasma' && !preset.plasma
          ? t.props.notForPlasma
          : null;
  const holes = tp.operation === 'drill' ? drillPoints(allShapes(layers).filter((s) => tp.shapeIds.includes(s.id))).length : 0;
  const speedGroup = (
    <Group title={t.props.speed}>
      <NumberField label={t.props.feed} unit="mm/min" step={50} min={1} value={tp.params.feedRate} hint="feedRate" onChange={(feedRate) => param({ feedRate })} />
      <NumberField label={t.props.plunge} unit="mm/min" step={25} min={1} value={tp.params.plungeRate} hint="plungeRate" onChange={(plungeRate) => param({ plungeRate })} />
      {expert && <NumberField label={t.props.spindle} unit="rpm" step={1000} min={0} value={tp.params.spindleRpm ?? 18000} hint="spindleRpm" onChange={(spindleRpm) => param({ spindleRpm })} />}
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
          options={toolOptions}
          onChange={(toolId) => patch(retoolPatch(tp, toolId))}
        />
        {!toolOk && currentTool && (
          <p className="rounded-md bg-warn/10 px-2 py-1.5 text-xs leading-relaxed text-warn">{t.toolRules.why(tp.operation, currentTool.kind, tp.operation === 'profile' ? tp.side : undefined)}</p>
        )}
        {(tp.operation === 'profile' || tp.operation === 'laserCut' || tp.operation === 'plasmaCut') && (
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
          <PocketStrategyEditor tp={tp} patch={patch} />
          {speedGroup}
        </>
      )}

      {tp.operation === 'vcarve' && (
        <>
          <Group title={t.props.depth}>
            <NumberField label={t.props.flatDepth} unit="mm" step={0.5} min={0} value={tp.flatDepth} hint="vFlatDepth" onChange={(flatDepth) => patch({ flatDepth })} />
            <p className="-mt-1 text-2xs text-muted">{t.props.flatDepthNote}</p>
            {expert && <NumberField label={t.props.contourStep} unit="mm" step={0.05} min={0.03} max={1} value={tp.contourStep} hint="contourStep" onChange={(contourStep) => patch({ contourStep })} />}
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
            {expert && <NumberField label={t.props.spindle} unit="rpm" step={1000} min={0} value={tp.params.spindleRpm ?? 12000} hint="spindleRpm" onChange={(spindleRpm) => param({ spindleRpm })} />}
          </Group>
        </>
      )}

      {tp.operation === 'facing' && (
        <>
          <Group title={t.props.facing}>
            <FieldRow label={t.props.facingArea} hint="facingArea">
              <Segmented
                label={t.props.facingArea}
                value={tp.area}
                options={[
                  { value: 'stock', label: t.props.facingStock },
                  { value: 'shapes', label: t.props.facingShapes },
                ]}
                onChange={(area) => patch(area === 'shapes' ? { area, shapeIds: tp.shapeIds.length ? tp.shapeIds : useAppStore.getState().selectedShapeIds } : { area })}
              />
            </FieldRow>
            {tp.area === 'shapes' && !tp.shapeIds.length && <p className="rounded-md bg-warn/10 px-2 py-1.5 text-xs text-warn">{t.props.facingSelectShapes}</p>}
            <NumberField label={t.props.facingDepth} unit="mm" step={0.1} min={0.05} value={tp.depth} hint="facingDepth" onChange={(depth) => patch({ depth })} />
            <NumberField label={t.props.stepDown} unit="mm" step={0.1} min={0.05} value={tp.params.stepDown} hint="stepDown" onChange={(stepDown) => param({ stepDown })} />
            <NumberField
              label={t.props.stepOver}
              unit="%"
              step={5}
              min={10}
              max={90}
              value={Math.round(tp.params.stepOver * 100)}
              hint="stepOver"
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
            <FieldRow label={t.props.facingPattern} hint="facingPattern">
              <Segmented
                label={t.props.facingPattern}
                value={tp.pattern}
                options={[
                  { value: 'zigzag', label: t.props.facingZigzag },
                  { value: 'oneway', label: t.props.facingOneway },
                ]}
                onChange={(pattern) => patch({ pattern })}
              />
            </FieldRow>
            {expert && <NumberField label={t.props.facingOverhang} unit="mm" step={0.5} min={0} max={50} value={tp.overhang} hint="facingOverhang" onChange={(overhang) => patch({ overhang })} />}
          </Group>
          {speedGroup}
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
            {expert && (
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
            )}
            <FieldRow label={t.props.roughing} hint="roughing">
              <Switch checked={tp.roughing} onChange={(roughing) => patch({ roughing })} label={t.props.roughing} />
            </FieldRow>
            {tp.roughing && (
              <>
                <NumberField label={t.props.stepDown} unit="mm" step={0.1} min={0.1} value={tp.params.stepDown} hint="stepDown" onChange={(stepDown) => param({ stepDown })} />
                {expert && <NumberField label={t.props.allowance} unit="mm" step={0.05} min={0} max={2} value={tp.allowance} hint="allowance" onChange={(allowance) => patch({ allowance })} />}
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

      {tp.operation === 'plasmaCut' && <PlasmaEditor tp={tp} patch={patch} param={param} />}

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
        {result?.warnings?.map((w) => (
          <p key={w} role="alert" className="flex gap-1.5 rounded-md bg-warn/10 px-2 py-1.5 text-xs leading-relaxed text-warn">
            <TriangleAlert size={13} className="mt-0.5 shrink-0" /> {w}
          </p>
        ))}
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

/* ───────── Plasma ───────── */

function PlasmaEditor({
  tp,
  patch,
  param,
}: {
  tp: PlasmaCutToolpath;
  patch: (p: Partial<ToolpathConfig>) => void;
  param: (p: Partial<ToolpathConfig['params']>) => void;
}) {
  const t = useT();
  const pl = t.plasma;
  const expert = useExpert();
  const machine = useMachine();
  const preset = useMaterialPreset();
  const thickness = useAppStore((s) => s.material.thickness);
  const zAxis = machine.plasma?.zAxis ?? true;
  const s = withPlasmaDefaults(tp.plasma);
  const set = (p: Partial<PlasmaSettings>) => patch({ plasma: { ...s, ...p } } as Partial<ToolpathConfig>);
  const chart = plasmaDataFor(preset, machine, thickness);
  const maxAmps = machine.plasma?.maxAmps ?? 999;
  const leads = (value: PlasmaSettings['leadIn']) => ({ value, label: pl.leads[value] });
  const applyChart = () => {
    if (!chart) return;
    patch({ kerf: chart.kerf, amps: Math.min(chart.amps, maxAmps), plasma: { ...s, pierceDelay: chart.pierceDelay, pierceHeight: chart.pierceHeight, cutHeight: chart.cutHeight } } as Partial<ToolpathConfig>);
    param({ feedRate: chart.feedRate });
  };

  return (
    <>
      <Group title={pl.cutting}>
        <NumberField label={pl.amps} unit="A" step={5} min={10} value={tp.amps} hint="plasmaAmps" onChange={(amps) => patch({ amps: Math.round(amps) } as Partial<ToolpathConfig>)} />
        {tp.amps > maxAmps && <p className="rounded-md bg-warn/10 px-2 py-1.5 text-xs text-warn">{pl.ampsTooHigh(maxAmps)}</p>}
        <NumberField label={t.props.feed} unit="mm/min" step={100} min={1} value={tp.params.feedRate} hint="feedRate" onChange={(feedRate) => param({ feedRate })} />
        {tp.side !== 'on' && <NumberField label={t.props.kerf} unit="mm" step={0.05} min={0} max={5} value={tp.kerf} hint="plasmaKerf" onChange={(kerf) => patch({ kerf } as Partial<ToolpathConfig>)} />}
        {chart ? (
          <div className="space-y-1.5 rounded-md bg-app px-2 py-1.5 text-2xs leading-relaxed text-muted">
            <p>{pl.chart(thickness.toLocaleString(t.locale), chart.amps, chart.feedRate, chart.kerf.toLocaleString(t.locale), chart.pierceDelay.toLocaleString(t.locale))}</p>
            {'limited' in chart && <p>{pl.chartLimited(chart.amps)}</p>}
            <button className="btn h-6 px-2 text-2xs" onClick={applyChart}>
              {pl.useChart}
            </button>
          </div>
        ) : null}
      </Group>

      <Group title={pl.pierce}>
        {zAxis && <NumberField label={pl.pierceHeight} unit="mm" step={0.1} min={0} value={s.pierceHeight} hint="pierceHeight" onChange={(pierceHeight) => set({ pierceHeight })} />}
        <NumberField label={pl.pierceDelay} unit="s" step={0.1} min={0} max={10} value={s.pierceDelay} hint="pierceDelay" onChange={(pierceDelay) => set({ pierceDelay })} />
        {zAxis && <NumberField label={pl.cutHeight} unit="mm" step={0.1} min={0} value={s.cutHeight} hint="cutHeight" onChange={(cutHeight) => set({ cutHeight })} />}
        {zAxis && (
          <FieldRow label={pl.ihs} hint="plasmaIhs">
            <Switch checked={s.ihs} onChange={(ihs) => set({ ihs })} label={pl.ihs} />
          </FieldRow>
        )}
        {zAxis && s.ihs && expert && <NumberField label={pl.switchOffset} unit="mm" step={0.1} min={0} value={s.ihsSwitchOffset} hint="plasmaIhs" onChange={(ihsSwitchOffset) => set({ ihsSwitchOffset })} />}
        {zAxis && expert && <NumberField label={pl.plungeRate} unit="mm/min" step={100} min={1} value={tp.params.plungeRate || 1000} onChange={(plungeRate) => param({ plungeRate })} />}
        {!zAxis && <p className="text-2xs leading-relaxed text-muted">{pl.noZ}</p>}
      </Group>

      {tp.side !== 'on' && (
        <Group title={pl.leadsTitle}>
          <FieldRow label={pl.leadIn} hint="plasmaLead">
            <Segmented label={pl.leadIn} value={s.leadIn} options={[leads('arc'), leads('line'), leads('none')]} onChange={(leadIn) => set({ leadIn })} />
          </FieldRow>
          {s.leadIn !== 'none' && <NumberField label={s.leadIn === 'arc' ? pl.radius : pl.length} unit="mm" step={0.5} min={0.5} value={s.leadInLength} hint="plasmaLead" onChange={(leadInLength) => set({ leadInLength })} />}
          <FieldRow label={pl.leadOut} hint="plasmaLead">
            <Segmented label={pl.leadOut} value={s.leadOut} options={[leads('arc'), leads('line'), leads('none')]} onChange={(leadOut) => set({ leadOut })} />
          </FieldRow>
          {s.leadOut !== 'none' && <NumberField label={s.leadOut === 'arc' ? pl.radius : pl.length} unit="mm" step={0.5} min={0.5} value={s.leadOutLength} hint="plasmaLead" onChange={(leadOutLength) => set({ leadOutLength })} />}
          {s.leadIn !== 'none' && <NumberField label={pl.leadInFeed} unit="%" step={5} min={10} max={100} value={s.leadInFeedPct} hint="plasmaLead" onChange={(leadInFeedPct) => set({ leadInFeedPct })} />}
          {s.leadOut !== 'none' && <NumberField label={pl.leadOutFeed} unit="%" step={5} min={10} max={100} value={s.leadOutFeedPct} hint="plasmaLead" onChange={(leadOutFeedPct) => set({ leadOutFeedPct })} />}
          {expert && <NumberField label={pl.overcut} unit="mm" step={0.1} min={0} max={10} value={s.overcut} hint="plasmaOvercut" onChange={(overcut) => set({ overcut })} />}
        </Group>
      )}

      <Group title={pl.corners}>
        <FieldRow label={pl.cornerSlowdown} hint="plasmaCorner">
          <Switch checked={s.cornerSlowdown} onChange={(cornerSlowdown) => set({ cornerSlowdown })} label={pl.cornerSlowdown} />
        </FieldRow>
        {s.cornerSlowdown && (
          <>
            <NumberField label={pl.cornerFeed} unit="%" step={5} min={10} max={100} value={s.cornerFeedPct} hint="plasmaCorner" onChange={(cornerFeedPct) => set({ cornerFeedPct })} />
            <NumberField label={pl.cornerDistance} unit="mm" step={0.5} min={0.5} max={20} value={s.cornerDistance} hint="plasmaCorner" onChange={(cornerDistance) => set({ cornerDistance })} />
            {expert && <NumberField label={pl.cornerAngle} unit="°" step={5} min={10} max={170} value={s.cornerAngle} hint="plasmaCorner" onChange={(cornerAngle) => set({ cornerAngle })} />}
          </>
        )}
      </Group>

      {tp.side !== 'on' && (
        <Group title={pl.holes}>
          <FieldRow label={pl.holeSlowdown} hint="holeSlowdown">
            <Switch checked={s.holeSlowdown} onChange={(holeSlowdown) => set({ holeSlowdown })} label={pl.holeSlowdown} />
          </FieldRow>
          {s.holeSlowdown && (
            <>
              <NumberField label={pl.holeDiameter} unit="mm" step={1} min={1} value={s.holeDiameter} hint="holeSlowdown" onChange={(holeDiameter) => set({ holeDiameter })} />
              <NumberField label={pl.holeFeed} unit="%" step={5} min={10} max={100} value={s.holeFeedPct} hint="holeSlowdown" onChange={(holeFeedPct) => set({ holeFeedPct })} />
            </>
          )}
          {expert && (
            <FieldRow label={pl.thcOff} hint="plasmaThc">
              <Switch checked={s.thcOffInHoles} onChange={(thcOffInHoles) => set({ thcOffInHoles })} label={pl.thcOff} />
            </FieldRow>
          )}
          {expert && s.thcOffInHoles && !machine.postprocessor.thcOff && <p className="text-2xs leading-relaxed text-muted">{pl.thcNoCodes}</p>}
          <p className="text-2xs leading-relaxed text-muted">{pl.orderNote}</p>
        </Group>
      )}

      {expert && tp.side !== 'on' && (
        <Group title={t.props.direction}>
          <FieldRow label={t.props.direction} hint="plasmaDirection">
            <Segmented
              label={t.props.direction}
              value={s.partOnRight ? 'right' : 'left'}
              options={[
                { value: 'right', label: pl.partRight },
                { value: 'left', label: pl.partLeft },
              ]}
              onChange={(v) => set({ partOnRight: v === 'right' })}
            />
          </FieldRow>
        </Group>
      )}
    </>
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
  const expert = useExpert();
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
        {expert && (
          <>
        <NumberField label={t.props.plugMargin} unit="mm" step={1} min={1} value={tp.margin} hint="plugMargin" onChange={(margin) => patch({ margin })} />
        <NumberField label={t.props.contourStep} unit="mm" step={0.05} min={0.03} max={1} value={tp.contourStep} hint="contourStep" onChange={(contourStep) => patch({ contourStep })} />
          </>
        )}
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
  const expert = useExpert();
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

      {!expert && <ExpertNote />}
      {expert && (
        <button className="text-left text-xs font-medium text-accent" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? t.props.hideDetails : t.props.showDetails}
        </button>
      )}
      {expert && open && (
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

function PocketStrategyEditor({ tp, patch }: { tp: PocketToolpath; patch: (p: Partial<ToolpathConfig>) => void }) {
  const expert = useExpert();
  const t = useT();
  const [open, setOpen] = useState(false);
  const st = resolvePocket(tp);
  const fmt = (n: number) => n.toLocaleString(t.locale, { maximumFractionDigits: 2 });
  const presets: StrategyPreset[] = ['fast', 'balanced', 'fine'];
  const set = (p: Partial<PocketStrategy>) => {
    const next = { ...st, ...p };
    patch({ pocket: { ...next, preset: matchPocketPreset(next) }, strategy: next.pattern });
  };
  const dirOptions = (['conventional', 'climb'] as CutDirection[]).map((value) => ({ value, label: t.props.directions[value] }));
  const finishActive = st.finishPass && (st.wallAllowance > 0 || st.floorAllowance > 0);

  return (
    <Group title={t.props.strategy} hint="pocketStrategy">
      <Segmented
        label={t.props.strategy}
        value={st.preset}
        options={[...presets, ...(st.preset === 'custom' ? (['custom'] as StrategyPreset[]) : [])].map((value) => ({ value, label: t.props.presets[value] }))}
        onChange={(preset) => preset !== 'custom' && patch({ pocket: { ...defaultPocketStrategy(preset, st.pattern), rasterAngle: st.rasterAngle } })}
      />
      <p className="text-xs leading-relaxed text-muted">{t.props.pocketPresetDesc[st.preset]}</p>
      <FieldRow label={t.props.pattern} hint="pocketPattern">
        <Segmented
          label={t.props.pattern}
          value={st.pattern}
          options={(['offset', 'raster'] as const).map((value) => ({ value, label: t.props.patterns[value] }))}
          onChange={(pattern) => set({ pattern })}
        />
      </FieldRow>
      {expert && st.pattern === 'raster' && (
        <NumberField label={t.props.rasterAngle} unit="°" step={15} min={-90} max={180} value={st.rasterAngle} hint="pocketPattern" onChange={(rasterAngle) => set({ rasterAngle })} />
      )}
      <div className="flex flex-wrap gap-1">
        <Chip>{t.props.chips.rough(t.props.directions[st.direction])}</Chip>
        <Chip>{finishActive ? t.props.pocketChips.finish(t.props.directions[st.finishDirection], fmt(st.wallAllowance), fmt(st.floorAllowance)) : t.props.chips.single}</Chip>
        <Chip>{st.entry === 'helix' ? t.props.pocketChips.helix(st.rampAngle) : st.entry === 'ramp' ? t.props.chips.ramp(st.rampAngle) : t.props.chips.plunge}</Chip>
      </div>

      {!expert && <ExpertNote />}
      {expert && (
        <button className="text-left text-xs font-medium text-accent" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? t.props.hideDetails : t.props.showDetails}
        </button>
      )}
      {expert && open && (
        <div className="space-y-2 rounded-lg border border-line p-2.5">
          <FieldRow label={t.props.roughDirection} hint="cutDirection">
            <Segmented label={t.props.roughDirection} value={st.direction} options={dirOptions} onChange={(direction) => set({ direction })} />
          </FieldRow>
          <FieldRow label={t.props.pocketFinish} hint="profileAllowance">
            <Switch
              checked={st.finishPass}
              onChange={(finishPass) =>
                set({ finishPass, wallAllowance: finishPass && st.wallAllowance <= 0 ? 0.3 : st.wallAllowance, floorAllowance: finishPass && st.floorAllowance <= 0 ? 0.2 : st.floorAllowance })
              }
              label={t.props.pocketFinish}
            />
          </FieldRow>
          {st.finishPass && (
            <>
              <NumberField label={t.props.wallAllowance} unit="mm" step={0.05} min={0} max={2} value={st.wallAllowance} hint="profileAllowance" onChange={(wallAllowance) => set({ wallAllowance })} />
              <NumberField label={t.props.floorAllowance} unit="mm" step={0.05} min={0} max={Math.max(0, tp.cutDepth / 2)} value={st.floorAllowance} hint="profileAllowance" onChange={(floorAllowance) => set({ floorAllowance })} />
              <FieldRow label={t.props.finishDirection} hint="cutDirection">
                <Segmented label={t.props.finishDirection} value={st.finishDirection} options={dirOptions} onChange={(finishDirection) => set({ finishDirection })} />
              </FieldRow>
              <NumberField label={t.props.finishFeed} unit="%" step={5} min={20} max={150} value={Math.round(st.finishFeedFactor * 100)} onChange={(pct) => set({ finishFeedFactor: pct / 100 })} />
            </>
          )}
          <FieldRow label={t.props.entry} hint="rampEntry">
            <Segmented
              label={t.props.entry}
              value={st.entry}
              options={(['helix', 'ramp', 'plunge'] as const).map((value) => ({ value, label: t.props.entries[value] }))}
              onChange={(entry) => set({ entry })}
            />
          </FieldRow>
          {st.entry !== 'plunge' && <NumberField label={t.props.rampAngle} unit="°" step={1} min={1} max={45} value={st.rampAngle} hint="rampEntry" onChange={(rampAngle) => set({ rampAngle })} />}
          <p className="text-2xs text-muted">{t.props.spindleNote}</p>
        </div>
      )}
    </Group>
  );
}

function TabsEditor({ tp, patch }: { tp: ProfileToolpath; patch: (p: Partial<ToolpathConfig>) => void }) {
  const expert = useExpert();
  const t = useT();
  const thickness = useAppStore((s) => s.material.thickness);
  const tool = useAppStore((s) => s.editTool);
  const setTool = useAppStore((s) => s.setEditTool);
  const { strategy: st, tabs } = resolveProfile(tp);
  if (tp.side === 'on') return null;
  const set = (p: Partial<TabSettings>) => patch({ tabs: { ...tabs, ...p } });
  const te = t.tabsEdit;
  const manual = tabs.mode === 'manual';
  const placing = tool === 'tabs';
  const contourGroups = () =>
    allShapes(useAppStore.getState().layers)
      .filter((sh) => tp.shapeIds.includes(sh.id))
      .map((sh) => shapeToPolylines(sh).filter((p) => p.closed))
      .filter((g) => g.length);
  const autoPositions = () =>
    autoTabPositions(contourGroups(), { ...tabs, mode: 'auto' }, useAppStore.getState().tools.find((x) => x.id === tp.toolId)?.diameter ?? 3);
  const startPlacing = () => {
    if (!manual) set({ mode: 'manual', positions: autoPositions() });
    setTool('tabs');
  };
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
          <NumberField label={t.props.tabWidth} unit="mm" step={1} min={1} value={tabs.width} onChange={(width) => set({ width })} />
          <NumberField label={t.props.tabHeight} unit="mm" step={0.5} min={0.2} max={Math.max(0.2, tp.cutDepth)} value={tabs.height} onChange={(height) => set({ height })} />
          <FieldRow label={te.placement}>
            <Segmented
              label={te.placement}
              value={manual ? 'manual' : 'auto'}
              options={[
                { value: 'auto', label: te.modes.auto },
                { value: 'manual', label: te.modes.manual },
              ]}
              onChange={(m) => {
                if (m === 'auto') {
                  set({ mode: 'auto' });
                  if (placing) setTool('select');
                } else startPlacing();
              }}
            />
          </FieldRow>
          {!manual && (
            <>
              <NumberField label={t.props.tabCount} step={1} min={1} max={20} value={tabs.count} onChange={(count) => set({ count: Math.round(count) })} />
              {expert && (
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
              )}
            </>
          )}
          {manual && <p className="text-xs font-medium">{te.manualCount(tabs.positions?.length ?? 0)}</p>}
          <button className={`btn w-full ${placing ? 'btn-primary' : ''}`} onClick={() => (placing ? setTool('select') : startPlacing())}>
            <MousePointerClick size={13} /> {placing ? te.placing : te.place}
          </button>
          {manual && (
            <div className="grid grid-cols-2 gap-2">
              <button className="btn" onClick={() => set({ mode: 'manual', positions: distributeTabs(contourGroups(), tabs.positions ?? []) })}>
                {te.distribute}
              </button>
              <button className="btn" onClick={() => set({ mode: 'manual', positions: [] })}>
                {te.clear}
              </button>
            </div>
          )}
          <p className="text-2xs leading-relaxed text-muted">{manual || placing ? te.manualHint : t.props.tabsHint}</p>
        </>
      )}
    </Group>
  );
}

/** 3 × 3-väljare för referenspunkt: hörn, sidornas mitt eller mitten. */
function AnchorPicker({ value, onChange, label }: { value: Anchor; onChange: (a: Anchor) => void; label: string }) {
  const t = useT();
  const cells: Anchor[] = [];
  for (const y of [1, 0, -1] as const) for (const x of [-1, 0, 1] as const) cells.push({ x, y });
  return (
    <div role="radiogroup" aria-label={label} className="grid w-[54px] shrink-0 grid-cols-3 gap-[3px] rounded-md border border-line bg-app p-[3px]">
      {cells.map((c) => {
        const on = c.x === value.x && c.y === value.y;
        return (
          <button
            key={`${c.x}${c.y}`}
            role="radio"
            aria-checked={on}
            aria-label={`${label}: ${t.measure.anchorNames[`${c.x}${c.y}` as keyof typeof t.measure.anchorNames]}`}
            title={t.measure.anchorNames[`${c.x}${c.y}` as keyof typeof t.measure.anchorNames]}
            onClick={() => onChange(c)}
            className={`h-3.5 w-3.5 rounded-[3px] ${on ? 'bg-accent' : 'bg-line hover:bg-accent/40'}`}
          />
        );
      })}
    </div>
  );
}

/** Mått mellan två markerade former. Den först markerade står still, den andra flyttas. */
function MeasureGroup({ ids }: { ids: string[] }) {
  const t = useT();
  const tm = t.measure;
  const layers = useAppStore((s) => s.layers);
  const stored = useAppStore((s) => s.measureRef);
  const setRef = useAppStore((s) => s.setMeasureRef);
  const swapped = useAppStore((s) => s.measureSwapped);
  const setSwapped = useAppStore((s) => s.setMeasureSwapped);
  const key = ids.join('|');
  // Nytt formpar: börja om med förvalet.
  useEffect(() => {
    setRef(null);
    setSwapped(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const all = allShapes(layers);
  const first = all.find((x) => x.id === ids[0]);
  const second = all.find((x) => x.id === ids[1]);
  if (!first || !second) return null;
  const [fixed, moving] = swapped ? [second, first] : [first, second];
  const ref = stored ?? defaultMeasureRef(fixed, moving);
  const m = measure(fixed, moving, ref);
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const presetOf = (r: MeasureRef) =>
    (['center', 'side', 'edge'] as const).find((p) => JSON.stringify(measurePreset(fixed, moving, p)) === JSON.stringify(r)) ?? 'custom';
  const preset = presetOf(ref);
  return (
    <Group title={tm.title}>
      <Segmented
        label={tm.reference}
        value={preset === 'custom' ? ('custom' as const) : preset}
        options={[
          { value: 'side', label: tm.presets.side },
          { value: 'center', label: tm.presets.center },
          { value: 'edge', label: tm.presets.edge },
          ...(preset === 'custom' ? [{ value: 'custom' as const, label: tm.presets.custom }] : []),
        ]}
        onChange={(p) => p !== 'custom' && setRef(measurePreset(fixed, moving, p))}
      />
      <div className="flex items-start gap-3">
        <div className="space-y-1">
          <p className="max-w-[90px] truncate text-2xs text-muted" title={fixed.name}>{tm.from(fixed.name)}</p>
          <AnchorPicker value={ref.fixed} onChange={(a) => setRef({ ...ref, fixed: a })} label={tm.fromLabel} />
        </div>
        <div className="space-y-1">
          <p className="max-w-[90px] truncate text-2xs text-muted" title={moving.name}>{tm.to(moving.name)}</p>
          <AnchorPicker value={ref.moving} onChange={(a) => setRef({ ...ref, moving: a })} label={tm.toLabel} />
        </div>
        <button className="btn ml-auto h-7 shrink-0 px-2 text-2xs" onClick={() => { setSwapped(!swapped); setRef(null); }} title={tm.swapDesc}>
          <ArrowLeftRight size={12} /> {tm.swap}
        </button>
      </div>
      <NumberField label={tm.dx} unit="mm" step={1} value={r2(m.dx)} onChange={(dx) => setMeasure(m, { dx })} />
      <NumberField label={tm.dy} unit="mm" step={1} value={r2(m.dy)} onChange={(dy) => setMeasure(m, { dy })} />
      <NumberField label={tm.dist} unit="mm" step={1} min={0} value={r2(m.dist)} onChange={(dist) => setMeasure(m, { dist })} />
      <p className="text-2xs leading-relaxed text-muted">{tm.note(fixed.name, moving.name)}</p>
    </Group>
  );
}

/** Reliefinlägg: skapa pluggen, eller visa den om den redan finns. */
function InlayGroup({ relief }: { relief: ReliefInstance }) {
  const t = useT();
  const ti = t.reliefInlay;
  const plug = useAppStore((s) => s.reliefs.find((r) => r.plug?.pocketId === relief.id));
  const edgeOk = useMemo(() => reliefEdgeAtTop(relief), [relief]);
  return (
    <Group title={ti.title} hint="reliefInlay">
      <p className="text-2xs leading-relaxed text-muted">{ti.intro}</p>
      {!edgeOk && <p className="rounded-md bg-warn/10 px-2 py-1.5 text-xs leading-relaxed text-warn">{ti.edgeWarning}</p>}
      {plug ? (
        <button className="btn w-full" onClick={() => useAppStore.getState().selectRelief(plug.id)}>
          {ti.openPlug}
        </button>
      ) : (
        <button className="btn w-full" onClick={() => createReliefPlug(relief.id)}>
          <Combine size={13} /> {ti.create}
        </button>
      )}
    </Group>
  );
}

/** Pluggens inställningar: limspalt, marginal och frigång. */
function PlugEditor({ relief }: { relief: ReliefInstance }) {
  const expert = useExpert();
  const t = useT();
  const ti = t.reliefInlay;
  const material = useAppStore((s) => s.material);
  const pocket = useAppStore((s) => s.reliefs.find((r) => r.id === relief.plug!.pocketId));
  const p = relief.plug!;
  const fmt = (n: number) => n.toLocaleString(t.locale, { maximumFractionDigits: 2 });
  const board = p.source.depth + 2 * p.gap + p.clearance;
  return (
    <Group title={ti.plugTitle} hint="reliefInlay">
      <FieldRow label={ti.show}>
        <Segmented
          label={ti.show}
          value={relief.visible ? 'plug' : 'pocket'}
          options={[
            { value: 'pocket', label: ti.parts.pocket },
            { value: 'plug', label: ti.parts.plug },
          ]}
          onChange={(part) => showInlayPart(relief.id, part)}
        />
      </FieldRow>
      <NumberField label={ti.gap} unit="mm" step={0.05} min={0} max={2} value={p.gap} onChange={(gap) => updateReliefPlug(relief.id, { gap })} />
      <NumberField label={ti.margin} unit="mm" step={0.5} min={0} max={30} value={p.margin} onChange={(margin) => updateReliefPlug(relief.id, { margin })} />
      {expert && (
        <>
      <NumberField label={ti.clearance} unit="mm" step={0.5} min={0} max={10} value={p.clearance} onChange={(clearance) => updateReliefPlug(relief.id, { clearance })} />
      <NumberField label={ti.tool} unit="mm" step={0.5} min={0.2} max={25} value={p.toolRadius * 2} onChange={(d) => updateReliefPlug(relief.id, { toolRadius: d / 2 })} />
        </>
      )}
      {!expert && <ExpertNote />}
      <p className="text-2xs leading-relaxed text-muted">{ti.boardNote(fmt(board), fmt(p.source.width + 2 * p.margin), fmt(p.source.height + 2 * p.margin))}</p>
      {board > material.thickness && <p className="rounded-md bg-warn/10 px-2 py-1.5 text-xs text-warn">{ti.tooThick(fmt(material.thickness))}</p>}
      {!pocket && <p className="rounded-md bg-warn/10 px-2 py-1.5 text-xs text-warn">{ti.pocketMissing}</p>}
      <ol className="list-decimal space-y-0.5 pl-4 text-2xs leading-relaxed text-muted">
        {ti.steps.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ol>
    </Group>
  );
}

/** Kort rad där inställningar är dolda i nybörjarläget. */
function ExpertNote() {
  const t = useT();
  return <p className="text-2xs italic text-muted">{t.props.expertNote}</p>;
}
