/**
 * Slår ihop flera delar G-kod till en fil: postprocessorns början bara först
 * och slutet bara sist (samma regel som när banor sparas tillsammans).
 */
import type { PostprocessorConfig } from '../types';

function findSeq(lines: string[], seq: string[], from = 0, to = lines.length): number {
  if (!seq.length) return -1;
  for (let i = from; i + seq.length <= to; i++) if (seq.every((l, k) => lines[i + k].trim() === l.trim())) return i;
  return -1;
}

export function combineGcodeParts(parts: string[], post: PostprocessorConfig): string {
  const list = parts.filter((p) => p.trim());
  if (list.length <= 1) return list[0] ?? '';
  const out: string[] = [];
  list.forEach((g, i) => {
    const lines = g.replace(/\n+$/, '').split('\n');
    let end = lines.length;
    if (i < list.length - 1) {
      const f = findSeq(lines, post.footer, Math.max(0, lines.length - post.footer.length - 3));
      if (f >= 0) end = f;
    }
    let body = lines.slice(0, end);
    if (i > 0) {
      const h = findSeq(body, post.header, 0, Math.min(body.length, post.header.length + 6));
      if (h >= 0) body = [...body.slice(0, h), ...body.slice(h + post.header.length)];
    }
    for (const l of body) out.push(l);
  });
  return out.join('\n') + '\n';
}
