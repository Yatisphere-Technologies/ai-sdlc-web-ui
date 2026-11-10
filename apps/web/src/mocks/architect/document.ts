import type { ArchBrief, ArchDocSection, ArchDocument } from "@throughline/contracts";
import { ARCH_QUESTIONS } from "@throughline/contracts";
import {
  CATALOG,
  CLOUD_LABEL,
  keyRole,
  MONTHLY_USD,
  NETWORK_WORD,
  REGIONS,
  type ServiceRole,
} from "./catalog";
import { securityControls } from "./controls";
import { architectureDecisions } from "./decisions";
import { networkPlan } from "./network";
import type { ArchSubject } from "./subject";

const AVAILABILITY: Record<
  ArchBrief["availability"],
  { slo: string; rto: string; rpo: string; minutes: string }
> = {
  "single-zone": { slo: "99.5%", rto: "4 h (restore)", rpo: "15 min (PITR)", minutes: "~3.6 h / month" },
  "zone-redundant": {
    slo: "99.95%",
    rto: "< 2 min (zone) · 8 h (region)",
    rpo: "0 (zone) · 1 h (region)",
    minutes: "~22 min / month",
  },
  "multi-region-warm": { slo: "99.99%", rto: "< 1 h", rpo: "< 5 min", minutes: "~4.4 min / month" },
  "multi-region-active": { slo: "99.995%", rto: "< 5 min", rpo: "< 1 min", minutes: "~2.2 min / month" },
};

const COST_FACTOR: Record<ArchBrief["availability"], number> = {
  "single-zone": 0.65,
  "zone-redundant": 1,
  "multi-region-warm": 1.6,
  "multi-region-active": 2.1,
};

const label = (id: keyof ArchBrief, value: string) =>
  ARCH_QUESTIONS.find((q) => q.id === id)?.options.find((o) => o.value === value)?.label ?? value;

const usd = (n: number) =>
  `$${Math.round(n / 10) * 10 >= 1000 ? `${(Math.round(n / 100) / 10).toFixed(1)}k` : Math.round(n / 10) * 10}`;

/** Warnings the agent raises when answers conflict with each other or with the regime. */
export function briefRisks(b: ArchBrief, s: ArchSubject): string[][] {
  const r = REGIONS[b.cloud][b.region];
  const risks: string[][] = [];
  const push = (risk: string, impact: "High" | "Medium" | "Low", mitigation: string, owner: string) =>
    risks.push([risk, impact, mitigation, owner]);
  if (!r.inCountry)
    push(
      `${CLOUD_LABEL[b.cloud]} has no region in ${b.region.toUpperCase()}; data would be stored abroad.`,
      "High",
      "Choose another platform or get a written residency exemption.",
      "Compliance",
    );
  if (b.availability.startsWith("multi-region") && !r.drInCountry)
    push(
      `DR region ${r.dr} is outside ${b.region.toUpperCase()}.`,
      "High",
      "Confirm the regulator allows DR abroad, or use zone redundancy plus in-country backups.",
      "Compliance",
    );
  if (b.classification === "restricted" && b.keys === "platform")
    push(
      "Restricted data encrypted with provider-managed keys.",
      "High",
      "Move to customer-managed keys (AD-08).",
      "Security",
    );
  if (b.classification === "restricted" && b.availability === "single-zone")
    push(
      "Regulated service in a single zone.",
      "High",
      "Use zone redundancy at minimum (AD-09).",
      "Architecture",
    );
  if (b.compute === "functions" && b.classification === "restricted")
    push(
      "Functions cold starts and limits on a regulated API.",
      "Medium",
      "Use premium plan with pre-warmed instances, or containers.",
      "Architecture",
    );
  if (b.messaging === "none" && s.externals.some((x) => x.where === "partner"))
    push(
      "Partner latency and outages surface directly to users.",
      "Medium",
      "Add a queue for partner calls (AD-04).",
      "Architecture",
    );
  if (b.exposure === "internal" && b.connectivity === "none")
    push(
      "Internal-only service with no private path from the corporate network.",
      "Medium",
      "Zero-trust access proxy added; confirm device posture policy.",
      "Network",
    );
  if (b.connectivity === "private-circuit")
    push(
      "Private circuit lead time (4–8 weeks with the carrier).",
      "Medium",
      "Order now; run on VPN until it is live.",
      "Network",
    );
  if (b.observability === "datadog" && b.classification !== "internal")
    push(
      "Telemetry leaves the tenant and may carry personal data.",
      "Medium",
      "Scrub PII at the collector; sign a DPA; pick the in-region Datadog site.",
      "Security",
    );
  if (b.database === "nosql" && b.classification === "restricted")
    push(
      "Document store for ledger-style state.",
      "Medium",
      "Model each transaction in one item, or use a relational store.",
      "Architecture",
    );
  if (b.ai !== "none")
    push(
      "Model output can be wrong or manipulated (prompt injection).",
      "Medium",
      "Keep the model out of decisions on money; filter inputs; human review for edge cases.",
      "Product",
    );
  if (b.availability === "multi-region-active" && b.database !== "nosql")
    push(
      "Active-active with a relational database risks write conflicts.",
      "High",
      "Single-writer region with fast failover, or partition writes by customer.",
      "Architecture",
    );
  push(
    "Address ranges are proposals.",
    "Low",
    "Reserve them in IPAM before the network is built.",
    "Network",
  );
  return risks;
}

