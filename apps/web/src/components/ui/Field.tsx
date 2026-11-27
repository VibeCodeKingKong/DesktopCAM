import { useEffect, useId, useState, type ReactNode, Fragment } from 'react';
import { InfoHint } from '../smartguide/InfoHint';
import { useAppStore } from '../../store/useAppStore';
import { displayStep, displayUnit, fromDisplay, toDisplay } from '../../utils/units';
import type { GuideKey } from '../../i18n';

interface RowProps {
  label: string;
  hint?: GuideKey;
  htmlFor?: string;
  /** Extra knapp efter etiketten (t.ex. ett "i" med förklaring). */
  extra?: ReactNode;
  children: ReactNode;
}

/** Etikett till vänster, kontroll till höger – samma rytm i alla paneler och dialoger. */
export function FieldRow({ label, hint, htmlFor, extra, children }: RowProps) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] items-center gap-2">
      <label htmlFor={htmlFor} className="flex min-w-0 items-center gap-1 text-xs text-muted">
        <span className="truncate">{label}</span>
        {hint && <InfoHint topic={hint} />}
        {extra}
      </label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
  step?: number;
  min?: number;
  max?: number;
  hint?: GuideKey;
  /** Räkna om medan man skriver (inte bara när fältet lämnas). */
  live?: boolean;
  extra?: ReactNode;
}

export function NumberField({ label, value, onChange, unit, step = 1, min, max, hint, live, extra }: NumberFieldProps) {
  const id = useId();
  // Längder visas i vald enhet (mm eller tum); värdet in och ut är alltid i mm.
  const units = useAppStore((s) => s.units);
  const shown = toDisplay(value, unit, units);
  const shownUnit = displayUnit(unit, units);
  const shownStep = displayStep(step, unit, units);
  const [draft, setDraft] = useState(String(+shown.toFixed(4)));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(String(+shown.toFixed(4)));
  }, [shown, focused]);

  const commit = (raw: string) => {
    const v = parseFloat(raw.replace(',', '.'));
    if (Number.isNaN(v)) return;
    const clamped = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, fromDisplay(v, unit, units)));
    if (Math.abs(clamped - value) > 1e-9) onChange(clamped);
  };

  return (
    <FieldRow label={label} hint={hint} htmlFor={id} extra={extra}>
      <div className="relative">
        <input
          id={id}
          className={`field ${unit ? 'pr-12' : ''}`}
          inputMode="decimal"
          value={draft}
          step={shownStep}
          onFocus={() => setFocused(true)}
          onBlur={(e) => {
            setFocused(false);
            commit(e.target.value);
          }}
          onChange={(e) => {
            setDraft(e.target.value);
            if (live) commit(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') {
              setDraft(String(+shown.toFixed(4)));
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
              const next = shown + (e.key === 'ArrowUp' ? shownStep : -shownStep) * (e.shiftKey ? 10 : 1);
              commit(String(+next.toFixed(4)));
            }
          }}
        />
        {shownUnit && <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-2xs text-muted">{shownUnit}</span>}
      </div>
    </FieldRow>
  );
}

interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  hint?: GuideKey;
  extra?: ReactNode;
}

export function SelectField<T extends string>({ label, value, options, onChange, hint, extra }: SelectFieldProps<T>) {
  const id = useId();
  return (
    <FieldRow label={label} hint={hint} htmlFor={id} extra={extra}>
      <Select id={id} value={value} options={options} onChange={onChange} />
    </FieldRow>
  );
}

/** Grupper med rubrik; mellan grupperna ritas en avskiljande linje. */
export type SelectGroup<T extends string> = { label: string; options: { value: T; label: string }[] };

export function Select<T extends string>({
  id,
  value,
  options,
  groups,
  onChange,
  className = '',
}: {
  id?: string;
  value: T;
  options?: { value: T; label: string }[];
  groups?: SelectGroup<T>[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <select id={id} className={`field cursor-pointer pr-6 ${className}`} value={value} onChange={(e) => onChange(e.target.value as T)}>
      {groups ? <GroupedOptions groups={groups} /> : (options ?? []).map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/**
 * Optgroups med en linje emellan. Linjen är ett inaktivt alternativ, eftersom
 * <hr> i <select> bara stöds av de nyaste webbläsarna.
 */
export function GroupedOptions<T extends string>({ groups, render }: { groups: SelectGroup<T>[]; render?: (o: { value: T; label: string }) => string }) {
  const shown = groups.filter((g) => g.options.length);
  return (
    <>
      {shown.map((g, i) => (
        <Fragment key={g.label}>
          {i > 0 && (
            <option disabled value="" aria-hidden="true">
              ──────────────
            </option>
          )}
          <optgroup label={g.label}>
            {g.options.map((o) => (
              <option key={o.value} value={o.value}>
                {render ? render(o) : o.label}
              </option>
            ))}
          </optgroup>
        </Fragment>
      ))}
    </>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex h-7 rounded-md border border-line bg-app p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
          className={`flex-1 rounded px-1.5 text-2xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
            o.value === value ? 'bg-raised text-ink shadow-sm' : 'text-muted hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
        checked ? 'bg-accent' : 'bg-line'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`}
      />
    </button>
  );
}
