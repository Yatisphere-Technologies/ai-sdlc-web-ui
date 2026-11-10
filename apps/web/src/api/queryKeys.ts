import type { TenantId } from "@throughline/contracts";

/**
 * Every tenant-scoped query key starts with ["tenant", tenantId]. That makes it impossible for two
 * tenants to share a cache entry, and lets us drop a whole tenant's cache in one call on switch.
 */
export const queryKeys = {
  session: ["session"] as const,
  tenant(tenantId: TenantId) {
    const all = ["tenant", tenantId] as const;
    return {
      all,
      controlRoom: [...all, "control-room"] as const,
      workItems: [...all, "work-items"] as const,
      integrations: [...all, "integrations"] as const,
      security: [...all, "security"] as const,
      members: [...all, "members"] as const,
      identity: [...all, "identity"] as const,
      agentGov: [...all, "agents"] as const,
      /** Prefix for every audit query; each filter set is its own entry. */
      auditAll: [...all, "audit"] as const,
      audit: (query: string) => [...all, "audit", query] as const,
      specs: [...all, "specs"] as const,
      designs: [...all, "designs"] as const,
      architectures: [...all, "architectures"] as const,
      brds: [...all, "brds"] as const,
      backlogs: [...all, "backlogs"] as const,
      brdStudio: (brdId: string) => [...all, "brd-studio", brdId] as const,
      workspaceDocs: (brdId: string) => [...all, "workspace-docs", brdId] as const,
      reviews: [...all, "reviews"] as const,
      build: [...all, "build"] as const,
      verify: [...all, "verify"] as const,
      testPlans: [...all, "test-plans"] as const,
      assistantList: [...all, "assistant", "list"] as const,
      assistantConversation: (id: string) => [...all, "assistant", "conversation", id] as const,
      releases: [...all, "releases"] as const,
      incidents: [...all, "incidents"] as const,
      trace: (workItemKey: string) => [...all, "trace", workItemKey] as const,
      insights: (period: string) => [...all, "insights", period] as const,
      /** Prefix for every program/project read model; they are rebuilt from everything else. */
      projects: [...all, "projects"] as const,
      portfolio: [...all, "projects", "portfolio"] as const,
      project: (key: string) => [...all, "projects", "detail", key] as const,
    };
  },
};

export type TenantQueryKeys = ReturnType<typeof queryKeys.tenant>;
