import type { ArchBrief, ArchDecision, DecisionOption } from "@throughline/contracts";
import { CATALOG, CLOUD_LABEL, REGIONS } from "./catalog";
import type { ArchSubject } from "./subject";

type Opt = { value: string; name: string; pros: string[]; cons: string[]; reject?: string | false };

function decide(
  id: string,
  title: string,
  context: string,
  chosen: string,
  opts: Opt[],
  why: string,
  consequences: string[],
): ArchDecision {
  const options: DecisionOption[] = opts.map((o) => ({
    name: o.name,
    pros: o.pros,
    cons: o.reject ? [...o.cons, o.reject] : o.cons,
    fit: o.value === chosen ? "chosen" : o.reject ? "rejected" : "viable",
  }));
  const pick = opts.find((o) => o.value === chosen);
  return { id, title, context, options, decision: `${pick?.name ?? chosen}. ${why}`, consequences };
}

/**
 * Architecture decision records for the brief. Every option the brief offered is written up with
 * pros and cons, so the board sees what was given up, not just what was picked.
 */
export function architectureDecisions(b: ArchBrief, s: ArchSubject): ArchDecision[] {
  const N = CATALOG[b.cloud];
  const region = REGIONS[b.cloud][b.region];
  const regulated = b.classification === "restricted";
  const list: ArchDecision[] = [];

  list.push(
    decide(
      "AD-01",
      "Hosting platform",
      `Where ${s.system} runs. Residency: ${b.region.toUpperCase()}. Classification: ${b.classification}.`,
      b.cloud,
      (["azure", "aws", "gcp", "on-prem"] as const).map((c) => {
        const r = REGIONS[c][b.region];
        const base: Record<typeof c, Omit<Opt, "value" | "name">> = {
          azure: {
            pros: [
              "Native Entra ID integration and conditional access",
              "Mature landing-zone and policy tooling",
              "Private endpoints for almost every PaaS service",
            ],
            cons: [
              "Some services reach new regions later",
              "Pricing for premium networking (Firewall Premium, APIM Premium) is high",
            ],
          },
          aws: {
            pros: [
              "Broadest service catalogue and serverless maturity",
              "Transit Gateway makes multi-VPC routing simple",
              "Strong per-service IAM",
            ],
            cons: [
              "Workforce SSO needs IAM Identity Center federation",
              "Network Firewall and NAT data charges add up",
            ],
          },
          gcp: {
            pros: [
              "Best-in-class managed Kubernetes (GKE Autopilot)",
              "Global VPC and load balancing",
              "Strong data and AI services",
            ],
            cons: [
              "Smaller enterprise partner ecosystem in some markets",
              "Fewer regions than Azure and AWS",
            ],
          },
          "on-prem": {
            pros: [
              "Full control of data location and hardware",
              "Reuses existing data-centre investment",
              "No cloud egress charges",
            ],
            cons: [
              "You run the platform: patching, capacity, HA",
              "Lead time for hardware; no elastic scale",
              "Managed security services must be bought and run",
            ],
          },
        };
        return {
          value: c,
          name: CLOUD_LABEL[c],
          ...base[c],
          reject: !r.inCountry ? `No ${b.region.toUpperCase()} region: data would leave the country.` : false,
        };
      }),
      b.cloud === "on-prem"
        ? "Chosen to keep everything in your data centres."
        : `Runs in ${region.primary}${region.dr ? `, recovering to ${region.dr}` : ""}.`,
      [
        region.inCountry
          ? "Data residency met in the primary region."
          : "Residency NOT met: the primary region is outside the country.",
        region.drInCountry
          ? "DR region is in-country."
          : "DR region is outside the country: residency rules must allow it, or DR stays in-region (zones only).",
      ],
    ),
  );

  list.push(
    decide(
      "AD-02",
      "Compute platform",
      `How ${s.services.length} services are packaged and run. Peak: ${s.peakLoad}.`,
      b.compute,
      [
        {
          value: "kubernetes",
          name: N.kubernetes,
          pros: [
            "Full control: service mesh, network policy, sidecars",
            "Portable across clouds",
            "Best fit for many services and steady load",
          ],
          cons: [
            "You own upgrades, node images, ingress and policy",
            "Needs a platform team",
            "Higher idle cost",
          ],
        },
        {
          value: "serverless-containers",
          name: N["serverless-containers"],
          pros: [
            "Containers without cluster operations",
            "Scale to zero for workers",
            "Faster to production for small teams",
          ],
          cons: [
            "Less control over networking and sidecars",
            "Per-request cost grows at sustained high load",
          ],
        },
        {
          value: "paas",
          name: N.paas,
          pros: ["Least to run: patching and scaling handled", "Built-in deployment slots"],
          cons: ["Limited runtime and network control", "Harder to run background workers well"],
        },
        {
          value: "functions",
          name: N.functions,
          pros: ["Pay per execution", "Natural fit for event-driven workers"],
          cons: [
            "Cold starts hurt p95 latency",
            "Execution time limits",
            "Harder to test and trace end to end",
          ],
          reject:
            regulated && b.compute !== "functions"
              ? "Weak fit for a regulated, latency-sensitive API."
              : false,
        },
      ],
      b.compute === "kubernetes"
        ? "The platform team already runs a hardened cluster baseline; mesh gives mTLS (C4)."
        : "Keeps platform work low for the team that owns this service.",
      ["Images built once in CI and promoted by digest", "Horizontal autoscaling on CPU and queue depth"],
    ),
  );

  list.push(
    decide(
      "AD-03",
      "System of record",
      `${s.dataEntities}. Retention: ${s.retention}.`,
      b.database,
      [
        {
          value: "postgres",
          name: N.postgres,
          pros: [
            "ACID transactions and unique constraints for idempotency",
            "No licence cost",
            "Rich JSON support for flexible fields",
          ],
          cons: ["Vertical scaling limits for very high write rates", "Major version upgrades need planning"],
        },
        {
          value: "sqlserver",
          name: N.sqlserver,
          pros: ["Reuses existing DBA skills and tooling", "Strong HA (Always On / business critical)"],
          cons: ["Licence cost", "Fewer open-source tools"],
        },
        {
          value: "nosql",
          name: N.nosql,
          pros: ["Predictable single-digit ms reads at any scale", "Built-in multi-region replication"],
          cons: [
            "Limited cross-item transactions",
            "Access patterns must be designed up front",
            "Ad-hoc reporting needs an analytical copy",
          ],
          reject:
            regulated && b.database !== "nosql" ? "Ledger-style state needs multi-row transactions." : false,
        },
      ],
      "Matches the consistency the spec asks for.",
      [
        b.availability === "single-zone"
          ? "Single-zone instance with point-in-time restore"
          : "Zone-redundant HA with synchronous standby",
        b.availability.startsWith("multi-region")
          ? "Async replica in the DR region"
          : "Geo-redundant backups only",
      ],
    ),
  );

  list.push(
    decide(
      "AD-04",
      "Asynchronous messaging",
      "How slow or failing partners are kept out of the user's request.",
      b.messaging,
      [
        {
          value: "none",
          name: "Synchronous calls",
          pros: ["Fewest components", "Simple to reason about"],
          cons: ["Partner latency and outages become user-facing", "Retries happen inside requests"],
        },
        {
          value: "queue",
          name: N.queue,
          pros: [
            "Retries, dead-lettering and back-pressure",
            "Decouples the API from partner availability",
            "Transactional outbox pattern keeps DB and queue in step",
          ],
          cons: [
            "Eventual consistency: the user gets 202, not the final answer",
            "At-least-once delivery: consumers must be idempotent",
          ],
        },
        {
          value: "stream",
          name: N.stream,
          pros: ["Ordered, replayable events", "Many consumers read the same events"],
          cons: ["Harder to operate (partitions, offsets)", "Higher base cost"],
        },
      ],
      b.messaging === "none"
        ? "Accepted the coupling to keep the design small."
        : "Partner calls move out of the request path.",
      b.messaging === "none"
        ? ["Partner timeouts must be tight (≤ 2 s)", "No automatic retry after the request ends"]
        : ["Idempotency key on every message", "Dead-letter queue reviewed daily by operations"],
    ),
  );

  list.push(
    decide(
      "AD-05",
      "Network topology",
      "How networks are organised and where inspection happens.",
      b.topology,
      [
        {
          value: "hub-spoke",
          name: b.cloud === "aws" ? "Hub and spoke with Transit Gateway" : "Hub and spoke",
          pros: [
            "One place for firewall, gateways and DNS",
            "Spokes isolated per workload",
            "Scales to many workloads",
          ],
          cons: ["Extra hop and peering cost", "Hub becomes shared infrastructure to govern"],
        },
        {
          value: "single-network",
          name: "Single network",
          pros: ["Simplest routing", "Lowest cost"],
          cons: ["Hard to add workloads with different trust", "Firewall and gateways are per-workload"],
          reject:
            b.connectivity !== "none" && b.topology !== "single-network"
              ? "On-prem links belong in a shared hub."
              : false,
        },
      ],
      b.topology === "hub-spoke"
        ? "Central egress inspection (C8) and one on-prem link for all spokes."
        : "One workload, no shared links.",
      ["Address plan avoids on-prem ranges", "All egress leaves through the firewall"],
    ),
  );

  if (b.cloud !== "on-prem") {
    list.push(
      decide(
        "AD-06",
        "Connectivity to the data centre",
        s.externals.some((x) => x.where === "onprem")
          ? `${s.externals
              .filter((x) => x.where === "onprem")
              .map((x) => x.name)
              .join(" and ")} stay on-prem.`
          : "No on-prem dependency in scope.",
        b.connectivity,
        [
          {
            value: "none",
            name: "No private link",
            pros: ["Nothing to provision"],
            cons: ["On-prem systems must be exposed over the internet"],
            reject: s.externals.some((x) => x.where === "onprem")
              ? "On-prem systems of record need a private path."
              : false,
          },
          {
            value: "vpn",
            name: N.vpn,
            pros: ["Live in days", "Low cost", "Encrypted by default"],
            cons: [
              "Internet-dependent latency and jitter",
              "Bandwidth per tunnel ~1.25 Gbps",
              "No provider SLA end to end",
            ],
          },
          {
            value: "private-circuit",
            name: N["private-circuit"],
            pros: ["Predictable latency, SLA-backed", "1–10 Gbps", "Traffic never crosses the internet"],
            cons: [
              "Weeks to provision with a carrier",
              "Not encrypted by default: add MACsec or IPsec over it if policy requires",
              "Higher monthly cost",
            ],
          },
        ],
        b.connectivity === "private-circuit"
          ? "Two circuits in different peering locations, with VPN as backup."
          : b.connectivity === "vpn"
            ? "Two tunnels to two on-prem devices with BGP failover."
            : "No on-prem traffic.",
        b.connectivity === "none"
          ? []
          : ["BGP advertises only the spoke ranges", "Hybrid DNS forwards private zones both ways"],
      ),
    );
  }

  list.push(
    decide(
      "AD-07",
      "Edge and API exposure",
      `Who calls ${s.system}: ${b.exposure}.`,
      b.exposure,
      [
        {
          value: "public",
          name: `${N.edge} + ${N.ingress}`,
          pros: ["Global anycast entry, DDoS absorption, WAF at the edge", "Origins locked to the edge"],
          cons: ["Two layers to configure", "Edge cost scales with traffic"],
        },
        {
          value: "partner",
          name: `${N.apigw} (partner)`,
          pros: ["mTLS, subscription keys, quotas per partner", "Developer portal and versioning"],
          cons: ["Premium tiers are expensive", "Adds latency of a policy engine"],
        },
        {
          value: "internal",
          name: "Internal load balancer only",
          pros: ["No public attack surface"],
          cons: ["Needs corporate network or zero-trust access for every user"],
        },
      ],
      "Matches who needs to reach the system.",
      ["Only the edge holds a public IP", "WAF in prevention mode before go-live (C2)"],
    ),
  );

  list.push(
    decide(
      "AD-08",
      "Key management",
      `Classification ${b.classification}; regimes: ${b.compliance.join(", ") || "none"}.`,
      b.keys,
      [
        {
          value: "platform",
          name: "Provider-managed keys",
          pros: ["No operations", "Free"],
          cons: ["You cannot revoke the provider's access to data"],
          reject: regulated && b.keys !== "platform" ? "Regulated data needs customer key control." : false,
        },
        {
          value: "customer-managed",
          name: `Customer-managed keys in ${N.secrets}`,
          pros: ["You own rotation and revocation", "Meets most regulators"],
          cons: ["Key loss = data loss: needs purge protection and backups", "Rotation runbooks"],
        },
        {
          value: "hsm",
          name: N.hsm,
          pros: ["Single-tenant FIPS 140-3 Level 3", "Strongest custody evidence"],
          cons: ["High fixed cost", "Specialist operations, quorum-based administration"],
        },
      ],
      "Matches the data's classification and the custody the regulator expects.",
      ["Purge protection and soft delete on the key store", "Key operations logged to the SIEM (C12)"],
    ),
  );

  list.push(
    decide(
      "AD-09",
      "Availability and disaster recovery",
      `Target set in the brief. ${region.dr ? `DR candidate: ${region.dr}.` : ""}`,
      b.availability,
      [
        {
          value: "single-zone",
          name: "Single zone (99.5%)",
          pros: ["Lowest cost"],
          cons: ["A data-centre outage takes the service down", "Restore from backup in hours"],
          reject:
            regulated && b.availability !== "single-zone"
              ? "Below the bar for a regulated, customer-facing service."
              : false,
        },
        {
          value: "zone-redundant",
          name: "Zone redundant (99.95%)",
          pros: ["Survives a data-centre failure automatically", "Zero data loss inside the region"],
          cons: ["Region outage means restore from geo-backup (hours)"],
        },
        {
          value: "multi-region-warm",
          name: "Warm standby region (99.99%)",
          pros: ["Recover from a region outage in under an hour", "RPO in minutes"],
          cons: ["~1.6× infrastructure cost", "DR must be rehearsed twice a year"],
        },
        {
          value: "multi-region-active",
          name: "Active-active (99.995%)",
          pros: ["Near-zero downtime", "Capacity used in both regions"],
          cons: ["Write conflicts: needs a multi-region database design", "Most expensive and complex"],
        },
      ],
      "Balances cost against the business impact of downtime.",
      [
        b.availability.startsWith("multi-region") && !region.drInCountry
          ? "DR region is outside the country: confirm with compliance."
          : "DR stays within the residency boundary.",
      ],
    ),
  );

  list.push(
    decide(
      "AD-10",
      "Observability",
      "Where logs, metrics and traces go, and who can read them.",
      b.observability,
      [
        {
          value: "native",
          name: `${N.monitor} + ${N.logs}`,
          pros: ["Data stays in-tenant and in-region", "No extra vendor"],
          cons: ["Weaker cross-cloud views", "Query languages differ per cloud"],
        },
        {
          value: "datadog",
          name: "Datadog",
          pros: ["One pane across clouds and on-prem", "Strong APM and alerting"],
          cons: ["Telemetry leaves your tenant: scrub PII", "Cost grows with hosts and logs"],
          reject:
            regulated &&
            b.observability !== "datadog" &&
            b.compliance.some((c) => c === "rbi" || c === "cbuae")
              ? "Telemetry may contain regulated data that must stay in-country."
              : false,
        },
        {
          value: "grafana",
          name: "OpenTelemetry + Grafana",
          pros: ["Open standards, no lock-in", "Self-host keeps data in-tenant"],
          cons: ["You run the stack", "More assembly required"],
        },
      ],
      "Traces carry the work-item id so incidents link back to changes.",
      ["OpenTelemetry SDKs in every service", "PII scrubbed at the collector"],
    ),
  );

  if (b.ai !== "none") {
    list.push(
      decide(
        "AD-11",
        "Model hosting",
        "The system calls a language model at runtime.",
        b.ai,
        [
          {
            value: "managed",
            name: N.llm,
            pros: ["No GPUs to run", "Content filtering built in", "Private endpoint"],
            cons: ["Per-token cost", "Model versions retire on the provider's schedule"],
          },
          {
            value: "self-hosted",
            name: `Open-weights model on ${N.gpu}`,
            pros: ["Data never leaves your network", "Fixed cost at high volume"],
            cons: ["GPU capacity and cost", "You own safety filtering and upgrades"],
          },
        ],
        "Prompts and responses logged with PII redaction (C13).",
        ["Evaluation suite runs on every prompt change"],
      ),
    );
  }
  return list;
}
