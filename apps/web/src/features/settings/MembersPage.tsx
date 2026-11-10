import {
  ACTION_LABEL,
  type Action,
  actionsFor,
  type Member,
  ROLE_ACTIONS,
  ROLE_LABEL,
  type Role,
} from "@throughline/contracts";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  Chip,
  ConfirmDialog,
  cn,
  Dialog,
  DialogContent,
  Eyebrow,
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
  Select,
  Skeleton,
} from "@throughline/ui";
import { Check, KeyRound, MoreHorizontal, Search, ShieldAlert, UserPlus } from "lucide-react";
import { Suspense, useId, useState } from "react";
import { useTenant } from "@/tenancy";
import { ago, Field, INPUT, TabLink } from "./parts";
import { ReadOnlyNotice } from "./ReadOnlyNotice";
import {
  useCertifyAccess,
  useIdentity,
  useInvite,
  useMembers,
  useRemoveMember,
  useUpdateMember,
} from "./security.api";

const ROLES = Object.keys(ROLE_LABEL) as Role[];
const SOURCE_LABEL: Record<Member["source"], string> = {
  scim: "SCIM",
  invite: "Invited",
  jit: "First sign-in",
};

function RolePicker({ value, onChange }: { value: Role[]; onChange: (r: Role[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ROLES.map((r) => (
        <Chip
          key={r}
          selected={value.includes(r)}
          onClick={() => onChange(value.includes(r) ? value.filter((x) => x !== r) : [...value, r])}
        >
          {ROLE_LABEL[r]}
        </Chip>
      ))}
    </div>
  );
}

function InviteDialog({ onClose }: { onClose: () => void }) {
  const invite = useInvite();
  const sso = useIdentity().sso;
  const id = useId();
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<Role[]>([
    sso.defaultRole === "tenant-admin" ? "viewer" : sso.defaultRole,
  ]);
  const verified = sso.domains.filter((d) => d.verified).map((d) => d.domain);
  return (
    <DialogContent
      title="Invite a member"
      description={
        sso.enforced
          ? `SSO is enforced: they sign in through ${sso.provider}, so the address must be on ${verified.join(" or ")}.`
          : "They get an email link; access starts when they first sign in."
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!email.includes("@") || roles.length === 0 || invite.isPending}
            onClick={() => invite.mutate({ email, roles }, { onSuccess: onClose })}
          >
            Send invitation
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field id={id} label="Work email">
          <input
            id={id}
            type="email"
            className={INPUT}
            value={email}
            placeholder={`name@${verified[0] ?? "company.com"}`}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-caption text-subtle font-medium">Roles</span>
          <RolePicker value={roles} onChange={setRoles} />
          <span className="text-caption text-muted">
            They can:{" "}
            {actionsFor(roles)
              .map((a) => ACTION_LABEL[a])
              .join(", ") || "view everything, change nothing"}
          </span>
        </div>
      </div>
    </DialogContent>
  );
}

function RolesDialog({ m, onClose }: { m: Member; onClose: () => void }) {
  const update = useUpdateMember();
  const [roles, setRoles] = useState<Role[]>(m.roles);
  return (
    <DialogContent
      title={`Roles for ${m.name}`}
      description="Permissions are the union of the roles plus any direct grants."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={roles.length === 0 || update.isPending}
            onClick={() => update.mutate({ id: m.id, roles }, { onSuccess: onClose })}
          >
            Save roles
          </Button>
        </>
      }
    >
      <RolePicker value={roles} onChange={setRoles} />
    </DialogContent>
  );
}

