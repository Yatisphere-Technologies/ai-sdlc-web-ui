import type { BrdCheck } from "@throughline/contracts";
import { Button, Card, Eyebrow } from "@throughline/ui";
import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import { CHECK_SECTION, SECTIONS } from "./sections";

/** The BA agent's review of the BRD, with a jump to each problem. */
export function QualityPanel({ checks, onJump }: { checks: BrdCheck[]; onJump: (id: string) => void }) {
  if (checks.length === 0) {
    return (
      <Card tone="ok" padding="lg" className="flex items-center gap-3">
        <CircleCheck className="text-ok size-5" aria-hidden />
        <span className="text-body text-ok">
          No issues. Every objective is measurable and every requirement is testable and traced.
        </span>
      </Card>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {(["error", "warning"] as const).map((sev) => {
        const items = checks.filter((c) => c.severity === sev);
        if (!items.length) return null;
        return (
          <Card key={sev} padding="lg" className="flex flex-col gap-2">
            <Eyebrow className={sev === "error" ? "text-risk-fg" : "text-gate-fg"}>
              {sev === "error" ? `Blocking · ${items.length}` : `Warnings · ${items.length}`}
            </Eyebrow>
            <ul className="divide-line flex flex-col divide-y">
              {items.map((c) => {
                const section = CHECK_SECTION[c.section] ?? c.section;
                return (
                  <li key={c.id} className="flex items-center gap-3 py-2.5">
                    {sev === "error" ? (
                      <CircleAlert className="text-risk size-4 shrink-0" aria-hidden />
                    ) : (
                      <TriangleAlert className="text-gate size-4 shrink-0" aria-hidden />
                    )}
                    <span className="text-body-sm text-foreground">{c.message}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto shrink-0"
                      onClick={() => onJump(c.target && c.section === "requirements" ? c.target : section)}
                    >
                      Go to {SECTIONS.find((s) => s.id === section)?.title ?? c.section}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
