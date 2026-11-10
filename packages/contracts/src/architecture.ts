import { z } from "zod";

/* ── Architecture brief: the questions a solution architect asks before drawing anything ─────── */

export const Cloud = z.enum(["azure", "aws", "gcp", "on-prem"]);
export type Cloud = z.infer<typeof Cloud>;

export const ArchBrief = z.object({
  cloud: Cloud,
  region: z.enum(["india", "uae", "eu", "us"]),
  compute: z.enum(["kubernetes", "serverless-containers", "paas", "functions"]),
  database: z.enum(["postgres", "sqlserver", "nosql"]),
  cache: z.enum(["yes", "no"]),
  messaging: z.enum(["none", "queue", "stream"]),
  exposure: z.enum(["public", "partner", "internal"]),
  topology: z.enum(["hub-spoke", "single-network"]),
  connectivity: z.enum(["none", "vpn", "private-circuit"]),
  identity: z.enum(["workforce", "customer", "both"]),
  availability: z.enum(["single-zone", "zone-redundant", "multi-region-warm", "multi-region-active"]),
  classification: z.enum(["internal", "confidential", "restricted"]),
  compliance: z.array(z.enum(["pci-dss", "rbi", "cbuae", "soc2", "gdpr", "iso27001", "ccpa"])),
  keys: z.enum(["platform", "customer-managed", "hsm"]),
  ai: z.enum(["none", "managed", "self-hosted"]),
  observability: z.enum(["native", "datadog", "grafana"]),
});
export type ArchBrief = z.infer<typeof ArchBrief>;
export type ArchQuestionId = keyof ArchBrief;

export type ArchQuestion = {
  id: ArchQuestionId;
  section: "Platform" | "Application" | "Network" | "Security" | "Operations";
  label: string;
  /** Why an architect asks this: what changes in the design depending on the answer. */
  why: string;
  multi?: boolean;
  options: { value: string; label: string; hint: string }[];
};

