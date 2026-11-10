import {
  type ControlConfig,
  ISOLATION_LABEL,
  postureScore,
  REGION_LABEL,
  ROTATION_OPTIONS,
  type SecurityControl,
} from "@throughline/contracts";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  cn,
  Dialog,
  DialogContent,
  Eyebrow,
  Select,
  Skeleton,
  StatusDot,
  SwitchRow,
} from "@throughline/ui";
import { KeyRound, Plus, Settings2, ShieldAlert, ShieldCheck, Trash2 } from "lucide-react";
import { Suspense, useId, useState } from "react";
import { BrandLogo } from "@/components/brand";
import { useTenant } from "@/tenancy";
import { ago, Field, Frameworks, INPUT, SeverityBadge, TAB_LABEL, TabLink } from "./parts";
import { ReadOnlyNotice } from "./ReadOnlyNotice";
import {
  useConfigureControl,
  useKeyAction,
  useKeyPolicy,
  useSecurity,
  useToggleControl,
} from "./security.api";

const GROUPS: { id: SecurityControl["group"]; title: string }[] = [
  { id: "access", title: "Access" },
  { id: "ai-data", title: "AI data controls" },
  { id: "audit", title: "Audit and agents" },
];

export function PostureDial({ score }: { score: number }) {
  const circumference = 302;
  const tone = score >= 90 ? "stroke-ok" : score >= 70 ? "stroke-gate" : "stroke-risk";
  return (
    <div className="relative size-20 shrink-0">
      <svg viewBox="0 0 120 120" className="size-20 -rotate-90" aria-hidden>
        <circle cx="60" cy="60" r="48" className="stroke-line" strokeWidth="12" fill="none" />
        <circle
          cx="60"
          cy="60"
          r="48"
          className={cn("ease-out-soft transition-[stroke-dashoffset] duration-700", tone)}
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={Math.round(circumference * (1 - score / 100))}
        />
      </svg>
      <span className="font-display text-heading-md text-strong absolute inset-0 flex items-center justify-center">
        {score}
      </span>
    </div>
  );
}

/* ── Control settings ────────────────────────────────────────────────────────────────────────── */

