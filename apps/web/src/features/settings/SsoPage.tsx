import { ROLE_LABEL, type Role } from "@throughline/contracts";
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
  Select,
  Skeleton,
  StatusDot,
  SwitchRow,
  toast,
} from "@throughline/ui";
import { Copy, Globe, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Suspense, useState } from "react";
import { BrandLogo } from "@/components/brand";
import { useTenant } from "@/tenancy";
import { ago, INPUT, stamp } from "./parts";
import { ReadOnlyNotice } from "./ReadOnlyNotice";
import {
  useDomain,
  useIdentity,
  useScimMappings,
  useScimSync,
  useScimToken,
  useUpdateSso,
} from "./security.api";

const ROLES = (Object.keys(ROLE_LABEL) as Role[]).filter((r) => r !== "tenant-admin");
const ALL_ROLES = Object.keys(ROLE_LABEL) as Role[];

function copy(text: string, what: string) {
  void navigator.clipboard?.writeText(text).then(
    () => toast.success(`${what} copied`),
    () => toast.error(`Couldn't copy the ${what.toLowerCase()}`),
  );
}

function CopyButton({ text, what }: { text: string; what: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 px-2"
      aria-label={`Copy ${what}`}
      onClick={() => copy(text, what)}
    >
      <Copy className="size-3.5" aria-hidden />
    </Button>
  );
}

function Sso({ manage }: { manage: boolean }) {
  const { sso } = useIdentity();
  const update = useUpdateSso();
  const [confirm, setConfirm] = useState<null | boolean>(null);
  return (
    <Card className="flex flex-col gap-3">
      <CardHeader className="mb-1">
        <CardTitle className="text-heading-sm">Single sign-on</CardTitle>
        <Badge tone={sso.enforced ? "ok" : "gate"}>{sso.enforced ? "Enforced" : "Optional"}</Badge>
      </CardHeader>
      <dl className="text-body-sm grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2">
        <dt className="text-muted">Provider</dt>
        <dd className="flex items-center gap-2">
          <BrandLogo brand={sso.provider} size="xs" />
          {sso.provider} · {sso.protocol.toUpperCase()}
        </dd>
        <dt className="text-muted">{sso.protocol === "saml" ? "Entity ID" : "Issuer"}</dt>
        <dd className="flex min-w-0 items-center gap-1">
          <span className="text-micro truncate font-mono">{sso.issuer}</span>
          <CopyButton text={sso.issuer} what="Issuer" />
        </dd>
        <dt className="text-muted">{sso.protocol === "saml" ? "Audience" : "Client ID"}</dt>
        <dd className="flex min-w-0 items-center gap-1">
          <span className="text-micro truncate font-mono">{sso.clientId}</span>
          <CopyButton text={sso.clientId} what="Client ID" />
        </dd>
        <dt className="text-muted">Last sign-in</dt>
        <dd>{ago(sso.lastLoginAt)}</dd>
      </dl>
      <SwitchRow
        label="Require SSO for everyone on a verified domain"
        description="Break-glass accounts can still use a password and hardware key"
        checked={sso.enforced}
        warnWhenOff
        disabled={!manage || update.isPending}
        onCheckedChange={(v) => setConfirm(v)}
      />
      <SwitchRow
        label="Create members on first sign-in (JIT)"
        description={
          sso.jit
            ? `They start as ${ROLE_LABEL[sso.defaultRole]}`
            : "Only invited or SCIM-synced people get in"
        }
        checked={sso.jit}
        disabled={!manage || update.isPending}
        onCheckedChange={(jit) => update.mutate({ jit })}
      />
      {sso.jit ? (
        <div className="flex items-center justify-between gap-3 px-1">
          <span className="text-body-sm text-subtle">Default role for new people</span>
          <Select
            label="Default role"
            variant="toolbar"
            size="sm"
            disabled={!manage}
            value={sso.defaultRole}
            onValueChange={(defaultRole) => update.mutate({ defaultRole })}
            options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
          />
        </div>
      ) : null}
      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        tone={confirm ? "gate" : "danger"}
        title={confirm ? "Enforce SSO?" : "Stop enforcing SSO?"}
        description={
          confirm
            ? `Everyone on a verified domain must sign in through ${sso.provider}. Sessions started another way end now.`
            : "People could sign in without your identity provider's MFA and conditional access."
        }
        confirmLabel={confirm ? "Enforce" : "Stop enforcing"}
        busy={update.isPending}
        onConfirm={() =>
          confirm !== null && update.mutate({ enforced: confirm }, { onSettled: () => setConfirm(null) })
        }
      />
    </Card>
  );
}

