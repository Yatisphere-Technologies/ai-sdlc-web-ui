import { Link } from "@tanstack/react-router";
import {
  ARTIFACT_TYPE_LABEL,
  type ArtifactRef,
  HEALTH_LABEL,
  type Health,
  PHASE_LABEL,
  type ProjectPhase,
} from "@throughline/contracts";
import { Badge, cn, StatusDot, type Tone } from "@throughline/ui";
import { Boxes, FolderKanban } from "lucide-react";
import type { ReactNode } from "react";
import { useTenant } from "@/tenancy";
import { usePortfolioQuery } from "./api";
import { useProjectScope } from "./scope";
import { useWorkItemsQuery } from "./work/api";

export const HEALTH_TONE: Record<Health, Tone> = { "on-track": "ok", "at-risk": "gate", "off-track": "risk" };

export function HealthBadge({ health }: { health: Health }) {
  return (
    <Badge tone={HEALTH_TONE[health]}>
      <StatusDot tone={HEALTH_TONE[health]} /> {HEALTH_LABEL[health]}
    </Badge>
  );
}

export function PhaseBadge({ phase }: { phase: ProjectPhase }) {
  return <Badge>{PHASE_LABEL[phase]}</Badge>;
}

export function PlatformBadge() {
  return (
    <Badge tone="ion">
      <Boxes className="size-3" aria-hidden /> Shared platform
    </Badge>
  );
}

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
  notation: "compact",
});
export const money = (n: number) => usd.format(n);

const LINK_CLASS = "hover:text-agent-fg underline-offset-2 hover:underline";

/** Link to wherever an artifact lives in the app. Falls back to plain text when it has no page. */
export function ArtifactRefLink({
  refTo,
  children,
  className,
}: {
  refTo: ArtifactRef;
  children?: ReactNode;
  className?: string;
}) {
  const { tenant } = useTenant();
  const portfolio = usePortfolioQuery().data;
  const workItems = useWorkItemsQuery().data?.items ?? [];
  const label = children ?? refTo.id;
  const cls = cn(LINK_CLASS, className);
  const slug = tenant.slug;
  switch (refTo.type) {
    case "brd":
      return (
        <Link to="/t/$tenantSlug/brd/$brdId" params={{ tenantSlug: slug, brdId: refTo.id }} className={cls}>
          {label}
        </Link>
      );
    case "backlog":
      return (
        <Link
          to="/t/$tenantSlug/brd/$brdId"
          params={{ tenantSlug: slug, brdId: refTo.id.replace(/^bl-/, "") }}
          search={{ view: "backlog" }}
          className={cls}
        >
          {label}
        </Link>
      );
    case "architecture":
      return (
        <Link
          to="/t/$tenantSlug/architecture"
          params={{ tenantSlug: slug }}
          search={{ arch: refTo.id }}
          className={cls}
        >
          {label}
        </Link>
      );
    case "project":
    case "plan": {
      const id = refTo.type === "plan" ? `prj-${refTo.id.replace(/^plan-/, "")}` : refTo.id;
      const key = portfolio?.projects.find((p) => p.id === id)?.key;
      return key ? (
        <Link
          to="/t/$tenantSlug/projects/$projectKey"
          params={{ tenantSlug: slug, projectKey: key }}
          search={refTo.type === "plan" ? { tab: "plan" } : {}}
          className={cls}
        >
          {label}
        </Link>
      ) : (
        <span className={className}>{label}</span>
      );
    }
    case "test-plan":
      return (
        <Link
          to="/t/$tenantSlug/testing"
          params={{ tenantSlug: slug }}
          search={{ plan: refTo.id }}
          className={cls}
        >
          {label}
        </Link>
      );
    case "spec":
      return (
        <Link
          to="/t/$tenantSlug/brd"
          params={{ tenantSlug: slug }}
          search={{ view: "specs", wi: refTo.id }}
          className={cls}
        >
          {label}
        </Link>
      );
    case "design":
      return (
        <Link
          to="/t/$tenantSlug/architecture"
          params={{ tenantSlug: slug }}
          search={{ view: "options" }}
          className={cls}
        >
          {label}
        </Link>
      );
    case "review":
      return (
        <Link to="/t/$tenantSlug/review" params={{ tenantSlug: slug }} className={cls}>
          {label}
        </Link>
      );
    case "build":
      return (
        <Link to="/t/$tenantSlug/delivery" params={{ tenantSlug: slug }} className={cls}>
          {label}
        </Link>
      );
    case "release":
      return (
        <Link
          to="/t/$tenantSlug/delivery"
          params={{ tenantSlug: slug }}
          search={{ tab: "release" }}
          className={cls}
        >
          {label}
        </Link>
      );
    case "incident":
      return (
        <Link to="/t/$tenantSlug/operate" params={{ tenantSlug: slug }} className={cls}>
          {label}
        </Link>
      );
    case "work-item": {
      const projectId = workItems.find((w) => w.key === refTo.id)?.projectId;
      const key = portfolio?.projects.find((p) => p.id === projectId)?.key;
      return key ? (
        <Link
          to="/t/$tenantSlug/projects/$projectKey"
          params={{ tenantSlug: slug, projectKey: key }}
          search={{ tab: "work", item: refTo.id }}
          className={cls}
        >
          {label}
        </Link>
      ) : (
        <span className={className}>{label}</span>
      );
    }
  }
}

