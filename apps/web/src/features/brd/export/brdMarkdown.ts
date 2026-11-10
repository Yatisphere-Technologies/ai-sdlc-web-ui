import { BRD_STATUS_LABEL, type Brd } from "@throughline/contracts";
import { placedSections } from "../sections";

const cell = (s: unknown) =>
  (Array.isArray(s) ? s.join("; ") : String(s ?? "")).replace(/\|/g, "\\|").replace(/\n/g, " ");

/** The BRD as Markdown: Confluence, a repo or a Word conversion (pandoc) all take it as-is. */
export function brdToMarkdown(brd: Brd): string {
  const c = brd.content;
  const out: string[] = [
    `# ${brd.id} · ${brd.title}`,
    "",
    "| Version | Status | Owner | Work item | Last updated |",
    "| --- | --- | --- | --- | --- |",
    `| ${brd.version} | ${BRD_STATUS_LABEL[brd.status]} | ${brd.owner} | ${brd.workItemKey} | ${brd.updatedAt.slice(0, 10)} |`,
    "",
    "## Approvals",
    "",
    "| Capacity | Name | Decision | Date | Comment |",
    "| --- | --- | --- | --- | --- |",
    ...brd.approvals.map(
      (a) => `| ${a.capacity} | ${a.name} | ${a.status} | ${a.at?.slice(0, 10) ?? ""} | ${cell(a.comment)} |`,
    ),
    "",
  ];
  for (const placed of placedSections(brd)) {
    out.push(`## ${placed.number}. ${placed.title}`, "");
    if (placed.kind === "custom") {
      out.push(placed.custom.body || "—", "");
      continue;
    }
    const s = placed.section;
    if (s.kind === "text") out.push(c[s.key] || "—", "");
    else if (s.kind === "list") {
      for (const { key, label } of s.keys) {
        if (s.keys.length > 1) out.push(`**${label}**`, "");
        out.push(...(c[key].length ? c[key].map((x) => `- ${x}`) : ["- None"]), "");
      }
    } else if (s.key === "requirements") {
      for (const r of c.requirements) {
        out.push(
          `### ${r.id} · ${r.title} (${r.priority.toUpperCase()})`,
          "",
          r.statement,
          "",
          `*Rationale:* ${r.rationale}  `,
          `*Actor:* ${r.actor} · *Objective:* ${r.objective} · *Area:* ${r.area} · *Source:* ${r.source || "—"}${r.sources?.length ? ` · *Cites:* ${r.sources.join(", ")}` : ""}`,
          "",
          "**Acceptance criteria**",
          "",
          ...r.acceptance.map((a, i) => `${i + 1}. ${a}`),
          "",
        );
      }
    } else {
      const rows = c[s.key] as unknown as Record<string, unknown>[];
      out.push(
        `| ${s.fields.map((f) => f.label).join(" | ")} |`,
        `| ${s.fields.map(() => "---").join(" | ")} |`,
        ...rows.map((r) => `| ${s.fields.map((f) => cell(r[f.key])).join(" | ")} |`),
        "",
      );
    }
  }
  out.push(
    "## Change history",
    "",
    ...brd.history.map((h) => `- **v${h.version}** · ${h.at.slice(0, 10)} · ${h.by}: ${h.what}`),
    "",
  );
  return `${out.join("\n").trim()}\n`;
}