function Domains({ manage }: { manage: boolean }) {
  const { sso } = useIdentity();
  const act = useDomain();
  const [domain, setDomain] = useState("");
  return (
    <Card className="flex flex-col gap-3">
      <CardHeader className="mb-1">
        <CardTitle className="text-heading-sm flex items-center gap-2">
          <Globe className="size-4" aria-hidden /> Domains
        </CardTitle>
        <span className="text-caption text-muted">Prove ownership with a DNS TXT record</span>
      </CardHeader>
      <ul className="flex flex-col gap-2">
        {sso.domains.map((d) => (
          <li key={d.domain} className="bg-surface-raised flex flex-col gap-1.5 rounded-md px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusDot tone={d.verified ? "ok" : "gate"} />
              <span className="text-body-sm text-foreground font-semibold">{d.domain}</span>
              <Badge tone={d.verified ? "ok" : "gate"}>{d.verified ? "Verified" : "Not verified"}</Badge>
              <span className="text-caption text-muted ml-auto">added {ago(d.addedAt)}</span>
              {manage ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2"
                  aria-label={`Remove ${d.domain}`}
                  disabled={act.isPending}
                  onClick={() => act.mutate({ action: "remove", domain: d.domain })}
                >
                  <Trash2 className="size-3.5" aria-hidden />
                </Button>
              ) : null}
            </div>
            {d.verified ? null : (
              <div className="text-caption text-subtle flex flex-wrap items-center gap-2">
                TXT <span className="text-foreground font-mono">{d.record}</span>
                <CopyButton text={d.record} what="TXT record" />
                {manage ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="ml-auto h-7"
                    disabled={act.isPending}
                    onClick={() => act.mutate({ action: "verify", domain: d.domain })}
                  >
                    Check DNS
                  </Button>
                ) : null}
              </div>
            )}
          </li>
        ))}
      </ul>
      {manage ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            act.mutate({ action: "add", domain }, { onSuccess: () => setDomain("") });
          }}
        >
          <input
            aria-label="Domain"
            className={INPUT}
            placeholder="example.com"
            value={domain}
            onChange={(e) => setDomain(e.target.value.trim())}
          />
          <Button type="submit" size="sm" variant="secondary" disabled={!domain || act.isPending}>
            <Plus className="size-4" aria-hidden /> Add
          </Button>
        </form>
      ) : null}
    </Card>
  );
}

