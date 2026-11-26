/**
 * Kalibrering och provning: provmönster för laser, fräs och plasma, mätningar,
 * bildanalys av ett foto och historik. Proven byggs i kärnan (geometri och
 * G-kod); här finns bara formulären, förhandsvisningen och flödet.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Camera, Check, ChevronRight, Download, FileCode2, Gauge, History, Play, ShieldAlert, Trash2, TriangleAlert, Wrench } from 'lucide-react';
import { addGcodeToolpath } from '../../cam/gcodeImport';
import { newProject, saveProject } from '../../cam/commands';
import { CalAnimation, paramConcept, TEST_CONCEPT } from '../calibration/animations';
import { CalInfo } from '../calibration/CalInfo';
import { PlanPlayback, PlayControls, usePlayback } from '../calibration/PlanPlayer';
import {
  analyzeGrid,
  bestCells,
  CALIBRATION_TESTS,
  calibrationGcode,
  defaultValues,
  exportDxf,
  exportSvg,
  findCalibrationTest,
  hasErrors,
  parseGcode,
  uid,
  validateGcode,
  validatePlan,
  type CalibrationCategory,
  type CalibrationPlan,
  type CalibrationTest,
  type CalIssue,
  type CalOutcome,
  type CalValues,
  type GridAnalysis,
  type P2,
} from '@desktopcam/core';
import { materialName, toolName, useT, type Dict } from '../../i18n';
import { useAppStore, useMachine } from '../../store/useAppStore';
import { Dialog } from '../ui/Dialog';
import { FieldRow, NumberField, SelectField } from '../ui/Field';
import { calibrationContext, calibrationTool } from '../../calibration/context';
import { CHOOSABLE_TESTS, useCalibration, type CalibrationRecord } from '../../calibration/history';
import { readPhoto, rectify, suggestCorners, type Photo } from '../../calibration/photo';
import { downloadText, pickFile, slug } from '../../utils/download';

type View = 'overview' | CalibrationCategory | 'history';
const CATS: CalibrationCategory[] = ['laser', 'router', 'plasma'];
const kindToCat = (k: string): CalibrationCategory | null => (k === 'laser' || k === 'router' || k === 'plasma' ? k : null);

export function CalibrationDialog() {
  const t = useT();
  const C = t.calib;
  const open = useAppStore((s) => s.dialog === 'calibration');
  const machine = useMachine();
  const [view, setView] = useState<View>(() => kindToCat(machine.kind) ?? 'overview');
  const [testId, setTestId] = useState<string | null>(null);
  useEffect(() => {
    void useCalibration.getState().load();
  }, []);
  const close = () => useAppStore.getState().openDialog(null);
  const go = (v: View, test?: string) => {
    setView(v);
    setTestId(test ?? null);
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title={C.title}
      width="max-w-6xl"
      actions={
        <>
        {/* Telefon: en lista i stället för flikar som inte får plats bredvid rubriken. */}
        <select className="field min-w-0 flex-1 sm:hidden" value={view} onChange={(e) => go(e.target.value as View)} aria-label={C.title}>
          {(['overview', ...CATS, 'history'] as View[]).map((v) => (
            <option key={v} value={v}>
              {C.nav[v]}
            </option>
          ))}
        </select>
        <div className="hidden min-w-0 flex-1 gap-1 overflow-x-auto sm:ml-2 sm:flex" role="tablist" aria-label={C.title}>
          {(['overview', ...CATS, 'history'] as View[]).map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              onClick={() => go(v)}
              className={`shrink-0 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs transition-colors ${view === v ? 'border-accent bg-accent text-white' : 'border-line hover:border-muted/60'}`}
            >
              {C.nav[v]}
            </button>
          ))}
        </div>
        </>
      }
    >
      {view === 'overview' && <Overview go={go} />}
      {kindToCat(view) && <CategoryView category={view as CalibrationCategory} testId={testId} setTestId={setTestId} />}
      {view === 'history' && <HistoryView />}
    </Dialog>
  );
}

/* ───────── Översikt ───────── */

