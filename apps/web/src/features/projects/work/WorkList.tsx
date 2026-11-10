import { STAGE_LABEL, type WorkItem } from "@throughline/contracts";
import { cn } from "@throughline/ui";
import { usePortfolioQuery } from "../api";
import { RiskBadge, StageBar, WaitingOn } from "./parts";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** Work items as a table. With `onOpen`, a row opens that item (click or Enter). */
export function WorkList({
  items,
  selected,
  onOpen,
}: {
  items: WorkItem[];
  selected?: string | null;
  onOpen?: (key: string) => void;
}) {
  const projects = usePortfolioQuery().data?.projects ?? [];
  const keyOf = (id: string) => projects.find((p) => p.id === id)?.key;
  return (
    <div className="border-line bg-surface overflow-x-auto rounded-2xl border">
      <table className="w-full min-w-5xl border-collapse text-left">
        <thead>
          <tr className="border-line border-b">
            {["Work item", "Lifecycle", "Risk", "Waiting on", "Age", "AI spend"].map((h) => (
              <th key={h} scope="col" className="eyebrow text-muted px-5 py-3.5 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((w, i) => (
            <tr
              key={w.id}
              tabIndex={onOpen ? 0 : undefined}
              aria-selected={onOpen ? w.key === selected : undefined}
              onClick={onOpen ? () => onOpen(w.key) : undefined}
              onKeyDown={
                onOpen
                  ? (e) => {
                      if (e.key === "Enter") onOpen(w.key);
                    }
                  : undefined
              }
              className={cn(
                "animate-rise border-surface-raised hover:bg-surface-raised border-b transition-colors",
                onOpen && "focus-visible:bg-surface-raised cursor-pointer outline-none",
                w.key === selected && "bg-agent-wash",
              )}
              style={{ animationDelay: `${i * 0.04}s` }}
            >
              <td className="max-w-xs px-5 py-3.5">
                <div className="flex flex-col gap-0.5">
                  <span className="text-body truncate font-semibold">{w.title}</span>
                  <span className="text-micro text-faint font-mono">
                    {w.key} · {w.team}
                    {keyOf(w.projectId) ? ` · ${keyOf(w.projectId)}` : ""}
                  </span>
                </div>
              </td>
              <td className="w-56 px-5 py-3.5">
                <div className="flex flex-col gap-1.5">
                  <StageBar item={w} />
                  <span
                    className={cn(
                      "text-caption",
                      w.waitingOn.kind === "human" ? "text-gate" : "text-agent-fg",
                    )}
                  >
                    {STAGE_LABEL[w.stage]}
                  </span>
                </div>
              </td>
              <td className="px-5 py-3.5">
                <RiskBadge risk={w.risk} />
              </td>
              <td className="px-5 py-3.5">
                <WaitingOn item={w} />
              </td>
              <td
                className={cn(
                  "text-caption px-5 py-3.5 font-mono",
                  w.ageDays > 7 ? "text-risk-fg" : "text-subtle",
                )}
              >
                {w.ageDays} d
              </td>
              <td className="text-caption text-subtle px-5 py-3.5 font-mono">{usd.format(w.aiSpendUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