/** The questionnaire, in the order an architect would walk it. Shared by the UI and the server. */
export const ARCH_QUESTIONS: readonly ArchQuestion[] = [
  {
    id: "cloud",
    section: "Platform",
    label: "Where will it run?",
    why: "Decides every managed service, the network model, the identity plane and the shapes on the diagrams.",
    options: [
      {
        value: "azure",
        label: "Microsoft Azure",
        hint: "Strong fit when Entra ID and Microsoft 365 already run the workforce.",
      },
      {
        value: "aws",
        label: "Amazon Web Services",
        hint: "Broadest service catalogue; strong serverless and container options.",
      },
      {
        value: "gcp",
        label: "Google Cloud",
        hint: "Strong managed Kubernetes and data/AI; smaller enterprise footprint in some regions.",
      },
      {
        value: "on-prem",
        label: "On-premises / private cloud",
        hint: "OpenShift or VMware Tanzu in your data centres; you run the platform.",
      },
    ],
  },
  {
    id: "region",
    section: "Platform",
    label: "Which geography must the data stay in?",
    why: "Data residency rules pin the primary region, rule out some services and decide where DR can go.",
    options: [
      {
        value: "india",
        label: "India",
        hint: "Azure Central India / AWS ap-south-1 / GCP asia-south1. RBI requires payment data in India.",
      },
      {
        value: "uae",
        label: "UAE",
        hint: "Azure UAE North / AWS me-central-1. Google Cloud has no UAE region today; check current availability.",
      },
      { value: "eu", label: "European Union", hint: "Frankfurt or Amsterdam regions; GDPR applies." },
      {
        value: "us",
        label: "United States",
        hint: "East US / us-east-1 / us-east4; widest service availability.",
      },
    ],
  },
  {
    id: "compute",
    section: "Application",
    label: "How should services run?",
    why: "Sets the operating model: how much platform your team owns versus the cloud provider.",
    options: [
      {
        value: "kubernetes",
        label: "Managed Kubernetes",
        hint: "AKS / EKS / GKE. Most control and portability; you run upgrades, ingress and policies.",
      },
      {
        value: "serverless-containers",
        label: "Serverless containers",
        hint: "Container Apps / ECS Fargate / Cloud Run. Containers without running a cluster.",
      },
      {
        value: "paas",
        label: "App platform (PaaS)",
        hint: "App Service / Elastic Beanstalk / App Engine. Least to run, least flexibility.",
      },
      {
        value: "functions",
        label: "Functions",
        hint: "Azure Functions / Lambda / Cloud Functions. Event-driven, pay per call, cold starts.",
      },
    ],
  },
  {
    id: "database",
    section: "Application",
    label: "What is the system of record?",
    why: "Consistency, query shape and licence cost all follow from the main datastore.",
    options: [
      {
        value: "postgres",
        label: "PostgreSQL",
        hint: "Relational, strong consistency, no licence cost. Flexible Server / Aurora / Cloud SQL.",
      },
      {
        value: "sqlserver",
        label: "SQL Server",
        hint: "When existing estate, tooling or skills are SQL Server. Licence cost applies.",
      },
      {
        value: "nosql",
        label: "Document / key-value",
        hint: "Cosmos DB / DynamoDB / Firestore. Massive scale, weaker cross-record transactions.",
      },
    ],
  },
  {
    id: "cache",
    section: "Application",
    label: "Do you need a cache?",
    why: "Adds a component to secure and run, in exchange for latency and load relief on the database.",
    options: [
      {
        value: "yes",
        label: "Yes, managed Redis",
        hint: "Session state, idempotency keys, rate limits, hot reads.",
      },
      { value: "no", label: "No", hint: "Fewer moving parts; the database carries every read." },
    ],
  },
  {
    id: "messaging",
    section: "Application",
    label: "How do services talk asynchronously?",
    why: "Decides retry semantics, ordering guarantees and how failures in partners are absorbed.",
    options: [
      { value: "none", label: "Synchronous only", hint: "Simplest. Partner slowness becomes your latency." },
      {
        value: "queue",
        label: "Message queue",
        hint: "Service Bus / SQS / Pub/Sub. Work queues, retries, dead-lettering.",
      },
      {
        value: "stream",
        label: "Event stream",
        hint: "Event Hubs / MSK / Pub/Sub. Ordered, replayable events for many consumers.",
      },
    ],
  },
  {
    id: "exposure",
    section: "Network",
    label: "Who reaches the system, and from where?",
    why: "Sets the edge: global entry point, WAF, API management and whether anything is public at all.",
    options: [
      {
        value: "public",
        label: "Public internet",
        hint: "Customers on mobile/web. Global edge + WAF + DDoS protection.",
      },
      {
        value: "partner",
        label: "Partners only",
        hint: "API management with mTLS and IP allow-lists; no anonymous traffic.",
      },
      {
        value: "internal",
        label: "Internal only",
        hint: "Staff over the corporate network; no public endpoint.",
      },
    ],
  },
  {
    id: "topology",
    section: "Network",
    label: "Network topology",
    why: "Hub-and-spoke centralises egress inspection and on-prem links; a single network is simpler but harder to grow.",
    options: [
      {
        value: "hub-spoke",
        label: "Hub and spoke",
        hint: "Shared hub (firewall, gateways, DNS) peered to a spoke per workload.",
      },
      {
        value: "single-network",
        label: "Single network",
        hint: "One VNet/VPC with subnets. Fine for one isolated workload.",
      },
    ],
  },
  {
    id: "connectivity",
    section: "Network",
    label: "Connection to your data centre",
    why: "Systems of record on-prem need a private path; its bandwidth and SLA set what can stay on-prem.",
    options: [
      {
        value: "none",
        label: "None needed",
        hint: "Everything the system calls is reachable over private cloud links or the internet.",
      },
      {
        value: "vpn",
        label: "Site-to-site VPN",
        hint: "Encrypted over the internet. Cheap, quick, variable latency, ~1 Gbps.",
      },
      {
        value: "private-circuit",
        label: "Private circuit",
        hint: "ExpressRoute / Direct Connect / Interconnect. Predictable latency, SLA, weeks to provision.",
      },
    ],
  },
  {
    id: "identity",
    section: "Security",
    label: "Who signs in?",
    why: "Workforce and customer identity have different threat models, scale and regulatory needs.",
    options: [
      {
        value: "workforce",
        label: "Staff only",
        hint: "Your corporate IdP (Entra ID / Okta) with SSO and conditional access.",
      },
      {
        value: "customer",
        label: "Customers",
        hint: "CIAM: Entra External ID / Cognito / Identity Platform. Sign-up, MFA, social login.",
      },
      { value: "both", label: "Customers and staff", hint: "Two identity planes, kept separate." },
    ],
  },
  {
    id: "classification",
    section: "Security",
    label: "Highest data classification",
    why: "Drives encryption, network isolation, logging retention and who may access production.",
    options: [
      { value: "internal", label: "Internal", hint: "No personal or regulated data." },
      {
        value: "confidential",
        label: "Confidential",
        hint: "Personal data (PII). Private endpoints, encryption, access reviews.",
      },
      {
        value: "restricted",
        label: "Restricted / regulated",
        hint: "Payment, health or banking data. Segmented zone, CMK, full audit.",
      },
    ],
  },
  {
    id: "compliance",
    section: "Security",
    label: "Which regimes apply?",
    why: "Each regime adds concrete controls; the document maps every control to where it is met.",
    multi: true,
    options: [
      {
        value: "pci-dss",
        label: "PCI DSS 4.0",
        hint: "Card data: segmentation, key management, quarterly scans.",
      },
      {
        value: "rbi",
        label: "RBI (India)",
        hint: "Payment data localisation; cyber security framework for banks.",
      },
      { value: "cbuae", label: "CBUAE (UAE)", hint: "Outsourcing and cloud guidance for UAE banks." },
      { value: "soc2", label: "SOC 2", hint: "Security, availability and confidentiality controls." },
      { value: "gdpr", label: "GDPR", hint: "Lawful basis, data subject rights, transfer rules." },
      { value: "iso27001", label: "ISO 27001", hint: "Information security management system." },
      { value: "ccpa", label: "CCPA", hint: "California consumer privacy rights." },
    ],
  },
  {
    id: "keys",
    section: "Security",
    label: "Who controls the encryption keys?",
    why: "Customer-managed and HSM keys give revocation control and satisfy regulators, at a cost in operations.",
    options: [
      {
        value: "platform",
        label: "Provider-managed keys",
        hint: "Zero effort; the provider controls rotation.",
      },
      {
        value: "customer-managed",
        label: "Customer-managed keys",
        hint: "Key Vault / KMS keys you own and rotate.",
      },
      {
        value: "hsm",
        label: "Dedicated HSM",
        hint: "FIPS 140-3 Level 3 single-tenant HSM. Highest assurance, highest cost.",
      },
    ],
  },
  {
    id: "availability",
    section: "Operations",
    label: "Availability target",
    why: "Each step up roughly doubles infrastructure cost and changes the data replication design.",
    options: [
      {
        value: "single-zone",
        label: "99.5% · single zone",
        hint: "~3.6 h downtime / month. Dev and internal tools.",
      },
      {
        value: "zone-redundant",
        label: "99.95% · zone redundant",
        hint: "~22 min / month. Survives a data-centre failure.",
      },
      {
        value: "multi-region-warm",
        label: "99.99% · warm standby region",
        hint: "~4 min / month. Survives a region failure; RPO minutes.",
      },
      {
        value: "multi-region-active",
        label: "99.995% · active-active",
        hint: "Both regions serve traffic. Hardest data design.",
      },
    ],
  },
  {
    id: "observability",
    section: "Operations",
    label: "Observability stack",
    why: "Where logs, metrics and traces land decides egress, retention cost and who can see production data.",
    options: [
      {
        value: "native",
        label: "Cloud native",
        hint: "Azure Monitor / CloudWatch / Cloud Operations. Data stays in-tenant.",
      },
      { value: "datadog", label: "Datadog", hint: "One pane across clouds; telemetry leaves your tenant." },
      {
        value: "grafana",
        label: "OpenTelemetry + Grafana",
        hint: "Open standards, self-run or Grafana Cloud.",
      },
    ],
  },
  {
    id: "ai",
    section: "Operations",
    label: "Does the system call an LLM?",
    why: "Model calls add a data path that needs private networking, content filtering and prompt logging.",
    options: [
      { value: "none", label: "No", hint: "No model calls at runtime." },
      {
        value: "managed",
        label: "Managed model service",
        hint: "Azure OpenAI / Bedrock / Vertex AI over a private endpoint.",
      },
      { value: "self-hosted", label: "Self-hosted model", hint: "Open-weights model on GPU nodes you run." },
    ],
  },
];

