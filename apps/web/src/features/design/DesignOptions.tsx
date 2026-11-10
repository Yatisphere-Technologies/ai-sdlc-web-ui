import { Link } from "@tanstack/react-router";
import type { Design, DesignOption } from "@throughline/contracts";
import { Badge, Button, Card, CardTitle, cn, EmptyState, SegmentedControl } from "@throughline/ui";
import { ArrowRight, CircleCheck } from "lucide-react";
import { useState } from "react";
import { ErrorNote } from "@/components/data/ErrorNote";
import { useTenant } from "@/tenancy";
import { useDecideDesign, useDesigns } from "./api";

const CHANGE = {
  existing: "border-line bg-surface-raised text-muted",
  changed: "border-ion bg-ion-soft text-ion-fg",
  new: "border-agent bg-agent-soft text-agent-fg",
} as const;

function OptionCard({
  option,
  selected,
  onSelect,
}: {
  option: DesignOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "hover-lift flex cursor-pointer flex-col gap-3.5 rounded-2xl border-2 p-5 text-left",
        selected ? "border-agent bg-agent-wash" : "border-line bg-surface",
      )}
    >
      <span className="flex items-center justify-between">
        <span className={cn("font-display text-display-md", selected ? "text-agent" : "text-ghost")}>
          {option.letter}
        </span>
        {option.recommended ? <Badge tone="agent">Agent recommends</Badge> : null}
      </span>
      <span className="text-body-lg font-semibold">{option.name}</span>
      <span className="text-body-sm text-subtle">{option.summary}</span>
      <dl className="flex flex-col gap-2">
        {option.metrics.map((m) => (
          <div key={m.label} className="grid grid-cols-[5.5rem_minmax(0,1fr)_3.5rem] items-center gap-2.5">
            <dt className="text-caption text-muted">{m.label}</dt>
            <span className="bg-line h-1.5 overflow-hidden rounded-full">
              <span
                className={cn("block h-full rounded-full", m.good ? "bg-ok" : "bg-gate")}
                style={{ width: `${m.score}%` }}
              />
            </span>
            <dd className={cn("text-micro text-right font-mono", m.good ? "text-ok" : "text-gate")}>
              {m.value}
            </dd>
          </div>
        ))}
      </dl>
    </button>
  );
}

function DesignDetail({ design }: { design: Design }) {
  const { tenant, can } = useTenant();
  const decide = useDecideDesign();
  const [optionId, setOptionId] = useState(
    design.chosenOptionId ?? design.options.find((o) => o.recommended)?.id ?? "",
  );
  const option = design.options.find((o) => o.id === optionId) ?? design.options[0];
  const decided = design.status === "decided";
  if (!option) return null;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 lg:grid-cols-3">
        {design.options.map((o) => (
          <OptionCard
            key={o.id}
            option={o}
            selected={o.id === option.id}
            onSelect={() => setOptionId(o.id)}
          />
        ))}
      </div>
      <Card padding="lg" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <CardTitle>Option {option.letter} · how it flows</CardTitle>
          <span className="text-micro text-muted font-mono">
            {option.components.length} COMPONENTS ·{" "}
            {option.components.filter((c) => c.change === "new").length} NEW
          </span>
        </div>
        <ol className="flex flex-wrap items-center gap-2">
          {option.components.map((c, i) => (
            <li
              key={c.name}
              className="animate-rise flex items-center gap-2"
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              <span className={cn("rounded-lg border-2 px-3.5 py-2.5 text-center", CHANGE[c.change])}>
                <span className="text-body-sm text-foreground block font-semibold">{c.name}</span>
                <span className="text-nano font-mono uppercase">{c.change}</span>
              </span>
              {i < option.components.length - 1 ? (
                <ArrowRight className="text-agent size-4" aria-hidden />
              ) : null}
            </li>
          ))}
        </ol>
        <p className="text-body text-subtle">
          <span className="text-foreground font-semibold">Why: </span>
          {option.rationale}
        </p>
      </Card>
      {decided ? (
        <Card tone="ok" className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-body text-ok flex items-center gap-2 font-semibold">
            <CircleCheck className="size-5" aria-hidden /> Option{" "}
            {design.options.find((o) => o.id === design.chosenOptionId)?.letter} chosen by {design.decidedBy}.
            Next: the architecture brief and diagrams.
          </span>
          <Button asChild>
            <Link to="/t/$tenantSlug/architecture" params={{ tenantSlug: tenant.slug }}>
              Open the architecture studio →
            </Link>
          </Button>
        </Card>
      ) : can("gate.approve.g2") ? (
        <div className="flex flex-col gap-2">
          <Button
            size="lg"
            disabled={decide.isPending}
            onClick={() => decide.mutate({ designId: design.id, optionId: option.id })}
          >
            Choose option {option.letter} and send to review
          </Button>
          <ErrorNote error={decide.error} />
        </div>
      ) : (
        <span className="text-caption text-muted">
          An architect chooses the design. You can compare the options.
        </span>
      )}
    </div>
  );
}

/** Design options for a work item, compared before the architecture is drawn. */
export function DesignOptions({ wi }: { wi?: string }) {
  const designs = useDesigns();
  const [id, setId] = useState(designs.find((d) => d.workItemKey === wi)?.id ?? designs[0]?.id ?? "");
  const design = designs.find((d) => d.id === id) ?? designs[0];
  if (!design) return <EmptyState title="Nothing is in design right now" />;
  return (
    <div className="flex flex-col gap-4">
      {designs.length > 1 ? (
        <SegmentedControl
          label="Design"
          value={design.id}
          onValueChange={setId}
          options={designs.map((d) => ({ value: d.id, label: `${d.workItemKey} · ${d.title}` }))}
        />
      ) : (
        <span className="text-micro text-muted font-mono">
          {design.workItemKey} · {design.title}
        </span>
      )}
      <DesignDetail key={design.id} design={design} />
    </div>
  );
}
