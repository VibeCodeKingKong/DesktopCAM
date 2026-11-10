import { Pause, Play, SkipForward, X } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { playPause, seekSimulation, showFinalResult, stopSimulation } from '../../cam/simController';
import { useT } from '../../i18n';

const SPEEDS = [0.25, 0.5, 1, 2, 4];

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
          className="field h-8 w-[4.5rem] shrink-0 py-0 text-xs"
          value={sim.speed}
          onChange={(e) => setSim({ speed: Number(e.target.value) })}
          aria-label={t.sim.speed}
          title={t.sim.speed}
        >
          {SPEEDS.map((v) => (
            <option key={v} value={v}>
              {String(v).replace('.', t.code === 'sv' ? ',' : '.')}×
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
    </div>
  );
}
