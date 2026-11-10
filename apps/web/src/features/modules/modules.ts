import {
  Activity,
  BarChart3,
  ClipboardList,
  DraftingCompass,
  FileCheck2,
  FlaskConical,
  FolderKanban,
  GitBranch,
  type LucideIcon,
  Radar,
  Stamp,
} from "lucide-react";

export type ModuleId =
  | "control-room"
  | "approvals"
  | "projects"
  | "brd"
  | "architecture"
  | "review"
  | "testing"
  | "delivery"
  | "operate"
  | "insights";

export type ModuleGroup = "overview" | "plan" | "design" | "deliver" | "run";

export type ModuleDef = {
  id: ModuleId;
  label: string;
  icon: LucideIcon;
  description: string;
  group: ModuleGroup;
};

export const MODULE_GROUPS: { id: ModuleGroup; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "plan", label: "Plan" },
  { id: "design", label: "Design" },
  { id: "deliver", label: "Deliver" },
  { id: "run", label: "Run" },
];

export const MODULES: readonly ModuleDef[] = [
  {
    id: "control-room",
    label: "Control room",
    icon: Radar,
    group: "overview",
    description: "Everything in flight, end to end.",
  },
  {
    id: "approvals",
    label: "Approvals",
    icon: Stamp,
    group: "overview",
    description: "Every gate waiting on a person, in one queue.",
  },
  {
    id: "projects",
    label: "Programs & projects",
    icon: FolderKanban,
    group: "overview",
    description: "Every program and project, with its plan, artifacts, work items and links.",
  },
  {
    id: "brd",
    label: "BRDs & specs",
    icon: ClipboardList,
    group: "plan",
    description: "Business requirements signed off, then specs approved at G1.",
  },
  {
    id: "architecture",
    label: "Architecture",
    icon: DraftingCompass,
    group: "design",
    description: "Options compared, then brief, diagrams and design document.",
  },
  {
    id: "review",
    label: "Review",
    icon: FileCheck2,
    group: "design",
    description: "Architecture and security pack, signed at G2.",
  },
  {
    id: "testing",
    label: "Test plan",
    icon: FlaskConical,
    group: "deliver",
    description: "Strategy, cases and coverage for every requirement, pushed to your test tool.",
  },
  {
    id: "delivery",
    label: "Delivery",
    icon: GitBranch,
    group: "deliver",
    description: "Build, verify (G3) and release (G4) for every change.",
  },
  {
    id: "operate",
    label: "Operate",
    icon: Activity,
    group: "run",
    description: "Incidents diagnosed, fixed once, learned from.",
  },
  {
    id: "insights",
    label: "Insights",
    icon: BarChart3,
    group: "run",
    description: "Value, spend and governance.",
  },
];

/** Route for each module, kept in one place so nav and links agree. */
export const MODULE_ROUTE = {
  "control-room": "/t/$tenantSlug",
  approvals: "/t/$tenantSlug/approvals",
  projects: "/t/$tenantSlug/projects",
  brd: "/t/$tenantSlug/brd",
  architecture: "/t/$tenantSlug/architecture",
  review: "/t/$tenantSlug/review",
  testing: "/t/$tenantSlug/testing",
  delivery: "/t/$tenantSlug/delivery",
  operate: "/t/$tenantSlug/operate",
  insights: "/t/$tenantSlug/insights",
} as const satisfies Record<ModuleId, string>;
