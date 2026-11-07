import { useAppStore } from '../../store/useAppStore';

/** Förloppsindikator för pågående beräkningar och navigeringshjälp för nybörjare. */
export function ViewportOverlay() {
  const progress = useAppStore((s) => s.progress);
  const toolpaths = useAppStore((s) => s.toolpaths);
  const beginner = useAppStore((s) => s.beginnerMode);
  const jobs = Object.entries(progress);

  return (
    <>
      {jobs.length > 0 && (
        <div className="absolute left-1/2 top-3 w-72 -translate-x-1/2 space-y-1.5 rounded-lg border border-line bg-surface/95 p-3 shadow-sm backdrop-blur" role="status">
          {jobs.map(([id, p]) => (
            <div key={id}>
              <div className="mb-1 flex justify-between text-2xs">
                <span className="font-medium">{toolpaths.find((t) => t.id === id)?.name ?? 'Beräknar'}</span>
                <span className="text-muted">{p.message}</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${Math.round(p.value * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
      {beginner && (
        <p className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-surface/85 px-2 py-1 text-2xs text-muted backdrop-blur">
          Rotera med vänster musknapp, panorera med höger och zooma med hjulet
        </p>
      )}
    </>
  );
}
