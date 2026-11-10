import { ArchBrief, type ArchSuggestion, type Tenant } from "@throughline/contracts";
import type { ArchSubject } from "./subject";

const REGION: Record<Tenant["region"], ArchBrief["region"]> = {
  "in-mumbai": "india",
  "in-hyderabad": "india",
  "ae-dubai": "uae",
  "eu-frankfurt": "eu",
  "us-virginia": "us",
};

const FALLBACK: { [K in keyof ArchBrief]: { value: ArchBrief[K]; reason: string } } = {
  cloud: { value: "azure", reason: "No hosting evidence found; Azure is the default landing zone." },
  region: { value: "india", reason: "No residency rule found." },
  compute: { value: "serverless-containers", reason: "Least platform to run when nothing else is known." },
  database: { value: "postgres", reason: "Relational default with no licence cost." },
  cache: { value: "yes", reason: "Idempotency keys and hot reads benefit from a cache." },
  messaging: { value: "queue", reason: "Absorbs partner slowness with retries." },
  exposure: { value: "public", reason: "Assumed customer-facing." },
  topology: { value: "single-network", reason: "One workload, no on-prem link." },
  connectivity: { value: "none", reason: "No on-prem dependency found." },
  identity: { value: "workforce", reason: "Assumed staff-only." },
  availability: { value: "zone-redundant", reason: "Survives a data-centre failure at modest cost." },
  classification: { value: "confidential", reason: "Assumed to hold personal data." },
  compliance: { value: ["iso27001"], reason: "Baseline control set." },
  keys: { value: "platform", reason: "Provider-managed keys unless a policy says otherwise." },
  ai: { value: "none", reason: "No model calls found." },
  observability: { value: "native", reason: "Keeps telemetry in-tenant." },
};

/**
 * The architect agent's first pass at the brief. Every answer carries where it came from, so the
 * person confirming it knows which ones are facts and which are guesses worth challenging.
 */
export function suggestBrief(
  tenant: Tenant,
  subject: ArchSubject,
): { brief: ArchBrief; suggestions: Record<string, ArchSuggestion> } {
  const suggestions: Record<string, ArchSuggestion> = {};
  for (const [key, fb] of Object.entries(FALLBACK)) {
    suggestions[key] = { value: fb.value, reason: fb.reason, basis: "assumed" };
  }

  suggestions.region = {
    value: REGION[tenant.region],
    reason: `${tenant.name}'s data residency is pinned to ${tenant.region} in workspace settings.`,
    basis: "stated",
  };
  suggestions.keys = {
    value: tenant.encryption === "customer-key" ? "customer-managed" : "platform",
    reason:
      tenant.encryption === "customer-key"
        ? "Workspace security policy requires customer-managed keys."
        : "Workspace uses provider-managed keys.",
    basis: "stated",
  };

  for (const [key, signal] of Object.entries(subject.signals)) {
    if (signal) suggestions[key] = signal;
  }

  const connectivity = suggestions.connectivity?.value;
  if (!subject.signals.topology) {
    const hub = connectivity !== "none" || suggestions.classification?.value === "restricted";
    suggestions.topology = hub
      ? {
          value: "hub-spoke",
          reason: "An on-prem link and regulated data both want central inspection in a shared hub.",
          basis: "inferred",
        }
      : { value: "single-network", reason: "One workload with no on-prem link.", basis: "inferred" };
  }

  const brief = Object.fromEntries(Object.entries(suggestions).map(([k, s]) => [k, s.value]));
  return { brief: ArchBrief.parse(brief), suggestions };
}
