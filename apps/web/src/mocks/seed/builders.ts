import type {
  AgentRun,
  GateDecision,
  Integration,
  Kpi,
  StageSummary,
  WorkItem,
} from "@throughline/contracts";

type ItemTuple = [
  key: string,
  title: string,
  progress: number,
  note: string,
  state?: "working" | "waiting" | "done",
];

export function stage(
  s: StageSummary["stage"],
  count: number,
  unit: string,
  activity: string,
  live: boolean,
  blurb: string,
  items: ItemTuple[],
): StageSummary {
  return {
    stage: s,
    count,
    unit,
    activity,
    live,
    blurb,
    items: items.map(([key, title, progress, note, state]) => ({
      key,
      title,
      progress,
      note,
      state: state ?? (progress >= 100 ? "done" : "working"),
    })),
  };
}

export function agent(
  code: string,
  name: string,
  task: string,
  model: string,
  progress: number,
  running = true,
): AgentRun {
  return { id: name, code, name, task, model, progress, running };
}

export function decision(
  id: string,
  gate: GateDecision["gate"],
  title: string,
  meta: string,
  workItemKey: string,
): GateDecision {
  return { id, gate, title, meta, workItemKey, status: "open", approvedBy: null };
}

export function kpi(
  id: string,
  label: string,
  value: string,
  delta: string,
  trend: Kpi["trend"],
  target: string,
  series: number[],
): Kpi {
  return { id, label, value, delta, trend, target, series };
}

export function work(
  key: string,
  title: string,
  team: string,
  stage: WorkItem["stage"],
  risk: WorkItem["risk"],
  waiting: [kind: "human" | "agent", label: string, gate?: WorkItem["waitingOn"]["gate"]],
  ageDays: number,
  aiSpendUsd: number,
): WorkItem {
  return {
    id: key.toLowerCase(),
    key,
    /** Set by placeWorkItems in each tenant seed. */
    projectId: "",
    title,
    team,
    stage,
    risk,
    waitingOn: { kind: waiting[0], label: waiting[1], gate: waiting[2] ?? null },
    ageDays,
    aiSpendUsd,
  };
}

/** Connectors every tenant sees; status and write-back choices differ per tenant. */
export function integrations(
  connected: Record<string, Integration["status"]>,
  auth: Record<string, string> = {},
): Integration[] {
  const base: Omit<Integration, "status" | "auth">[] = [
    {
      id: "jira",
      name: "Jira",
      mono: "JI",
      category: "plan",
      detail: "Issues, sprints, comments",
      systemOfRecord: "work items",
      reads: "Issues, status, assignees, sprints and comments, so status answers and traces stay live.",
      never: "Change your workflows, transitions or boards.",
      writeBack: [
        { id: "links", label: "Add spec and trace links to issues", enabled: true },
        { id: "gate-comments", label: "Post gate decisions as comments", enabled: true },
        { id: "gate-field", label: "Update a Gate custom field", enabled: false },
      ],
    },
    {
      id: "azure-boards",
      name: "Azure Boards",
      mono: "AB",
      category: "plan",
      detail: "Work items and iterations",
      systemOfRecord: "work items",
      reads: "Work items, states and iterations.",
      never: "Change process templates.",
      writeBack: [{ id: "links", label: "Add trace links to work items", enabled: false }],
    },
    {
      id: "confluence",
      name: "Confluence",
      mono: "CF",
      category: "know",
      detail: "Specs and decision records",
      systemOfRecord: "specs and decisions",
      reads: "Pages, templates and past decisions, so agents follow how you already write.",
      never: "Edit pages people wrote without a suggestion they accept.",
      writeBack: [
        { id: "publish-spec", label: "Publish approved specs as pages", enabled: true },
        { id: "publish-adr", label: "Publish decision records", enabled: true },
      ],
    },
    {
      id: "github",
      name: "GitHub",
      mono: "GH",
      category: "code",
      detail: "Repos, PRs, checks",
      systemOfRecord: "code and reviews",
      reads: "PRs, reviews, checks and commits, linked to work items by branch name or commit trailer.",
      never: "Merge without the required human key, or change branch protection.",
      writeBack: [
        { id: "open-pr", label: "Open PRs from agent worktrees", enabled: true },
        { id: "spec-check", label: "Post the spec check as a PR check", enabled: true },
        { id: "evidence", label: "Add the evidence summary to PRs", enabled: false },
      ],
    },
    {
      id: "claude-code",
      name: "Claude Code",
      mono: "CC",
      category: "code",
      detail: "Engineer sessions via MCP",
      systemOfRecord: "engineer workspace",
      reads: "Which task an engineer pulls and the agent session summary.",
      never: "Read code outside the repos the engineer opens.",
      writeBack: [{ id: "context", label: "Serve specs and rules to sessions", enabled: true }],
    },
    {
      id: "argo",
      name: "Argo CD",
      mono: "AR",
      category: "ship",
      detail: "Progressive delivery",
      systemOfRecord: "deployments",
      reads: "Applications, rollouts and health.",
      never: "Promote a rollout without the G4 decision.",
      writeBack: [{ id: "promote", label: "Promote rollouts after G4 approval", enabled: false }],
    },
    {
      id: "datadog",
      name: "Datadog",
      mono: "DD",
      category: "run",
      detail: "Monitors, SLOs, traces",
      systemOfRecord: "runtime telemetry",
      reads: "Monitors, SLOs, traces and deploy markers, joined to work items by trace id.",
      never: "Change monitors or alert routing.",
      writeBack: [{ id: "markers", label: "Add deploy markers with the work item id", enabled: true }],
    },
    {
      id: "slack",
      name: "Slack",
      mono: "SL",
      category: "talk",
      detail: "Ask, approvals, digests",
      systemOfRecord: "conversations",
      reads: "Messages sent to the Throughline app and its channels.",
      never: "Read channels the app was not added to.",
      writeBack: [{ id: "digests", label: "Post daily digests", enabled: true }],
    },
    {
      id: "teams",
      name: "Microsoft Teams",
      mono: "TM",
      category: "talk",
      detail: "Ask, approvals, digests",
      systemOfRecord: "conversations",
      reads: "Messages sent to the Throughline app.",
      never: "Read chats the app is not part of.",
      writeBack: [{ id: "digests", label: "Post daily digests", enabled: false }],
    },
  ];
  return base.map((i) => ({ ...i, status: connected[i.id] ?? "available", auth: auth[i.id] ?? null }));
}
