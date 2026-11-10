/**
 * A deliberately small Markdown subset for agent replies: paragraphs, bullet and numbered lists,
 * **bold**, *italic*, `code` and [links](https://…). It parses to a tree that React renders as
 * elements, so nothing is ever injected as HTML.
 */

export type Inline =
  | { type: "text"; text: string }
  | { type: "strong"; children: Inline[] }
  | { type: "em"; children: Inline[] }
  | { type: "code"; text: string }
  | { type: "link"; href: string; children: Inline[] };

export type Block =
  | { type: "p"; children: Inline[] }
  | { type: "ul"; items: Inline[][] }
  | { type: "ol"; items: Inline[][] }
  | { type: "h"; children: Inline[] };

const SAFE_URL = /^https?:\/\/[^\s<>"']+$/i;

export function parseInline(s: string): Inline[] {
  const out: Inline[] = [];
  let rest = s;
  const pattern =
    /(\*\*([^*]+)\*\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)\s]+)\))|(\*([^*\s][^*]*)\*)|(https?:\/\/[^\s<>()"']+[^\s<>()"'.,;:!?])/;
  while (rest) {
    const m = pattern.exec(rest);
    if (!m) {
      out.push({ type: "text", text: rest });
      break;
    }
    if (m.index > 0) out.push({ type: "text", text: rest.slice(0, m.index) });
    if (m[1] && m[2]) out.push({ type: "strong", children: parseInline(m[2]) });
    else if (m[3] && m[4] !== undefined) out.push({ type: "code", text: m[4] });
    else if (m[5] && m[6] && m[7]) {
      if (SAFE_URL.test(m[7])) out.push({ type: "link", href: m[7], children: parseInline(m[6]) });
      else out.push({ type: "text", text: m[6] });
    } else if (m[8] && m[9]) out.push({ type: "em", children: parseInline(m[9]) });
    else if (m[10]) out.push({ type: "link", href: m[10], children: [{ type: "text", text: m[10] }] });
    rest = rest.slice(m.index + m[0].length);
  }
  return out;
}

const BULLET = /^\s*(?:[-*•])\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^\s*#{1,4}\s+(.*)$/;

export function parseMarkdown(src: string): Block[] {
  const blocks: Block[] = [];
  const lines = src.replace(/\r/g, "").split("\n");
  let para: string[] = [];
  const flush = () => {
    if (para.length) blocks.push({ type: "p", children: parseInline(para.join("\n")) });
    para = [];
  };
  for (const line of lines) {
    const bullet = BULLET.exec(line);
    const numbered = NUMBERED.exec(line);
    const heading = HEADING.exec(line);
    if (!line.trim()) {
      flush();
    } else if (bullet || numbered) {
      flush();
      const type = bullet ? "ul" : "ol";
      const text = (bullet?.[1] ?? numbered?.[1] ?? "").trim();
      const last = blocks.at(-1);
      if (last && last.type === type) last.items.push(parseInline(text));
      else blocks.push({ type, items: [parseInline(text)] });
    } else if (heading) {
      flush();
      blocks.push({ type: "h", children: parseInline((heading[1] ?? "").trim()) });
    } else {
      para.push(line);
    }
  }
  flush();
  return blocks;
}

/** Plain text of a Markdown string, for copying and screen-reader summaries. */
export function plainText(src: string): string {
  const inline = (xs: Inline[]): string =>
    xs.map((x) => (x.type === "text" || x.type === "code" ? x.text : inline(x.children))).join("");
  return parseMarkdown(src)
    .map((b) =>
      b.type === "p" || b.type === "h"
        ? inline(b.children)
        : b.items.map((i, n) => `${b.type === "ol" ? `${n + 1}.` : "•"} ${inline(i)}`).join("\n"),
    )
    .join("\n\n");
}
