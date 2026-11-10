import type { DiagramCategory, DiagramGroup, EdgeKind } from "@throughline/contracts";
import {
  Activity,
  AppWindow,
  Archive,
  ArrowUpRight,
  BadgeCheck,
  Boxes,
  BrickWall,
  Building,
  Building2,
  Cable,
  ChartLine,
  Container,
  Cpu,
  Database,
  DatabaseZap,
  Fingerprint,
  GitBranch,
  Globe,
  Hexagon,
  IdCard,
  Inbox,
  KeyRound,
  Lock,
  type LucideIcon,
  Network,
  Package,
  PanelsTopLeft,
  Plug,
  Radar,
  Router,
  ScrollText,
  ShieldAlert,
  ShieldHalf,
  Signpost,
  Sparkles,
  Split,
  SquareFunction,
  Terminal,
  UserCheck,
  UserCog,
  Users,
  Waves,
  Waypoints,
  Zap,
} from "lucide-react";

/** Token classes per component category. Fill/stroke utilities come from the --dg-* tokens. */
export const CATEGORY: Record<
  DiagramCategory,
  { stroke: string; soft: string; bg: string; text: string; color: string; name: string }
> = {
  person: {
    stroke: "stroke-dg-person",
    soft: "fill-dg-person-soft",
    bg: "bg-dg-person-soft",
    text: "fill-dg-person",
    color: "text-dg-person",
    name: "People",
  },
  edge: {
    stroke: "stroke-dg-edge",
    soft: "fill-dg-edge-soft",
    bg: "bg-dg-edge-soft",
    text: "fill-dg-edge",
    color: "text-dg-edge",
    name: "Edge and gateways",
  },
  compute: {
    stroke: "stroke-dg-compute",
    soft: "fill-dg-compute-soft",
    bg: "bg-dg-compute-soft",
    text: "fill-dg-compute",
    color: "text-dg-compute",
    name: "Compute",
  },
  data: {
    stroke: "stroke-dg-data",
    soft: "fill-dg-data-soft",
    bg: "bg-dg-data-soft",
    text: "fill-dg-data",
    color: "text-dg-data",
    name: "Data",
  },
  integration: {
    stroke: "stroke-dg-integration",
    soft: "fill-dg-integration-soft",
    bg: "bg-dg-integration-soft",
    text: "fill-dg-integration",
    color: "text-dg-integration",
    name: "Messaging",
  },
  network: {
    stroke: "stroke-dg-network",
    soft: "fill-dg-network-soft",
    bg: "bg-dg-network-soft",
    text: "fill-dg-network",
    color: "text-dg-network",
    name: "Network",
  },
  security: {
    stroke: "stroke-dg-security",
    soft: "fill-dg-security-soft",
    bg: "bg-dg-security-soft",
    text: "fill-dg-security",
    color: "text-dg-security",
    name: "Security",
  },
  identity: {
    stroke: "stroke-dg-identity",
    soft: "fill-dg-identity-soft",
    bg: "bg-dg-identity-soft",
    text: "fill-dg-identity",
    color: "text-dg-identity",
    name: "Identity",
  },
  ops: {
    stroke: "stroke-dg-ops",
    soft: "fill-dg-ops-soft",
    bg: "bg-dg-ops-soft",
    text: "fill-dg-ops",
    color: "text-dg-ops",
    name: "Operations",
  },
  ai: {
    stroke: "stroke-dg-ai",
    soft: "fill-dg-ai-soft",
    bg: "bg-dg-ai-soft",
    text: "fill-dg-ai",
    color: "text-dg-ai",
    name: "AI",
  },
  external: {
    stroke: "stroke-dg-external",
    soft: "fill-dg-external-soft",
    bg: "bg-dg-external-soft",
    text: "fill-dg-external",
    color: "text-dg-external",
    name: "External",
  },
  system: {
    stroke: "stroke-agent",
    soft: "fill-agent-soft",
    bg: "bg-agent-soft",
    text: "fill-agent",
    color: "text-agent",
    name: "This system",
  },
};

