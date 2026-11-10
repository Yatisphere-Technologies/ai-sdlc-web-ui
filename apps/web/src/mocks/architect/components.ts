import type {
  ArchBrief,
  ArchComponent,
  ArchDecision,
  BrdContent,
  ComponentServes,
  Diagram,
  DiagramCategory,
  NonFunctional,
} from "@throughline/contracts";
import { CATALOG, CLOUD_LABEL, keyRole, MONTHLY_USD, REGIONS, type ServiceRole } from "./catalog";
import { securityControls } from "./controls";
import type { ArchSubject } from "./subject";

/**
 * The component catalogue behind the diagrams: for every logical building block, what it does in
 * this solution, why it is there (the BRD requirements, NFRs, decisions and controls it serves),
 * how it is configured, what it costs and which brief question would change it. Diagram nodes
 * point at a component, so the same info shows whichever diagram the reader clicks in.
 */

type Draft = Omit<ArchComponent, "serves" | "monthlyUsd" | "docsUrl"> & {
  /** Requirement ids (BR-xx) this component delivers. */
  brs?: string[];
};

/** Microsoft Learn landing page per role. Only Azure for now; other clouds show no link. */
const AZURE_DOCS: Partial<Record<ServiceRole, string>> = {
  edge: "https://learn.microsoft.com/azure/frontdoor/",
  waf: "https://learn.microsoft.com/azure/web-application-firewall/",
  ddos: "https://learn.microsoft.com/azure/ddos-protection/",
  dns: "https://learn.microsoft.com/azure/dns/",
  apigw: "https://learn.microsoft.com/azure/api-management/",
  ingress: "https://learn.microsoft.com/azure/application-gateway/",
  ztna: "https://learn.microsoft.com/entra/global-secure-access/",
  kubernetes: "https://learn.microsoft.com/azure/aks/",
  "serverless-containers": "https://learn.microsoft.com/azure/container-apps/",
  paas: "https://learn.microsoft.com/azure/app-service/",
  functions: "https://learn.microsoft.com/azure/azure-functions/",
  postgres: "https://learn.microsoft.com/azure/postgresql/flexible-server/",
  sqlserver: "https://learn.microsoft.com/azure/azure-sql/database/",
  nosql: "https://learn.microsoft.com/azure/cosmos-db/",
  cache: "https://learn.microsoft.com/azure/azure-cache-for-redis/",
  queue: "https://learn.microsoft.com/azure/service-bus-messaging/",
  stream: "https://learn.microsoft.com/azure/event-hubs/",
  "object-store": "https://learn.microsoft.com/azure/storage/blobs/",
  secrets: "https://learn.microsoft.com/azure/key-vault/",
  hsm: "https://learn.microsoft.com/azure/key-vault/managed-hsm/",
  "workforce-idp": "https://learn.microsoft.com/entra/identity/",
  "customer-idp": "https://learn.microsoft.com/entra/external-id/",
  "workload-identity": "https://learn.microsoft.com/entra/workload-id/",
  firewall: "https://learn.microsoft.com/azure/firewall/",
  nat: "https://learn.microsoft.com/azure/nat-gateway/",
  "private-endpoint": "https://learn.microsoft.com/azure/private-link/",
  transit: "https://learn.microsoft.com/azure/virtual-network/virtual-network-peering-overview",
  vpn: "https://learn.microsoft.com/azure/vpn-gateway/",
  "private-circuit": "https://learn.microsoft.com/azure/expressroute/",
  bastion: "https://learn.microsoft.com/azure/bastion/",
  "dns-resolver": "https://learn.microsoft.com/azure/dns/dns-private-resolver-overview",
  monitor: "https://learn.microsoft.com/azure/azure-monitor/",
  logs: "https://learn.microsoft.com/azure/azure-monitor/logs/log-analytics-overview",
  siem: "https://learn.microsoft.com/azure/sentinel/",
  registry: "https://learn.microsoft.com/azure/container-registry/",
  cicd: "https://learn.microsoft.com/azure/devops/pipelines/",
  llm: "https://learn.microsoft.com/azure/ai-foundry/openai/",
  "static-web": "https://learn.microsoft.com/azure/static-web-apps/",
  "api-catalog": "https://learn.microsoft.com/azure/api-center/",
  "content-safety": "https://learn.microsoft.com/azure/ai-services/content-safety/",
  "agent-identity": "https://learn.microsoft.com/entra/agent-id/",
  language: "https://learn.microsoft.com/azure/ai-services/language-service/",
  search: "https://learn.microsoft.com/azure/search/",
};

