import { Link } from "@tanstack/react-router";
import type { SettingsTab } from "@throughline/contracts";
import { Badge, cn, Tooltip } from "@throughline/ui";
import type { ReactNode } from "react";
import { useTenant } from "@/tenancy";

export const INPUT =
  "w-full rounded-md border border-line bg-surface-sunken px-3 py-2 text-body-sm text-foreground outline-none placeholder:text-ghost focus:border-agent disabled:opacity-60";

export const TAB_ROUTE = {
  security: "/t/$tenantSlug/settings/security",
  members: "/t/$tenantSlug/settings/members",
  sso: "/t/$tenantSlug/settings/sso",
  agents: "/t/$tenantSlug/settings/agents",
  audit: "/t/$tenantSlug/settings/audit",
} as const satisfies Record<SettingsTab, string>;

export const TAB_LABEL: Record<SettingsTab, string> = {
  security: "Security and data",
  members: "Members and roles",
  sso: "SSO and SCIM",
  agents: "Agents and policies",
  audit: "Audit log",
};

export function TabLink({
  tab,
  children,
  className,
}: {
  tab: SettingsTab;
  children: ReactNode;
  className?: string;
}) {
  const { tenant } = useTenant();
  return (
    <Link
      to={TAB_ROUTE[tab]}
      params={{ tenantSlug: tenant.slug }}
      className={cn("text-agent-fg hover:text-strong underline-offset-4 hover:underline", className)}
    >
      {children}
    </Link>
  );
}

export function Frameworks({ items }: { items: readonly string[] }) {
  if (!items.length) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {items.map((f) => (
        <span key={f} className="border-line text-nano text-muted rounded-xs border px-1.5 py-0.5 font-mono">
          {f}
        </span>
      ))}
    </span>
  );
}

export function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-caption text-subtle font-medium">
        {label}
      </label>
      {children}
      {hint ? <span className="text-caption text-muted">{hint}</span> : null}
    </div>
  );
}

const DAY = 86_400_000;
/** "today", "3 days ago", "in 20 days", or a date for anything older than a year. */
export function ago(iso: string | null, empty = "Never") {
  if (!iso) return empty;
  const d = Math.round((Date.now() - Date.parse(iso)) / DAY);
  if (Math.abs(d) > 365)
    return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  if (d === 0) return "today";
  if (d === 1) return "yesterday";
  if (d === -1) return "tomorrow";
  return d > 0 ? `${d} days ago` : `in ${-d} days`;
}
export const stamp = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

export function Mono({ children, tip }: { children: ReactNode; tip?: string }) {
  const el = <span className="text-caption text-subtle truncate font-mono">{children}</span>;
  return tip ? <Tooltip content={tip}>{el}</Tooltip> : el;
}

export const SEVERITY_TONE = { high: "risk", medium: "gate", low: "neutral" } as const;
export function SeverityBadge({ severity }: { severity: keyof typeof SEVERITY_TONE }) {
  return (
    <Badge tone={SEVERITY_TONE[severity]} mono>
      {severity}
    </Badge>
  );
}
