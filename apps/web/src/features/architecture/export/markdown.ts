import { type Architecture, DIAGRAM_LABEL, type DocTable } from "@throughline/contracts";

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
const table = (t: DocTable) =>
  [
    `| ${t.columns.map(cell).join(" | ")} |`,
    `| ${t.columns.map(() => "---").join(" | ")} |`,
    ...t.rows.map((r) => `| ${r.map(cell).join(" | ")} |`),
  ].join("\n");

/**
 * The architecture document as Markdown, ready for Confluence, a repo `docs/` folder or a PR.
 * Diagrams are referenced by the file names the SVG export uses.
 */
export function toMarkdown(arch: Architecture, slug: string): string {
  const doc = arch.document;
  if (!doc) return "";
  const out: string[] = [
    `# ${doc.title}`,
    "",
    `**Work item:** ${arch.workItemKey} · **Version:** ${doc.version} · **Revision:** ${arch.revision}${arch.generatedAt ? ` · **Generated:** ${arch.generatedAt.slice(0, 10)}` : ""}`,
    "",
    `> ${doc.summary}`,
    "",
  ];
  for (const s of doc.sections) {
    out.push(`## ${s.title}`, "");
    if (s.intro) out.push(s.intro, "");
    if (s.diagram) {
      const d = arch.diagrams.find((x) => x.kind === s.diagram);
      if (d) out.push(`![${DIAGRAM_LABEL[s.diagram]}](./${slug}-${d.kind}.svg)`, "", `*${d.caption}*`, "");
      if (d?.messages) {
        out.push(
          ...d.messages.map(
            (m) => `${m.step}. **${m.from} → ${m.to}:** ${m.label}${m.note ? ` (${m.note})` : ""}`,
          ),
          "",
        );
      }
    }
    for (const t of s.tables ?? []) out.push(`**${t.caption}**`, "", table(t.table), "");
    for (const d of s.decisions ?? []) {
      out.push(`### ${d.id} · ${d.title}`, "", `*Context:* ${d.context}`, "");
      for (const o of d.options) {
        const tag = o.fit === "chosen" ? " ✅ chosen" : o.fit === "rejected" ? " ❌ rejected" : "";
        out.push(`- **${o.name}**${tag}`);
        for (const p of o.pros) out.push(`  - ➕ ${p}`);
        for (const c of o.cons) out.push(`  - ➖ ${c}`);
      }
      out.push("", `**Decision:** ${d.decision}`, "");
      if (d.consequences.length) out.push(...d.consequences.map((c) => `- ${c}`), "");
    }
    if (s.bullets) out.push(...s.bullets.map((b) => `- ${b}`), "");
  }
  return `${out.join("\n").trim()}\n`;
}