/** How sure the architect agent is about a suggested answer, using the same tags as shaping. */
export const ArchSuggestion = z.object({
  value: z.union([z.string(), z.array(z.string())]),
  reason: z.string(),
  basis: z.enum(["stated", "evidenced", "inferred", "assumed"]),
});
export type ArchSuggestion = z.infer<typeof ArchSuggestion>;

/* ── Diagrams ───────────────────────────────────────────────────────────────────────────────── */

export const DiagramCategory = z.enum([
  "person",
  "edge",
  "compute",
  "data",
  "integration",
  "network",
  "security",
  "identity",
  "ops",
  "ai",
  "external",
  "system",
]);
export type DiagramCategory = z.infer<typeof DiagramCategory>;

export const DiagramNode = z.object({
  id: z.string(),
  label: z.string(),
  /** Product or technology, e.g. "Azure Kubernetes Service". */
  tech: z.string().optional(),
  /** Service role, used to pick the cloud vendor shape in exports, e.g. "kubernetes". */
  role: z.string(),
  category: DiagramCategory,
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  note: z.string().optional(),
  /** Innermost group that contains this node; exports nest it there so it moves with the group. */
  parent: z.string().optional(),
  /** The logical component this node draws (see Architecture.components); one component can appear in several diagrams. */
  component: z.string().optional(),
});
export type DiagramNode = z.infer<typeof DiagramNode>;