/** Which NFR categories each standard component helps meet. */
const NFR_FOR: Record<NonFunctional["category"], string[]> = {
  availability: ["db", "dr", "entry", "bus", "edge"],
  performance: ["cache", "entry", "db"],
  security: ["edge", "entry", "firewall", "keys", "widp", "cidp", "wid", "bastion"],
  compliance: ["logs", "siem", "store", "keys"],
  data: ["db", "store", "keys", "system"],
  reporting: ["logs"],
  usability: [],
};

/** Standard decision (AD-xx) behind each component. */
const DECISION_FOR: Record<string, string[]> = {
  system: ["AD-01"],
  db: ["AD-03", "AD-09"],
  bus: ["AD-04"],
  firewall: ["AD-05"],
  hub: ["AD-05"],
  gateway: ["AD-06"],
  router: ["AD-06"],
  edge: ["AD-07"],
  entry: ["AD-07"],
  ztna: ["AD-07"],
  keys: ["AD-08"],
  dr: ["AD-09"],
  logs: ["AD-10"],
  siem: ["AD-10"],
  llm: ["AD-11"],
  gpu: ["AD-11"],
};

/** Security controls (C-numbers) each component carries. */
const CONTROLS_FOR: Record<string, string[]> = {
  edge: ["C1", "C2"],
  entry: ["C1", "C3"],
  db: ["C5", "C7", "C14"],
  cache: ["C5"],
  bus: ["C5"],
  store: ["C5", "C7", "C14"],
  keys: ["C6", "C7"],
  wid: ["C6"],
  firewall: ["C8", "C9"],
  bastion: ["C10"],
  registry: ["C11"],
  cicd: ["C11"],
  logs: ["C12"],
  siem: ["C12"],
  llm: ["C13"],
  system: ["C14"],
};

/** Node id in a diagram → logical component id. */
export function componentOf(nodeId: string, s: ArchSubject, b: ArchBrief): string {
  const customer = s.actors.find((a) => !a.staff);
  const staff = s.actors.find((a) => a.staff);
  const partner = s.externals.find((x) => x.where === "partner");
  const onprem = s.externals.find((x) => x.where === "onprem");
  const saas = s.externals.find((x) => x.where === "saas");
  const worker = s.services.find((x) => x.async);
  const api = s.services.find((x) => x.id === "api") ?? s.services[0];
  const map: Record<string, string | undefined> = {
    users: customer?.id ?? staff?.id,
    staff: staff?.id,
    actor: (customer ?? staff)?.id,
    caller: partner?.id,
    partner: partner?.id,
    onprem: onprem?.id,
    notify: saas?.id,
    idp: b.identity === "workforce" ? "widp" : "cidp",
    web: s.services.find((x) => x.id === "console")?.id,
    "pe-kv": "keys",
    kv: "keys",
    "pe-bus": "bus",
    "pe-store": "store",
    "pe-llm": "llm",
    fw: "firewall",
    gw: "gateway",
    tgw: "transit",
    dd: "logs",
    "dr-compute": "dr",
    "dr-db": "dr",
    worker: worker?.id,
    api: api?.id,
  };
  return map[nodeId] ?? nodeId;
}

