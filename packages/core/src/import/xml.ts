/**
 * Minimal XML-tolk för SVG. Körs i Web Workern, där DOMParser saknas.
 * Hanterar element, attribut, kommentarer, CDATA, processinstruktioner och DOCTYPE.
 * Textinnehåll sparas inte (text importeras ändå inte som vektorer).
 */
export interface XmlNode {
  name: string;
  attrs: Record<string, string>;
  children: XmlNode[];
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e] ?? m;
  });
}

export function parseXml(src: string): XmlNode {
  const doc: XmlNode = { name: '#document', attrs: {}, children: [] };
  const stack: XmlNode[] = [doc];
  const attrRe = /\s*([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/y;
  let i = 0;

  while (i < src.length) {
    const lt = src.indexOf('<', i);
    if (lt < 0) break;
    i = lt;
    if (src.startsWith('<!--', i)) {
      const end = src.indexOf('-->', i + 4);
      i = end < 0 ? src.length : end + 3;
    } else if (src.startsWith('<![CDATA[', i)) {
      const end = src.indexOf(']]>', i + 9);
      i = end < 0 ? src.length : end + 3;
    } else if (src.startsWith('<?', i)) {
      const end = src.indexOf('?>', i + 2);
      i = end < 0 ? src.length : end + 2;
    } else if (src.startsWith('<!', i)) {
      let depth = 0;
      let j = i + 2;
      for (; j < src.length; j++) {
        if (src[j] === '[') depth++;
        else if (src[j] === ']') depth--;
        else if (src[j] === '>' && depth <= 0) break;
      }
      i = j + 1;
    } else if (src.startsWith('</', i)) {
      const end = src.indexOf('>', i);
      if (stack.length > 1) stack.pop();
      i = end < 0 ? src.length : end + 1;
    } else {
      const nameMatch = /^<([^\s/>]+)/.exec(src.slice(i, i + 256));
      if (!nameMatch) {
        i++;
        continue;
      }
      const node: XmlNode = { name: nameMatch[1], attrs: {}, children: [] };
      i += nameMatch[0].length;
      attrRe.lastIndex = i;
      let m: RegExpExecArray | null;
      while ((m = attrRe.exec(src))) {
        node.attrs[m[1]] = decode(m[2] ?? m[3] ?? '');
        i = attrRe.lastIndex;
      }
      while (i < src.length && /\s/.test(src[i])) i++;
      const selfClosing = src[i] === '/';
      const end = src.indexOf('>', i);
      i = end < 0 ? src.length : end + 1;
      stack[stack.length - 1].children.push(node);
      if (!selfClosing) stack.push(node);
    }
  }
  const root = doc.children[0];
  if (!root) throw new Error('SVG_INVALID');
  return root;
}