export const DiagramGroup = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(["cloud", "region", "network", "subnet", "zone", "onprem", "external", "boundary"]),
  x: z.number(),
  y: z.number(),
  w: z.number(),
  h: z.number(),
  /** Address range for networks and subnets. */
  cidr: z.string().optional(),
  trust: z.enum(["untrusted", "dmz", "trusted", "restricted", "management"]).optional(),
  parent: z.string().optional(),
});
export type DiagramGroup = z.infer<typeof DiagramGroup>;

export const EdgeKind = z.enum(["request", "async", "data", "identity", "admin", "replication", "private"]);
export type EdgeKind = z.infer<typeof EdgeKind>;

export const DiagramEdge = z.object({
  id: z.string(),
  from: z.string(),
  to: z.string(),
  label: z.string().optional(),
  kind: EdgeKind,
  /** Security control reference shown on the line, e.g. "C3". */
  control: z.string().optional(),
});
export type DiagramEdge = z.infer<typeof DiagramEdge>;

export const SequenceMessage = z.object({
  step: z.number(),
  from: z.string(),
  to: z.string(),
  label: z.string(),
  kind: EdgeKind,
  reply: z.boolean().optional(),
  note: z.string().optional(),
});
export type SequenceMessage = z.infer<typeof SequenceMessage>;

export const DiagramKind = z.enum(["context", "container", "deployment", "security", "sequence"]);
export type DiagramKind = z.infer<typeof DiagramKind>;

export const Diagram = z.object({
  id: z.string(),
  kind: DiagramKind,
  title: z.string(),
  caption: z.string(),
  width: z.number(),
  height: z.number(),
  groups: z.array(DiagramGroup),
  nodes: z.array(DiagramNode),
  edges: z.array(DiagramEdge),
  /** Present on sequence diagrams: nodes are the participants, in order. */
  messages: z.array(SequenceMessage).optional(),
});
export type Diagram = z.infer<typeof Diagram>;

export const DIAGRAM_LABEL: Record<DiagramKind, string> = {
  context: "System context",
  container: "Containers",
  deployment: "Deployment & network",
  security: "Security architecture",
  sequence: "Request flow",
};

/* ── Architecture document ──────────────────────────────────────────────────────────────────── */

export const DecisionOption = z.object({
  name: z.string(),
  pros: z.array(z.string()),
  cons: z.array(z.string()),
  fit: z.enum(["chosen", "viable", "rejected"]),
});
export type DecisionOption = z.infer<typeof DecisionOption>;

export const ArchDecision = z.object({
  id: z.string(),
  title: z.string(),
  context: z.string(),
  options: z.array(DecisionOption),
  decision: z.string(),
  consequences: z.array(z.string()),
});
export type ArchDecision = z.infer<typeof ArchDecision>;