function standard(id: string, b: ArchBrief, s: ArchSubject): Draft | null {
  const N = CATALOG[b.cloud];
  const region = REGIONS[b.cloud][b.region];
  const svc = (role: ServiceRole, category: DiagramCategory) => ({ role, category, product: N[role] });
  const zones = region.zones && b.availability !== "single-zone";
  const apiName = s.services.find((x) => x.id === "api")?.name ?? "the API";
  switch (id) {
    case "system":
      return {
        id,
        name: s.system,
        ...svc("system", "system"),
        product: `${CLOUD_LABEL[b.cloud]} · ${region.primary}`,
        purpose: s.purpose,
        why: `The system this architecture describes. Peak load: ${s.peakLoad}.`,
        config: [
          { k: "Region", v: region.primary },
          { k: "Disaster recovery", v: b.availability.startsWith("multi") ? (region.dr ?? "—") : "None" },
          { k: "Classification", v: b.classification },
        ],
        status: "ga",
        choice: "cloud",
      };
    case "edge":
      return {
        id,
        name: "Edge + WAF",
        ...svc("edge", "edge"),
        product: `${N.edge} · ${N.waf}`,
        purpose: `Global entry point: terminates TLS, applies the WAF policy and rate limits, and forwards only clean traffic to the ${b.exposure === "partner" ? "API gateway" : "load balancer"} over a private origin.`,
        why: "Without it the entry point faces the internet directly: no protection from bots, injection or volumetric attacks.",
        config: [
          { k: "WAF mode", v: "Prevention, managed rule set + bot protection" },
          { k: "Origin", v: "Private link; origin accepts only the edge" },
          { k: "TLS", v: "1.2+ with managed certificates" },
        ],
        status: "ga",
        choice: "exposure",
      };
    case "entry":
      return b.exposure === "partner"
        ? {
            id,
            name: "API gateway",
            ...svc("apigw", "edge"),
            purpose: `Validates every caller's token, enforces policy (allow-lists, rate limits, quotas, transformations) and routes calls to ${apiName}.`,
            why: "One place to authenticate, throttle and log every call, instead of each service doing it differently.",
            config: [
              { k: "Tier", v: b.cloud === "azure" ? "Premium v2, zone redundant" : "Production tier" },
              { k: "Network", v: "Injected into the spoke network; private backends" },
              { k: "Policy", v: "Versioned in Git, deployed by pipeline" },
            ],
            status: "ga",
            choice: "exposure",
          }
        : {
            id,
            name: b.exposure === "internal" ? "Internal load balancer + WAF" : "Ingress + WAF",
            ...svc("ingress", "edge"),
            purpose: `Load balances requests and applies WAF rules before traffic reaches ${apiName}.`,
            why: "Keeps services off the network edge and gives one place for TLS and request filtering.",
            config: [
              { k: "Scaling", v: "Autoscale 2–10 instances" },
              { k: "Exposure", v: b.exposure === "internal" ? "Private IP only" : "Behind the edge" },
            ],
            status: "ga",
            choice: "exposure",
          };
    case "ztna":
      return {
        id,
        name: "Access proxy",
        ...svc("ztna", "security"),
        purpose: "Gives users per-application access based on identity and device posture, without a VPN.",
        why: "Internal users have no corporate network link to this system.",
        config: [{ k: "Policy", v: "Managed devices, MFA" }],
        status: "ga",
        choice: "exposure",
      };
    case "db":
      return {
        id,
        name: "Database",
        ...svc(b.database, "data"),
        purpose: `System of record for ${s.dataEntities.toLowerCase()}.`,
        why: `Holds the state the business depends on, with transactions and retention: ${s.retention}.`,
        config: [
          { k: "High availability", v: zones ? "Zone-redundant standby" : "Single zone" },
          { k: "Backups", v: "Point-in-time restore, 35 days; long-term archive per retention" },
          { k: "Encryption", v: b.keys === "platform" ? "Provider-managed keys" : "Customer-managed key" },
          { k: "Access", v: "Private endpoint only; workload identity" },
        ],
        status: "ga",
        choice: "database",
      };
    case "cache":
      return {
        id,
        name: "Cache",
        ...svc("cache", "data"),
        purpose:
          "Holds short-lived data (idempotency keys, sessions, rate-limit counters) so hot paths don't hit the database.",
        why: "Keeps latency inside target at peak and stops duplicate requests being processed twice.",
        config: [
          { k: "Tier", v: zones ? "Zone-redundant" : "Standard" },
          { k: "Port", v: "TLS 6380 only" },
        ],
        status: "ga",
        choice: "cache",
      };
    case "bus":
      return {
        id,
        name: b.messaging === "stream" ? "Event stream" : "Message queue",
        ...svc(b.messaging === "stream" ? "stream" : "queue", "integration"),
        purpose:
          b.messaging === "stream"
            ? `Ordered, replayable stream of ${s.flow.event} events for every consumer.`
            : `Decouples ${apiName} from slow downstream work: delivers ${s.flow.event} at least once, retries with backoff and dead-letters what keeps failing.`,
        why: "Partner or downstream slowness doesn't become user-facing latency, and nothing is lost when a consumer is down.",
        config: [
          { k: "Delivery", v: "At least once; consumers are idempotent" },
          { k: "Dead-letter", v: "After 5 attempts; alert on depth" },
        ],
        status: "ga",
        choice: "messaging",
      };
    case "store":
      return {
        id,
        name: "Object storage",
        ...svc("object-store", "data"),
        purpose: "Holds exports and audit archives, moving them to colder tiers with lifecycle rules.",
        why: `Retention (${s.retention}) is cheaper and tamper-evident here than in the database.`,
        config: [
          { k: "Immutability", v: "Time-based retention on audit containers" },
          { k: "Access", v: "Private endpoint only" },
        ],
        status: "ga",
        choice: null,
      };
    case "keys":
      return {
        id,
        name: b.keys === "hsm" ? "HSM-backed keys" : "Secrets and keys",
        ...svc(keyRole(b), "security"),
        purpose:
          "Holds secrets, certificates and the keys that encrypt data at rest; services read them with their own identity.",
        why:
          b.keys === "platform"
            ? "No secret lives in code or configuration."
            : "The workspace policy requires keys the organisation controls and can revoke.",
        config: [
          {
            k: "Key ownership",
            v:
              b.keys === "hsm"
                ? "HSM, FIPS 140-3 Level 3"
                : b.keys === "customer-managed"
                  ? "Customer-managed, rotated yearly"
                  : "Provider-managed",
          },
          { k: "Access", v: "RBAC, private endpoint, purge protection" },
        ],
        status: "ga",
        choice: "keys",
      };
    case "firewall":
      return {
        id,
        name: "Firewall",
        ...svc("firewall", "security"),
        purpose:
          "Inspects all outbound traffic and allows only named destinations (partners, SaaS, package mirrors).",
        why: "Stops data leaving to unknown places and gives one egress allow-list to audit.",
        config: [
          { k: "Mode", v: "Threat intelligence deny, TLS inspection where allowed" },
          { k: "Routes", v: "Forced tunnel (0.0.0.0/0) from workload subnets" },
        ],
        status: "ga",
        choice: "topology",
      };
    case "gateway":
      return {
        id,
        name: b.connectivity === "vpn" ? "VPN gateway" : "Private circuit gateway",
        ...svc(b.connectivity === "vpn" ? "vpn" : "private-circuit", "network"),
        purpose:
          "Connects the cloud network to the corporate data centre so on-prem systems are reached privately.",
        why: `${
          s.externals
            .filter((x) => x.where === "onprem")
            .map((x) => x.name)
            .join(", ") || "On-prem systems"
        } stay on-prem and must not be exposed to the internet.`,
        config: [{ k: "Redundancy", v: b.connectivity === "vpn" ? "Two tunnels, BGP" : "Two circuits, BGP" }],
        status: "existing",
        choice: "connectivity",
      };
    case "router":
      return {
        id,
        name: "Customer edge router",
        ...svc("router", "network"),
        purpose: "The data centre end of the private link.",
        why: "Terminates the circuit or tunnels on the corporate side.",
        config: [],
        status: "existing",
        choice: "connectivity",
      };
    case "resolver":
      return {
        id,
        name: "DNS resolver",
        ...svc("dns-resolver", "network"),
        purpose: "Resolves private names in both directions between cloud and data centre.",
        why: "Private endpoints only work if both sides resolve them to private addresses.",
        config: [],
        status: "ga",
        choice: null,
      };
    case "bastion":
      return {
        id,
        name: "Privileged access",
        ...svc("bastion", "security"),
        purpose: "Just-in-time administrative access to the network without public IPs.",
        why: "Admins never need a public endpoint or a standing permission.",
        config: [{ k: "Access", v: "Approval + MFA, session recorded" }],
        status: "ga",
        choice: null,
      };
    case "registry":
      return {
        id,
        name: "Image registry",
        ...svc("registry", "ops"),
        purpose: "Stores signed container images; the platform runs only signed images from here.",
        why: "Supply-chain control: what runs is exactly what was built and scanned.",
        config: [{ k: "Policy", v: "Signature required; vulnerability scan on push" }],
        status: "ga",
        choice: null,
      };
    case "cicd":
      return {
        id,
        name: "CI/CD",
        ...svc("cicd", "ops"),
        purpose: "Builds, tests, scans, signs and deploys every change.",
        why: "No manual changes reach production.",
        config: [{ k: "Credentials", v: "Federated (OIDC), no stored secrets" }],
        status: "existing",
        choice: null,
      };
    case "logs":
      return {
        id,
        name: "Logs and metrics",
        ...svc(b.observability === "native" ? "logs" : b.observability, "ops"),
        product: b.observability === "native" ? `${N.monitor} · ${N.logs}` : N[b.observability],
        purpose: "Collects logs, metrics and traces from every component and drives alerts and dashboards.",
        why: "Operations and audit need one place to see what happened.",
        config: [{ k: "Retention", v: "90 days hot, then archive" }],
        status: "ga",
        choice: "observability",
      };
    case "siem":
      return {
        id,
        name: "SIEM",
        ...svc("siem", "security"),
        purpose: "Correlates security events across the platform and runs detections for the SOC.",
        why: "Attacks are spotted from patterns across components, not in one log.",
        config: [],
        status: "existing",
        choice: null,
      };
    case "widp":
      return {
        id,
        name: "Workforce identity",
        ...svc("workforce-idp", "identity"),
        purpose:
          "Signs staff (and agents) in with MFA and Conditional Access; issues the tokens the entry point validates.",
        why: "Every call is tied to a real identity the organisation controls.",
        config: [{ k: "Policy", v: "MFA, compliant device, Conditional Access" }],
        status: "existing",
        choice: "identity",
      };
    case "cidp":
      return {
        id,
        name: "Customer identity",
        ...svc("customer-idp", "identity"),
        purpose: "Customer sign-up, sign-in and step-up authentication for sensitive actions.",
        why: "Customers need their own identity store, separate from staff.",
        config: [],
        status: "ga",
        choice: "identity",
      };
    case "wid":
      return {
        id,
        name: "Workload identity",
        ...svc("workload-identity", "identity"),
        purpose: "Gives every service its own identity to reach databases, queues and keys.",
        why: "No passwords or keys are stored in code or configuration.",
        config: [],
        status: "ga",
        choice: null,
      };
    case "dns":
      return {
        id,
        name: "Public DNS",
        ...svc("dns", "network"),
        purpose: "Publishes the public name of the entry point.",
        why: "Failover between regions is a DNS or edge change, not a client change.",
        config: [],
        status: "ga",
        choice: null,
      };
    case "transit":
      return {
        id,
        name: "Transit gateway",
        ...svc("transit", "network"),
        purpose: "Routes traffic between the hub and spoke networks.",
        why: "Spokes don't talk to each other directly; all routes pass the inspection layer.",
        config: [],
        status: "ga",
        choice: "topology",
      };
    case "nat":
      return {
        id,
        name: "NAT gateways",
        ...svc("nat", "network"),
        purpose: "Gives outbound traffic stable public addresses partners can allow-list.",
        why: "Partners filter by source IP.",
        config: [],
        status: "ga",
        choice: null,
      };
    case "llm":
      return {
        id,
        name: "Language model",
        ...svc("llm", "ai"),
        purpose: "Hosted model the workers call for classification and drafting, over a private endpoint.",
        why: "The language tasks in the requirements need a model; a managed one avoids running GPUs.",
        config: [
          { k: "Network", v: "Private endpoint; no public access" },
          { k: "Data", v: "No training on prompts; in-region processing" },
        ],
        status: "ga",
        choice: "ai",
      };
    case "gpu":
      return {
        id,
        name: "Model server",
        ...svc("gpu", "ai"),
        purpose: "Runs an open-weight model inside the network.",
        why: "Data may not leave the network for model calls.",
        config: [],
        status: "ga",
        choice: "ai",
      };
    case "dr":
      return {
        id,
        name: "Standby region",
        ...svc(b.compute, "compute"),
        product: `${region.dr ?? "Secondary region"} · ${N[b.compute]} + ${N[b.database]} replica`,
        purpose: `${b.availability === "multi-region-active" ? "Runs at full capacity alongside the primary" : "Warm standby, scaled down"}; the database replicates asynchronously and is promoted on failover.`,
        why: "Survives the loss of the whole primary region within the recovery targets.",
        config: [
          {
            k: "Mode",
            v: b.availability === "multi-region-active" ? "Active-active" : "Warm standby at 30%",
          },
        ],
        status: "ga",
        choice: "availability",
      };
    default:
      return null;
  }
}

