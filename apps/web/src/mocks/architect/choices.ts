import {
  type ArchBrief,
  type BrdContent,
  ArchBrief as BriefSchema,
  type ChoiceImpact,
} from "@throughline/contracts";
import { buildComponents } from "./components";
import { securityControls } from "./controls";
import { architectureDecisions } from "./decisions";
import { buildDiagrams } from "./diagrams";
import { briefRisks, costEstimate } from "./document";
import type { ArchSubject } from "./subject";

const text = (v: unknown) => (Array.isArray(v) ? v.join(", ") : String(v));

/**
 * What switching one brief answer would change: run cost, components added or removed, decisions
 * and controls that change, and new risks (residency, conflicts). Deterministic, like generation.
 * Returns null when the new brief isn't valid.
 */
export function previewChoice(
  brief: ArchBrief,
  subject: ArchSubject,
  field: string,
  value: string | string[],
  brd: BrdContent | null,
): ChoiceImpact | null {
  if (!(field in brief)) return null;
  const parsed = BriefSchema.safeParse({ ...brief, [field]: value });
  if (!parsed.success) return null;
  const next = parsed.data;
  const side = (b: ArchBrief) => {
    const decisions = [...architectureDecisions(b, subject), ...(subject.decisions ?? [])];
    const { components } = buildComponents(b, subject, buildDiagrams(b, subject), decisions, brd);
    return {
      cost: costEstimate(b).total,
      parts: new Map(components.map((c) => [`${c.name} (${c.product})`, c])),
      decisions: new Map(decisions.map((d) => [d.id, d])),
      controls: new Map(securityControls(b).map((c) => [c.id, c.name])),
      risks: new Set(briefRisks(b, subject).map((r) => r[0] ?? "")),
    };
  };
  const a = side(brief);
  const z = side(next);
  return {
    field,
    from: text(brief[field as keyof ArchBrief]),
    to: text(value),
    costBefore: Math.round(a.cost),
    costAfter: Math.round(z.cost),
    added: [...z.parts.keys()].filter((k) => !a.parts.has(k)),
    removed: [...a.parts.keys()].filter((k) => !z.parts.has(k)),
    decisions: [...z.decisions.values()]
      .filter((d) => a.decisions.get(d.id)?.decision !== d.decision)
      .map((d) => `${d.id} ${d.title}`),
    controls: [...new Set([...a.controls.keys(), ...z.controls.keys()])]
      .filter((id) => a.controls.get(id) !== z.controls.get(id))
      .map((id) => `${id} ${z.controls.get(id) ?? `${a.controls.get(id)} (removed)`}`),
    warnings: [...z.risks].filter((r) => r && !a.risks.has(r)),
  };
}