function MemberRow({ m, you, manage }: { m: Member; you: boolean; manage: boolean }) {
  const update = useUpdateMember();
  const remove = useRemoveMember();
  const [dialog, setDialog] = useState<null | "roles" | "remove" | "suspend">(null);
  const stale =
    m.status === "active" &&
    !m.breakGlass &&
    m.lastActiveAt &&
    Date.now() - Date.parse(m.lastActiveAt) > 90 * 86_400_000;
  return (
    <tr className={cn("border-line border-b last:border-0", m.status === "suspended" && "opacity-60")}>
      <td className="py-2.5 pr-3">
        <span className="flex flex-col">
          <span className="text-body-sm text-foreground flex items-center gap-2 font-semibold">
            {m.name}
            {you ? <Badge tone="agent">You</Badge> : null}
            {m.breakGlass ? (
              <Badge tone="gate">
                <KeyRound className="size-3" aria-hidden /> Break-glass
              </Badge>
            ) : null}
          </span>
          <span className="text-caption text-muted">{m.email}</span>
        </span>
      </td>
      <td className="py-2.5 pr-3">
        <span className="flex flex-wrap gap-1">
          {m.roles.map((r) => (
            <Badge key={r} tone={r === "tenant-admin" ? "gate" : "neutral"}>
              {ROLE_LABEL[r]}
            </Badge>
          ))}
          {m.grants.length ? (
            <Badge tone="ion">
              +{m.grants.length} grant{m.grants.length === 1 ? "" : "s"}
            </Badge>
          ) : null}
        </span>
      </td>
      <td className="text-caption text-subtle py-2.5 pr-3">
        {SOURCE_LABEL[m.source]}
        {m.groups.length ? <span className="text-muted block">{m.groups.join(", ")}</span> : null}
      </td>
      <td className="py-2.5 pr-3">
        {m.mfa ? (
          <span className="text-caption text-ok flex items-center gap-1">
            <Check className="size-3.5" aria-hidden /> MFA
          </span>
        ) : (
          <span className="text-caption text-risk-fg flex items-center gap-1">
            <ShieldAlert className="size-3.5" aria-hidden /> {m.status === "invited" ? "Pending" : "No MFA"}
          </span>
        )}
      </td>
      <td className={cn("text-caption py-2.5 pr-3", stale ? "text-gate-fg" : "text-subtle")}>
        {m.status === "invited" ? `Invited ${ago(m.addedAt)}` : ago(m.lastActiveAt)}
      </td>
      <td className="py-2.5 pr-3">
        <Badge tone={m.status === "active" ? "ok" : m.status === "invited" ? "ion" : "risk"}>
          {m.status}
        </Badge>
      </td>
      <td className="py-2.5 text-right">
        {manage && !you ? (
          <Menu>
            <MenuTrigger asChild>
              <Button variant="ghost" size="sm" aria-label={`Actions for ${m.name}`}>
                <MoreHorizontal className="size-4" aria-hidden />
              </Button>
            </MenuTrigger>
            <MenuContent align="end">
              <MenuItem disabled={m.source === "scim"} onSelect={() => setDialog("roles")}>
                {m.source === "scim" ? "Roles come from IdP groups" : "Change roles…"}
              </MenuItem>
              {m.status === "suspended" ? (
                <MenuItem onSelect={() => update.mutate({ id: m.id, status: "active" })}>Reinstate</MenuItem>
              ) : m.status === "active" ? (
                <MenuItem onSelect={() => setDialog("suspend")}>Suspend and sign out…</MenuItem>
              ) : null}
              <MenuSeparator />
              <MenuItem className="text-risk-fg" onSelect={() => setDialog("remove")}>
                {m.status === "invited" ? "Cancel invitation…" : "Remove from workspace…"}
              </MenuItem>
            </MenuContent>
          </Menu>
        ) : null}
        <Dialog open={dialog === "roles"} onOpenChange={(o) => !o && setDialog(null)}>
          {dialog === "roles" ? <RolesDialog m={m} onClose={() => setDialog(null)} /> : null}
        </Dialog>
        <ConfirmDialog
          open={dialog === "suspend"}
          onOpenChange={(o) => !o && setDialog(null)}
          tone="danger"
          title={`Suspend ${m.name}?`}
          description="Their sessions, tokens and Slack/Teams links stop working now. Their work and history stay."
          confirmLabel="Suspend"
          busy={update.isPending}
          onConfirm={() =>
            update.mutate({ id: m.id, status: "suspended" }, { onSettled: () => setDialog(null) })
          }
        />
        <ConfirmDialog
          open={dialog === "remove"}
          onOpenChange={(o) => !o && setDialog(null)}
          tone="danger"
          title={m.status === "invited" ? `Cancel the invitation to ${m.email}?` : `Remove ${m.name}?`}
          description={
            m.source === "scim"
              ? "They're synced from your identity provider, so the server will ask you to remove them there."
              : "They lose access at once. Their past approvals and audit entries are kept."
          }
          confirmLabel="Remove"
          busy={remove.isPending}
          onConfirm={() => remove.mutate({ id: m.id }, { onSettled: () => setDialog(null) })}
        />
      </td>
    </tr>
  );
}

