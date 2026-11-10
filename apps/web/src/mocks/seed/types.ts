import type { ControlRoom, Integration, TestPlan, WorkItemList } from "@throughline/contracts";
import type { ArchitectureRecord } from "../architect";
import type { AssistantStore } from "../assistant/handlers";
import type { BrdRecord } from "../ba";
import type { SecurityBundle } from "../security/seed";
import type { TenantModules } from "./modules";
import type { TenantProjects } from "./projects";

/** Everything the mock API stores for one tenant. Nothing in here is shared across tenants. */
export type TenantSeed = TenantProjects &
  SecurityBundle & {
    controlRoom: ControlRoom;
    workItems: WorkItemList;
    integrations: Integration[];
    modules: TenantModules;
    architectures: ArchitectureRecord[];
    brds: BrdRecord[];
    /** One test plan per project. */
    testPlans: TestPlan[];
    /** The signed-in user's assistant conversations in this workspace. */
    assistant: AssistantStore;
  };
