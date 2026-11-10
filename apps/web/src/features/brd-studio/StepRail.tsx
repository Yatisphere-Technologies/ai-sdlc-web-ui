import { BRD_STEPS, type BrdStepId, type StepProgress } from "@throughline/contracts";
import { cn } from "@throughline/ui";
import { Check, CircleDot, Stamp } from "lucide-react";

const STATUS_LABEL: Record<StepProgress["status"], string> = {
  done: "Done",
  ready: "Required checks pass",
  started: "In progress",
  todo: "Not started",
};

/** The eight guided steps plus sign-off, with how far each one is. Any step can be opened. */
export function StepRail({
  progress,
  current,
  onSelect,
  signoff,
  onSignoff,
}: {
  progress: StepProgress[];
  current: BrdStepId;
  onSelect: (s: BrdStepId) => void;
  /** Approvals signed, e.g. "2/3", and whether every required check passes. */
  signoff: { signed: string; ready: boolean };
  onSignoff: () => void;
}) {
  return (
    <nav aria-label="BRD steps" className="flex flex-col gap-1">
      <ol className="flex flex-col gap-0.5">
        {BRD_STEPS.map((s, i) => {
          const p = progress.find((x) => x.step === s.id);
          const status = p?.status ?? "todo";
          const active = s.id === current;
          return (
            <li key={s.id}>
              <button
                type="button"
                aria-current={active ? "step" : undefined}
                onClick={() => onSelect(s.id)}
                className={cn(
                  "group flex w-full cursor-pointer items-center gap-3 rounded-md px-2.5 py-2 text-left",
                  active ? "bg-agent-wash" : "hover:bg-surface-raised",
                )}
              >
                <span
                  className={cn(
                    "text-micro grid size-6 shrink-0 place-items-center rounded-xs border font-mono",
                    status === "done"
                      ? "border-ok-line bg-ok-soft text-ok"
                      : status === "ready"
                        ? "border-ok-line text-ok"
                        : active
                          ? "border-agent text-agent-fg"
                          : status === "started"
                            ? "border-gate-line text-gate-fg"
                            : "border-line text-muted",
                  )}
                  title={STATUS_LABEL[status]}
                >
                  {status === "done" ? <Check className="size-3.5" aria-hidden /> : i + 1}
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span
                    className={cn(
                      "text-body-sm truncate font-semibold",
                      active ? "text-strong" : "text-foreground",
                    )}
                  >
                    {s.title}
                  </span>
                  <span className="text-nano text-faint font-mono">
                    {p ? `${p.passed}/${p.checks.length} checks` : ""}
                    <span className="sr-only"> · {STATUS_LABEL[status]}</span>
                  </span>
                </span>
                {active ? <CircleDot className="text-agent size-3.5 shrink-0" aria-hidden /> : null}
              </button>
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        onClick={onSignoff}
        className="border-line hover:bg-surface-raised mt-2 flex w-full cursor-pointer items-center gap-3 rounded-md border-t px-2.5 pt-3 pb-2 text-left"
      >
        <span
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-xs border",
            signoff.ready ? "border-gate text-gate" : "border-line text-muted",
          )}
        >
          <Stamp className="size-3.5" aria-hidden />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-body-sm text-foreground font-semibold">Sign-off</span>
          <span className="text-nano text-faint font-mono">
            {signoff.ready ? `ready · ${signoff.signed} signed` : "waiting on required checks"}
          </span>
        </span>
      </button>
    </nav>
  );
}