function ConfigEditor({
  control,
  currentIp,
  onClose,
}: {
  control: SecurityControl;
  currentIp: string;
  onClose: () => void;
}) {
  const save = useConfigureControl();
  const id = useId();
  const [cfg, setCfg] = useState<ControlConfig | null>(control.config);
  if (!cfg) return null;
  const submit = () => save.mutate({ id: control.id, config: cfg }, { onSuccess: onClose });
  let body: React.ReactNode = null;
  switch (cfg.kind) {
    case "ip-ranges":
      body = (
        <div className="flex flex-col gap-3">
          <p className="text-body-sm text-muted">
            Your address is <span className="text-foreground font-mono">{currentIp}</span>. The rule can only
            be on while one of the ranges includes it, so you can't lock yourself out.
          </p>
          {cfg.ranges.map((r, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are edited in place; a content key would remount the input on every keystroke
            <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2">
              <input
                aria-label="CIDR range"
                className={cn(INPUT, "text-micro font-mono")}
                value={r.cidr}
                placeholder="203.0.113.0/24"
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    ranges: cfg.ranges.map((x, j) => (j === i ? { ...x, cidr: e.target.value } : x)),
                  })
                }
              />
              <input
                aria-label="Label"
                className={INPUT}
                value={r.label}
                placeholder="Office"
                onChange={(e) =>
                  setCfg({
                    ...cfg,
                    ranges: cfg.ranges.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                  })
                }
              />
              <Button
                variant="ghost"
                size="sm"
                aria-label={`Remove ${r.cidr}`}
                onClick={() => setCfg({ ...cfg, ranges: cfg.ranges.filter((_, j) => j !== i) })}
              >
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
          ))}
          <Button
            variant="secondary"
            size="sm"
            className="self-start"
            onClick={() => setCfg({ ...cfg, ranges: [...cfg.ranges, { cidr: "", label: "" }] })}
          >
            <Plus className="size-4" aria-hidden /> Add range
          </Button>
        </div>
      );
      break;
    case "hours":
    case "days":
      body = (
        <Field id={id} label={cfg.kind === "hours" ? "Idle timeout" : "Keep for"}>
          <Select
            id={id}
            label={cfg.kind === "hours" ? "Idle timeout" : "Retention"}
            value={String(cfg.value)}
            onValueChange={(v) => setCfg({ ...cfg, value: Number(v) })}
            options={cfg.options.map((o) => ({
              value: String(o),
              label:
                cfg.kind === "hours"
                  ? `${o} hour${o === 1 ? "" : "s"}`
                  : o >= 365
                    ? `${Math.round(o / 365)} year${o >= 730 ? "s" : ""}`
                    : `${o} days`,
            }))}
          />
        </Field>
      );
      break;
    case "categories":
      body = (
        <div className="flex flex-col gap-2">
          {cfg.items.map((it) => (
            <SwitchRow
              key={it.id}
              label={it.label}
              checked={it.enabled}
              onCheckedChange={(enabled) =>
                setCfg({ ...cfg, items: cfg.items.map((x) => (x.id === it.id ? { ...x, enabled } : x)) })
              }
            />
          ))}
        </div>
      );
      break;
    case "siem":
      body = (
        <div className="flex flex-col gap-3">
          <Field id={`${id}-t`} label="SIEM">
            <Select
              id={`${id}-t`}
              label="SIEM"
              value={cfg.target}
              onValueChange={(target) => setCfg({ ...cfg, target })}
              options={[
                {
                  value: "sentinel",
                  label: "Microsoft Sentinel",
                  description: "Log Analytics workspace",
                  icon: <BrandLogo brand="sentinel" size="xs" />,
                },
                {
                  value: "splunk",
                  label: "Splunk",
                  description: "HTTP Event Collector",
                  icon: <BrandLogo brand="splunk" size="xs" />,
                },
                {
                  value: "chronicle",
                  label: "Google SecOps",
                  description: "Chronicle ingestion",
                  icon: <BrandLogo brand="google-cloud" size="xs" />,
                },
              ]}
            />
          </Field>
          <Field id={`${id}-e`} label="Workspace or endpoint">
            <input
              id={`${id}-e`}
              className={cn(INPUT, "text-micro font-mono")}
              value={cfg.endpoint === "not configured" ? "" : cfg.endpoint}
              placeholder="law-security-prod"
              onChange={(e) => setCfg({ ...cfg, endpoint: e.target.value })}
            />
          </Field>
        </div>
      );
      break;
  }
  return (
    <DialogContent
      title={control.label}
      description="Changes apply immediately and are recorded in the audit log."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={save.isPending}>
            Save
          </Button>
        </>
      }
    >
      {body}
    </DialogContent>
  );
}

function ControlRow({ c, manage, currentIp }: { c: SecurityControl; manage: boolean; currentIp: string }) {
  const toggle = useToggleControl();
  const [editing, setEditing] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <SwitchRow
        label={c.label}
        description={c.description}
        checked={c.enabled}
        warnWhenOff={c.recommended}
        disabled={!manage || toggle.isPending}
        onCheckedChange={(enabled) => toggle.mutate({ id: c.id, enabled })}
      />
      {toggle.isError && toggle.variables?.id === c.id ? (
        <span className="text-caption text-risk-fg px-1">{toggle.error.message}</span>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <Frameworks items={c.frameworks} />
        {c.config && manage ? (
          <Dialog open={editing} onOpenChange={setEditing}>
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setEditing(true)}>
              <Settings2 className="size-3.5" aria-hidden /> Configure
            </Button>
            {editing ? (
              <ConfigEditor control={c} currentIp={currentIp} onClose={() => setEditing(false)} />
            ) : null}
          </Dialog>
        ) : null}
      </div>
    </div>
  );
}

/* ── Keys ────────────────────────────────────────────────────────────────────────────────────── */

