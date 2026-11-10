import type { Backlog, BacklogItem, IssuePriority, TaskKind } from "@throughline/contracts";

const cell = (v: string | number | null | undefined) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const row = (cells: (string | number | null | undefined)[]) => cells.map(cell).join(",");

/** Depth-first order so parents always come before children (both importers need that). */
export function ordered(items: BacklogItem[]): { item: BacklogItem; depth: number }[] {
  const children = new Map<string | null, BacklogItem[]>();
  for (const i of items) children.set(i.parentId, [...(children.get(i.parentId) ?? []), i]);
  const out: { item: BacklogItem; depth: number }[] = [];
  const walk = (parent: string | null, depth: number) => {
    for (const i of children.get(parent) ?? []) {
      out.push({ item: i, depth });
      walk(i.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

const criteriaText = (i: BacklogItem) =>
  i.acceptance.map((c, n) => `${n + 1}. Given ${c.given}, when ${c.when}, then ${c.then}.`).join("\n");

const list = (title: string, xs: string[]) =>
  xs.length ? `\n${title}:\n${xs.map((x) => `- ${x}`).join("\n")}` : "";

/** Everything a delivery team needs in the work item body, in plain text both tools accept. */
export function description(i: BacklogItem, withCriteria = true) {
  return [
    i.description,
    i.businessValue ? `\nBusiness value: ${i.businessValue}` : "",
    list(
      "Outcomes",
      i.outcomes.map((o) => `${o.objective}: ${o.kpi} from ${o.baseline} to ${o.target}`),
    ),
    i.scope ? list("In scope", i.scope.in) + list("Out of scope", i.scope.out) : "",
    list("Business acceptance criteria", i.criteria),
    withCriteria && i.acceptance.length ? `\nAcceptance criteria:\n${criteriaText(i)}` : "",
    list(
      "Test scenarios",
      i.tests.map((t) => `[${t.kind}] ${t.scenario}`),
    ),
    list("Definition of done (in addition to the team DoD)", i.definitionOfDone),
    i.nfrs.length ? `\nNon-functional: ${i.nfrs.join(", ")}` : "",
    i.rules.length ? `\nBusiness rules: ${i.rules.join(", ")}` : "",
    i.data.length ? `\nData: ${i.data.map((d) => `${d.entity} (${d.classification})`).join(", ")}` : "",
    i.risks.length ? `\nRisks: ${i.risks.join(", ")}` : "",
    i.dependsOn.length ? `\nDepends on: ${i.dependsOn.join(", ")}` : "",
    list("Notes", i.notes),
    i.owner ? `\nOwner: ${i.owner}` : "",
    i.traces.length ? `\nTraces to: ${i.traces.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

const JIRA_PRIORITY: Record<IssuePriority, string> = {
  highest: "Highest",
  high: "High",
  medium: "Medium",
  low: "Low",
};

/**
 * Jira CSV import (Jira Cloud: Settings → System → External system import → CSV). Map "Issue Id" and
 * "Parent Id" so epics, stories and sub-tasks link up. Jira has no Feature level by default, so a
 * feature becomes a label and component on its stories; with Jira Premium you can map it to a level instead.
 */
export function toJiraCsv(b: Backlog): string {
  const items = b.items;
  const byId = new Map(items.map((i) => [i.id, i]));
  const epicOf = (i: BacklogItem): BacklogItem | undefined => {
    let p = i.parentId ? byId.get(i.parentId) : undefined;
    while (p && p.type !== "epic") p = p.parentId ? byId.get(p.parentId) : undefined;
    return p;
  };
  const rows = ordered(items)
    .map(({ item }) => item)
    .filter((i) => i.type !== "feature");
  const labelsFor = (i: BacklogItem) => {
    const feature = i.type === "story" && i.parentId ? byId.get(i.parentId) : undefined;
    return [...i.labels, ...(feature?.type === "feature" ? [`feature-${feature.id}`] : []), ...i.traces].map(
      (l) => l.replace(/\s+/g, "-"),
    );
  };
  const maxLabels = Math.max(1, ...rows.map((i) => labelsFor(i).length));
  const maxComponents = Math.max(1, ...rows.map((i) => i.components.length));
  const header = [
    "Issue Id",
    "Parent Id",
    "Issue Type",
    "Summary",
    "Description",
    "Priority",
    "Story Points",
    "Fix Version/s",
    "Original Estimate",
    ...Array.from({ length: maxLabels }, () => "Labels"),
    ...Array.from({ length: maxComponents }, () => "Component/s"),
  ];
  const lines = rows.map((i) => {
    const parent =
      i.type === "story" ? epicOf(i) : i.type === "subtask" && i.parentId ? byId.get(i.parentId) : undefined;
    const labels = labelsFor(i);
    return row([
      i.id,
      parent?.id ?? "",
      i.type === "epic" ? "Epic" : i.type === "story" ? "Story" : "Sub-task",
      i.title,
      description(i),
      JIRA_PRIORITY[i.priority],
      i.points,
      i.release ?? "",
      i.hours ? i.hours * 3600 : "",
      ...Array.from({ length: maxLabels }, (_, n) => labels[n] ?? ""),
      ...Array.from({ length: maxComponents }, (_, n) => i.components[n] ?? ""),
    ]);
  });
  return `${[row(header), ...lines].join("\r\n")}\r\n`;
}

const ADO_TYPE = { epic: "Epic", feature: "Feature", story: "User Story", subtask: "Task" } as const;
const ADO_ACTIVITY: Record<TaskKind, string> = {
  design: "Design",
  build: "Development",
  data: "Development",
  test: "Testing",
  security: "Development",
  devops: "Deployment",
  docs: "Documentation",
  change: "Requirements",
};
const ADO_PRIORITY: Record<IssuePriority, number> = { highest: 1, high: 2, medium: 3, low: 4 };

/**
 * Azure Boards CSV import (Boards → Work items → Import from CSV), Agile process. The Title 1–4
 * columns carry the hierarchy, so links are created on import. For the Scrum process, rename
 * "User Story" to "Product Backlog Item" and "Story Points" to "Effort".
 */
export function toAdoCsv(b: Backlog): string {
  const header = [
    "ID",
    "Work Item Type",
    "Title 1",
    "Title 2",
    "Title 3",
    "Title 4",
    "Description",
    "Acceptance Criteria",
    "Priority",
    "Story Points",
    "Original Estimate",
    "Activity",
    "Value Area",
    "Tags",
  ];
  const lines = ordered(b.items).map(({ item: i, depth }) =>
    row([
      "",
      ADO_TYPE[i.type],
      ...Array.from({ length: 4 }, (_, n) => (n === Math.min(depth, 3) ? i.title : "")),
      description(i, false),
      [criteriaText(i), ...i.criteria].filter(Boolean).join("\n"),
      ADO_PRIORITY[i.priority],
      i.points,
      i.hours ?? "",
      i.taskKind ? ADO_ACTIVITY[i.taskKind] : "",
      i.type === "subtask" ? "" : i.kind === "business" ? "Business" : "Architectural",
      [...i.labels, ...(i.release ? [i.release] : []), ...i.traces].join("; "),
    ]),
  );
  return `${[row(header), ...lines].join("\r\n")}\r\n`;
}
