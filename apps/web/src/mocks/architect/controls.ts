import type { ArchBrief } from "@throughline/contracts";
import { CATALOG, keyRole } from "./catalog";

export type Control = {
  id: string;
  name: string;
  where: string;
  detail: string;
  /** STRIDE threat it mitigates. */
  stride: string;
  maps: string[];
};

const MAP: Record<ArchBrief["compliance"][number], Record<string, string>> = {
  "pci-dss": {
    tls: "PCI 4.2.1",
    waf: "PCI 6.4.2",
    auth: "PCI 8.3",
    private: "PCI 1.3",
    keys: "PCI 3.6",
    egress: "PCI 1.4",
    admin: "PCI 7.2, 8.4",
    supply: "PCI 6.3.2",
    logs: "PCI 10.2, 10.5",
    mtls: "PCI 4.2.1",
  },
  rbi: {
    private: "RBI CSF Annex 1 (network)",
    keys: "RBI CSF (crypto controls)",
    logs: "RBI CSF (SOC, log retention)",
    admin: "RBI CSF (privileged access)",
    residency: "RBI payment data localisation (2018)",
  },
  cbuae: {
    private: "CBUAE outsourcing: segregation",
    keys: "CBUAE: key custody with the bank",
    logs: "CBUAE: audit trail and access",
    residency: "CBUAE: data held in the UAE",
  },
  soc2: { auth: "CC6.1", private: "CC6.6", tls: "CC6.7", logs: "CC7.2", supply: "CC8.1", admin: "CC6.3" },
  gdpr: { tls: "Art. 32", keys: "Art. 32", residency: "Art. 44", logs: "Art. 33" },
  iso27001: {
    tls: "A.8.24",
    waf: "A.8.20",
    auth: "A.5.15",
    private: "A.8.22",
    keys: "A.8.24",
    egress: "A.8.20",
    admin: "A.8.2",
    supply: "A.8.28",
    logs: "A.8.15",
    mtls: "A.8.21",
  },
  ccpa: { keys: "1798.150", tls: "1798.150", logs: "1798.150" },
};

const maps = (b: ArchBrief, topic: string) =>
  b.compliance.map((c) => MAP[c][topic]).filter((m): m is string => Boolean(m));

/**
 * The security controls the design relies on. Diagram edges cite them by id, and the document
 * maps each one to the regimes in scope, so a reviewer can trace a line on a picture to a rule.
 */
