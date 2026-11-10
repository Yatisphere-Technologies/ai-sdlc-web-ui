import type { ArchBrief } from "@throughline/contracts";
import { describe, expect, it } from "vitest";
import { briefChanges, briefWarnings } from "./brief";

const brief: ArchBrief = {
  cloud: "azure",
  region: "india",
  compute: "kubernetes",
  database: "postgres",
  cache: "yes",
  messaging: "queue",
  exposure: "public",
  topology: "hub-spoke",
  connectivity: "vpn",
  identity: "both",
  availability: "zone-redundant",
  classification: "restricted",
  compliance: ["rbi"],
  keys: "customer-managed",
  ai: "none",
  observability: "native",
};

describe("brief helpers", () => {
  it("counts answers that differ from the agent", () => {
    const s = {
      cloud: { value: "aws", reason: "", basis: "assumed" as const },
      region: { value: "india", reason: "", basis: "stated" as const },
    };
    expect(briefChanges(brief, s)).toEqual(["cloud"]);
  });
  it("warns on residency and resilience conflicts", () => {
    expect(briefWarnings(brief)).toEqual([]);
    expect(briefWarnings({ ...brief, cloud: "gcp", region: "uae" })).toHaveLength(2);
    expect(briefWarnings({ ...brief, keys: "platform", availability: "single-zone" })).toHaveLength(2);
  });
});
