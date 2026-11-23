import { Layers, Pause, Play, RotateCcw, Scissors, SkipForward, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { BASE_PLAYBACK_SECONDS, glueInlays, playPause, seekSimulation, showFinalResult, stopSimulation } from '../../cam/simController';
import { useT } from '../../i18n';
import { useState } from 'react';
import { InlaySectionView } from './InlaySectionView';

/** 0 = översikt (hela körningen på 40 s); övriga gånger maskinens verkliga hastighet. */
const SPEEDS = [0, 1, 2, 5, 10, 25, 100, 500];

/**
 * Uppspelningen är inte i verklig hastighet: 1× spelar hela körningen på
 * BASE_PLAYBACK_SECONDS. Visa hur mycket snabbare (eller långsammare) än maskinen.
 */
function playbackLabel(t: ReturnType<typeof useT>, factor: number) {
  const n = (v: number) => (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10).toLocaleString(t.locale);
  if (factor >= 1.5) return t.sim.faster(n(factor));
  if (factor <= 0.67) return t.sim.slower(n(1 / factor));
  return t.sim.realTime;
}

function clock(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

/** Uppspelningsreglage för materialsimuleringen, längst ner i vyn. */
export function SimulationBar() {
  const t = useT();
  const sim = useAppStore((s) => s.sim);
  const setSim = useAppStore((s) => s.setSim);
  if (!sim.active) return null;
  return (
    <div className="absolute inset-x-3 bottom-3 z-10 mx-auto max-w-2xl rounded-xl border border-line bg-surface/95 p-2.5 shadow-pop backdrop-blur" role="group" aria-label={t.sim.title}>
      <div className="mb-1.5 flex items-center gap-2 text-2xs">
        <span className="font-semibold">{t.sim.title}</span>
        <span className="truncate text-muted">{sim.progress >= 1 ? t.sim.finished : sim.job}</span>
        <span className="ml-auto shrink-0 tabular-nums text-muted">
          {clock(sim.progress * sim.duration)} / {clock(sim.duration)} {t.sim.machineTime}
        </span>
        {sim.speed === 0 && (
          <span className="hidden shrink-0 rounded bg-app px-1.5 py-0.5 tabular-nums text-muted sm:inline" title={t.sim.speedHint}>
            {playbackLabel(t, sim.duration / BASE_PLAYBACK_SECONDS)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button className="btn h-8 w-8 shrink-0 p-0" onClick={playPause} aria-label={sim.playing ? t.sim.pause : t.sim.play} title={sim.playing ? t.sim.pause : t.sim.play}>
          {sim.playing ? <Pause size={15} /> : <Play size={15} />}
        </button>
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(sim.progress * 1000)}
          onChange={(e) => {
            setSim({ playing: false });
            seekSimulation(Number(e.target.value) / 1000);
          }}
          className="h-1 min-w-0 flex-1 accent-[rgb(var(--c-accent))]"
          aria-label={t.sim.position}
        />
        <select
          className="field h-8 w-[7.5rem] shrink-0 py-0 text-xs"
          value={sim.speed}
          onChange={(e) => setSim({ speed: Number(e.target.value) })}
          aria-label={t.sim.speed}
          title={t.sim.speedHint}
        >
          {SPEEDS.map((v) => (
            <option key={v} value={v}>
              {v === 0 ? t.sim.overview : v === 1 ? t.sim.realSpeed : `${v.toLocaleString(t.locale)}×`}
            </option>
          ))}
        </select>
        <button className="btn h-8 w-8 shrink-0 p-0" onClick={showFinalResult} aria-label={t.sim.result} title={t.sim.result}>
          <SkipForward size={15} />
        </button>
        <button className="btn h-8 w-8 shrink-0 p-0" onClick={stopSimulation} aria-label={t.sim.close} title={t.sim.close}>
          <X size={15} />
        </button>
      </div>
      {sim.inlays > 0 && <InlayGlue />}
    </div>
  );
}

/** V-inlägg: limma och plana pluggen i fickan, med passningen. */
function InlayGlue() {
  const t = useT();
  const ti = t.inlaySim;
  const sim = useAppStore((s) => s.sim);
  const pct = (v: number) => `${Math.round(v * 100)} %`;
  const [section, setSection] = useState(false);
  const mm = (v: number) => `${v.toLocaleString(t.locale, { maximumFractionDigits: 2 })} mm`;
  return (
    <div className="mt-2 space-y-1.5 border-t border-line pt-2">
      <div className="flex flex-wrap items-center gap-2">
        {sim.assembly === 'none' ? (
          <button className="btn h-8" onClick={glueInlays} title={ti.glueDesc}>
            <Layers size={14} /> {ti.glue}
          </button>
        ) : (
          <button className="btn h-8" onClick={() => seekSimulation(1)} disabled={sim.assembly === 'animating'}>
            <RotateCcw size={14} /> {ti.showMilling}
          </button>
        )}
        {sim.assembly === 'none' && <span className="text-2xs text-muted">{ti.glueDesc}</span>}
        {sim.assembly === 'done' && (
          <button className={`btn h-8 ${section ? 'border-accent text-accent' : ''}`} onClick={() => setSection(!section)} aria-pressed={section}>
            <Scissors size={14} /> {ti.section}
          </button>
        )}
        {sim.assembly === 'done' && (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-muted">
            <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-[#6e4b33]" />{ti.legendInlay}</span>
            <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-[#db2626]" />{ti.legendVoid}</span>
            <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-[#f9c71a]" />{ti.legendThin}</span>
          </span>
        )}
      </div>
      {sim.assembly === 'done' && section && <InlaySectionView />}
      {sim.assembly === 'done' &&
        sim.fit.map((f) => (
          <div key={f.name} className="text-2xs leading-relaxed">
            <span className="font-medium">{f.name}: </span>
            {f.blocked ? (
              <span className="text-warn">{f.relief ? ti.blockedRelief : ti.blocked}</span>
            ) : (
              <>
                <span>{ti.fitSummary(mm(f.sink), mm(f.maxGap), pct(f.filled))}</span>
                {f.voids > 0.005 && <span className="text-warn"> {(f.relief ? ti.voidsRelief : ti.voids)(pct(f.voids))}</span>}
                {f.thin > 0.005 && <span className="text-warn"> {(f.relief ? ti.thinRelief : ti.thin)(pct(f.thin))}</span>}
                {f.voids <= 0.005 && f.thin <= 0.005 && <span className="text-accent"> {ti.ok}</span>}
              </>
            )}
          </div>
        ))}
    </div>
  );
}