function Mappings({ manage }: { manage: boolean }) {
  const { scim } = useIdentity();
  const save = useScimMappings();
  const [rows, setRows] = useState(scim.mappings);
  const dirty = JSON.stringify(rows) !== JSON.stringify(scim.mappings);
  return (
    <div className="flex flex-col gap-2">
      <span className="eyebrow text-muted">Group → role</span>
      {rows.length === 0 ? <span className="text-caption text-muted">No groups mapped yet.</span> : null}
      {rows.map((r, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: rows are edited in place; a content key would remount the input on every keystroke
        <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2">
          <input
            aria-label="IdP group"
            className={cn(INPUT, "text-micro font-mono")}
            value={r.group}
            disabled={!manage}
            onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, group: e.target.value } : x)))}
          />
          <Select
            label={`Role for ${r.group}`}
            size="sm"
            disabled={!manage}
            value={r.roles[0] ?? "viewer"}
            onValueChange={(role) => setRows(rows.map((x, j) => (j === i ? { ...x, roles: [role] } : x)))}
            options={ALL_ROLES.map((x) => ({ value: x, label: ROLE_LABEL[x] }))}
          />
          {manage ? (
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Remove ${r.group}`}
              onClick={() => setRows(rows.filter((_, j) => j !== i))}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          ) : null}
        </div>
      ))}
      {manage ? (
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRows([...rows, { group: "", roles: ["viewer"] }])}
          >
            <Plus className="size-4" aria-hidden /> Add group
          </Button>
          {dirty ? (
            <>
              <Button size="sm" variant="ghost" onClick={() => setRows(scim.mappings)}>
                Discard
              </Button>
              <Button
                size="sm"
                disabled={save.isPending || rows.some((r) => !r.group)}
                onClick={() => save.mutate({ mappings: rows })}
              >
                Save and apply
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
      {save.error ? <span className="text-caption text-risk-fg">{save.error.message}</span> : null}
    </div>
  );
}

function Scim({ manage }: { manage: boolean }) {
  const { scim } = useIdentity();
  const issue = useScimToken();
  const sync = useScimSync();
  const [ask, setAsk] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  return (
    <Card className="flex flex-col gap-3">
      <CardHeader className="mb-1">
        <CardTitle className="text-heading-sm">SCIM provisioning</CardTitle>
        <Badge tone={scim.enabled ? "ok" : "gate"}>{scim.enabled ? "On" : "Off"}</Badge>
      </CardHeader>
      <dl className="text-body-sm grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-2">
        <dt className="text-muted">Endpoint</dt>
        <dd className="flex min-w-0 items-center gap-1">
          <span className="text-micro truncate font-mono">{scim.endpoint}</span>
          <CopyButton text={scim.endpoint} what="SCIM endpoint" />
        </dd>
        <dt className="text-muted">Token</dt>
        <dd>
          {scim.token ? (
            <>
              <span className="font-mono">…{scim.token.last4}</span>
              <span className="text-caption text-muted"> · expires {ago(scim.token.expiresAt)}</span>
            </>
          ) : (
            <span className="text-muted">None issued</span>
          )}
        </dd>
        <dt className="text-muted">Last sync</dt>
        <dd>
          {ago(scim.lastSyncAt)}
          {scim.lastSyncAt ? ` · ${scim.users} users, ${scim.groups} groups` : ""}
        </dd>
      </dl>
      {manage ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => setAsk(true)}>
            {scim.token ? "Rotate token" : "Issue token"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!scim.enabled || sync.isPending}
            onClick={() => sync.mutate(undefined)}
          >
            <RefreshCw className="size-4" aria-hidden /> Sync now
          </Button>
        </div>
      ) : null}
      {!scim.enabled ? (
        <p className="text-caption text-muted">
          Issue a token, add it to your IdP's provisioning app with the endpoint above, then turn on “Sync
          users and groups with SCIM” in Security and data.
        </p>
      ) : null}
      <Mappings key={JSON.stringify(scim.mappings)} manage={manage} />
      {scim.log.length ? (
        <div className="flex flex-col gap-1.5">
          <span className="eyebrow text-muted">Sync log</span>
          <ul className="flex flex-col gap-1">
            {scim.log.slice(0, 5).map((l) => (
              <li key={`${l.at}-${l.message}`} className="text-caption flex gap-2">
                <StatusDot tone={l.level === "error" ? "risk" : l.level === "warn" ? "gate" : "ok"} />
                <span className="text-muted shrink-0">{stamp(l.at)}</span>
                <span className="text-subtle">{l.message}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <ConfirmDialog
        open={ask}
        onOpenChange={setAsk}
        tone={scim.token ? "danger" : "primary"}
        title={scim.token ? "Rotate the SCIM token?" : "Issue a SCIM token?"}
        description={
          scim.token
            ? `Token …${scim.token.last4} stops working now. Paste the new one into your IdP straight away or provisioning stops.`
            : "The token is shown once. Store it in your IdP's provisioning settings."
        }
        confirmLabel={scim.token ? "Rotate" : "Issue"}
        busy={issue.isPending}
        onConfirm={() =>
          issue.mutate(undefined, {
            onSuccess: (d) => setSecret(d.secret ?? null),
            onSettled: () => setAsk(false),
          })
        }
      />
      <Dialog open={secret !== null} onOpenChange={(o) => !o && setSecret(null)}>
        {secret ? (
          <DialogContent
            title="Your new SCIM token"
            description="Copy it now. Throughline keeps only a hash and the last four characters, so it can't be shown again."
            footer={<Button onClick={() => setSecret(null)}>Done</Button>}
          >
            <div className="bg-surface-sunken border-line flex items-center gap-2 rounded-md border px-3 py-2">
              <span className="text-caption text-foreground min-w-0 flex-1 font-mono break-all">
                {secret}
              </span>
              <CopyButton text={secret} what="Token" />
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </Card>
  );
}

function Identity() {
  const { can } = useTenant();
  const manage = can("security.manage");
  return (
    <>
      {manage ? null : <ReadOnlyNotice what="sign-in and provisioning settings" />}
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="flex flex-col gap-5">
          <Sso manage={manage} />
          <Domains manage={manage} />
        </div>
        <Scim manage={manage} />
      </div>
      <p className="text-caption text-muted">
        MFA, device compliance and conditional access are enforced by your identity provider at sign-in;
        Throughline checks the token's MFA claim and refuses sessions without it when “Require MFA for
        everyone” is on.
      </p>
    </>
  );
}

export function SsoPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <Identity />
    </Suspense>
  );
}
