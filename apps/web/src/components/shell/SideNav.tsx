import { Link } from "@tanstack/react-router";
import { cn } from "@throughline/ui";
import { Settings } from "lucide-react";
import { useMyApprovalCount } from "@/features/approvals";
import { MODULE_GROUPS, MODULE_ROUTE, MODULES, type ModuleDef } from "@/features/modules";
import { useTenant } from "@/tenancy";
import { Logo } from "./Logo";

const itemClass =
  "flex min-h-10 items-center gap-3 rounded-md px-3 text-body text-muted transition-colors hover:bg-surface-raised hover:text-strong";
const activeClass = "bg-surface-raised text-strong";

function ApprovalCount() {
  const n = useMyApprovalCount();
  if (!n) return null;
  return (
    <span className="bg-gate-soft text-gate text-nano rounded-xs px-1.5 font-mono">
      {n}
      <span className="sr-only"> waiting on you</span>
    </span>
  );
}

export function NavItem({ module }: { module: ModuleDef }) {
  const { tenant } = useTenant();
  const Icon = module.icon;
  return (
    <Link
      to={MODULE_ROUTE[module.id]}
      params={{ tenantSlug: tenant.slug }}
      activeOptions={{ exact: module.id === "control-room" }}
      className={itemClass}
      activeProps={{ className: activeClass }}
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="flex-1">{module.label}</span>
      {module.id === "approvals" ? <ApprovalCount /> : null}
    </Link>
  );
}

export function SideNav({ className }: { className?: string }) {
  const { tenant } = useTenant();
  return (
    <nav
      aria-label="Main"
      className={cn("border-line bg-surface-nav flex flex-col gap-4 border-r px-3 py-5", className)}
    >
      <div className="px-3">
        <Logo />
      </div>
      {MODULE_GROUPS.map((g) => (
        <div key={g.id} className="flex flex-col gap-0.5">
          <span className="eyebrow text-ghost px-3 pb-1">{g.label}</span>
          {MODULES.filter((m) => m.group === g.id).map((m) => (
            <NavItem key={m.id} module={m} />
          ))}
        </div>
      ))}
      <div className="mt-auto">
        <Link
          to="/t/$tenantSlug/settings"
          params={{ tenantSlug: tenant.slug }}
          className={itemClass}
          activeProps={{ className: activeClass }}
        >
          <Settings className="size-4" aria-hidden />
          Settings
        </Link>
      </div>
    </nav>
  );
}