function Keys({ manage }: { manage: boolean }) {
  const { tenant } = useTenant();
  const { keys } = useSecurity();
  const act = useKeyAction();
  const policy = useKeyPolicy();
  const [ask, setAsk] = useState<null | "rotate" | "revoke">(null);
  const [typed, setTyped] = useState("");
  const customer = keys.mode === "customer-key";
  const age = Math.floor((Date.now() - Date.parse(keys.rotatedAt)) / 86_400_000);
  const overdue = customer && age > keys.rotationDays;
  return (
    <Card tone={keys.status === "revoked" ? "risk" : undefined} className="flex flex-col gap-3">
      <CardHeader className="mb-1">
        <CardTitle className="text-heading-sm flex items-center gap-2">
          <KeyRound className="size-4" aria-hidden /> Encryption key
        </CardTitle>
        <Badge tone={keys.status === "revoked" ? "risk" : customer ? "ok" : "neutral"}>
          {keys.status === "revoked" ? "Revoked" : customer ? "Customer-managed" : "Platform-managed"}
        </Badge>
      </CardHeader>
      <dl className="text-body-sm grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
        <dt className="text-muted">Provider</dt>
        <dd>{keys.provider}</dd>
        <dt className="text-muted">Key</dt>
        <dd className="text-ok font-mono">{keys.keyRef}</dd>
        <dt className="text-muted">Last rotated</dt>
        <dd className={cn(overdue && "text-gate-fg")}>
          {ago(keys.rotatedAt)}
          {overdue ? " · overdue" : ""}
        </dd>
        <dt className="text-muted">Rotate every</dt>
        <dd>
          {customer && manage ? (
            <Select
              label="Rotation policy"
              size="sm"
              variant="toolbar"
              value={String(keys.rotationDays)}
              onValueChange={(v) => policy.mutate({ rotationDays: Number(v) })}
              options={ROTATION_OPTIONS.map((d) => ({ value: String(d), label: `${d} days` }))}
            />
          ) : (
            `${keys.rotationDays} days`
          )}
        </dd>
      </dl>
      <ol className="flex flex-col gap-1.5">
        {keys.versions.slice(0, 4).map((v) => (
          <li
            key={v.version}
            className="bg-surface-raised text-caption flex items-center justify-between gap-3 rounded-md px-3 py-2"
          >
            <span className="flex items-center gap-2">
              <StatusDot tone={v.status === "active" ? "ok" : "neutral"} />
              <span className="text-foreground font-mono">{v.version}</span>
              <span className="text-muted">{v.reason}</span>
            </span>
            <span className="text-muted">
              {ago(v.createdAt)} · {v.by}
            </span>
          </li>
        ))}
      </ol>
      {keys.status === "revoked" ? (
        <p className="text-body-sm text-risk-fg">
          Revoked {ago(keys.revokedAt)}. Data can't be decrypted until the key is restored; Key Vault
          soft-delete keeps it for 90 days.
        </p>
      ) : null}
      {!customer ? (
        <p className="text-caption text-muted">
          Throughline rotates this key yearly. Enterprise workspaces can bring their own key in Azure Key
          Vault, AWS KMS or Google Cloud KMS.
        </p>
      ) : manage ? (
        <div className="flex flex-wrap gap-2 pt-1">
          {keys.status === "revoked" ? (
            <Button
              variant="gate"
              size="sm"
              disabled={act.isPending}
              onClick={() => act.mutate({ action: "restore" })}
            >
              Restore access
            </Button>
          ) : (
            <>
              <Button variant="secondary" size="sm" onClick={() => setAsk("rotate")}>
                Rotate now
              </Button>
              <Button variant="danger" size="sm" onClick={() => setAsk("revoke")}>
                Revoke access
              </Button>
            </>
          )}
        </div>
      ) : null}
      <ConfirmDialog
        open={ask === "rotate"}
        onOpenChange={(o) => !o && setAsk(null)}
        title="Rotate the encryption key now?"
        description="A new key version wraps every data key. The old version is kept to decrypt older data, so nothing is re-encrypted and nothing goes offline."
        confirmLabel="Rotate"
        busy={act.isPending}
        onConfirm={() => act.mutate({ action: "rotate" }, { onSettled: () => setAsk(null) })}
      />
      <ConfirmDialog
        open={ask === "revoke"}
        onOpenChange={(o) => {
          if (!o) {
            setAsk(null);
            setTyped("");
          }
        }}
        tone="danger"
        title="Revoke Throughline's access to your key?"
        description="Every agent and person loses access to this workspace's data at once. Use this for a suspected breach or when leaving the platform."
        confirmLabel="Revoke"
        busy={act.isPending || typed !== tenant.slug}
        onConfirm={() =>
          act.mutate(
            { action: "revoke", confirm: typed },
            {
              onSettled: () => {
                setAsk(null);
                setTyped("");
              },
            },
          )
        }
      >
        <Field id="revoke-confirm" label={`Type ${tenant.slug} to confirm`}>
          <input
            id="revoke-confirm"
            className={cn(INPUT, "text-micro font-mono")}
            value={typed}
            autoComplete="off"
            onChange={(e) => setTyped(e.target.value)}
          />
        </Field>
      </ConfirmDialog>
    </Card>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────────────────────────── */

function Security() {
  const { tenant, can } = useTenant();
  const data = useSecurity();
  const manage = can("security.manage");
  const score = postureScore(data.controls, data.findings);
  const high = data.findings.filter((f) => f.severity === "high").length;

  const facts = [
    ["Isolation", ISOLATION_LABEL[tenant.isolation]],
    ["Data residency", REGION_LABEL[tenant.region]],
    ["Sign-in", tenant.identityProvider],
    ["Encryption", data.keys.mode === "customer-key" ? "Your key" : "Platform key"],
  ] as const;

  return (
    <>
      {manage ? null : <ReadOnlyNotice what="security settings" />}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(13rem,100%),1fr))] gap-3">
        <Card padding="sm" className="flex items-center gap-4">
          <PostureDial score={score} />
          <div className="flex flex-col gap-0.5">
            <span className="text-body font-semibold">Security posture</span>
            <span
              className={cn(
                "text-caption",
                high ? "text-risk-fg" : data.findings.length ? "text-gate-fg" : "text-ok",
              )}
            >
              {data.findings.length === 0
                ? "Nothing to fix"
                : `${data.findings.length} finding${data.findings.length === 1 ? "" : "s"}${high ? ` · ${high} high` : ""}`}
            </span>
          </div>
        </Card>
        {facts.map(([k, v]) => (
          <Card key={k} padding="sm" className="flex flex-col gap-1.5">
            <Eyebrow>{k}</Eyebrow>
            <span className="text-body flex items-center gap-2 font-semibold">
              <StatusDot tone={k === "Encryption" && data.keys.status === "revoked" ? "risk" : "ok"} live />{" "}
              {v}
            </span>
          </Card>
        ))}
      </div>
      <Card className="flex flex-col gap-3">
        <CardHeader className="mb-1">
          <CardTitle className="text-heading-sm flex items-center gap-2">
            {data.findings.length ? (
              <ShieldAlert className="text-gate size-4" aria-hidden />
            ) : (
              <ShieldCheck className="text-ok size-4" aria-hidden />
            )}
            What to fix
          </CardTitle>
          <span className="text-caption text-muted">Checked across members, identity, keys and agents</span>
        </CardHeader>
        {data.findings.length ? (
          <ul className="flex flex-col gap-2">
            {data.findings.map((f) => (
              <li
                key={f.id}
                className="bg-surface-raised grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 rounded-md px-3 py-2.5"
              >
                <SeverityBadge severity={f.severity} />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-body-sm text-foreground font-semibold">{f.title}</span>
                  <span className="text-caption text-muted">{f.detail}</span>
                </span>
                <TabLink tab={f.tab} className="text-caption whitespace-nowrap">
                  {TAB_LABEL[f.tab]} →
                </TabLink>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body-sm text-ok">Every recommended control is on and nothing needs attention.</p>
        )}
      </Card>
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="flex flex-col gap-5">
          {GROUPS.map((g) => (
            <Card key={g.id} className="flex flex-col gap-3">
              <CardTitle className="text-heading-sm mb-1">{g.title}</CardTitle>
              {data.controls
                .filter((c) => c.group === g.id)
                .map((c) => (
                  <ControlRow key={c.id} c={c} manage={manage} currentIp={data.currentIp} />
                ))}
            </Card>
          ))}
        </div>
        <div className="flex flex-col gap-5">
          <Keys manage={manage} />
          <Card tone="sunken" className="flex flex-col gap-2">
            <Eyebrow className="text-agent">How this workspace is sealed off</Eyebrow>
            <ul className="text-body-sm text-subtle flex list-disc flex-col gap-1.5 pl-5">
              <li>
                Every API call carries the workspace id in the path and a header; the server rejects a
                mismatch.
              </li>
              <li>Unknown and forbidden workspaces both return “not found”, so ids can't be probed.</li>
              <li>Cached data is keyed by workspace and dropped when you switch.</li>
              <li>Agent sandboxes, credentials and memory are created per workspace and never shared.</li>
              <li>
                Every change on these pages, and every refusal, is written to the hash-chained{" "}
                <TabLink tab="audit">audit log</TabLink>.
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

export function SecurityPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <Security />
    </Suspense>
  );
}