/** Small chip naming an artifact by type and id, linked to it. */
export function RefChip({ refTo }: { refTo: ArtifactRef }) {
  return (
    <span className="border-line bg-surface-raised text-caption text-subtle inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5">
      <span className="text-faint">{ARTIFACT_TYPE_LABEL[refTo.type]}</span>
      <ArtifactRefLink refTo={refTo} className="text-foreground font-mono">
        {refTo.id}
      </ArtifactRefLink>
    </span>
  );
}

/** "Belongs to UPI · UPI AutoPay self-service": shown on BRDs, architectures and work items. */
export function ProjectChip({ projectId, className }: { projectId: string; className?: string }) {
  const { tenant } = useTenant();
  const p = usePortfolioQuery().data?.projects.find((x) => x.id === projectId);
  if (!p) return null;
  return (
    <Link
      to="/t/$tenantSlug/projects/$projectKey"
      params={{ tenantSlug: tenant.slug, projectKey: p.key }}
      className={cn(
        "border-line bg-surface text-caption text-subtle hover:border-agent hover:text-foreground inline-flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-0.5",
        className,
      )}
    >
      <FolderKanban className="text-agent-fg size-3 shrink-0" aria-hidden />
      <span className="text-foreground font-mono">{p.key}</span>
      <span className="truncate">{p.name}</span>
    </Link>
  );
}

/** Non-link project label, for use inside other links or cards. */
export function ProjectLabel({ projectId }: { projectId: string }) {
  const p = usePortfolioQuery().data?.projects.find((x) => x.id === projectId);
  if (!p) return null;
  return (
    <span className="text-caption text-subtle inline-flex min-w-0 items-center gap-1.5">
      <FolderKanban className="text-agent-fg size-3 shrink-0" aria-hidden />
      <span className="text-foreground font-mono">{p.key}</span>
      <span className="truncate">{p.name}</span>
    </span>
  );
}

/** "Showing UPI only · Show all": tells people a list is filtered by the working project. */
export function ScopeNote({ shown, total, onClear }: { shown: number; total: number; onClear: () => void }) {
  const { tenant } = useTenant();
  const [scope] = useProjectScope(tenant.id);
  const p = usePortfolioQuery().data?.projects.find((x) => x.id === scope);
  if (!scope || !p) return null;
  return (
    <span className="text-caption text-muted inline-flex flex-wrap items-center gap-1.5">
      <FolderKanban className="text-agent-fg size-3.5" aria-hidden />
      Showing {shown} of {total} in <span className="text-foreground font-mono">{p.key}</span> {p.name}
      <button type="button" onClick={onClear} className="text-agent-fg cursor-pointer hover:underline">
        Show all projects
      </button>
    </span>
  );
}
