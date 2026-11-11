import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { useT } from '../../i18n';
import { customFonts, FONT_FAMILIES, LINE_FONT, loadFont, loadFontFile } from '../../text/fonts';
import { FieldRow } from './Field';

/**
 * Val av typsnitt: det enkellinjiga gravyrtypsnittet eller ett kontur-typsnitt.
 * Kontur-typsnitt hämtas när de väljs; onChange anropas först när det är inläst.
 */
export function FontPicker({ value, onChange }: { value: string; onChange: (font: string) => void }) {
  const t = useT();
  const d = t.textDialog;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const pick = async (id: string) => {
    setError(false);
    if (id === LINE_FONT || id.startsWith('custom:')) return onChange(id);
    setLoading(true);
    try {
      await loadFont(id);
      onChange(id);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const upload = async (f: File | undefined) => {
    if (!f) return;
    setError(false);
    try {
      const font = await loadFontFile(f);
      onChange(font.id);
    } catch {
      setError(true);
    }
  };

  return (
    <>
      <FieldRow label={d.font}>
        <div className="flex gap-1">
          <select className="field min-w-0 flex-1" value={value} onChange={(e) => pick(e.target.value)} aria-label={d.font}>
            <optgroup label={d.fontGroups.line}>
              <option value={LINE_FONT}>desktopCAM Linje</option>
            </optgroup>
            <optgroup label={d.fontGroups.outline}>
              {FONT_FAMILIES.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} – {d.fontStyles[f.style]}
                </option>
              ))}
            </optgroup>
            {customFonts.length > 0 && (
              <optgroup label={d.fontGroups.custom}>
                {customFonts.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          <button type="button" className="btn shrink-0 px-2" onClick={() => file.current?.click()} title={d.loadFont} aria-label={d.loadFont}>
            <Upload size={13} />
          </button>
          <input ref={file} type="file" accept=".ttf,.otf,.woff,font/ttf,font/otf,font/woff" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
        </div>
      </FieldRow>
      {loading && <p className="text-2xs text-muted">{d.loadingFont}</p>}
      {error && <p className="text-2xs text-warn">{d.fontFailed}</p>}
    </>
  );
}