function fromSubject(id: string, b: ArchBrief, s: ArchSubject): Draft | null {
  const N = CATALOG[b.cloud];
  const actor = s.actors.find((a) => a.id === id);
  if (actor)
    return {
      id,
      name: actor.name,
      product: actor.channel,
      role: actor.staff ? "staff" : "users",
      category: "person",
      purpose: actor.description,
      why: actor.staff ? "Staff who run or oversee the system." : "The people the system serves.",
      config: [
        {
          k: "Signs in with",
          v: actor.staff || b.identity === "workforce" ? N["workforce-idp"] : N["customer-idp"],
        },
      ],
      status: "external",
      choice: null,
    };
  const ext = s.externals.find((x) => x.id === id);
  if (ext)
    return {
      id,
      name: ext.name,
      product:
        ext.where === "onprem" ? "On-premises system" : ext.where === "saas" ? "SaaS" : "Partner system",
      role: ext.where === "onprem" ? "onprem-dc" : "external",
      category: "external",
      purpose: ext.description,
      why: "An existing system this one depends on; it isn't built or run by this project.",
      config: [
        { k: "Protocol", v: ext.protocol },
        { k: "Reached via", v: ext.where === "onprem" ? "Private link" : "Egress firewall allow-list" },
      ],
      status: "external",
      choice: ext.where === "onprem" ? "connectivity" : null,
    };
  const service = s.services.find((x) => x.id === id);
  if (service) {
    const console = service.id === "console";
    return {
      id,
      name: service.name,
      product: console ? N["static-web"] : N[b.compute],
      role: console ? "static-web" : b.compute,
      category: console ? "edge" : "compute",
      purpose: `${service.description}.`,
      why: service.async
        ? "Does the slow and failure-prone work off the request path, so callers get a fast answer and retries are safe."
        : console
          ? "Staff need a place to act on what the system can't decide alone."
          : "Owns the core business logic and state changes.",
      config: console
        ? [
            { k: "Hosting", v: N["static-web"] },
            { k: "Sign-in", v: N["workforce-idp"] },
          ]
        : [
            { k: "Runs on", v: N[b.compute] },
            {
              k: "Scaling",
              v: service.async
                ? "On queue depth"
                : b.availability === "single-zone"
                  ? "2 replicas"
                  : "min 3 replicas across zones",
            },
            { k: "Identity", v: "Workload identity; no stored secrets" },
          ],
      status: "ga",
      choice: console ? null : "compute",
      brs: service.serves,
    };
  }
  const comp = s.components?.find((x) => x.id === id);
  if (comp) {
    const [product = N[comp.role], purpose = comp.description] = comp.description.split(" · ");
    return {
      id,
      name: comp.name,
      product,
      role: comp.role,
      category: comp.category,
      purpose: `${purpose.charAt(0).toUpperCase()}${purpose.slice(1)}.`,
      why:
        comp.why ??
        `Used by ${comp.link.from === "worker" ? (s.services.find((x) => x.async)?.name ?? "the worker") : comp.link.from === "api" ? (s.services.find((x) => x.id === "api")?.name ?? "the API") : "the entry point"}: ${comp.link.label.toLowerCase()}.`,
      config: [],
      status: "ga",
      choice: null,
      brs: comp.serves,
    };
  }
  return null;
}

