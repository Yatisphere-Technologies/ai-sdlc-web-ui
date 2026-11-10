import {
  BACKLOG_KIND_LABEL,
  type BacklogKind,
  type BacklogType,
  type IssuePriority,
  type TaskKind,
} from "@throughline/contracts";
import { Badge, cn } from "@throughline/ui";
import { BookOpen, FlaskConical, Layers, SquareCheck, Zap } from "lucide-react";
import type { ReactNode } from "react";

export const TYPE: Record<BacklogType, { label: string; Icon: typeof Zap; color: string }> = {
  epic: { label: "Epic", Icon: Zap, color: "text-dg-integration" },
  feature: { label: "Feature", Icon: Layers, color: "text-ion" },
  story: { label: "Story", Icon: BookOpen, color: "text-agent" },
  subtask: { label: "Sub-task", Icon: SquareCheck, color: "text-muted" },
};

export const PRIORITY: Record<IssuePriority, { label: string; tone: "risk" | "gate" | "ion" | "neutral" }> = {
  highest: { label: "Highest", tone: "risk" },
  high: { label: "High", tone: "gate" },
  medium: { label: "Medium", tone: "ion" },
  low: { label: "Low", tone: "neutral" },
};

export const KIND_TONE: Record<BacklogKind, "agent" | "ion" | "gate" | "human" | "neutral"> = {
  business: "agent",
  enabler: "ion",
  compliance: "gate",
  transition: "human",
  spike: "neutral",
};

export const TASK_ICON: Partial<Record<TaskKind, typeof Zap>> = { test: FlaskConical };

export const INPUT =
  "w-full rounded-md border border-line bg-surface-sunken px-2.5 py-1.5 text-body-sm text-foreground outline-none focus:border-agent disabled:opacity-70";

export function KindBadge({ kind }: { kind: BacklogKind }) {
  return (
    <Badge tone={KIND_TONE[kind]} mono>
      {BACKLOG_KIND_LABEL[kind]}
    </Badge>
  );
}

/** A titled block in the item details. */
export function Section({
  title,
  count,
  children,
  className,
}: {
  title: string;
  count?: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-2", className)}>
      <h4 className="eyebrow text-muted flex items-center gap-1.5">
        {title}
        {count !== undefined ? <span className="text-faint">· {count}</span> : null}
      </h4>
      {children}
    </section>
  );
}

const TRACE_TONE: [RegExp, "agent" | "ion" | "gate" | "risk" | "neutral" | "human"][] = [
  [/^BR-/, "agent"],
  [/^OBJ-/, "human"],
  [/^RULE-/, "gate"],
  [/^NFR-/, "ion"],
  [/^R-/, "risk"],
];

export function TraceChip({ id, title }: { id: string; title?: string }) {
  const tone = TRACE_TONE.find(([re]) => re.test(id))?.[1] ?? "neutral";
  return (
    <Badge tone={tone} mono title={title}>
      {id}
    </Badge>
  );
}