/** Indicative monthly run cost per building block, scaled by the availability choice. */
export function costEstimate(b: ArchBrief) {
  const N = CATALOG[b.cloud];
  const costRoles: [string, ServiceRole, number?][] = [
    ["Edge, WAF", "edge"],
    ...(b.exposure === "public" && b.classification !== "internal"
      ? ([["DDoS protection", "ddos"]] as [string, ServiceRole][])
      : []),
    [
      b.exposure === "partner" ? "API gateway" : "Ingress + WAF",
      b.exposure === "partner" ? "apigw" : "ingress",
    ],
    ["Compute", b.compute],
    ["Database", b.database],
    ...(b.cache === "yes" ? ([["Cache", "cache"]] as [string, ServiceRole][]) : []),
    ...(b.messaging !== "none" ? ([["Messaging", b.messaging]] as [string, ServiceRole][]) : []),
    ["Object storage", "object-store"],
    ["Keys and secrets", keyRole(b)],
    ["Firewall", "firewall"],
    ["Private endpoints", "private-endpoint", 4],
    ...(b.connectivity !== "none" && b.cloud !== "on-prem"
      ? ([["On-prem link", b.connectivity === "vpn" ? "vpn" : "private-circuit"]] as [string, ServiceRole][])
      : []),
    ["Bastion", "bastion"],
    ["Observability", b.observability === "native" ? "logs" : b.observability],
    ["SIEM", "siem"],
    ["Registry", "registry"],
    ...(b.identity !== "workforce"
      ? ([["Customer identity", "customer-idp"]] as [string, ServiceRole][])
      : []),
    ...(b.ai === "managed" ? ([["Model usage", "llm"]] as [string, ServiceRole][]) : []),
    ...(b.ai === "self-hosted" ? ([["GPU nodes", "gpu"]] as [string, ServiceRole][]) : []),
  ];
  const factor = COST_FACTOR[b.availability];
  const costRows = costRoles.map(([what, role, count]) => {
    const base = (MONTHLY_USD[role] ?? 0) * (count ?? 1);
    const scaled = ["edge", "waf", "ddos", "siem", "registry", "customer-idp"].includes(role)
      ? base
      : base * factor;
    return { what, service: N[role], monthly: scaled };
  });
  const total = costRows.reduce((a, r) => a + r.monthly, 0);
  return { rows: costRows, total };
}

