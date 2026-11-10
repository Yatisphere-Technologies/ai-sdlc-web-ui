import { Link } from "@tanstack/react-router";
import type { SettingsTab } from "@throughline/contracts";
import { Eyebrow, PageHeader } from "@throughline/ui";
import type { ReactNode } from "react";
import { useTenant } from "@/tenancy";
import { TAB_LABEL, TAB_ROUTE } from "./parts";

const LIVE = [
  { to: "/t/$tenantSlug/settings/integrations", label: "Integrations" },
  ...(Object.keys(TAB_ROUTE) as SettingsTab[]).map((t) => ({ to: TAB_ROUTE[t], label: TAB_LABEL[t] })),
] as const;

const tabClass =
  "flex h-11 items-center whitespace-nowrap border-b-2 border-transparent px-1 text-body text-muted hover:text-strong";

export function SettingsLayout({ children }: { children: ReactNode }) {
  const { tenant } = useTenant();
  return (
    <>
      <PageHeader
        eyebrow={
          <Eyebrow>
            Settings · {tenant.name} · {tenant.id}
          </Eyebrow>
        }
        title="Workspace settings"
      />
      <nav aria-label="Settings" className="border-line flex gap-6 overflow-x-auto border-b">
        {LIVE.map((l) => (
          <Link
            key={l.to}
            to={l.to}
            params={{ tenantSlug: tenant.slug }}
            className={tabClass}
            activeProps={{ className: "border-agent text-strong" }}
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
    </>
  );
}
