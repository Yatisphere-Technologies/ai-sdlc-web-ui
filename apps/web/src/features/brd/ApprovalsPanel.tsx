import type { Brd, BrdCheck } from "@throughline/contracts";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  cn,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
  Eyebrow,
} from "@throughline/ui";
import { CircleCheck, CircleDashed, MessageSquareWarning } from "lucide-react";
import { useState } from "react";
import { useSession } from "@/auth/session";
import { ErrorNote } from "@/components/data/ErrorNote";
import { useTenant } from "@/tenancy";
import { useChangeRequest, useDecideBrd, useSubmitBrd } from "./api";

const STATUS = {
  pending: { label: "Pending", tone: "gate" as const, Icon: CircleDashed },
  approved: { label: "Approved", tone: "ok" as const, Icon: CircleCheck },
  "changes-requested": { label: "Changes requested", tone: "risk" as const, Icon: MessageSquareWarning },
};

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

/** Sign-off: who must approve, their decisions, the workflow actions and the version history. */
export function ApprovalsPanel({ brd, checks }: { brd: Brd; checks: BrdCheck[] }) {
  const { can } = useTenant();
  const session = useSession();
  const decide = useDecideBrd();
  const submit = useSubmitBrd();
  const change = useChangeRequest();
  const [comment, setComment] = useState("");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState<null | "submit" | { approvalId: string; capacity: string }>(null);
  const [changeOpen, setChangeOpen] = useState(false);
  const errors = checks.filter((c) => c.severity === "error");
  const iSubmitted = brd.submittedBy === session.user.name;
  const editable = brd.status === "draft" || brd.status === "changes-requested";

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex flex-col gap-4">
        {brd.approvals.map((a) => {
          const s = STATUS[a.status];
          const mine = a.isMe && brd.status === "in-review" && a.status === "pending";
          return (
            <Card key={a.id} padding="lg" className={cn("flex flex-col gap-3", mine && "border-gate-line")}>
              <div className="flex flex-wrap items-center gap-3">
                <s.Icon
                  className={cn(
                    "size-5",
                    a.status === "approved" ? "text-ok" : a.status === "pending" ? "text-gate" : "text-risk",
                  )}
                  aria-hidden
                />
                <div className="flex flex-col">
                  <span className="text-body text-strong font-semibold">
                    {a.name}
                    {a.isMe ? <span className="text-muted"> (you)</span> : null}
                  </span>
                  <span className="text-caption text-muted">{a.capacity}</span>
                </div>
                <Badge tone={s.tone} mono className="ml-auto">
                  {s.label}
                </Badge>
              </div>
              {a.comment ? (
                <p className="bg-surface-raised text-body-sm text-subtle rounded-md px-3 py-2">
                  “{a.comment}” · {when(a.at)}
                </p>
              ) : null}
              {mine && can("brd.approve") ? (
                iSubmitted ? (
                  <p className="text-caption text-gate-fg">
                    You submitted this version, so another person must take this approval.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    <label className="flex flex-col gap-1">
                      <span className="eyebrow text-muted">Comment (required to request changes)</span>
                      <textarea
                        rows={2}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        className="border-line bg-surface-sunken text-body-sm text-foreground focus:border-agent w-full rounded-md border px-2.5 py-1.5 outline-none"
                      />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="gate"
                        disabled={decide.isPending}
                        onClick={() => setConfirm({ approvalId: a.id, capacity: a.capacity })}
                      >
                        Approve as {a.capacity.toLowerCase()}
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={decide.isPending || !comment.trim()}
                        onClick={() =>
                          decide.mutate({
                            id: brd.id,
                            approvalId: a.id,
                            decision: "request-changes",
                            comment,
                          })
                        }
                      >
                        Request changes
                      </Button>
                    </div>
                    {checks.length > 0 ? (
                      <p className="text-caption text-muted">
                        {checks.length} quality warning{checks.length > 1 ? "s" : ""} open; see Quality before
                        you sign.
                      </p>
                    ) : null}
                  </div>
                )
              ) : null}
            </Card>
          );
        })}
        <ErrorNote error={decide.error} />
      </div>

      <aside className="flex flex-col gap-4">
        {editable && can("brd.edit") ? (
          <Card padding="lg" className="flex flex-col gap-3">
            <Eyebrow>Submit for approval</Eyebrow>
            <p className="text-body-sm text-subtle">
              Locks this version and asks {brd.approvals.length} approvers to sign.{" "}
              {errors.length > 0
                ? `Fix ${errors.length} blocking issue${errors.length > 1 ? "s" : ""} first.`
                : "No blocking issues."}
            </p>
            <Button disabled={errors.length > 0 || submit.isPending} onClick={() => setConfirm("submit")}>
              Submit version {brd.version} for approval
            </Button>
            <ErrorNote error={submit.error} />
          </Card>
        ) : null}
        {brd.status === "approved" && can("brd.edit") ? (
          <Card padding="lg" className="flex flex-col gap-3">
            <Eyebrow>Change request</Eyebrow>
            <p className="text-body-sm text-subtle">
              Version {brd.version} is the approved baseline. A change opens a new draft and needs approval
              again; the backlog is marked out of date.
            </p>
            <Dialog open={changeOpen} onOpenChange={setChangeOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary">Raise change request</Button>
              </DialogTrigger>
              <DialogContent
                title={`Change ${brd.id} v${brd.version}`}
                description="Opens a new draft version. It needs every approval again, and the backlog is marked out of date until then."
                footer={
                  <>
                    <DialogClose asChild>
                      <Button variant="ghost" size="sm">
                        Cancel
                      </Button>
                    </DialogClose>
                    <Button
                      size="sm"
                      variant="gate"
                      disabled={reason.trim().length < 5 || change.isPending}
                      onClick={() =>
                        change.mutate(
                          { id: brd.id, reason },
                          {
                            onSuccess: () => {
                              setChangeOpen(false);
                              setReason("");
                            },
                          },
                        )
                      }
                    >
                      Open version {nextVersion(brd.version)}
                    </Button>
                  </>
                }
              >
                <label className="flex flex-col gap-1.5">
                  <span className="eyebrow text-muted">Reason (recorded in the version history)</span>
                  <textarea
                    rows={3}
                    autoFocus
                    placeholder="e.g. Add the auto-refund rule agreed for OQ-2"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="border-line bg-surface-sunken text-body-sm text-foreground focus:border-agent w-full rounded-md border px-2.5 py-2 outline-none"
                  />
                </label>
                <ul className="text-caption text-muted mt-3 flex flex-col gap-1">
                  <li>· {brd.approvals.length} approvers sign again</li>
                  <li>· Backlog items already in the tool keep their keys</li>
                </ul>
                <ErrorNote error={change.error} />
              </DialogContent>
            </Dialog>
            <ErrorNote error={change.error} />
          </Card>
        ) : null}
        <ConfirmDialog
          open={confirm === "submit"}
          onOpenChange={(o) => !o && setConfirm(null)}
          title={`Submit v${brd.version} for approval?`}
          description={`The document locks while ${brd.approvals.map((a) => a.name).join(", ")} review it. You can't approve a version you submitted.`}
          confirmLabel="Submit for approval"
          tone="gate"
          busy={submit.isPending}
          onConfirm={() => {
            setConfirm(null);
            submit.mutate({ id: brd.id });
          }}
        >
          {checks.length ? (
            <p className="text-caption text-gate-fg">
              {checks.length} warning{checks.length > 1 ? "s" : ""} will be shown to approvers.
            </p>
          ) : null}
        </ConfirmDialog>
        <ConfirmDialog
          open={typeof confirm === "object" && confirm !== null}
          onOpenChange={(o) => !o && setConfirm(null)}
          title={`Approve ${brd.id} v${brd.version}${typeof confirm === "object" && confirm ? ` as ${confirm.capacity.toLowerCase()}` : ""}?`}
          description="Your approval is recorded with your name and the time, and can't be withdrawn for this version."
          confirmLabel="Approve"
          tone="gate"
          busy={decide.isPending}
          onConfirm={() => {
            if (typeof confirm !== "object" || !confirm) return;
            decide.mutate({
              id: brd.id,
              approvalId: confirm.approvalId,
              decision: "approve",
              comment: comment || undefined,
            });
            setConfirm(null);
          }}
        >
          {comment.trim() ? (
            <p className="bg-surface-raised text-body-sm text-subtle rounded-md px-3 py-2">
              “{comment.trim()}”
            </p>
          ) : null}
        </ConfirmDialog>
        <Card padding="lg" className="flex flex-col gap-3">
          <Eyebrow>Version history</Eyebrow>
          <ol className="border-line flex flex-col gap-3 border-l pl-4">
            {[...brd.history].reverse().map((h) => (
              <li key={`${h.version}-${h.at}-${h.what}`} className="flex flex-col gap-0.5">
                <span className="text-micro text-agent-fg font-mono">
                  v{h.version} · {when(h.at)}
                </span>
                <span className="text-body-sm text-foreground">{h.what}</span>
                <span className="text-caption text-muted">{h.by}</span>
              </li>
            ))}
          </ol>
        </Card>
      </aside>
    </div>
  );
}

/** The draft version a change request opens: 1.0 → 1.1. */
function nextVersion(v: string) {
  const [major = "0", minor = "0"] = v.split(".");
  return `${major}.${Number(minor) + 1}`;
}
