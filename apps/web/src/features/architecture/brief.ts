import { ARCH_QUESTIONS, type ArchBrief, type ArchSuggestion } from "@throughline/contracts";

/** Questions whose answer differs from the agent's suggestion. */
export function briefChanges(brief: ArchBrief, suggestions: Record<string, ArchSuggestion>) {
  return ARCH_QUESTIONS.filter((q) => {
    const s = suggestions[q.id];
    return s && JSON.stringify(s.value) !== JSON.stringify(brief[q.id]);
  }).map((q) => q.id);
}

/** Live warnings while answering, before anything is generated. The full list lands in the document. */
export function briefWarnings(b: ArchBrief): string[] {
  const out: string[] = [];
  if (b.cloud === "gcp" && b.region === "uae")
    out.push("Google Cloud has no UAE region: data would leave the country.");
  if (b.cloud === "aws" && b.region === "uae" && b.availability.startsWith("multi-region"))
    out.push("AWS's only other Gulf region is Bahrain: DR would leave the UAE.");
  if (b.classification === "restricted" && b.keys === "platform")
    out.push("Restricted data with provider-managed keys rarely passes a regulator.");
  if (b.classification === "restricted" && b.availability === "single-zone")
    out.push("A regulated service in a single zone has no data-centre resilience.");
  if (b.exposure === "internal" && b.connectivity === "none")
    out.push("Internal-only with no private link: staff need a zero-trust access proxy.");
  if (b.availability === "multi-region-active" && b.database !== "nosql")
    out.push("Active-active with a relational database risks write conflicts.");
  if (b.compliance.includes("rbi") && b.region !== "india")
    out.push("RBI requires payment data stored in India.");
  if (b.compliance.includes("cbuae") && b.region !== "uae")
    out.push("CBUAE expects bank data held in the UAE.");
  return out;
}