export const DocTable = z.object({ columns: z.array(z.string()), rows: z.array(z.array(z.string())) });
export type DocTable = z.infer<typeof DocTable>;

export const ArchDocSection = z.object({
  id: z.string(),
  title: z.string(),
  intro: z.string().optional(),
  bullets: z.array(z.string()).optional(),
  tables: z.array(z.object({ caption: z.string(), table: DocTable })).optional(),
  decisions: z.array(ArchDecision).optional(),
  diagram: DiagramKind.optional(),
});
export type ArchDocSection = z.infer<typeof ArchDocSection>;

export const ArchDocument = z.object({
  title: z.string(),
  version: z.string(),
  summary: z.string(),
  sections: z.array(ArchDocSection),
});
export type ArchDocument = z.infer<typeof ArchDocument>;

/* ── The architecture record ────────────────────────────────────────────────────────────────── */

/* ── Components: what each building block does, why it is there and what else could do the job ── */

export const ComponentServes = z.object({
  kind: z.enum(["objective", "requirement", "nfr", "rule", "decision", "control"]),
  id: z.string(),
  label: z.string(),
});
export type ComponentServes = z.infer<typeof ComponentServes>;

export const ArchComponent = z.object({
  id: z.string(),
  name: z.string(),
  /** Product or technology, e.g. "Azure API Management". */
  product: z.string(),
  role: z.string(),
  category: DiagramCategory,
  /** What it does in this solution. */
  purpose: z.string(),
  /** Why the solution needs it; what breaks without it. */
  why: z.string(),
  /** Requirements, NFRs, decisions and controls it exists for. */
  serves: z.array(ComponentServes),
  config: z.array(z.object({ k: z.string(), v: z.string() })),
  /** "existing" = already runs and is reused; "external" = someone else's system. */
  status: z.enum(["ga", "preview", "existing", "external"]),
  docsUrl: z.string().nullable(),
  monthlyUsd: z.number().nullable(),
  /** The brief question that decides this component, so it can be changed from the diagram. */
  choice: z.string().nullable(),
});
export type ArchComponent = z.infer<typeof ArchComponent>;

export const ArchChange = z.object({
  at: z.string(),
  by: z.string(),
  field: z.string(),
  from: z.string(),
  to: z.string(),
  revision: z.number(),
});
export type ArchChange = z.infer<typeof ArchChange>;

export const ArchChoice = z.object({
  field: z.string(),
  value: z.union([z.string(), z.array(z.string())]),
});
export type ArchChoice = z.infer<typeof ArchChoice>;

/** What changes if a choice is switched, so the person sees the impact before applying it. */
export const ChoiceImpact = z.object({
  field: z.string(),
  from: z.string(),
  to: z.string(),
  costBefore: z.number(),
  costAfter: z.number(),
  added: z.array(z.string()),
  removed: z.array(z.string()),
  decisions: z.array(z.string()),
  controls: z.array(z.string()),
  warnings: z.array(z.string()),
});
export type ChoiceImpact = z.infer<typeof ChoiceImpact>;

export const ArchStatus = z.enum(["brief", "generating", "ready", "stale"]);
export type ArchStatus = z.infer<typeof ArchStatus>;

export const Architecture = z.object({
  id: z.string(),
  projectId: z.string(),
  workItemKey: z.string(),
  title: z.string(),
  system: z.string(),
  status: ArchStatus,
  progress: z.number(),
  steps: z.array(z.object({ label: z.string(), done: z.boolean() })),
  brief: ArchBrief,
  suggestions: z.record(z.string(), ArchSuggestion),
  briefBy: z.string().nullable(),
  diagrams: z.array(Diagram),
  document: ArchDocument.nullable(),
  generatedAt: z.string().nullable(),
  revision: z.number(),
  components: z.array(ArchComponent),
  /** Choices changed after the first generation, newest first. */
  history: z.array(ArchChange),
});
export type Architecture = z.infer<typeof Architecture>;
export const ArchitectureList = z.object({ items: z.array(Architecture) });
export type ArchitectureList = z.infer<typeof ArchitectureList>;

export const ARCH_STEPS = [
  "Reading the brief and the approved spec",
  "Choosing services for each role",
  "Planning networks and address space",
  "Laying out the diagrams",
  "Writing the security architecture",
  "Comparing options and writing decisions",
] as const;
