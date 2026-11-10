import { CATEGORY_LABEL, type Integration, type IntegrationCategory } from "@throughline/contracts";
import {
  Badge,
  Card,
  CardHeader,
  CardTitle,
  cn,
  Eyebrow,
  Skeleton,
  StatusDot,
  SwitchRow,
} from "@throughline/ui";
import { Suspense, useState } from "react";
import { BrandLogo } from "@/components/brand";
import { useTenant } from "@/tenancy";
import { ConnectWizard } from "./ConnectWizard";
import { useIntegrations, useToggleWriteBack } from "./integrations.api";
import { ReadOnlyNotice } from "./ReadOnlyNotice";

const STATUS: Record<Integration["status"], { label: string; tone: "ok" | "gate" | "neutral" }> = {
  connected: { label: "Connected", tone: "ok" },
  attention: { label: "Needs attention", tone: "gate" },
  available: { label: "Available", tone: "neutral" },
};

const PRINCIPLES = [
  ["Your tools stay the source of truth", "Jira owns work, GitHub owns code, Datadog owns telemetry."],
  ["Links, not copies", "We store ids and evidence hashes, not a second database."],
  ["Write-back is opt-in", "Every field and comment is a switch the tool owner controls."],
  ["Easy to leave", "Turn us off and everything is still in your tools."],
] as const;

function Detail({ integration }: { integration: Integration }) {
  const { can } = useTenant();
  const toggle = useToggleWriteBack(integration.id);
  const manage = can("integrations.manage");

  if (integration.status === "available") return <ConnectWizard integration={integration} />;

  return (
    <Card className="flex flex-col gap-4">
      <CardHeader className="mb-0 flex-wrap">
        <CardTitle className="text-heading-lg flex items-center gap-3">
          <BrandLogo brand={integration.id} fallback={integration.mono} size="md" />
          {integration.name}
        </CardTitle>
        <Badge tone="ok">System of record · {integration.systemOfRecord}</Badge>
      </CardHeader>
      <span className="text-micro text-muted font-mono">{integration.auth}</span>
      <div className="flex flex-col gap-1.5">
        <Eyebrow className="text-agent">We read</Eyebrow>
        <p className="text-body-sm text-subtle">{integration.reads}</p>
      </div>
      <div className="flex flex-col gap-2">
        <Eyebrow className="text-gate">We write back · you choose each one</Eyebrow>
        {integration.writeBack.map((w) => (
          <SwitchRow
            key={w.id}
            label={w.label}
            checked={w.enabled}
            disabled={!manage || toggle.isPending}
            onCheckedChange={(enabled) => toggle.mutate({ optionId: w.id, enabled })}
          />
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <Eyebrow className="text-risk-fg">We never</Eyebrow>
        <p className="text-body-sm text-subtle">{integration.never}</p>
      </div>
    </Card>
  );
}

function Integrations() {
  const { can } = useTenant();
  const items = useIntegrations();
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? "");
  const selected = items.find((i) => i.id === selectedId);
  const categories = Object.keys(CATEGORY_LABEL) as IntegrationCategory[];
  const connected = items.filter((i) => i.status !== "available").length;

  return (
    <>
      {can("integrations.manage") ? null : <ReadOnlyNotice what="integrations" />}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(14rem,100%),1fr))] gap-3">
        {PRINCIPLES.map(([t, d]) => (
          <Card key={t} padding="sm" className="flex flex-col gap-1">
            <span className="text-agent-fg text-body font-semibold">{t}</span>
            <span className="text-caption text-muted">{d}</span>
          </Card>
        ))}
      </div>
      <p className="text-body-sm text-muted">
        {connected} connected · credentials are stored in this workspace's own vault and never shared across
        workspaces.
      </p>
      <div className="flex flex-col gap-6 xl:flex-row xl:items-start">
        <div className="grid min-w-0 flex-1 content-start gap-5 2xl:grid-cols-2">
          {categories.map((cat) => {
            const inCat = items.filter((i) => i.category === cat);
            if (inCat.length === 0) return null;
            return (
              <section key={cat} aria-label={CATEGORY_LABEL[cat]} className="flex flex-col gap-2.5">
                <Eyebrow>{CATEGORY_LABEL[cat]}</Eyebrow>
                <div className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-2.5">
                  {inCat.map((i) => (
                    <button
                      key={i.id}
                      type="button"
                      aria-pressed={i.id === selectedId}
                      onClick={() => setSelectedId(i.id)}
                      className={cn(
                        "hover-lift flex cursor-pointer flex-col gap-2 rounded-lg border-2 p-3 text-left",
                        i.id === selectedId ? "border-agent bg-agent-wash" : "border-line bg-surface",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-body flex items-center gap-2.5 font-semibold">
                          <BrandLogo brand={i.id} fallback={i.mono} />
                          {i.name}
                        </span>
                        <StatusDot tone={STATUS[i.status].tone} live={i.status === "connected"} />
                      </span>
                      <span className="text-caption text-muted">{i.detail}</span>
                      <Badge tone={STATUS[i.status].tone} mono className="self-start">
                        {STATUS[i.status].label}
                      </Badge>
                    </button>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
        <aside className="xl:sticky xl:top-24 xl:w-md">
          {selected ? <Detail key={selected.id} integration={selected} /> : null}
        </aside>
      </div>
    </>
  );
}

export function IntegrationsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <Integrations />
    </Suspense>
  );
}