function Overview({ go }: { go: (v: View, test?: string) => void }) {
  const t = useT();
  const C = t.calib;
  const machine = useMachine();
  const material = useAppStore((s) => s.material);
  const materials = useAppStore((s) => s.materials);
  const preset = materials.find((m) => m.id === material.presetId);
  const records = useCalibration((s) => s.records);
  const cat = kindToCat(machine.kind);
  const tool = calibrationTool();
  const firstTests: Record<CalibrationCategory, string[]> = { laser: ['laser-matrix', 'laser-kerf', 'laser-focus'], router: ['router-accuracy', 'router-slot', 'router-depth'], plasma: ['plasma-kerf', 'plasma-speed', 'plasma-holes'] };
  return (
    <div className="grid gap-4 p-4 sm:p-5 md:grid-cols-[1fr_1fr]">
      <section className="space-y-3">
        <p className="text-sm leading-relaxed">{C.overview.intro}</p>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg border border-line p-3 text-sm">
          <dt className="text-muted">{C.overview.machine}</dt>
          <dd className="min-w-0 truncate font-medium">{machine.name}</dd>
          <dt className="text-muted">{C.overview.controller}</dt>
          <dd className="min-w-0 truncate">{machine.postprocessor.name}</dd>
          <dt className="text-muted">{C.overview.workArea}</dt>
          <dd className="tabular-nums">
            {machine.workArea.x} × {machine.workArea.y} mm
          </dd>
          <dt className="text-muted">{C.overview.material}</dt>
          <dd>
            {preset ? materialName(t, preset.id, preset.name) : ''} · {material.thickness.toLocaleString(t.locale)} mm
          </dd>
          {machine.kind === 'router' && (
            <>
              <dt className="text-muted">{C.overview.tool}</dt>
              <dd>{tool ? toolName(t, tool.id, tool.name) : '–'}</dd>
            </>
          )}
        </dl>
        <div className="flex flex-wrap gap-2">
          <button className="btn" onClick={() => useAppStore.getState().openDialog('machineSetup')}>
            <Wrench size={13} /> {C.overview.editMachine}
          </button>
        </div>
        <p className="text-2xs leading-relaxed text-muted">{C.overview.setupHint}</p>
        {cat ? (
          <div className="space-y-1.5">
            <h3 className="text-sm font-semibold">{C.overview.start}</h3>
            {firstTests[cat].map((id) => (
              <button key={id} className="flex w-full items-center gap-2 rounded-md border border-line px-3 py-2 text-left text-sm hover:border-accent" onClick={() => go(cat, id)}>
                <Gauge size={14} className="shrink-0 text-accent" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{C.tests[id].name}</span>
                  <span className="block text-xs text-muted">{C.tests[id].what}</span>
                </span>
                <ChevronRight size={14} className="shrink-0 text-muted" />
              </button>
            ))}
          </div>
        ) : (
          <p className="rounded-md bg-warn/10 px-3 py-2 text-xs text-warn">{C.overview.noCategory}</p>
        )}
      </section>
      <section className="space-y-3">
        <Safety category={cat} />
        <div>
          <h3 className="mb-1.5 text-sm font-semibold">{C.overview.recent}</h3>
          {records.length === 0 ? (
            <p className="text-xs text-muted">{C.overview.noRecent}</p>
          ) : (
            <ul className="space-y-1">
              {records.slice(0, 6).map((r) => (
                <li key={r.id}>
                  <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-app" onClick={() => go('history')}>
                    <History size={12} className="shrink-0 text-muted" />
                    <span className="min-w-0 flex-1 truncate">
                      {C.tests[r.testId]?.name ?? r.testId} · {r.machineName} · {r.materialName} {r.thickness} mm
                    </span>
                    <span className="shrink-0 tabular-nums text-muted">{new Date(r.date).toLocaleDateString(t.locale)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-md bg-app px-3 py-2 text-2xs leading-relaxed text-muted">
          <p className="font-medium text-ink">{C.ai.title}</p>
          <p>{C.ai.status}</p>
        </div>
      </section>
    </div>
  );
}

function Safety({ category }: { category: CalibrationCategory | null }) {
  const C = useT().calib;
  if (!category) return null;
  return (
    <div className="rounded-lg border border-warn/40 bg-warn/5 p-3 text-xs leading-relaxed">
      <p className="mb-1 flex items-center gap-1.5 font-semibold text-warn">
        <ShieldAlert size={14} /> {C.safety.title}
      </p>
      <ul className="list-disc space-y-0.5 pl-4">
        {C.safety[category].map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </div>
  );
}

/* ───────── Prov per maskintyp ───────── */

function CategoryView({ category, testId, setTestId }: { category: CalibrationCategory; testId: string | null; setTestId: (id: string) => void }) {
  const C = useT().calib;
  const tests = CALIBRATION_TESTS[category];
  const test = tests.find((x) => x.id === testId) ?? tests[0];
  return (
    <div className="grid md:grid-cols-[220px_1fr]">
      <ul className="flex gap-1 overflow-x-auto border-b border-line p-2 md:block md:space-y-0.5 md:overflow-visible md:border-b-0 md:border-r md:p-3" role="listbox" aria-label={C.nav[category]}>
        {tests.map((x) => (
          <li key={x.id} className="shrink-0">
            <button
              role="option"
              aria-selected={x.id === test.id}
              onClick={() => setTestId(x.id)}
              className={`w-full rounded-md px-2.5 py-1.5 text-left text-xs transition-colors md:text-sm ${x.id === test.id ? 'bg-accent/10 font-semibold text-accent' : 'hover:bg-app'}`}
            >
              {C.tests[x.id].name}
            </button>
          </li>
        ))}
      </ul>
      <TestPanel key={test.id} test={test} />
    </div>
  );
}

/** Kommentarer i G-koden: bara ASCII (vissa sändprogram klarar inte annat). */
const asciiComment = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’‘]/g, "'").replace(/[–—]/g, '-').replace(/[^\x20-\x7e]/g, '').trim();

function fmtValue(t: Dict, v: number, unit = '') {
  return `${v.toLocaleString(t.locale, { maximumFractionDigits: 3 })}${unit ? ` ${unit}` : ''}`;
}

function issueText(t: Dict, i: CalIssue): string {
  const f = t.calib.issues[i.code];
  return typeof f === 'function' ? f(i.data ?? {}) : f;
}

function TestPanel({ test }: { test: CalibrationTest }) {
  const t = useT();
  const C = t.calib;
  const machine = useMachine();
  const material = useAppStore((s) => s.material);
  const materials = useAppStore((s) => s.materials);
  const tools = useAppStore((s) => s.tools);
  const activeToolId = useAppStore((s) => s.activeToolId);
  const ctx = useMemo(() => calibrationContext(), [machine, material, tools, activeToolId]);
  const [values, setValues] = useState<CalValues>(() => defaultValues(test, ctx));
  useEffect(() => setValues(defaultValues(test, ctx)), [test, ctx]);
  const built = useMemo(() => {
    try {
      return { plan: test.build(values, ctx), error: null as string | null };
    } catch (e) {
      return { plan: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [test, values, ctx]);
  const plan = built.plan;
  const issues = useMemo(() => (plan ? validatePlan(test.category, values, plan, ctx) : []), [plan, test, values, ctx]);
  const sameKind = machine.kind === test.category;
  const [gcode, setGcode] = useState<{ text: string; issues: CalIssue[]; seconds: number; lines: number } | null>(null);
  useEffect(() => setGcode(null), [plan]);
  const [measured, setMeasured] = useState<Record<string, number>>({});
  const outcomes = useMemo<CalOutcome[]>(() => (plan && test.evaluate ? test.evaluate(plan, measured, values, ctx) : []), [plan, measured, test, values, ctx]);
  const [approved, setApproved] = useState<string[]>([]);
  const [analysis, setAnalysis] = useState<{ a: GridAnalysis; photo: string } | null>(null);
  const [chosen, setChosen] = useState<Record<string, number> | null>(null);
  const [useAsDefault, setUseAsDefault] = useState(false);
  useEffect(() => {
    setChosen(null);
    setUseAsDefault(false);
  }, [plan]);
  const [notes, setNotes] = useState('');
  const [saved, setSaved] = useState(false);
  const preset = materials.find((m) => m.id === material.presetId);
  const base = slug(`${C.tests[test.id].name}-${machine.name}`);

  const makeGcode = () => {
    if (!plan) return;
    const text = calibrationGcode(test, plan, ctx);
    const gi = validateGcode(text, test.category, ctx);
    const { stats } = parseGcode(text, machine.postprocessor.maxFeed ?? machine.maxFeed);
    setGcode({ text: `${C.gcodeHeader.map((l) => `; ${asciiComment(l)}`).join('\n')}\n${text}`, issues: gi, seconds: stats.estimatedSeconds, lines: stats.lineCount });
  };
  /** Lägger in provet i projektet – ritningen som eget lager och G-koden som bana – och öppnar simuleringen. */
  const [ask, setAsk] = useState(false);
  useEffect(() => setAsk(false), [plan]);
  /**
   * Provet simuleras i ett eget projekt, så att det inte blandas med det
   * användaren håller på med. Finns det något i projektet frågar vi först:
   * det sparas alltid i webbläsaren (Senaste projekt), och kan också sparas som fil.
   */
  const simulate = (choice?: 'file' | 'continue') => {
    if (!plan || !gcode) return;
    const name = C.tests[test.id].name;
    const before = useAppStore.getState();
    const busy = before.toolpaths.length > 0 || before.reliefs.length > 0 || before.imageObjects.length > 0 || before.layers.some((l) => l.shapes.length > 0);
    if (busy && !choice) {
      setAsk(true);
      return;
    }
    setAsk(false);
    if (busy && choice === 'file') saveProject();
    if (busy) newProject();
    const s = useAppStore.getState();
    s.setProjectName(C.projectLayer(name));
    const shapes = plan.layers.flatMap((l) => l.shapes.map((sh) => ({ ...sh, id: uid('shape'), name: C.layers[l.name as keyof typeof C.layers] ?? sh.name })));
    const layerId = uid('layer');
    useAppStore.setState({ layers: [{ id: layerId, name: C.projectLayer(name), color: '#d4572a', visible: true, locked: false, shapes }], activeLayerId: layerId, selectedShapeIds: [] });
    addGcodeToolpath({
      name,
      gcode: gcode.text,
      source: { kind: 'calibration', testId: test.id },
      // Laser: skärprov skär igenom, övriga prov bränner ytan.
      laserCut: test.category === 'laser' && (test.id === 'laser-kerf' || values.mode === 'cut'),
      tool: test.category === 'router' ? calibrationTool() : undefined,
    });
    s.openDialog(null);
    s.setTab('simulate');
    s.setStatus(busy ? C.simulatedNew(name) : C.simulated(name));
  };
  const layers = plan ? plan.layers.map((l) => ({ name: C.layers[l.name as keyof typeof C.layers] ?? l.name, color: l.color, shapes: l.shapes })) : [];
  const allIssues = [...issues, ...(gcode?.issues ?? [])];
  const blocked = hasErrors(allIssues);

  const save = () => {
    if (!plan) return;
    const tool = calibrationTool();
    const r: CalibrationRecord = {
      id: uid('cal'),
      date: new Date().toISOString(),
      testId: test.id,
      category: test.category,
      machineId: machine.id,
      machineName: machine.name,
      materialId: material.presetId,
      materialName: preset ? materialName(t, preset.id, preset.name) : material.presetId,
      thickness: material.thickness,
      toolName: test.category === 'router' && tool ? toolName(t, tool.id, tool.name) : undefined,
      toolDiameter: test.category === 'router' ? tool?.diameter : undefined,
      values,
      measured,
      outcomes,
      approved: [...approved.filter((k) => outcomes.some((o) => o.key === k)), ...(chosen && useAsDefault ? ['chosen'] : [])],
      analysis: analysis
        ? { confidence: analysis.a.confidence, target: target.current, readings: analysis.a.readings.map((x) => ({ label: x.label, darkness: x.darkness, unevenness: x.unevenness, values: x.values })), best: bestCells(analysis.a, target.current).map((x) => x.label) }
        : undefined,
      photo: analysis?.photo,
      notes,
      chosen: chosen ?? undefined,
    };
    useCalibration.getState().add(r);
    setSaved(true);
    useAppStore.getState().setStatus(C.savedStatus);
  };
  const target = useRef(0.5);

  return (
    <div className="grid min-w-0 gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      {/* Vänster: om provet, formulär, kontroller och export */}
      <section className="min-w-0 space-y-3">
        <div>
          <h3 className="text-base font-semibold">{C.tests[test.id].name}</h3>
          <p className="mt-0.5 text-sm leading-relaxed">{C.tests[test.id].what}</p>
        </div>
        {TEST_CONCEPT[test.id] && (
          <div className="grid items-center gap-2 rounded-md bg-app p-2 sm:grid-cols-[minmax(0,180px)_1fr]">
            <CalAnimation concept={TEST_CONCEPT[test.id]} className="!p-0" />
            <p className="text-xs leading-relaxed">
              <span className="font-medium">{C.howItWorks}: </span>
              {C.anim[TEST_CONCEPT[test.id]]}
            </p>
          </div>
        )}
        <details className="rounded-md bg-app px-3 py-2 text-xs leading-relaxed">
          <summary className="cursor-pointer font-medium">{C.howTo}</summary>
          <p className="mt-1.5">
            <span className="font-medium">{C.run}: </span>
            {C.tests[test.id].run}
          </p>
          <p className="mt-1">
            <span className="font-medium">{C.evaluate}: </span>
            {C.tests[test.id].evaluate}
          </p>
        </details>
        {test.category === 'laser' && <p className="text-2xs leading-relaxed text-warn">{C.safety.hazardous}</p>}
        <ParamForm test={test} values={values} onChange={(k, v) => setValues((o) => ({ ...o, [k]: v }))} />
        <button className="text-2xs text-accent underline" onClick={() => setValues(defaultValues(test, ctx))}>
          {C.resetValues}
        </button>
        {built.error && <p className="rounded-md bg-warn/10 px-2 py-1.5 text-xs text-warn">{built.error === 'NO_TOOL' ? C.issues.noTool : C.buildError}</p>}
        {allIssues.length > 0 && (
          <ul className="space-y-1">
            {allIssues.map((i, k) => (
              <li key={k} className={`flex gap-1.5 rounded-md px-2 py-1.5 text-xs leading-relaxed ${i.level === 'error' ? 'bg-warn/15 text-warn' : 'bg-app text-ink'}`}>
                <TriangleAlert size={13} className="mt-0.5 shrink-0" /> {issueText(t, i)}
              </li>
            ))}
          </ul>
        )}
        <div className="space-y-2 rounded-lg border border-line p-3">
          <h4 className="text-sm font-semibold">{C.exportTitle}</h4>
          <div className="flex flex-wrap gap-2">
            <button className="btn" disabled={!plan} onClick={() => downloadText(`${base}.svg`, exportSvg(layers), 'image/svg+xml')}>
              <Download size={13} /> SVG
            </button>
            <button className="btn" disabled={!plan} onClick={() => downloadText(`${base}.dxf`, exportDxf(layers), 'application/dxf')}>
              <Download size={13} /> DXF
            </button>
            <button className="btn" disabled={!plan || !sameKind || hasErrors(issues)} onClick={makeGcode}>
              <FileCode2 size={13} /> {C.checkGcode}
            </button>
          </div>
          {!sameKind && <p className="text-2xs leading-relaxed text-muted">{C.gcodeOtherMachine(C.nav[test.category])}</p>}
          {gcode && (
            <div className="space-y-1.5 rounded-md bg-app p-2 text-xs">
              <p className="tabular-nums">{C.gcodeStats(gcode.lines.toLocaleString(t.locale), Math.max(1, Math.round(gcode.seconds / 60)).toLocaleString(t.locale))}</p>
              {!hasErrors(gcode.issues) ? (
                <>
                  <p className="flex items-center gap-1 text-ok">
                    <Check size={13} /> {C.gcodeChecked}
                  </p>
                  <p className="text-2xs leading-relaxed text-muted">{C.notGuaranteed}</p>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn btn-primary" disabled={blocked} onClick={() => downloadText(`${base}.gcode`, gcode.text)}>
                      <Download size={13} /> {C.downloadGcode}
                    </button>
                    <button className="btn" disabled={blocked || ask} onClick={() => simulate()} title={C.simulateTitle}>
                      <Play size={13} /> {C.simulate}
                    </button>
                  </div>
                  {ask && (
                    <div role="alertdialog" aria-label={C.askTitle} className="space-y-2 rounded-md border border-accent/40 bg-accent/5 p-2.5">
                      <p className="font-semibold">{C.askTitle}</p>
                      <p className="leading-relaxed">{C.askBody(useAppStore.getState().projectName || t.common.untitledProject)}</p>
                      <div className="flex flex-wrap gap-2">
                        <button className="btn btn-primary" onClick={() => simulate('file')}>
                          <Download size={13} /> {C.askSave}
                        </button>
                        <button className="btn" onClick={() => simulate('continue')}>
                          {C.askContinue}
                        </button>
                        <button className="btn" onClick={() => setAsk(false)}>
                          {t.common.cancel}
                        </button>
                      </div>
                    </div>
                  )}
                  <p className="text-2xs leading-relaxed text-muted">{C.simulateNote}</p>
                </>
              ) : (
                <p className="text-warn">{C.gcodeBlocked}</p>
              )}
            </div>
          )}
          <p className="text-2xs leading-relaxed text-muted">{C.formatsNote}</p>
        </div>
      </section>

      {/* Höger: förhandsvisning, mätning, foto och sparande */}
      <section className="min-w-0 space-y-3">
        {plan && (
          <Preview
            plan={plan}
            category={test.category}
            sMax={machine.laser?.sMax ?? 1000}
            getGcode={() => {
              try {
                return calibrationGcode(test, plan, ctx);
              } catch {
                return null;
              }
            }}
          />
        )}
        {plan && (
          <p className="text-2xs tabular-nums text-muted">
            {C.size(fmtValue(t, Math.round(plan.width * 10) / 10), fmtValue(t, Math.round(plan.height * 10) / 10))} · {C.cells(plan.cells.length)}
          </p>
        )}
        {plan && plan.measures.length > 0 && (
          <div className="space-y-2 rounded-lg border border-line p-3">
            <h4 className="text-sm font-semibold">{C.measure.title}</h4>
            <p className="text-2xs leading-relaxed text-muted">{C.measure.intro}</p>
            <div className="grid gap-x-4">
              {plan.measures.map((m) => (
                <NumberField
                  key={m.key}
                  label={`${C.measure.keys[m.key.replace(/\d+$/, '') as keyof typeof C.measure.keys] ?? m.key}${/\d$/.test(m.key) ? ` ${Number(m.key.match(/\d+$/)![0]) + 1}` : ''}${m.nominal !== undefined ? ` (${fmtValue(t, m.nominal)})` : ''}`}
                  unit="mm"
                  step={0.01}
                  min={0}
                  live
                  value={measured[m.key] ?? 0}
                  onChange={(v) => setMeasured((o) => ({ ...o, [m.key]: v }))}
                />
              ))}
            </div>
            {outcomes.length > 0 && <Outcomes outcomes={outcomes} approved={approved} setApproved={setApproved} />}
          </div>
        )}
        {plan && CHOOSABLE_TESTS.includes(test.id) && (
          <BestResult plan={plan} chosen={chosen} setChosen={setChosen} useAsDefault={useAsDefault} setUseAsDefault={setUseAsDefault} materialText={`${preset ? materialName(t, preset.id, preset.name) : material.presetId} ${fmtValue(t, material.thickness, 'mm')}`} machineName={machine.name} />
        )}
        {plan && test.analyzable && <PhotoAnalysis plan={plan} onResult={setAnalysis} onChoose={setChosen} chosen={chosen} targetRef={target} />}
        {plan && test.category !== 'laser' && <p className="rounded-md bg-app px-3 py-2 text-2xs leading-relaxed text-muted">{C.photoNotForMeasure}</p>}
        <div className="space-y-2 rounded-lg border border-line p-3">
          <h4 className="text-sm font-semibold">{C.saveTitle}</h4>
          <textarea className="field h-16 w-full resize-y py-1.5" placeholder={C.notesPlaceholder} value={notes} onChange={(e) => setNotes(e.target.value)} aria-label={C.notesPlaceholder} />
          <button className="btn btn-primary" disabled={!plan || saved} onClick={save}>
            <Check size={13} /> {saved ? C.saved : C.save}
          </button>
          <p className="text-2xs leading-relaxed text-muted">{C.saveNote}</p>
        </div>
      </section>
    </div>
  );
}

function ParamForm({ test, values, onChange }: { test: CalibrationTest; values: CalValues; onChange: (k: string, v: number | string) => void }) {
  const t = useT();
  const C = t.calib;
  const info = (key: string) => {
    const body = C.paramHelp[key];
    if (!body) return undefined;
    const concept = paramConcept(key, test.category);
    return (
      <CalInfo title={C.params[key] ?? key} body={body}>
        {concept && <CalAnimation concept={concept} caption={C.anim[concept]} />}
      </CalInfo>
    );
  };
  const field = (p: CalibrationTest['params'][number]) =>
    p.kind === 'choice' ? (
      <SelectField key={p.key} label={C.params[p.key] ?? p.key} extra={info(p.key)} value={String(values[p.key])} options={p.options.map((o) => ({ value: o, label: C.choices[o] ?? o }))} onChange={(v) => onChange(p.key, v)} />
    ) : (
      <NumberField
        key={p.key}
        label={C.params[p.key] ?? p.key}
        extra={info(p.key)}
        unit={p.unit || undefined}
        step={p.step}
        min={p.min}
        max={p.max}
        value={Number(values[p.key])}
        onChange={(v) => onChange(p.key, p.integer ? Math.round(v) : v)}
      />
    );
  const basic = test.params.filter((p) => !p.advanced);
  const adv = test.params.filter((p) => p.advanced);
  return (
    <div className="space-y-1.5">
      {basic.map(field)}
      {adv.length > 0 && (
        <details className="rounded-md border border-line px-2 py-1.5">
          <summary className="cursor-pointer text-xs font-medium">{C.advanced}</summary>
          <div className="mt-1.5 space-y-1.5">{adv.map(field)}</div>
        </details>
      )}
    </div>
  );
}

/** Förhandsvisning: gravyr som grå ytor (mörkare med högre effekt), skärningar röda, etiketter tunna. */
function Preview({ plan, category, getGcode, sMax }: { plan: CalibrationPlan; category: CalibrationCategory; getGcode: () => string | null; sMax: number }) {
  const C = useT().calib;
  const play = usePlayback();
  // G-koden tas fram först när uppspelningen startas (och igen om provet ändras).
  const gcodeText = useMemo(() => (play.active ? getGcode() : null), [play.active, plan]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => play.stop(), [plan]); // eslint-disable-line react-hooks/exhaustive-deps
  const pad = Math.max(plan.width, plan.height) * 0.04 + 2;
  const top = plan.y + plan.height;
  const sw = Math.max(plan.width, plan.height) / 400;
  const d = (pts: number[], closed: boolean) => {
    let s = '';
    for (let i = 0; i + 1 < pts.length; i += 2) s += `${i ? 'L' : 'M'}${pts[i].toFixed(2)} ${(top - pts[i + 1]).toFixed(2)}`;
    return closed ? s + 'Z' : s;
  };
  return (
    <figure className="rounded-lg border border-line bg-app p-2">
      <svg viewBox={`${plan.x - pad} ${-pad} ${plan.width + 2 * pad} ${plan.height + 2 * pad}`} className="max-h-[42vh] w-full" role="img" aria-label={C.preview}>
        <rect x={plan.x} y={0} width={plan.width} height={plan.height} className="fill-surface" />
        <g opacity={gcodeText ? 0.18 : 1}>
        {plan.laser
          ? plan.laser.map((o, i) =>
              o.kind === 'fill' && o.rect ? (
                <rect key={i} x={o.rect.x0} y={top - o.rect.y1} width={o.rect.x1 - o.rect.x0} height={o.rect.y1 - o.rect.y0} fill="#1f2328" fillOpacity={Math.min(0.95, 0.08 + (o.powerPct / 100) * (0.4 + 0.6 * Math.min(1, 0.1 / (o.interval ?? 0.1))))} />
              ) : (
                o.polylines.map((p, k) => (
                  <path key={`${i}-${k}`} d={d(p.points, p.closed)} fill="none" stroke={o.label ? '#57606a' : '#d1242f'} strokeWidth={o.label ? sw * 0.7 : sw * 1.4} strokeLinecap="round" strokeLinejoin="round" />
                ))
              ),
            )
          : plan.layers.flatMap((l) => l.shapes.flatMap((sh) => sh.paths.map((p, k) => <path key={`${l.name}-${k}`} d={`M${p.start.x} ${top - p.start.y}${p.segments.map((s) => `L${s.to.x} ${top - s.to.y}`).join('')}${p.closed ? 'Z' : ''}`} fill="none" stroke={l.color} strokeWidth={sw * 1.4} />)))}
        {category !== 'laser' &&
          plan.cells
            .filter((c) => c.label)
            .map((c) => (
              <text key={c.id} x={(c.x0 + c.x1) / 2} y={top - (c.y0 + c.y1) / 2} textAnchor="middle" dominantBaseline="middle" fontSize={Math.max(2.5, Math.min(c.x1 - c.x0, c.y1 - c.y0) * 0.22)} className="fill-muted">
                {c.label}
              </text>
            ))}
        </g>
        {gcodeText && <PlanPlayback gcode={gcodeText} category={category} sMax={sMax} top={top} scale={sw} progress={play.progress} />}
      </svg>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
        <figcaption className="min-w-0 flex-1 text-2xs text-muted">{gcodeText ? C.playCaption : category === 'laser' ? C.previewLaser : C.previewCut}</figcaption>
        <PlayControls playing={play.playing} active={play.active} onToggle={play.toggle} onRestart={play.restart} onStop={play.stop} />
      </div>
    </figure>
  );
}

function Outcomes({ outcomes, approved, setApproved }: { outcomes: CalOutcome[]; approved: string[]; setApproved: (a: string[]) => void }) {
  const t = useT();
  const C = t.calib;
  const tools = useAppStore((s) => s.tools);
  const tool = calibrationTool();
  const [toolDone, setToolDone] = useState(false);
  return (
    <div className="space-y-1.5 rounded-md bg-app p-2 text-xs">
      <h5 className="font-semibold">{C.measure.result}</h5>
      <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1">
        {outcomes.map((o) => (
          <OutcomeRow key={o.key} label={C.measure.outcomes[o.key as keyof typeof C.measure.outcomes] ?? o.key} value={fmtValue(t, o.value, o.unit)} />
        ))}
      </dl>
      <p className="text-2xs leading-relaxed text-muted">{C.measure.explain}</p>
      {outcomes
        .filter((o) => o.apply === 'laserKerf' || o.apply === 'plasmaKerf')
        .map((o) => (
          <label key={o.key} className="flex items-start gap-2 text-xs">
            <input type="checkbox" className="mt-0.5" checked={approved.includes(o.key)} onChange={(e) => setApproved(e.target.checked ? [...approved, o.key] : approved.filter((k) => k !== o.key))} />
            <span>{C.measure.approveKerf(fmtValue(t, o.value, 'mm'))}</span>
          </label>
        ))}
      {outcomes
        .filter((o) => o.apply === 'toolDiameter' && tool && o.value > 0)
        .map((o) => (
          <div key={o.key} className="space-y-1">
            <button
              className="btn"
              disabled={toolDone || Math.abs(o.value - tool!.diameter) < 0.001}
              onClick={() => {
                const cur = tools.find((x) => x.id === tool!.id);
                if (!cur) return;
                useAppStore.getState().saveTool({ ...cur, diameter: o.value });
                setToolDone(true);
                setApproved([...approved, o.key]);
              }}
            >
              <Wrench size={13} /> {C.measure.applyTool(toolName(t, tool!.id, tool!.name), fmtValue(t, tool!.diameter), fmtValue(t, o.value))}
            </button>
            <p className="text-2xs leading-relaxed text-muted">{toolDone ? C.measure.toolUpdated : C.measure.toolNote}</p>
          </div>
        ))}
    </div>
  );
}

const OutcomeRow = ({ label, value }: { label: string; value: string }) => (
  <>
    <dt className="text-muted">{label}</dt>
    <dd className="text-right font-medium tabular-nums">{value}</dd>
  </>
);

/* ───────── Foto och bildanalys ───────── */

function PhotoAnalysis({
  plan,
  onResult,
  onChoose,
  chosen,
  targetRef,
}: {
  plan: CalibrationPlan;
  onResult: (r: { a: GridAnalysis; photo: string } | null) => void;
  onChoose: (c: Record<string, number> | null) => void;
  chosen: Record<string, number> | null;
  targetRef: { current: number };
}) {
  const t = useT();
  const C = t.calib;
  const P = C.photo;
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [corners, setCorners] = useState<P2[]>([]);
  const [result, setResult] = useState<{ a: GridAnalysis; url: string } | null>(null);
  const [target, setTarget] = useState(0.5);
  const [error, setError] = useState('');
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<number | null>(null);
  targetRef.current = target;

  const choose = async () => {
    const file = await pickFile('image/*', 'environment');
    if (!file) return;
    setError('');
    try {
      const p = await readPhoto(file);
      setPhoto(p);
      setCorners(suggestCorners(p));
      setResult(null);
      onResult(null);
    } catch {
      setError(P.readError);
    }
  };
  const analyze = () => {
    if (!photo) return;
    const r = rectify(photo, corners, plan.width / Math.max(1e-6, plan.height));
    const a = analyzeGrid(r.gray, r.width, r.height, plan);
    setResult({ a, url: r.url });
    onResult({ a, photo: r.url });
  };
  const move = (e: React.PointerEvent) => {
    if (drag.current === null || !svgRef.current || !photo) return;
    const box = svgRef.current.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * photo.width, y = ((e.clientY - box.top) / box.height) * photo.height;
    setCorners((c) => c.map((q, i) => (i === drag.current ? [Math.max(0, Math.min(photo.width, x)), Math.max(0, Math.min(photo.height, y))] : q)));
  };
  const best = result ? bestCells(result.a, target) : [];
  const conf = result ? P.confidence[result.a.confidence] : '';
  return (
    <div className="space-y-2 rounded-lg border border-line p-3">
      <h4 className="flex items-center gap-1.5 text-sm font-semibold">
        <Camera size={14} /> {P.title}
      </h4>
      <p className="text-2xs leading-relaxed text-muted">{P.intro}</p>
      <button className="btn" onClick={() => void choose()}>
        <Camera size={13} /> {photo ? P.another : P.choose}
      </button>
      {error && <p className="text-xs text-warn">{error}</p>}
      {photo && !result && (
        <>
          <p className="text-2xs leading-relaxed">{P.corners}</p>
          <div className="relative">
            <img src={photo.url} alt="" className="block w-full rounded-md" draggable={false} />
            <svg
              ref={svgRef}
              viewBox={`0 0 ${photo.width} ${photo.height}`}
              className="absolute inset-0 h-full w-full touch-none"
              onPointerMove={move}
              onPointerUp={() => (drag.current = null)}
              onPointerLeave={() => (drag.current = null)}
            >
              <polygon points={corners.map((c) => c.join(',')).join(' ')} fill="rgba(10,106,216,0.12)" stroke="#0a6ad8" strokeWidth={photo.width / 300} />
              {corners.map((c, i) => (
                <circle
                  key={i}
                  cx={c[0]}
                  cy={c[1]}
                  r={photo.width / 45}
                  fill="#ffffff"
                  stroke="#0a6ad8"
                  strokeWidth={photo.width / 250}
                  className="cursor-grab"
                  onPointerDown={(e) => {
                    drag.current = i;
                    (e.target as Element).setPointerCapture?.(e.pointerId);
                  }}
                />
              ))}
            </svg>
          </div>
          <button className="btn btn-primary" onClick={analyze}>
            {P.analyze}
          </button>
        </>
      )}
      {result && (
        <div className="space-y-2">
          <div className="relative">
            <img src={result.url} alt={P.rectified} className="block w-full rounded-md" />
            <svg viewBox={`${plan.x} 0 ${plan.width} ${plan.height}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
              {best.map((b, i) => {
                const c = plan.cells.find((x) => x.id === b.id)!;
                return <rect key={b.id} x={c.x0} y={plan.y + plan.height - c.y1} width={c.x1 - c.x0} height={c.y1 - c.y0} fill="none" stroke={i === 0 ? '#1f883d' : '#0a6ad8'} strokeWidth={Math.max(plan.width, plan.height) / 150} />;
              })}
            </svg>
          </div>
          <p className={`text-xs ${result.a.confidence === 'low' ? 'text-warn' : ''}`}>{P.confidenceLine(conf)}</p>
          <FieldRow label={P.target}>
            <input type="range" min={0.05} max={1} step={0.05} value={target} onChange={(e) => setTarget(Number(e.target.value))} className="w-full" aria-label={P.target} />
          </FieldRow>
          <p className="text-2xs text-muted">{P.targetHint(Math.round(target * 100))}</p>
          <ul className="space-y-1">
            {best.map((b, i) => (
              <li key={b.id} className="flex items-center gap-2 rounded-md bg-app px-2 py-1 text-xs">
                <span className={`font-semibold ${i === 0 ? 'text-ok' : ''}`}>{i + 1}.</span>
                <span className="min-w-0 flex-1 truncate">{b.label}</span>
                <span className="tabular-nums text-muted">{P.reading(Math.round(b.darkness * 100), Math.round(b.unevenness * 100))}</span>
                <button className="btn h-6 px-2" onClick={() => onChoose(b.values)} aria-pressed={chosen === b.values}>
                  {chosen === b.values ? <Check size={12} /> : P.pick}
                </button>
              </li>
            ))}
          </ul>
          <details className="text-2xs">
            <summary className="cursor-pointer">{P.allCells}</summary>
            <table className="mt-1 w-full tabular-nums">
              <tbody>
                {result.a.readings.map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className="py-0.5">{r.label}</td>
                    <td className="text-right">{Math.round(r.darkness * 100)} %</td>
                    <td className="text-right text-muted">± {Math.round(r.unevenness * 100)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
          <ul className="list-disc space-y-0.5 pl-4 text-2xs leading-relaxed text-muted">
            {result.a.limitations.map((l) => (
              <li key={l}>{P.limitations[l as keyof typeof P.limitations] ?? l}</li>
            ))}
          </ul>
          <button className="text-2xs text-accent underline" onClick={() => setResult(null)}>
            {P.adjust}
          </button>
        </div>
      )}
    </div>
  );
}

/* ───────── Historik ───────── */

function HistoryView() {
  const t = useT();
  const C = t.calib;
  const H = C.history;
  const records = useCalibration((s) => s.records);
  const [cat, setCat] = useState<'all' | CalibrationCategory>('all');
  const [machineId, setMachineId] = useState('all');
  const [materialId, setMaterialId] = useState('all');
  const [sort, setSort] = useState<'new' | 'old' | 'test'>('new');
  const [picked, setPicked] = useState<string[]>([]);
  const [confirm, setConfirm] = useState<string | null>(null);
  const machines = [...new Map(records.map((r) => [r.machineId, r.machineName])).entries()];
  const mats = [...new Map(records.map((r) => [r.materialId, r.materialName])).entries()];
  const list = records
    .filter((r) => (cat === 'all' || r.category === cat) && (machineId === 'all' || r.machineId === machineId) && (materialId === 'all' || r.materialId === materialId))
    .sort((a, b) => (sort === 'new' ? b.date.localeCompare(a.date) : sort === 'old' ? a.date.localeCompare(b.date) : (C.tests[a.testId]?.name ?? '').localeCompare(C.tests[b.testId]?.name ?? '')));
  const compare = records.filter((r) => picked.includes(r.id));
  if (!records.length) return <p className="p-5 text-sm text-muted">{H.empty}</p>;
  return (
    <div className="space-y-3 p-4 sm:p-5">
      <div className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField label={H.category} value={cat} options={[{ value: 'all' as const, label: H.all }, ...CATS.map((c) => ({ value: c, label: C.nav[c] }))]} onChange={setCat} />
        <SelectField label={H.machine} value={machineId} options={[{ value: 'all', label: H.all }, ...machines.map(([id, name]) => ({ value: id, label: name }))]} onChange={setMachineId} />
        <SelectField label={H.material} value={materialId} options={[{ value: 'all', label: H.all }, ...mats.map(([id, name]) => ({ value: id, label: name }))]} onChange={setMaterialId} />
        <SelectField label={H.sort} value={sort} options={(['new', 'old', 'test'] as const).map((v) => ({ value: v, label: H.sorts[v] }))} onChange={setSort} />
      </div>
      <p className="text-2xs text-muted">{H.compareHint}</p>
      <ul className="space-y-1.5">
        {list.map((r) => (
          <li key={r.id} className="rounded-md border border-line p-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <input type="checkbox" checked={picked.includes(r.id)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, r.id] : p.filter((x) => x !== r.id)))} aria-label={H.compare} />
              <span className="font-semibold">{C.tests[r.testId]?.name ?? r.testId}</span>
              <span className="text-muted">
                {r.machineName} · {r.materialName} {r.thickness.toLocaleString(t.locale)} mm{r.toolName ? ` · ${r.toolName}` : ''}
              </span>
              <span className="ml-auto tabular-nums text-muted">{new Date(r.date).toLocaleString(t.locale, { dateStyle: 'short', timeStyle: 'short' })}</span>
              {confirm === r.id ? (
                <span className="flex items-center gap-1">
                  <button className="btn h-6 px-2 text-warn" onClick={() => (useCalibration.getState().remove(r.id), setConfirm(null))}>
                    {H.confirmDelete}
                  </button>
                  <button className="btn h-6 px-2" onClick={() => setConfirm(null)}>
                    {t.common.cancel}
                  </button>
                </span>
              ) : (
                <button className="rounded p-1 text-muted hover:text-warn" onClick={() => setConfirm(r.id)} aria-label={t.common.remove}>
                  <Trash2 size={13} />
                </button>
              )}
            </div>
            <RecordSummary r={r} />
          </li>
        ))}
      </ul>
      {compare.length >= 2 && <CompareTable records={compare} />}
    </div>
  );
}

function recordLines(t: Dict, r: CalibrationRecord): { label: string; value: string }[] {
  const C = t.calib;
  const out: { label: string; value: string }[] = [];
  for (const o of r.outcomes) out.push({ label: C.measure.outcomes[o.key as keyof typeof C.measure.outcomes] ?? o.key, value: `${fmtValue(t, o.value, o.unit)}${r.approved?.includes(o.key) ? ` ✓` : ''}` });
  if (r.chosen) out.push({ label: C.history.chosen, value: Object.entries(r.chosen).map(([k, v]) => `${C.params[k] ?? k} ${fmtValue(t, v)}`).join(', ') });
  if (r.analysis) out.push({ label: C.history.analysis, value: `${C.photo.confidence[r.analysis.confidence]} · ${r.analysis.best.join(', ')}` });
  return out;
}

/**
 * Bästa resultat: rutan som blev bäst (väljs här eller ur bildanalysen) och
 * om dess inställningar ska bli förval för nya banor. Kräver ett uttryckligt val.
 */
function BestResult({ plan, chosen, setChosen, useAsDefault, setUseAsDefault, materialText, machineName }: {
  plan: CalibrationPlan;
  chosen: Record<string, number> | null;
  setChosen: (c: Record<string, number> | null) => void;
  useAsDefault: boolean;
  setUseAsDefault: (v: boolean) => void;
  materialText: string;
  machineName: string;
}) {
  const t = useT();
  const C = t.calib;
  const cells = plan.cells.filter((c) => Object.keys(c.values).length > 0);
  const text = (v: Record<string, number>) => Object.entries(v).map(([k, x]) => `${C.params[k] ?? k} ${fmtValue(t, x)}`).join(' · ');
  const key = (v: Record<string, number> | null) => (v ? JSON.stringify(Object.entries(v).sort()) : '');
  const current = cells.find((c) => key(c.values) === key(chosen))?.id ?? '';
  return (
    <div className="space-y-2 rounded-lg border border-line p-3">
      <h4 className="text-sm font-semibold">{C.best.title}</h4>
      <p className="text-2xs leading-relaxed text-muted">{C.best.intro}</p>
      <SelectField
        label={C.best.pick}
        value={current}
        options={[{ value: '', label: C.best.none }, ...cells.map((c) => ({ value: c.id, label: `${c.label ? `${c.label} – ` : ''}${text(c.values)}` }))]}
        onChange={(id) => {
          const c = cells.find((x) => x.id === id);
          setChosen(c ? c.values : null);
          if (!c) setUseAsDefault(false);
        }}
      />
      <label className="flex items-start gap-2 text-xs">
        <input type="checkbox" className="mt-0.5" disabled={!chosen} checked={!!chosen && useAsDefault} onChange={(e) => setUseAsDefault(e.target.checked)} />
        <span>{C.best.useAsDefault(machineName, materialText)}</span>
      </label>
      <p className="text-2xs leading-relaxed text-muted">{C.best.note}</p>
    </div>
  );
}

function RecordSummary({ r }: { r: CalibrationRecord }) {
  const t = useT();
  const lines = recordLines(t, r);
  const isDefault = !!r.approved?.includes('chosen');
  if (!lines.length && !r.notes && !r.photo) return null;
  return (
    <div className="mt-1.5 flex gap-3">
      {r.photo && <img src={r.photo} alt="" className="h-16 w-auto shrink-0 rounded" />}
      <div className="min-w-0 space-y-0.5">
        {lines.map((l) => (
          <p key={l.label}>
            <span className="text-muted">{l.label}: </span>
            {l.value}
          </p>
        ))}
        {r.notes && <p className="italic text-muted">{r.notes}</p>}
        {r.chosen && CHOOSABLE_TESTS.includes(r.testId) && (
          <label className="mt-1 flex items-center gap-2">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => useCalibration.getState().update(r.id, { approved: [...(r.approved ?? []).filter((k) => k !== 'chosen'), ...(e.target.checked ? ['chosen'] : [])] })}
            />
            <span>{t.calib.best.historyToggle}</span>
          </label>
        )}
      </div>
    </div>
  );
}

function CompareTable({ records }: { records: CalibrationRecord[] }) {
  const t = useT();
  const C = t.calib;
  const keys = [...new Set(records.flatMap((r) => Object.keys(r.values)))].filter((k) => k !== 'x' && k !== 'y');
  const outKeys = [...new Set(records.flatMap((r) => r.outcomes.map((o) => o.key)))];
  const cell = (r: CalibrationRecord, k: string) => {
    const v = r.values[k];
    return v === undefined ? '–' : typeof v === 'number' ? fmtValue(t, v) : C.choices[v] ?? v;
  };
  const row = (label: string, render: (r: CalibrationRecord) => ReactNode) => (
    <tr className="border-t border-line">
      <th className="py-1 pr-3 text-left font-normal text-muted">{label}</th>
      {records.map((r) => (
        <td key={r.id} className="py-1 pr-3 tabular-nums">
          {render(r)}
        </td>
      ))}
    </tr>
  );
  return (
    <div className="overflow-x-auto rounded-lg border border-line p-3">
      <h4 className="mb-1 text-sm font-semibold">{C.history.compare}</h4>
      <table className="text-xs">
        <tbody>
          {row(C.history.test, (r) => C.tests[r.testId]?.name ?? r.testId)}
          {row(C.history.machine, (r) => r.machineName)}
          {row(C.history.material, (r) => `${r.materialName} ${r.thickness} mm`)}
          {row(C.history.date, (r) => new Date(r.date).toLocaleDateString(t.locale))}
          {keys.map((k) => row(C.params[k] ?? k, (r) => cell(r, k)))}
          {outKeys.map((k) =>
            row(C.measure.outcomes[k as keyof typeof C.measure.outcomes] ?? k, (r) => {
              const o = r.outcomes.find((x) => x.key === k);
              return o ? fmtValue(t, o.value, o.unit) : '–';
            }),
          )}
          {row(C.history.chosen, (r) => (r.chosen ? Object.entries(r.chosen).map(([k, v]) => `${C.params[k] ?? k} ${fmtValue(t, v)}`).join(', ') : '–'))}
        </tbody>
      </table>
    </div>
  );
}

export { findCalibrationTest };
