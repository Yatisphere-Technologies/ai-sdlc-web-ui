import { BRD_STEPS, type BrdCheck, type BrdStepId, type StepProgress, stepOf } from "@throughline/contracts";
import { Button, cn } from "@throughline/ui";
import { ArrowLeft, ArrowRight, Check, ChevronDown, Circle, Send } from "lucide-react";
import { type ReactNode, useState } from "react";
import { QualityPanel } from "../brd/QualityPanel";

/**
 * The guided step as one compact line (step, title, how many exit checks pass, previous / next).
 * Expanding it shows every step and this step's exit checks.
 */
export function StepHeader({
  step,
  progress,
  checks,
  onGo,
  onJump,
  onSignoff,
  steps,
}: {
  step: BrdStepId;
  progress: StepProgress | undefined;
  checks: BrdCheck[];
  onGo: (s: BrdStepId) => void;
  onJump: (section: string) => void;
  onSignoff: () => void;
  /** All steps (e.g. StepRail), shown when expanded. */
  steps?: ReactNode;
}) {
  const s = stepOf(step);
  const i = BRD_STEPS.indexOf(s);
  const prev = BRD_STEPS[i - 1];
  const next = BRD_STEPS[i + 1];
  const exit = progress?.checks ?? [];
  const [open, setOpen] = useState(false);
  const done = progress?.status === "done" || progress?.status === "ready";
  return (
    <div className="border-line flex flex-col border-b">
      <div className="flex items-center gap-1 px-3 py-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="hover:bg-surface-raised flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-left"
        >
          <span
            className={cn(
              "text-micro grid size-6 shrink-0 place-items-center rounded-xs border font-mono",
              done ? "border-ok-line text-ok" : "border-agent text-agent-fg",
            )}
          >
            {done ? <Check className="size-3.5" aria-hidden /> : i + 1}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-body-sm text-strong truncate font-semibold">
              {s.title}
              <span className="text-muted font-normal">
                {" "}
                · step {i + 1} of {BRD_STEPS.length}
              </span>
            </span>
            <span className="text-nano text-faint font-mono">
              {progress?.passed ?? 0}/{exit.length} exit checks pass
            </span>
          </span>
          <ChevronDown
            className={cn("text-muted ml-auto size-4 shrink-0 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </button>
        <Button
          size="sm"
          variant="ghost"
          aria-label={prev ? `Previous step: ${prev.title}` : "Previous step"}
          disabled={!prev}
          onClick={() => prev && onGo(prev.id)}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <Button
          size="sm"
          variant={done ? "primary" : "ghost"}
          aria-label={next ? `Next step: ${next.title}` : "Go to sign-off"}
          onClick={() => (next ? onGo(next.id) : onSignoff())}
        >
          <ArrowRight className="size-4" />
        </Button>
      </div>
      {open ? (
        <div className="border-line bg-surface-sunken flex max-h-112 flex-col gap-4 overflow-y-auto border-t px-4 py-3">
          <p className="text-caption text-muted">{s.goal}</p>
          {exit.length ? (
            <ul aria-label="Exit checks" className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
              {exit.map((c) => (
                <li key={c.id} className="text-caption flex items-start gap-1.5">
                  {c.ok ? (
                    <Check className="text-ok mt-0.5 size-3.5 shrink-0" aria-label="Passes" />
                  ) : (
                    <Circle
                      className={cn("mt-0.5 size-3.5 shrink-0", c.required ? "text-risk-fg" : "text-faint")}
                      aria-label="Open"
                    />
                  )}
                  <span className={c.ok ? "text-muted" : "text-foreground"}>
                    {c.label}
                    {c.required && !c.ok ? <span className="text-risk-fg"> · required</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          {step === "review" ? (
            <div className="flex flex-col gap-3">
              <QualityPanel checks={checks} onJump={onJump} />
              <Button
                size="sm"
                variant="gate"
                className="self-start"
                disabled={checks.some((c) => c.severity === "error")}
                onClick={onSignoff}
              >
                <Send className="size-3.5" aria-hidden /> Go to sign-off
              </Button>
            </div>
          ) : null}
          {steps ? (
            <div className="flex flex-col gap-1">
              <span className="eyebrow text-faint">All steps</span>
              {steps}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
