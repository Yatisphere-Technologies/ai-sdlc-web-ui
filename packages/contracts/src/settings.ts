import { z } from "zod";

export const IntegrationCategory = z.enum(["plan", "know", "code", "ship", "run", "talk"]);
export type IntegrationCategory = z.infer<typeof IntegrationCategory>;

export const CATEGORY_LABEL: Record<IntegrationCategory, string> = {
  plan: "Plan · work items",
  know: "Know · specs and decisions",
  code: "Code · repos and reviews",
  ship: "Ship · CI/CD and quality",
  run: "Run · telemetry",
  talk: "Talk · where people are",
};

export const Integration = z.object({
  id: z.string(),
  name: z.string(),
  mono: z.string().max(2),
  category: IntegrationCategory,
  status: z.enum(["connected", "attention", "available"]),
  auth: z.string().nullable(),
  detail: z.string(),
  systemOfRecord: z.string(),
  reads: z.string(),
  never: z.string(),
  writeBack: z.array(z.object({ id: z.string(), label: z.string(), enabled: z.boolean() })),
});
export type Integration = z.infer<typeof Integration>;

export const IntegrationList = z.object({ items: z.array(Integration) });

/** Extra settings some controls carry. */
export const ControlConfig = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("ip-ranges"),
    ranges: z.array(z.object({ cidr: z.string(), label: z.string() })),
  }),
  z.object({
    kind: z.literal("hours"),
    value: z.number().int().positive(),
    options: z.array(z.number().int()),
  }),
  z.object({
    kind: z.literal("days"),
    value: z.number().int().positive(),
    options: z.array(z.number().int()),
  }),
  z.object({
    kind: z.literal("categories"),
    items: z.array(z.object({ id: z.string(), label: z.string(), enabled: z.boolean() })),
  }),
  z.object({
    kind: z.literal("siem"),
    target: z.enum(["sentinel", "splunk", "chronicle"]),
    endpoint: z.string(),
  }),
]);
export type ControlConfig = z.infer<typeof ControlConfig>;

export const SecurityControl = z.object({
  id: z.string(),
  group: z.enum(["access", "ai-data", "audit"]),
  label: z.string(),
  description: z.string(),
  enabled: z.boolean(),
  /** Counts towards the posture score */
  recommended: z.boolean(),
  config: ControlConfig.nullable(),
  /** Framework clauses this control evidences, e.g. "ISO 27001 A.8.5". */
  frameworks: z.array(z.string()),
});
export type SecurityControl = z.infer<typeof SecurityControl>;

export const KeyVersion = z.object({
  version: z.string(),
  createdAt: z.string(),
  by: z.string(),
  reason: z.string(),
  status: z.enum(["active", "retired"]),
});
export type KeyVersion = z.infer<typeof KeyVersion>;

/** The key that encrypts this workspace's data at rest (envelope encryption). */
export const KeyManagement = z.object({
  mode: z.enum(["customer-key", "platform-key"]),
  provider: z.string(),
  keyRef: z.string(),
  status: z.enum(["active", "revoked"]),
  rotationDays: z.number().int().positive(),
  rotatedAt: z.string(),
  revokedAt: z.string().nullable(),
  versions: z.array(KeyVersion),
});
export type KeyManagement = z.infer<typeof KeyManagement>;
export const ROTATION_OPTIONS = [30, 90, 180, 365] as const;

export const SettingsTab = z.enum(["security", "members", "sso", "agents", "audit"]);
export type SettingsTab = z.infer<typeof SettingsTab>;

/** Something in the workspace that weakens its security, with where to fix it. */
export const SecurityFinding = z.object({
  id: z.string(),
  severity: z.enum(["high", "medium", "low"]),
  title: z.string(),
  detail: z.string(),
  tab: SettingsTab,
});
export type SecurityFinding = z.infer<typeof SecurityFinding>;

export const SecuritySettings = z.object({
  controls: z.array(SecurityControl),
  keys: KeyManagement,
  findings: z.array(SecurityFinding),
  /** The caller's address as the server sees it; IP rules must keep it inside. */
  currentIp: z.string(),
});
export type SecuritySettings = z.infer<typeof SecuritySettings>;

/** A plain on/off switch (integration write-backs, checklist items). */
export const UpdateControl = z.object({ enabled: z.boolean() });

export const UpdateSecurityControl = z
  .object({ enabled: z.boolean().optional(), config: ControlConfig.optional() })
  .refine((v) => v.enabled !== undefined || v.config !== undefined, "Change something");
export const KeyPolicy = z.object({ rotationDays: z.number().int().positive() });
export const RevokeKey = z.object({ confirm: z.string() });

/** Share of recommended controls that are on, 0–100, less 5 per high and 2 per medium finding. */
export function postureScore(
  controls: readonly SecurityControl[],
  findings: readonly Pick<SecurityFinding, "severity">[] = [],
) {
  const recommended = controls.filter((c) => c.recommended);
  const base =
    recommended.length === 0
      ? 100
      : Math.round((recommended.filter((c) => c.enabled).length / recommended.length) * 100);
  const penalty = findings.reduce(
    (n, f) => n + (f.severity === "high" ? 5 : f.severity === "medium" ? 2 : 0),
    0,
  );
  return Math.max(0, base - penalty);
}
