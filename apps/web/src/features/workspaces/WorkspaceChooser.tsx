import { Link } from "@tanstack/react-router";
import { ISOLATION_LABEL, PLAN_LABEL, REGION_LABEL } from "@throughline/contracts";
import { Badge, Eyebrow, StatusDot } from "@throughline/ui";
import { ArrowRight, KeyRound, MapPin, ShieldCheck } from "lucide-react";
import { useSession } from "@/auth/session";
import { Logo } from "@/components/shell/Logo";
import { TenantAvatar } from "@/components/shell/TenantAvatar";
import { lastTenant } from "@/tenancy";
import { ThemeMenu } from "@/theme";

export function WorkspaceChooser() {
  const session = useSession();
  const last = lastTenant();

  return (
    <div className="bg-grid min-h-screen px-6 py-10 lg:px-16">
      <div className="mx-auto flex max-w-5xl flex-col gap-10">
        <div className="flex items-center justify-between">
          <Logo />
          <ThemeMenu />
        </div>
        <header className="animate-rise flex flex-col gap-3">
          <Eyebrow>Signed in as {session.user.email}</Eyebrow>
          <h1 className="font-display text-display-lg text-strong text-balance">
            Choose a workspace. <span className="text-agent">Each one is sealed off.</span>
          </h1>
          <p className="text-body-lg text-subtle max-w-2xl">
            Workspaces never share data, keys or agent memory. Your role, and what you can approve, can be
            different in each.
          </p>
        </header>

        <ul className="grid gap-4 md:grid-cols-2">
          {session.tenants.map((t, i) => {
            const membership = session.memberships.find((m) => m.tenantId === t.id);
            return (
              <li key={t.id} className="animate-rise" style={{ animationDelay: `${0.1 + i * 0.08}s` }}>
                <Link
                  to="/t/$tenantSlug"
                  params={{ tenantSlug: t.slug }}
                  className="hover-lift group border-line bg-surface flex h-full flex-col gap-5 rounded-2xl border p-6"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <TenantAvatar name={t.name} size="lg" />
                      <div className="flex flex-col gap-1">
                        <span className="font-display text-heading-md text-strong">{t.name}</span>
                        <span className="text-micro text-faint font-mono">{t.id}</span>
                      </div>
                    </div>
                    {t.slug === last ? (
                      <Badge tone="agent" mono>
                        <StatusDot tone="agent" /> Last used
                      </Badge>
                    ) : (
                      <Badge mono>{PLAN_LABEL[t.plan]}</Badge>
                    )}
                  </div>
                  <dl className="text-body-sm grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="text-subtle flex items-center gap-2">
                      <MapPin className="text-muted size-4" aria-hidden />
                      <dt className="sr-only">Region</dt>
                      <dd>{REGION_LABEL[t.region]}</dd>
                    </div>
                    <div className="text-subtle flex items-center gap-2">
                      <ShieldCheck className="text-muted size-4" aria-hidden />
                      <dt className="sr-only">Isolation</dt>
                      <dd>{ISOLATION_LABEL[t.isolation]}</dd>
                    </div>
                    <div className="text-subtle flex items-center gap-2">
                      <KeyRound className="text-muted size-4" aria-hidden />
                      <dt className="sr-only">Encryption</dt>
                      <dd>{t.encryption === "customer-key" ? "Your key" : "Platform key"}</dd>
                    </div>
                  </dl>
                  <div className="border-line mt-auto flex items-center justify-between gap-3 border-t pt-4">
                    <span className="flex flex-wrap gap-1.5">
                      {membership?.roles.map((r) => (
                        <Badge key={r} tone="human">
                          {r.replace("-", " ")}
                        </Badge>
                      ))}
                    </span>
                    <ArrowRight
                      className="text-muted group-hover:text-agent size-5 transition-transform group-hover:translate-x-1"
                      aria-hidden
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
