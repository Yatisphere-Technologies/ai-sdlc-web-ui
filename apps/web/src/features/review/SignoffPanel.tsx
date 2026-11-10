import { blockingFindings, type ReviewPack, type SignoffRole } from "@throughline/contracts";
import { Button, Card, cn, GateMark } from "@throughline/ui";
import { CircleCheck } from "lucide-react";
import { ErrorNote } from "@/components/data/ErrorNote";
import { useTenant } from "@/tenancy";
import { useSignoff } from "./api";

const ROLE: Record<SignoffRole, { label: string; action: "gate.approve.g2" | "review.security.signoff" }> = {
  architecture: { label: "Architecture", action: "gate.approve.g2" },
  security: { label: "Security", action: "review.security.signoff" },
};

export function SignoffPanel({ pack }: { pack: ReviewPack }) {
  const { can } = useTenant();
  const signoff = useSignoff();
  const blocking = blockingFindings(pack).length;
  const ready = pack.status === "in-review" && blocking === 0;
  const done = pack.status === "signed-off";

  return (
    <Card tone={done ? "ok" : "gate"} className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-heading-md text-strong flex items-center gap-2.5">
          <GateMark state={done ? "approved" : "open"} /> G2 · two keys
        </h2>
        <span className={cn("text-micro font-mono", done ? "text-ok" : "text-gate")}>
          {done ? "SIGNED OFF" : `${pack.signoffs.filter((s) => s.by).length}/2 SIGNED`}
        </span>
      </div>
      <p className="text-body-sm text-subtle">
        Architecture and security each sign. One person can't sign both, and every high or critical finding
        must be resolved or accepted first.
      </p>
      <ul className="flex flex-col gap-2.5">
        {pack.signoffs.map((s) => {
          const allowed = can(ROLE[s.role].action);
          return (
            <li
              key={s.role}
              className="border-line bg-surface-raised flex items-center justify-between gap-3 rounded-lg border px-3.5 py-3"
            >
              <span className="flex flex-col gap-0.5">
                <span className="text-body font-semibold">{ROLE[s.role].label}</span>
                <span className={cn("text-caption", s.by ? "text-ok" : "text-muted")}>
                  {s.by ? `Signed by ${s.by}` : allowed ? "Your signature" : "Waiting for the other reviewer"}
                </span>
              </span>
              {s.by ? (
                <CircleCheck className="text-ok size-5" aria-label="Signed" />
              ) : allowed ? (
                <Button
                  variant="gate"
                  size="sm"
                  disabled={!ready || signoff.isPending}
                  onClick={() => signoff.mutate({ packId: pack.id, role: s.role })}
                >
                  Sign {ROLE[s.role].label.toLowerCase()}
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {!done && blocking > 0 ? (
        <p className="text-caption text-risk-fg">
          {blocking} blocking finding{blocking === 1 ? "" : "s"} must be closed before anyone can sign.
        </p>
      ) : null}
      <ErrorNote error={signoff.error} />
    </Card>
  );
}