export function buildDocument(b: ArchBrief, s: ArchSubject, revision: number): ArchDocument {
  const N = CATALOG[b.cloud];
  const region = REGIONS[b.cloud][b.region];
  const av = AVAILABILITY[b.availability];
  const plan = networkPlan(b);
  const w = NETWORK_WORD[b.cloud];
  const controls = securityControls(b);
  const decisions = [...architectureDecisions(b, s), ...(s.decisions ?? [])];
  const entry = b.exposure === "partner" ? N.apigw : N.ingress;

  const { rows: costRows, total } = costEstimate(b);

  const sections: ArchDocSection[] = [
    {
      id: "summary",
      title: "1. Summary",
      intro: `${s.purpose} This document proposes the target architecture on ${CLOUD_LABEL[b.cloud]} in ${region.primary}, with ${label("availability", b.availability).toLowerCase()} availability, ${b.topology === "hub-spoke" ? "hub-and-spoke" : "single-network"} networking and ${b.keys === "hsm" ? "HSM-backed" : b.keys === "customer-managed" ? "customer-managed" : "provider-managed"} encryption.`,
      tables: [
        {
          caption: "At a glance",
          table: {
            columns: ["Aspect", "Choice"],
            rows: [
              ["Platform", `${CLOUD_LABEL[b.cloud]} · ${region.primary}`],
              ["Compute", N[b.compute]],
              ["Data", `${N[b.database]}${b.cache === "yes" ? ` + ${N.cache}` : ""}`],
              ["Messaging", b.messaging === "none" ? "Synchronous" : N[b.messaging]],
              ["Exposure", `${label("exposure", b.exposure)} via ${entry}`],
              ["Availability", `${av.slo} · RTO ${av.rto} · RPO ${av.rpo}`],
              ["Indicative run cost", `${usd(total)} / month (±40%)`],
            ],
          },
        },
      ],
    },
    {
      id: "context",
      title: "2. Context and scope",
      intro: `${s.system} sits between the people below and the systems it depends on. Peak load: ${s.peakLoad}.`,
      diagram: "context",
      tables: [
        {
          caption: "People and systems",
          table: {
            columns: ["Name", "Type", "Interaction", "Protocol / channel"],
            rows: [
              ...s.actors.map((a) => [a.name, a.staff ? "Staff" : "User", a.description, a.channel]),
              ...s.externals.map((x) => [
                x.name,
                x.where === "onprem" ? "On-prem system" : x.where === "saas" ? "SaaS" : "Partner",
                x.description,
                x.protocol,
              ]),
            ],
          },
        },
      ],
      bullets: [
        "In scope: the services, data stores and network described here.",
        "Out of scope: changes inside partner and on-prem systems; mobile app release.",
      ],
    },
    {
      id: "nfr",
      title: "3. Quality requirements",
      tables: [
        {
          caption: "Non-functional requirements",
          table: {
            columns: ["Quality", "Target", "How the design meets it"],
            rows: [
              [
                "Availability",
                `${av.slo} (${av.minutes} downtime)`,
                b.availability === "single-zone"
                  ? "Single zone, backups"
                  : b.availability === "zone-redundant"
                    ? "Zone-redundant compute and data"
                    : "Second region with replicated data",
              ],
              [
                "Recovery",
                `RTO ${av.rto} · RPO ${av.rpo}`,
                "Automated failover for zones; scripted runbook for regions",
              ],
              [
                "Latency",
                s.latencyTarget,
                `${b.cache === "yes" ? "Cache for hot keys; " : ""}${b.messaging !== "none" ? "partner calls off the request path" : "tight partner timeouts"}`,
              ],
              ["Throughput", s.peakLoad, "Horizontal autoscaling; load tested at 2× peak before G3"],
              [
                "Residency",
                `${b.region.toUpperCase()} only`,
                region.inCountry
                  ? `Primary in ${region.primary}; policy denies other regions`
                  : "NOT MET: see risks",
              ],
              ["Retention", s.retention, `Lifecycle rules on ${N["object-store"]}; immutable audit logs`],
              [
                "Security",
                `${label("classification", b.classification)} data`,
                `Controls C1–C${controls.length} (section 7)`,
              ],
            ],
          },
        },
      ],
    },
    {
      id: "solution",
      title: "4. Solution overview",
      intro: "Logical building blocks and the technology chosen for each.",
      diagram: "container",
      tables: [
        {
          caption: "Components",
          table: {
            columns: ["Component", "Technology", "Responsibility", "Scaling"],
            rows: [
              [
                b.exposure === "partner" ? "API gateway" : "Ingress",
                entry,
                "TLS, WAF, token validation, routing",
                "Autoscale 2–10 units",
              ],
              ...s.services
                .filter((x) => x.id !== "console" && (b.messaging !== "none" || !x.async))
                .map((x) => [
                  x.name,
                  N[b.compute],
                  x.description,
                  x.async ? "Scale on queue depth" : "Min 3 replicas, CPU 60%",
                ]),
              ...(s.services.some((x) => x.id === "console")
                ? [
                    [
                      s.services.find((x) => x.id === "console")?.name ?? "Ops console",
                      N["static-web"],
                      "Front end for staff",
                      "Static, CDN cached",
                    ],
                  ]
                : []),
              [
                "Database",
                N[b.database],
                s.dataEntities,
                b.availability === "single-zone" ? "Vertical" : "Vertical + read replica",
              ],
              ...(b.cache === "yes"
                ? [["Cache", N.cache, "Idempotency keys, sessions, rate limits", "Zone-redundant tier"]]
                : []),
              ...(b.messaging !== "none"
                ? [
                    [
                      b.messaging === "stream" ? "Event stream" : "Queue",
                      N[b.messaging],
                      "Decouples partner calls; dead-lettering",
                      "Partitioned / premium units",
                    ],
                  ]
                : []),
              ["Object storage", N["object-store"], "Exports, audit archives", "Lifecycle to archive tier"],
              ...(s.components ?? []).map((x) => {
                const [tech = x.name, role = ""] = x.description.split(" · ");
                return [x.name, tech, role, "Managed service"];
              }),
            ],
          },
        },
      ],
    },
    {
      id: "flow",
      title: "5. Key flow",
      intro: `${s.flow.name}, step by step. Numbers match the sequence diagram.`,
      diagram: "sequence",
    },
    {
      id: "decisions",
      title: "6. Design decisions",
      intro: "Every option the brief offered, with pros and cons. Rejected options note the reason.",
      decisions,
    },
    {
      id: "network",
      title: "7. Deployment and network",
      intro: `${b.topology === "hub-spoke" ? `Hub-and-spoke: shared ${w.network} for firewall${b.connectivity !== "none" ? ", gateways" : ""} and privileged access; the workload ${w.network} holds only its own tiers.` : `One ${w.network} holding every tier, segmented by ${w.subnet.toLowerCase()} and ${w.sg}.`} Every data service is reached through a private endpoint; nothing but the edge has a public IP.`,
      diagram: "deployment",
      tables: [
        {
          caption: "Address plan",
          table: {
            columns: [w.network, w.subnet, "CIDR", "Purpose", "Allowed traffic"],
            rows: [
              ...(plan.hub
                ? [[plan.hub.name, "(network)", plan.hub.cidr, "Shared hub", "Peered to spokes"]]
                : []),
              [plan.spoke.name, "(network)", plan.spoke.cidr, `${s.system} workload`, "Peered to hub only"],
              ...plan.subnets.map((x) => [
                x.network === "hub" ? (plan.hub?.name ?? "") : plan.spoke.name,
                x.name,
                x.cidr,
                x.purpose,
                x.rules,
              ]),
              ...(plan.dr
                ? [[plan.dr.name, "(network)", plan.dr.cidr, "DR copy of the spoke", "Same rules as primary"]]
                : []),
              ...(plan.onprem
                ? [
                    [
                      "On-prem",
                      "(summary)",
                      plan.onprem,
                      "Existing data centre",
                      "Must not overlap the cloud ranges",
                    ],
                  ]
                : []),
            ],
          },
        },
        {
          caption: "Traffic flows",
          table: {
            columns: ["Flow", "Path", "Controls"],
            rows: [
              [
                "Ingress (north-south)",
                b.exposure === "internal"
                  ? `Corporate network → ${entry} → services`
                  : `Internet → ${N.edge} → ${entry} → services`,
                "C1, C2, C3",
              ],
              ["East-west", "Service → service inside the workload network", "C4 (mTLS, default-deny)"],
              ["Data access", `Services → private endpoints → ${N[b.database]}, ${N.secrets}`, "C5, C6, C7"],
              ["Egress", `Services → ${N.firewall} → allow-listed partners`, "C8, C9"],
              ...(b.connectivity !== "none" && b.cloud !== "on-prem"
                ? [
                    [
                      "Hybrid",
                      `Services → ${N.firewall} → ${b.connectivity === "vpn" ? N.vpn : N["private-circuit"]} → data centre`,
                      "C8, BGP route filters",
                    ],
                  ]
                : []),
              ["Admin", `Engineers → ${N.bastion} → workloads (JIT)`, "C10"],
            ],
          },
        },
        {
          caption: "Networking options compared: topology",
          table: {
            columns: ["Option", "Isolation", "Central inspection", "Cost", "Complexity", "Best when"],
            rows: [
              [
                "Hub and spoke",
                "High (spoke per workload)",
                "Yes, in the hub",
                "Medium",
                "Medium",
                "Several workloads, on-prem link, regulated data",
              ],
              [
                "Single network",
                "Medium (subnets + rules)",
                "Per network",
                "Low",
                "Low",
                "One small workload, no shared links",
              ],
              [
                b.cloud === "azure" ? "Virtual WAN" : b.cloud === "aws" ? "Cloud WAN" : "NCC hub",
                "High",
                "Yes, managed",
                "High",
                "Low to run",
                "Many regions and branches",
              ],
            ],
          },
        },
        {
          caption: "Networking options compared: on-prem connectivity",
          table: {
            columns: ["Option", "Latency", "Bandwidth", "SLA", "Lead time", "Indicative cost / month"],
            rows: [
              [
                "Site-to-site VPN",
                "Variable (internet)",
                "~1.25 Gbps per tunnel",
                "Gateway only",
                "Days",
                usd(MONTHLY_USD.vpn ?? 0),
              ],
              [
                `${N["private-circuit"]} (1 Gbps)`,
                "Low, predictable",
                "1–10 Gbps",
                "End to end",
                "4–8 weeks",
                usd(MONTHLY_USD["private-circuit"] ?? 0),
              ],
              [
                "Circuit + VPN backup",
                "Low",
                "Circuit, VPN on failure",
                "Highest",
                "4–8 weeks",
                usd((MONTHLY_USD["private-circuit"] ?? 0) + (MONTHLY_USD.vpn ?? 0)),
              ],
            ],
          },
        },
        {
          caption: "Networking options compared: ingress",
          table: {
            columns: ["Option", "What it gives", "Trade-off"],
            rows: [
              [`${N.edge} + ${N.ingress}`, "Global edge, DDoS absorption, WAF twice", "Two layers to manage"],
              [N.apigw, "Partner keys, quotas, mTLS, versioning", "Cost; policy engine latency"],
              ["Internal load balancer", "No public surface", "Users need a private path"],
            ],
          },
        },
      ],
      bullets: [
        `DNS: private zones for every private endpoint, linked to the ${plan.hub ? "hub" : "workload network"}${b.connectivity !== "none" ? "; on-prem forwards those zones to the resolver" : ""}.`,
        "Route tables send 0.0.0.0/0 to the firewall; no subnet has a direct internet route.",
        `Flow logs on every ${w.subnet.toLowerCase()} feed the SIEM (C12).`,
      ],
    },
    {
      id: "security",
      title: "8. Security architecture",
      intro:
        "Defence in depth across trust zones. Every boundary crossing on the diagram cites the control that guards it.",
      diagram: "security",
      tables: [
        {
          caption: "Trust zones",
          table: {
            columns: ["Zone", "Contains", "Who may enter", "From where"],
            rows: [
              ["Untrusted", "Users, partners, internet", "Anyone", "-"],
              [
                "Edge (DMZ)",
                `${b.exposure !== "internal" ? `${N.edge}, ` : ""}${entry}, ${N.firewall}`,
                "Authenticated or anonymous HTTPS",
                "Untrusted",
              ],
              [
                "Application",
                s.services
                  .filter((x) => x.id !== "console")
                  .map((x) => x.name)
                  .join(", "),
                "Validated requests only",
                "Edge",
              ],
              [
                "Restricted data",
                `${N[b.database]}${b.cache === "yes" ? `, ${N.cache}` : ""}, ${N["object-store"]}`,
                "Workload identities",
                "Application",
              ],
              [
                "Management",
                `${N.bastion}, ${N.cicd}, ${N.registry}`,
                "Engineers with JIT approval",
                "Corporate devices",
              ],
            ],
          },
        },
        {
          caption: "Identity and access",
          table: {
            columns: ["Who", "How they authenticate", "Authorisation"],
            rows: [
              ...(b.identity !== "workforce"
                ? [
                    [
                      "Customers",
                      `${N["customer-idp"]} · MFA or passkeys`,
                      "Scopes on access tokens; per-resource ownership checks",
                    ],
                  ]
                : []),
              ...(b.identity !== "customer"
                ? [
                    [
                      "Staff",
                      `${N["workforce-idp"]} · SSO, phishing-resistant MFA, compliant device`,
                      "Role-based, reviewed quarterly",
                    ],
                  ]
                : []),
              ["Workloads", N["workload-identity"], "Least-privilege role per service"],
              [
                "Engineers (production)",
                `${N["workforce-idp"]} + ${N.bastion}`,
                "Just-in-time, time-boxed, recorded",
              ],
              ["Pipelines", "OIDC federation, no stored secrets", "Deploy only to their own environment"],
            ],
          },
        },
        {
          caption: "Security controls",
          table: {
            columns: ["Id", "Control", "Enforced by", "Detail", "Threat (STRIDE)", "Maps to"],
            rows: controls.map((c) => [c.id, c.name, c.where, c.detail, c.stride, c.maps.join(", ") || "-"]),
          },
        },
        {
          caption: "Threat summary",
          table: {
            columns: ["Threat", "Where", "Mitigation"],
            rows: [
              [
                "Credential stuffing / account takeover",
                "Sign-in",
                "MFA, bot protection, rate limits (C2, C3)",
              ],
              [
                "Replay or duplicate submission",
                s.flow.command,
                `Idempotency key with unique constraint${b.cache === "yes" ? " and cache check" : ""}`,
              ],
              [
                "Injection and request smuggling",
                "Edge and API",
                "WAF rules, schema validation at the gateway (C2)",
              ],
              [
                "Data exfiltration",
                "Egress",
                "Firewall allow-list, private endpoints, no public data services (C5, C8)",
              ],
              [
                "Insider misuse",
                "Production access",
                "JIT, recording, dual approval for key operations (C7, C10)",
              ],
              ["Malicious image", "Supply chain", "Signed images and admission control (C11)"],
              ...(b.ai !== "none"
                ? [
                    [
                      "Prompt injection",
                      "Model calls",
                      "Input filtering, output never executes actions on money (C13)",
                    ],
                  ]
                : []),
            ],
          },
        },
      ],
      bullets: [
        `Encryption: in transit everywhere (C1, C4); at rest with ${b.keys === "hsm" ? "HSM-protected keys" : b.keys === "customer-managed" ? "customer-managed keys" : "provider keys"} (C7).`,
        "Secrets never in code, images or pipeline variables (C6).",
        "Security testing: SAST and dependency scans on every PR; DAST before G3; penetration test before first release.",
      ],
    },
    {
      id: "resilience",
      title: "9. Availability and recovery",
      tables: [
        {
          caption: "Per component",
          table: {
            columns: ["Component", "High availability", "Backup", "Recovery"],
            rows: [
              ["Edge", "Global, anycast", "Config as code", "Automatic"],
              [
                "Compute",
                b.availability === "single-zone"
                  ? "Multiple replicas, one zone"
                  : "Replicas spread across 3 zones",
                "Images in registry",
                b.availability.startsWith("multi-region")
                  ? "Scale up in DR region"
                  : "Redeploy from pipeline",
              ],
              [
                "Database",
                b.availability === "single-zone" ? "Single instance" : "Zone-redundant standby",
                "PITR 35 days; geo-redundant backup",
                b.availability.startsWith("multi-region") ? "Promote geo-replica" : "Restore",
              ],
              ...(b.messaging !== "none"
                ? [
                    [
                      "Messaging",
                      "Zone redundant",
                      "N/A (replay from outbox)",
                      b.availability.startsWith("multi-region") ? "Geo-DR alias" : "Recreate, replay",
                    ],
                  ]
                : []),
              [
                "Keys",
                "Zone redundant, purge protection",
                "Key backup to the paired region",
                "Restore keys before data",
              ],
            ],
          },
        },
      ],
      bullets: b.availability.startsWith("multi-region")
        ? [
            "Failover runbook: freeze writes → promote database replica → scale DR compute → switch edge origin → verify synthetic checks → reopen writes.",
            "DR rehearsed twice a year; results attached to the next G2 review.",
          ]
        : ["Region loss is recovered by restore; accepted for this tier."],
    },
    {
      id: "operations",
      title: "10. Observability and operations",
      tables: [
        {
          caption: "Service level objectives",
          table: {
            columns: ["SLI", "SLO", "Alert"],
            rows: [
              ["Availability of the main API", av.slo, "Burn rate 2% in 1 h"],
              ["Latency", s.latencyTarget, "p95 over target for 10 min"],
              ...(b.messaging !== "none"
                ? [
                    ["Queue age", "< 60 s", "Oldest message > 5 min"],
                    ["Dead letters", "0 unreviewed after 24 h", "Any new dead letter"],
                  ]
                : []),
            ],
          },
        },
      ],
      bullets: [
        `Telemetry: OpenTelemetry traces, metrics and logs to ${b.observability === "native" ? N.monitor : N[b.observability]}; every span carries the work-item key.`,
        "Runbooks linked from each alert; incidents open in the Operate stage with the change that caused them.",
        "Infrastructure as code (Terraform/Bicep) with policy checks in the pipeline; drift detected nightly.",
      ],
    },
    {
      id: "cost",
      title: "11. Indicative cost",
      intro: `List prices, production footprint, ${label("availability", b.availability).toLowerCase()}. Accuracy ±40%: confirm with the provider's pricing calculator and your discounts before committing.`,
      tables: [
        {
          caption: "Monthly run cost (USD)",
          table: {
            columns: ["Item", "Service", "Monthly"],
            rows: [...costRows.map((r) => [r.what, r.service, usd(r.monthly)]), ["Total", "", usd(total)]],
          },
        },
      ],
    },
    {
      id: "compliance",
      title: "12. Compliance mapping",
      tables: [
        {
          caption: "Where each regime is met",
          table: {
            columns: ["Regime", "Requirement", "Met by"],
            rows: b.compliance.flatMap((c) => {
              const hits = controls.filter((x) => x.maps.length > 0 && x.maps.some((m) => m.length > 0));
              const name = label("compliance", c);
              return hits
                .map((x) => {
                  const ref = x.maps.find((m) => mapsBelong(c, m));
                  return ref ? [name, ref, `${x.id} · ${x.name}`] : null;
                })
                .filter((row): row is string[] => row !== null);
            }),
          },
        },
      ],
    },
    {
      id: "risks",
      title: "13. Risks and open questions",
      tables: [
        {
          caption: "Risks",
          table: {
            columns: ["Risk", "Impact", "Mitigation", "Owner"],
            rows: [...briefRisks(b, s), ...(s.risks ?? [])],
          },
        },
      ],
    },
  ];
  for (const extra of s.sections ?? []) {
    const no = sections.length + 1;
    sections.push({ ...extra, id: `extra-${no}`, title: `${no}. ${extra.title}` });
  }

  return {
    title: `${s.system} · solution architecture`,
    version: `0.${revision} draft`,
    summary: `${CLOUD_LABEL[b.cloud]} · ${region.primary} · ${N[b.compute]} · ${N[b.database]} · ${av.slo}`,
    sections,
  };
}

const PREFIX: Record<ArchBrief["compliance"][number], RegExp> = {
  "pci-dss": /^PCI/,
  rbi: /^RBI/,
  cbuae: /^CBUAE/,
  soc2: /^CC/,
  gdpr: /^Art\./,
  iso27001: /^A\./,
  ccpa: /^1798/,
};
const mapsBelong = (c: ArchBrief["compliance"][number], ref: string) => PREFIX[c].test(ref);
