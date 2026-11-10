import type { ControlConfig, SecurityControl } from "@throughline/contracts";

type Def = Omit<SecurityControl, "enabled">;

const RETENTION_LABEL: Record<number, string> = {
  30: "30 days",
  90: "90 days",
  365: "1 year",
  730: "2 years",
  2555: "7 years",
};
export const retentionLabel = (d: number) => RETENTION_LABEL[d] ?? `${d} days`;

/** Label and description follow the control's settings. */
export function describe(c: SecurityControl): SecurityControl {
  const cfg = c.config;
  if (!cfg) return c;
  switch (cfg.kind) {
    case "hours":
      return { ...c, label: `Sign out after ${cfg.value} hours idle` };
    case "days":
      return { ...c, label: `Keep prompts and outputs for ${retentionLabel(cfg.value)}` };
    case "ip-ranges":
      return {
        ...c,
        description: `${cfg.ranges.length} range${cfg.ranges.length === 1 ? "" : "s"}: ${cfg.ranges.map((r) => r.label).join(", ")}`,
      };
    case "categories": {
      const on = cfg.items.filter((i) => i.enabled);
      return {
        ...c,
        description: `${on.length} of ${cfg.items.length} types: ${on.map((i) => i.label).join(", ")}`,
      };
    }
    case "siem":
      return {
        ...c,
        description: `${{ sentinel: "Microsoft Sentinel", splunk: "Splunk", chronicle: "Google SecOps" }[cfg.target]} · ${cfg.endpoint}`,
      };
  }
}

export type ControlOptions = {
  off?: string[];
  ip?: { cidr: string; label: string }[];
  siem?: Extract<ControlConfig, { kind: "siem" }>;
  idInfo: string;
  sessionHours?: number;
  retentionDays?: number;
};

/** The workspace controls every tenant has, mapped to the clauses they evidence. */
export function workspaceControls(o: ControlOptions): SecurityControl[] {
  const list: Def[] = [
    {
      id: "mfa",
      group: "access",
      label: "Require MFA for everyone",
      description: "Enforced through your identity provider",
      recommended: true,
      config: null,
      frameworks: ["ISO 27001 A.8.5", "SOC 2 CC6.1"],
    },
    {
      id: "scim",
      group: "access",
      label: "Sync users and groups with SCIM",
      description: "Leavers lose access within 5 minutes",
      recommended: true,
      config: null,
      frameworks: ["ISO 27001 A.5.18", "SOC 2 CC6.2"],
    },
    {
      id: "ip",
      group: "access",
      label: "Only allow office and VPN IP ranges",
      description: "",
      recommended: false,
      config: { kind: "ip-ranges", ranges: o.ip ?? [] },
      frameworks: ["ISO 27001 A.8.20", "SOC 2 CC6.6"],
    },
    {
      id: "session",
      group: "access",
      label: "",
      description: `Applies to web, Slack and Teams · ${o.idInfo}`,
      recommended: true,
      config: { kind: "hours", value: o.sessionHours ?? 8, options: [1, 4, 8, 12, 24] },
      frameworks: ["ISO 27001 A.8.5"],
    },
    {
      id: "pii",
      group: "ai-data",
      label: "Redact PII and secrets before any model call",
      description: "",
      recommended: true,
      config: {
        kind: "categories",
        items: [
          { id: "national-id", label: "National IDs", enabled: true },
          { id: "card", label: "Card numbers", enabled: true },
          { id: "account", label: "Bank accounts", enabled: true },
          { id: "secrets", label: "Keys and tokens", enabled: true },
          { id: "contact", label: "Emails and phones", enabled: true },
          { id: "names", label: "Customer names", enabled: false },
        ],
      },
      frameworks: ["ISO 27001 A.8.11", "ISO 27001 A.8.12", "SOC 2 C1.1"],
    },
    {
      id: "no-train",
      group: "ai-data",
      label: "Block model training on our data",
      description: "Zero-retention terms with model providers",
      recommended: true,
      config: null,
      frameworks: ["ISO 27001 A.5.34", "SOC 2 C1.1"],
    },
    {
      id: "retain",
      group: "ai-data",
      label: "",
      description: "In your region, encrypted with your key, then deleted",
      recommended: true,
      config: { kind: "days", value: o.retentionDays ?? 365, options: [30, 90, 365, 730, 2555] },
      frameworks: ["ISO 27001 A.5.33", "ISO 27001 A.8.10"],
    },
    {
      id: "browser-speech",
      group: "ai-data",
      label: "Allow voice through the browser's speech service",
      description:
        "Dictation and voice mode send audio to the browser vendor (Chrome: Google, Edge: Microsoft)",
      recommended: false,
      config: null,
      frameworks: ["ISO 27001 A.5.34", "ISO 27001 A.5.14"],
    },
    {
      id: "secret-scan",
      group: "ai-data",
      label: "Scan agent output for leaked secrets",
      description: "Blocks the PR and alerts security",
      recommended: true,
      config: null,
      frameworks: ["ISO 27001 A.8.12", "ISO 27001 A.8.28"],
    },
    {
      id: "siem",
      group: "audit",
      label: "Stream audit events to your SIEM",
      description: "",
      recommended: true,
      config: o.siem ?? { kind: "siem", target: "sentinel", endpoint: "not configured" },
      frameworks: ["ISO 27001 A.8.15", "ISO 27001 A.8.16", "SOC 2 CC7.2"],
    },
    {
      id: "hash-chain",
      group: "audit",
      label: "Hash-chain the audit log",
      description: "Any edit breaks the chain and alerts",
      recommended: true,
      config: null,
      frameworks: ["ISO 27001 A.8.15", "SOC 2 CC7.2"],
    },
    {
      id: "sandbox",
      group: "audit",
      label: "Run agents in isolated sandboxes",
      description: "No network except allowed tools",
      recommended: true,
      config: null,
      frameworks: ["ISO 27001 A.8.22", "ISO 27001 A.8.31"],
    },
  ];
  return list.map((c) => describe({ ...c, enabled: !(o.off ?? []).includes(c.id) }));
}

/** Is an IPv4 address inside a CIDR range? */
export function inCidr(ip: string, cidr: string) {
  const [base, bitsRaw] = cidr.split("/");
  const bits = Number(bitsRaw);
  const toInt = (a: string) => a.split(".").reduce((n, o) => (n << 8) + Number(o), 0) >>> 0;
  if (!base || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (toInt(ip) & mask) === (toInt(base) & mask);
}

export const CIDR = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}\/(3[0-2]|[12]?\d)$/;