function RoleMatrix() {
  const actions = Object.keys(ACTION_LABEL) as Action[];
  return (
    <Card className="flex flex-col gap-3">
      <CardHeader className="mb-1">
        <CardTitle className="text-heading-sm">What each role can do</CardTitle>
        <span className="text-caption text-muted">
          Enforced by the server; the UI only hides what you can't use
        </span>
      </CardHeader>
      <div className="overflow-x-auto">
        <table className="w-full min-w-3xl text-left">
          <thead>
            <tr className="border-line border-b">
              <th scope="col" className="eyebrow text-muted py-2 pr-3 font-normal">
                Permission
              </th>
              {ROLES.map((r) => (
                <th key={r} scope="col" className="text-caption text-muted px-2 py-2 text-center font-normal">
                  {ROLE_LABEL[r]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {actions.map((a) => (
              <tr key={a} className="border-line border-b last:border-0">
                <th scope="row" className="text-body-sm text-subtle py-2 pr-3 font-normal">
                  {ACTION_LABEL[a]}
                </th>
                {ROLES.map((r) => (
                  <td key={r} className="px-2 py-2 text-center">
                    {ROLE_ACTIONS[r].includes(a) ? (
                      <Check className="text-ok mx-auto size-4" aria-label="Allowed" />
                    ) : (
                      <span className="text-ghost">
                        <span aria-hidden>·</span>
                        <span className="sr-only">Not allowed</span>
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-caption text-muted">
        Direct grants add single permissions on top, for example security sign-off for an AppSec engineer.
      </p>
    </Card>
  );
}

function Members() {
  const { can } = useTenant();
  const data = useMembers();
  const certify = useCertifyAccess();
  const manage = can("members.manage");
  const [inviting, setInviting] = useState(false);
  const [confirmReview, setConfirmReview] = useState(false);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<Role | "all">("all");
  const active = data.items.filter((m) => m.status === "active");
  const mfa = active.filter((m) => m.mfa).length;
  const admins = active.filter((m) => m.roles.includes("tenant-admin")).length;
  const due = data.review.lastAt ? Date.parse(data.review.lastAt) + data.review.everyDays * 86_400_000 : 0;
  const overdue = due < Date.now();
  const shown = data.items.filter(
    (m) =>
      (role === "all" || m.roles.includes(role)) &&
      (!q || `${m.name} ${m.email} ${m.groups.join(" ")}`.toLowerCase().includes(q.toLowerCase())),
  );
  return (
    <>
      {manage ? null : <ReadOnlyNotice what="members and roles" />}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(13rem,100%),1fr))] gap-3">
        {[
          ["Seats", `${data.seats.used} of ${data.seats.total}`, null],
          ["Admins", String(admins), admins > 3 ? "Keep admins few" : null],
          [
            "MFA coverage",
            `${active.length ? Math.round((mfa / active.length) * 100) : 100}%`,
            mfa < active.length ? `${active.length - mfa} without` : null,
          ],
        ].map(([k, v, warn]) => (
          <Card key={k} padding="sm" className="flex flex-col gap-1">
            <Eyebrow>{k}</Eyebrow>
            <span className="font-display text-heading-md text-strong">{v}</span>
            {warn ? <span className="text-caption text-gate-fg">{warn}</span> : null}
          </Card>
        ))}
        <Card padding="sm" tone={overdue ? "gate" : undefined} className="flex flex-col gap-1">
          <Eyebrow>Access review</Eyebrow>
          <span className="text-body-sm text-foreground font-semibold">
            {data.review.lastAt ? `Certified ${ago(data.review.lastAt)}` : "Never certified"}
          </span>
          <span className={cn("text-caption", overdue ? "text-gate-fg" : "text-muted")}>
            {overdue ? "Overdue" : `Next due ${ago(new Date(due).toISOString())}`} · every{" "}
            {data.review.everyDays} days
          </span>
          {manage ? (
            <Button
              size="sm"
              variant="secondary"
              className="mt-1 self-start"
              onClick={() => setConfirmReview(true)}
            >
              Certify access
            </Button>
          ) : null}
        </Card>
      </div>
      <Card className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-heading-sm mr-auto">Members · {data.items.length}</CardTitle>
          <label className="border-line bg-surface focus-within:border-agent flex h-9 min-w-48 items-center gap-1.5 rounded-md border px-2.5">
            <Search className="text-muted size-4" aria-hidden />
            <span className="sr-only">Filter members</span>
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, email or group"
              className="text-body-sm text-foreground placeholder:text-faint min-w-0 flex-1 bg-transparent outline-none"
            />
          </label>
          <Select
            label="Role"
            prefix="Role"
            variant="toolbar"
            size="sm"
            value={role}
            onValueChange={setRole}
            options={[
              { value: "all" as const, label: "All" },
              ...ROLES.map((r) => ({
                value: r,
                label: ROLE_LABEL[r],
                meta: String(data.items.filter((m) => m.roles.includes(r)).length),
              })),
            ]}
          />
          {manage ? (
            <Dialog open={inviting} onOpenChange={setInviting}>
              <Button size="sm" onClick={() => setInviting(true)}>
                <UserPlus className="size-4" aria-hidden /> Invite
              </Button>
              {inviting ? <InviteDialog onClose={() => setInviting(false)} /> : null}
            </Dialog>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-4xl text-left">
            <thead>
              <tr className="border-line border-b">
                {["Member", "Roles", "Source", "MFA", "Last active", "Status", ""].map((h) => (
                  <th key={h} scope="col" className="eyebrow text-muted py-2 pr-3 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((m) => (
                <MemberRow key={m.id} m={m} you={m.id === data.you} manage={manage} />
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-caption text-muted">
          People synced by SCIM get their roles from their groups; change the mapping in{" "}
          <TabLink tab="sso">SSO and SCIM</TabLink>.
        </p>
      </Card>
      <RoleMatrix />
      <ConfirmDialog
        open={confirmReview}
        onOpenChange={setConfirmReview}
        tone="gate"
        title="Certify everyone's access?"
        description={`You confirm that the ${data.items.length} people and their roles above still need this access. The review is signed with your name in the audit log.`}
        confirmLabel="Certify"
        busy={certify.isPending}
        onConfirm={() => certify.mutate(undefined, { onSettled: () => setConfirmReview(false) })}
      />
    </>
  );
}

export function MembersPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <Members />
    </Suspense>
  );
}