/** Annotates every node with its component and returns the component catalogue. */
export function buildComponents(
  b: ArchBrief,
  s: ArchSubject,
  diagrams: Diagram[],
  decisions: ArchDecision[],
  brd: BrdContent | null,
): { diagrams: Diagram[]; components: ArchComponent[] } {
  const annotated = diagrams.map((d) => ({
    ...d,
    nodes: d.nodes.map((n) => ({ ...n, component: componentOf(n.id, s, b) })),
  }));
  const ids = [...new Set(annotated.flatMap((d) => d.nodes.map((n) => n.component ?? n.id)))];
  const controls = securityControls(b);
  const decisionIds = new Set(decisions.map((d) => d.id));
  const subjectDecisions = s.decisionFor ?? {};
  const components: ArchComponent[] = [];
  for (const id of ids) {
    const draft = fromSubject(id, b, s) ?? standard(id, b, s);
    if (!draft) continue;
    const serves: ComponentServes[] = [];
    for (const br of new Set([...(draft.brs ?? []), ...(s.servesFor?.[id] ?? [])])) {
      const r = brd?.requirements.find((x) => x.id === br);
      if (r) serves.push({ kind: "requirement", id: r.id, label: r.title });
    }
    for (const nfr of brd?.nfrs ?? [])
      if (NFR_FOR[nfr.category].includes(id))
        serves.push({ kind: "nfr", id: nfr.id, label: `${nfr.statement} (${nfr.target})` });
    for (const d of [...(DECISION_FOR[id] ?? []), ...(subjectDecisions[id] ?? [])])
      if (decisionIds.has(d))
        serves.push({ kind: "decision", id: d, label: decisions.find((x) => x.id === d)?.title ?? d });
    for (const c of CONTROLS_FOR[id] ?? []) {
      const ctl = controls.find((x) => x.id === c);
      if (ctl) serves.push({ kind: "control", id: c, label: ctl.name });
    }
    const role = draft.role as ServiceRole;
    const { brs: _brs, ...rest } = draft;
    components.push({
      ...rest,
      serves,
      docsUrl: b.cloud === "azure" ? (AZURE_DOCS[role] ?? null) : null,
      monthlyUsd:
        draft.status === "external" || draft.status === "existing" ? null : (MONTHLY_USD[role] ?? null),
    });
  }
  return { diagrams: annotated, components };
}
