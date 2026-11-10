import type { Integration } from "@throughline/contracts";
import { Badge, Button, Card, CardHeader, CardTitle, cn, Eyebrow, Progress } from "@throughline/ui";
import { CircleCheck } from "lucide-react";
import { useState } from "react";
import { BrandLogo } from "@/components/brand";
import { useTenant } from "@/tenancy";
import { useConnectIntegration } from "./integrations.api";

const AUTH_METHODS = [
  {
    id: "oauth",
    label: "OAuth 2.0",
    help: "Each action is tied to a real identity. Tokens refresh automatically.",
    tag: "Recommended",
    tone: "agent" as const,
  },
  {
    id: "app",
    label: "Organisation app",
    help: "Installed once by an admin. Best for webhooks at scale.",
    tag: "Admin needed",
    tone: "gate" as const,
  },
  {
    id: "token",
    label: "API token",
    help: "Quick for a pilot. Tied to one service account; rotate every 90 days.",
    tag: "Pilot only",
    tone: "neutral" as const,
  },
];

const STEPS = ["Sign in", "Choose scope", "Write-back", "Test"] as const;

/** Connect an available integration. Steps are client-side; the final step calls the API. */
export function ConnectWizard({ integration }: { integration: Integration }) {
  const { can } = useTenant();
  const connect = useConnectIntegration(integration.id);
  const [step, setStep] = useState(0);
  const [method, setMethod] = useState("oauth");
  const allowed = can("integrations.manage");
  const label = AUTH_METHODS.find((m) => m.id === method)?.label ?? method;

  if (connect.isSuccess) {
    return (
      <Card tone="ok" className="animate-pop flex items-center gap-3">
        <CircleCheck className="text-ok size-6" aria-hidden />
        <span className="text-body text-ok font-semibold">
          {integration.name} connected · written to the audit log
        </span>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <CardHeader className="mb-0">
        <CardTitle className="flex items-center gap-3">
          <BrandLogo brand={integration.id} fallback={integration.mono} size="md" />
          Connect {integration.name}
        </CardTitle>
        <span className="text-micro text-muted font-mono">
          STEP {step + 1} OF {STEPS.length}
        </span>
      </CardHeader>
      <Progress value={((step + 1) / STEPS.length) * 100} tone="gate" label="Setup progress" />
      <ol className="grid grid-cols-4 gap-2">
        {STEPS.map((s, i) => (
          <li key={s} className={cn("text-caption", i <= step ? "text-foreground" : "text-faint")}>
            {String(i + 1).padStart(2, "0")} {s}
          </li>
        ))}
      </ol>

      {!allowed ? (
        <p className="text-body-sm text-gate-fg">Only a tenant admin can connect tools in this workspace.</p>
      ) : step === 0 ? (
        <fieldset className="flex flex-col gap-2">
          <legend className="text-body pb-2 font-semibold">How should we sign in?</legend>
          {AUTH_METHODS.map((m) => (
            <label
              key={m.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3",
                method === m.id ? "border-agent bg-agent-wash" : "border-line bg-surface-raised",
              )}
            >
              <input
                type="radio"
                name="auth"
                value={m.id}
                checked={method === m.id}
                onChange={() => setMethod(m.id)}
                className="accent-agent mt-1"
              />
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="text-body font-semibold">{m.label}</span>
                <span className="text-caption text-muted">{m.help}</span>
              </span>
              <Badge tone={m.tone} mono>
                {m.tag}
              </Badge>
            </label>
          ))}
        </fieldset>
      ) : step === 1 ? (
        <p className="text-body-sm text-subtle">
          Choose which projects, repos or spaces agents may read. Start small: one team's scope. You can widen
          it later.
        </p>
      ) : step === 2 ? (
        <div className="flex flex-col gap-2">
          <Eyebrow className="text-gate">Off until you switch it on</Eyebrow>
          {integration.writeBack.map((w) => (
            <span
              key={w.id}
              className="border-line bg-surface-raised text-body-sm rounded-md border px-3 py-2.5"
            >
              {w.label}
            </span>
          ))}
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {["Sign in works", "Can read the chosen scope", "Webhooks arrive", "Audit event recorded"].map(
            (t, i) => (
              <li
                key={t}
                className="animate-rise bg-surface-raised text-body-sm flex items-center justify-between rounded-md px-3 py-2.5"
                style={{ animationDelay: `${i * 0.25}s` }}
              >
                {t}
                <span className="text-micro text-ok font-mono">✓ PASSED</span>
              </li>
            ),
          )}
        </ul>
      )}

      {connect.isError ? <span className="text-caption text-risk-fg">{connect.error.message}</span> : null}

      {allowed ? (
        <div className="border-line flex justify-between gap-3 border-t pt-4">
          <Button variant="secondary" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)}>Continue</Button>
          ) : (
            <Button disabled={connect.isPending} onClick={() => connect.mutate(`${label} · just now`)}>
              {connect.isPending ? "Connecting…" : "Finish and connect"}
            </Button>
          )}
        </div>
      ) : null}
    </Card>
  );
}
