import {
  ARCH_STEPS,
  type ArchBrief,
  type Architecture,
  type BrdContent,
  type Tenant,
} from "@throughline/contracts";
import { buildComponents } from "./components";
import { architectureDecisions } from "./decisions";
import { buildDiagrams } from "./diagrams";
import { buildDocument } from "./document";
import type { ArchSubject } from "./subject";
import { suggestBrief } from "./suggest";

export { previewChoice } from "./choices";
export type { ArchSubject } from "./subject";
export {
  acmeMcpSubject,
  acmeSubject,
  emailListenerSubject,
  fabrikamSubject,
  northwindSubject,
} from "./subject";

/** Server-side record: the public architecture plus what the agent knows about the system. */
export type ArchitectureRecord = { architecture: Architecture; subject: ArchSubject };

/**
 * Stand-in for the architect agent. Deterministic: the same brief always yields the same diagrams,
 * components and document, which is what lets a reviewer trust a regenerated pack. The BRD it was
 * derived from (when there is one) tells each component which requirements and NFRs it serves.
 */
export function generateArchitecture(
  brief: ArchBrief,
  subject: ArchSubject,
  revision: number,
  brd: BrdContent | null = null,
) {
  const decisions = [...architectureDecisions(brief, subject), ...(subject.decisions ?? [])];
  const { diagrams, components } = buildComponents(
    brief,
    subject,
    buildDiagrams(brief, subject),
    decisions,
    brd,
  );
  return { diagrams, components, document: buildDocument(brief, subject, revision) };
}

export function seedArchitecture(
  tenant: Tenant,
  subject: ArchSubject,
  generated: boolean,
  opts: { projectId: string; brd?: BrdContent | null },
): ArchitectureRecord {
  const { brief, suggestions } = suggestBrief(tenant, subject);
  const out = generated ? generateArchitecture(brief, subject, 1, opts.brd ?? null) : null;
  return {
    subject,
    architecture: {
      id: subject.id,
      projectId: opts.projectId,
      workItemKey: subject.workItemKey,
      title: subject.title,
      system: subject.system,
      status: generated ? "ready" : "brief",
      progress: generated ? 100 : 0,
      steps: ARCH_STEPS.map((label) => ({ label, done: generated })),
      brief,
      suggestions,
      briefBy: generated ? "architect-agent · confirmed by the architecture lead" : null,
      diagrams: out?.diagrams ?? [],
      document: out?.document ?? null,
      generatedAt: generated ? "2026-10-22T09:40:00Z" : null,
      revision: generated ? 1 : 0,
      components: out?.components ?? [],
      history: [],
    },
  };
}
