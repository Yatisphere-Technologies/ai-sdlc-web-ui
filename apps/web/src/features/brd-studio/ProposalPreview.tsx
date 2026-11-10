import type { Proposal } from "@throughline/contracts";
import { SECTIONS } from "../brd/sections";

/** Labels and a short preview for the edits the BA agent proposes. */

export const TARGET_LABEL: Record<string, string> = {
  summary: "Executive summary",
  problem: "Problem statement",
  background: "Background",
  objectives: "Objectives",
  inScope: "In scope",
  outOfScope: "Out of scope",
  stakeholders: "Stakeholders",
  currentState: "Current state",
  futureState: "Future state",
  painPoints: "Pain points",
  requirements: "Requirements",
  rules: "Business rules",
  nfrs: "Non-functional",
  data: "Data",
  assumptions: "Assumptions",
  constraints: "Constraints",
  dependencies: "Dependencies",
  risks: "Risks",
  successCriteria: "Success criteria",
  glossary: "Glossary",
  openQuestions: "Open questions",
};

export const focusLabel = (focus: string) =>
  focus.startsWith("acceptance:")
    ? `Acceptance criteria for ${focus.split(":")[1]}`
    : (TARGET_LABEL[focus] ?? SECTIONS.find((s) => s.id === focus)?.title ?? focus);

/** A short, readable preview of what a proposal would write. */
export function ProposalPreview({ p }: { p: Proposal }) {
  const v = p.value as Record<string, unknown> | string | string[] | null;
  if (p.op === "remove-row") return <p className="text-caption text-risk-fg">Removes {p.rowId}</p>;
  if (typeof v === "string") return <p className="text-caption text-subtle line-clamp-4">{v}</p>;
  if (Array.isArray(v))
    return (
      <ul className="text-caption text-subtle list-disc pl-4">
        {v.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    );
  if (v && typeof v === "object") {
    const lines = [
      v.statement ?? v.description ?? v.question ?? v.step ?? v.definition,
      Array.isArray(v.acceptance) && v.acceptance.length
        ? `Acceptance: ${(v.acceptance as string[]).join("; ")}`
        : null,
      v.kpi
        ? `KPI: ${v.kpi} · ${v.baseline} → ${v.target}`
        : v.target && p.target === "nfrs"
          ? `Target: ${v.target}`
          : null,
      v.role ? `${v.role} (${v.raci})` : null,
      v.priority && p.op === "update-row" && !v.statement ? `Priority → ${v.priority}` : null,
    ].filter(Boolean) as string[];
    if (!lines.length) return null;
    return (
      <div className="text-caption text-subtle flex flex-col gap-0.5">
        {lines.map((l) => (
          <p key={l} className="line-clamp-3">
            {l}
          </p>
        ))}
      </div>
    );
  }
  return null;
}