export const EDGE: Record<EdgeKind, { stroke: string; dash?: string; marker: string; name: string }> = {
  request: { stroke: "stroke-subtle", marker: "fill-subtle", name: "Request" },
  async: {
    stroke: "stroke-dg-integration",
    dash: "6 4",
    marker: "fill-dg-integration",
    name: "Async message",
  },
  data: { stroke: "stroke-dg-data", marker: "fill-dg-data", name: "Data access" },
  identity: {
    stroke: "stroke-dg-identity",
    dash: "2 4",
    marker: "fill-dg-identity",
    name: "Identity / keys",
  },
  admin: { stroke: "stroke-dg-ops", dash: "8 4", marker: "fill-dg-ops", name: "Admin / pipeline" },
  replication: { stroke: "stroke-dg-data", dash: "10 5", marker: "fill-dg-data", name: "Replication" },
  private: { stroke: "stroke-dg-network", marker: "fill-dg-network", name: "Private network" },
};

type GroupStyle = { stroke: string; fill: string; label: string; dash?: string };

const TRUST: Record<NonNullable<DiagramGroup["trust"]>, GroupStyle> = {
  untrusted: { stroke: "stroke-risk", fill: "fill-risk-soft", label: "fill-risk-fg" },
  dmz: { stroke: "stroke-gate", fill: "fill-gate-wash", label: "fill-gate-fg" },
  trusted: { stroke: "stroke-agent", fill: "fill-agent-wash", label: "fill-agent-fg" },
  restricted: { stroke: "stroke-dg-data", fill: "fill-dg-data-soft", label: "fill-dg-data" },
  management: { stroke: "stroke-ion", fill: "fill-ion-soft", label: "fill-ion-fg" },
};

export function groupStyle(g: DiagramGroup): GroupStyle {
  if (g.kind === "zone" && g.trust) return { ...TRUST[g.trust], dash: "6 4" };
  switch (g.kind) {
    case "cloud":
      return { stroke: "stroke-line-strong", fill: "fill-surface", label: "fill-strong" };
    case "region":
      return { stroke: "stroke-ion", fill: "fill-transparent", label: "fill-ion-fg", dash: "8 5" };
    case "network":
      return { stroke: "stroke-dg-network", fill: "fill-dg-network-soft", label: "fill-dg-network" };
    case "subnet":
      return { stroke: "stroke-line-strong", fill: "fill-surface-raised", label: "fill-subtle", dash: "4 3" };
    case "onprem":
      return { stroke: "stroke-dg-external", fill: "fill-surface-sunken", label: "fill-subtle", dash: "8 5" };
    case "external":
      return { stroke: "stroke-line-strong", fill: "fill-transparent", label: "fill-muted", dash: "4 4" };
    default:
      return { stroke: "stroke-agent-line", fill: "fill-transparent", label: "fill-agent-fg", dash: "6 4" };
  }
}

const ROLE_ICON: Record<string, LucideIcon> = {
  users: Users,
  staff: UserCog,
  internet: Globe,
  edge: Globe,
  waf: ShieldHalf,
  ddos: ShieldAlert,
  dns: Signpost,
  apigw: Waypoints,
  ingress: Split,
  ztna: Fingerprint,
  kubernetes: Boxes,
  "serverless-containers": Container,
  paas: AppWindow,
  functions: SquareFunction,
  "static-web": PanelsTopLeft,
  postgres: Database,
  sqlserver: Database,
  nosql: DatabaseZap,
  cache: Zap,
  queue: Inbox,
  stream: Waves,
  "object-store": Archive,
  secrets: KeyRound,
  hsm: Lock,
  "workforce-idp": IdCard,
  "customer-idp": UserCheck,
  "workload-identity": BadgeCheck,
  firewall: BrickWall,
  nat: ArrowUpRight,
  "private-endpoint": Plug,
  transit: Network,
  vpn: Cable,
  "private-circuit": Cable,
  bastion: Terminal,
  "dns-resolver": Signpost,
  monitor: Activity,
  logs: ScrollText,
  siem: Radar,
  registry: Package,
  cicd: GitBranch,
  llm: Sparkles,
  gpu: Cpu,
  datadog: Activity,
  grafana: ChartLine,
  "onprem-dc": Building2,
  router: Router,
  external: Building,
  system: Hexagon,
};

export const roleIcon = (role: string): LucideIcon => ROLE_ICON[role] ?? Hexagon;
