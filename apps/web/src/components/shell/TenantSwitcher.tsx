import { Link, useNavigate } from "@tanstack/react-router";
import { ISOLATION_LABEL, PLAN_LABEL, REGION_LABEL } from "@throughline/contracts";
import { Badge, Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@throughline/ui";
import { Check, ChevronsUpDown, LayoutGrid } from "lucide-react";
import { useSession } from "@/auth/session";
import { useTenant } from "@/tenancy";
import { TenantAvatar } from "./TenantAvatar";

export function TenantSwitcher() {
  const session = useSession();
  const { tenant } = useTenant();
  const navigate = useNavigate();

  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          className="press border-line bg-surface hover:border-line-strong flex h-11 w-full max-w-full cursor-pointer items-center gap-3 rounded-md border px-2.5 text-left sm:w-auto"
          aria-label={`Workspace: ${tenant.name}. Switch workspace`}
        >
          <TenantAvatar name={tenant.name} />
          <span className="flex min-w-0 flex-col">
            <span className="text-body text-strong truncate font-semibold">{tenant.name}</span>
            <span className="text-caption text-muted truncate">
              {REGION_LABEL[tenant.region]} · {ISOLATION_LABEL[tenant.isolation]}
            </span>
          </span>
          <ChevronsUpDown className="text-muted size-4 shrink-0" aria-hidden />
        </button>
      </MenuTrigger>
      <MenuContent>
        <MenuLabel>Your workspaces</MenuLabel>
        {session.tenants.map((t) => (
          <MenuItem
            key={t.id}
            onSelect={() => navigate({ to: "/t/$tenantSlug", params: { tenantSlug: t.slug } })}
          >
            <TenantAvatar name={t.name} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate">{t.name}</span>
              <span className="text-caption text-muted">{REGION_LABEL[t.region]}</span>
            </span>
            {t.id === tenant.id ? (
              <Check className="text-agent size-4" aria-label="Current" />
            ) : (
              <Badge mono>{PLAN_LABEL[t.plan]}</Badge>
            )}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem asChild>
          <Link to="/workspaces">
            <LayoutGrid className="text-muted size-4" aria-hidden />
            All workspaces
          </Link>
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