export function securityControls(b: ArchBrief): Control[] {
  const N = CATALOG[b.cloud];
  const entry = b.exposure === "partner" ? N.apigw : N.ingress;
  const idp =
    b.identity === "workforce"
      ? N["workforce-idp"]
      : b.identity === "customer"
        ? N["customer-idp"]
        : `${N["customer-idp"]} and ${N["workforce-idp"]}`;
  const keyStore = N[keyRole(b)];
  const list: Control[] = [
    {
      id: "C1",
      name: "Encryption in transit",
      where: b.exposure === "internal" ? entry : N.edge,
      detail: "TLS 1.2+ only (TLS 1.3 preferred), HSTS, managed certificates with automatic rotation.",
      stride: "Information disclosure",
      maps: maps(b, "tls"),
    },
    {
      id: "C2",
      name: "Web application firewall and rate limits",
      where: b.exposure === "internal" ? entry : `${N.waf} + ${entry}`,
      detail:
        "OWASP core rule set in prevention mode, bot protection, per-client rate limits, origin locked to the edge.",
      stride: "Tampering, denial of service",
      maps: maps(b, "waf"),
    },
    {
      id: "C3",
      name: "Token validation at the gateway",
      where: `${entry} with ${idp}`,
      detail:
        "OAuth 2.0 / OIDC access tokens validated (issuer, audience, expiry, scopes) before any service is reached; MFA enforced by the identity provider.",
      stride: "Spoofing, elevation of privilege",
      maps: maps(b, "auth"),
    },
    {
      id: "C4",
      name: "Service-to-service mTLS and network policy",
      where: b.compute === "kubernetes" ? `${N.kubernetes} (service mesh + network policies)` : N[b.compute],
      detail: "Workload identities on every call; default-deny network policy; only declared flows allowed.",
      stride: "Spoofing, tampering",
      maps: maps(b, "mtls"),
    },
    {
      id: "C5",
      name: "Private connectivity to data services",
      where: N["private-endpoint"],
      detail:
        "Databases, cache, messaging, storage and secrets reachable only through private endpoints; public network access disabled.",
      stride: "Information disclosure",
      maps: maps(b, "private"),
    },
    {
      id: "C6",
      name: "No static credentials",
      where: N["workload-identity"],
      detail:
        "Workloads authenticate with federated workload identity; secrets fetched at runtime from the vault; nothing in code or images.",
      stride: "Spoofing, information disclosure",
      maps: maps(b, "auth"),
    },
    {
      id: "C7",
      name: b.keys === "platform" ? "Encryption at rest" : "Customer-controlled encryption at rest",
      where: keyStore,
      detail:
        b.keys === "hsm"
          ? "Data keys wrapped by keys in a single-tenant FIPS 140-3 Level 3 HSM; dual control for key operations; 90-day rotation."
          : b.keys === "customer-managed"
            ? "Customer-managed keys for database, storage and messaging; annual rotation; revocation tested."
            : "Provider-managed AES-256 encryption for every datastore.",
      stride: "Information disclosure",
      maps: maps(b, "keys"),
    },
    {
      id: "C8",
      name: "Egress allow-listing",
      where: N.firewall,
      detail:
        "All outbound traffic forced through the firewall; only named partner FQDNs on 443 allowed; TLS inspection where policy allows.",
      stride: "Information disclosure (exfiltration)",
      maps: maps(b, "egress"),
    },
    {
      id: "C9",
      name: "Partner mutual TLS",
      where: "Outbound integration client",
      detail:
        "Client certificates from the vault, pinned partner CA, signed payloads where the partner supports them.",
      stride: "Spoofing, tampering",
      maps: maps(b, "mtls"),
    },
    {
      id: "C10",
      name: "Just-in-time privileged access",
      where: N.bastion,
      detail:
        "No standing production access; time-boxed approval, session recording, break-glass accounts monitored.",
      stride: "Elevation of privilege",
      maps: maps(b, "admin"),
    },
    {
      id: "C11",
      name: "Signed supply chain",
      where: `${N.cicd} → ${N.registry}`,
      detail:
        "Images built in CI, scanned, signed with provenance and SBOM; admission control runs only signed images.",
      stride: "Tampering",
      maps: maps(b, "supply"),
    },
    {
      id: "C12",
      name: "Audit logging and detection",
      where: `${N.logs} → ${N.siem}`,
      detail: `Control-plane, data-plane and flow logs retained immutably for ${b.classification === "restricted" ? "1 year hot, 10 years archive" : "1 year"}; detections routed to the SOC.`,
      stride: "Repudiation",
      maps: maps(b, "logs"),
    },
  ];
  if (b.ai !== "none") {
    list.push({
      id: "C13",
      name: "Model call guardrails",
      where: N.llm,
      detail:
        "Private endpoint, content filtering on input and output, no customer data used for training, prompts and responses logged with PII redaction.",
      stride: "Information disclosure, tampering",
      maps: maps(b, "private"),
    });
  }
  if (b.compliance.some((c) => c === "rbi" || c === "cbuae" || c === "gdpr")) {
    list.push({
      id: "C14",
      name: "Data residency enforcement",
      where: "Cloud policy (allowed locations)",
      detail:
        "Policy denies resources outside approved regions; backups and replicas stay in-country; telemetry exports reviewed.",
      stride: "Information disclosure (regulatory)",
      maps: maps(b, "residency"),
    });
  }
  return list;
}
