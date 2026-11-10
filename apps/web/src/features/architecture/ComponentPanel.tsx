import {
  ARCH_QUESTIONS,
  type ArchComponent,
  type Architecture,
  type ChoiceImpact,
  type ComponentServes,
  type Diagram,
} from "@throughline/contracts";
import { Badge, Button, cn, Eyebrow, type Tone, Tooltip } from "@throughline/ui";
import {
  ArrowRight,
  BadgeCheck,
  ExternalLink,
  FlaskConical,
  Gauge,
  Lightbulb,
  ListChecks,
  LoaderCircle,
  Scale,
  ShieldCheck,
  Sparkles,
  Target,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { useTenant } from "@/tenancy";
import { useChooseArchitecture, usePreviewChoice } from "./api";
import { CATEGORY, EDGE, roleIcon } from "./diagramStyle";
import { externalBrandIcon, vendorIcon } from "./icons";

const STATUS: Record<ArchComponent["status"], { label: string; tone: Tone; hint: string }> = {
  ga: { label: "GA", tone: "ok", hint: "Generally available, with an SLA" },
  preview: {
    label: "Preview",
    tone: "gate",
    hint: "Preview: no SLA, may change; keep off the critical path",
  },
  existing: { label: "Existing", tone: "ion", hint: "Already runs in the organisation and is reused" },
  external: {
    label: "External",
    tone: "neutral",
    hint: "Someone else's system; this project doesn't build or run it",
  },
};

const SERVES: { kind: ComponentServes["kind"]; label: string; icon: typeof Target }[] = [
  { kind: "requirement", label: "Business requirements it delivers", icon: Target },
  { kind: "nfr", label: "Non-functional targets it helps meet", icon: Gauge },
  { kind: "decision", label: "Decisions behind it", icon: Scale },
  { kind: "control", label: "Security controls it carries", icon: ShieldCheck },
];

const usd = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

export function ComponentIcon({
  c,
  cloud,
  size = "md",
}: {
  c: ArchComponent;
  cloud: Architecture["brief"]["cloud"];
  size?: "sm" | "md";
}) {
  const brand = externalBrandIcon(c.category, `${c.name} ${c.product}`);
  const vendor = brand ?? vendorIcon(cloud, c.role);
  const Icon = roleIcon(c.role);
  const box = size === "sm" ? "size-8" : "size-11";
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-lg",
        box,
        brand ? "bg-brand-tile border-line border" : vendor ? "bg-surface-raised" : CATEGORY[c.category].bg,
      )}
    >
      {vendor ? (
        <img src={vendor} alt="" className={size === "sm" ? "size-5" : "size-7"} />
      ) : (
        <Icon className={cn(size === "sm" ? "size-4" : "size-5", CATEGORY[c.category].color)} aria-hidden />
      )}
    </span>
  );
}

function Impact({ impact }: { impact: ChoiceImpact }) {
  const delta = impact.costAfter - impact.costBefore;
  const list = (title: string, items: string[], tone: string) =>
    items.length ? (
      <div className="flex flex-col gap-1">
        <span className="text-caption text-muted">{title}</span>
        <ul className="flex flex-col gap-0.5">
          {items.map((x) => (
            <li key={x} className={cn("text-caption", tone)}>
              {x}
            </li>
          ))}
        </ul>
      </div>
    ) : null;
  return (
    <div className="border-line bg-surface-sunken flex flex-col gap-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-body-sm text-strong font-semibold">Impact of the change</span>
        <Badge tone={delta > 0 ? "gate" : delta < 0 ? "ok" : "neutral"} mono>
          {delta === 0 ? "No cost change" : `${delta > 0 ? "+" : "−"}${usd(Math.abs(delta))}/mo`}
        </Badge>
        <span className="text-caption text-muted">
          {usd(impact.costBefore)} → {usd(impact.costAfter)} per month (indicative)
        </span>
      </div>
      {list("Added", impact.added, "text-ok")}
      {list("Removed", impact.removed, "text-risk-fg")}
      {list("Decisions that change", impact.decisions, "text-foreground")}
      {list("Security controls that change", impact.controls, "text-foreground")}
      {impact.warnings.length ? (
        <div className="flex flex-col gap-1">
          {impact.warnings.map((w) => (
            <span key={w} className="text-caption text-gate-fg flex items-start gap-1.5">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {w}
            </span>
          ))}
        </div>
      ) : null}
      {!impact.added.length &&
      !impact.removed.length &&
      !impact.decisions.length &&
      !impact.controls.length ? (
        <span className="text-caption text-muted">Nothing else in the design changes.</span>
      ) : null}
    </div>
  );
}

/** Lets a person switch the brief answer behind a component, previewing the impact first. */
function Choice({ arch, field }: { arch: Architecture; field: string }) {
  const { can } = useTenant();
  const q = ARCH_QUESTIONS.find((x) => x.id === field);
  const preview = usePreviewChoice(arch.id);
  const choose = useChooseArchitecture();
  const [pick, setPick] = useState<string | null>(null);
  if (!q || q.multi) return null;
  const current = String(arch.brief[q.id]);
  const currentLabel = q.options.find((o) => o.value === current)?.label ?? current;
  const editable = can("architecture.edit") && arch.status !== "generating";
  const select = (value: string) => {
    setPick(value);
    preview.mutate({ field, value });
  };
  return (
    <section className="flex flex-col gap-2.5">
      <Eyebrow className="flex items-center gap-1.5">
        <Sparkles className="size-3.5" aria-hidden /> Choices · {q.label}
      </Eyebrow>
      <p className="text-caption text-subtle">{q.why}</p>
      <div className="flex flex-col gap-1.5">
        {q.options.map((o) => {
          const isCurrent = o.value === current;
          const isPick = o.value === pick;
          return (
            <button
              key={o.value}
              type="button"
              disabled={!editable || isCurrent}
              onClick={() => select(o.value)}
              aria-pressed={isPick}
              className={cn(
                "flex flex-col gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors",
                isCurrent
                  ? "border-agent bg-agent-wash cursor-default"
                  : isPick
                    ? "border-gate bg-gate-soft"
                    : "border-line hover:border-line-strong cursor-pointer disabled:cursor-default disabled:opacity-70",
              )}
            >
              <span className="text-body-sm text-foreground flex items-center gap-2 font-medium">
                {o.label}
                {isCurrent ? <Badge tone="agent">Current</Badge> : null}
                {arch.suggestions[q.id]?.value === o.value && !isCurrent ? (
                  <Badge tone="ion">Agent's suggestion</Badge>
                ) : null}
              </span>
              <span className="text-caption text-muted">{o.hint}</span>
            </button>
          );
        })}
      </div>
      {!editable ? (
        <span className="text-caption text-faint">
          Your role can see the options but not change the design.
        </span>
      ) : null}
      {pick ? (
        preview.isPending ? (
          <span className="text-caption text-muted flex items-center gap-2">
            <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> Working out the impact…
          </span>
        ) : preview.data ? (
          <>
            <Impact impact={preview.data} />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                disabled={choose.isPending}
                onClick={() =>
                  choose.mutate(
                    { id: arch.id, field, value: pick },
                    {
                      onSuccess: () => {
                        setPick(null);
                        preview.reset();
                      },
                    },
                  )
                }
              >
                {choose.isPending
                  ? "Regenerating…"
                  : `Switch to ${q.options.find((o) => o.value === pick)?.label}`}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPick(null);
                  preview.reset();
                }}
              >
                Keep {currentLabel}
              </Button>
            </div>
            <span className="text-caption text-faint">
              Switching regenerates the diagrams, decisions and document as a new revision and records who
              changed what.
            </span>
          </>
        ) : preview.error ? (
          <span className="text-caption text-risk-fg">{preview.error.message}</span>
        ) : null
      ) : null}
    </section>
  );
}

/**
 * Everything about one component: what it does, why the solution needs it (the requirements,
 * NFRs, decisions and controls it serves), how it's configured, what it costs, where its docs are,
 * what it connects to in the current diagram, and the choice that would change it.
 */
export function ComponentPanel({
  arch,
  component: c,
  diagram,
  nodeId,
  onSelect,
}: {
  arch: Architecture;
  component: ArchComponent;
  diagram?: Diagram;
  nodeId?: string;
  onSelect?: (nodeId: string) => void;
}) {
  const st = STATUS[c.status];
  const name = (x: string) =>
    diagram?.nodes.find((y) => y.id === x)?.label ?? diagram?.groups.find((g) => g.id === x)?.label ?? x;
  const links =
    diagram && nodeId
      ? diagram.kind === "sequence"
        ? (diagram.messages ?? [])
            .filter((m) => m.from === nodeId || m.to === nodeId)
            .map((m) => ({
              key: `${m.step}`,
              other: m.from === nodeId ? m.to : m.from,
              out: m.from === nodeId,
              label: `${m.step}. ${m.label}`,
              kind: m.kind,
              control: undefined as string | undefined,
            }))
        : diagram.edges
            .filter((e) => e.from === nodeId || e.to === nodeId)
            .map((e) => ({
              key: e.id,
              other: e.from === nodeId ? e.to : e.from,
              out: e.from === nodeId,
              label: e.label ?? "",
              kind: e.kind,
              control: e.control,
            }))
      : [];
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <ComponentIcon c={c} cloud={arch.brief.cloud} />
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-body text-strong font-semibold">{c.name}</span>
          <span className="text-caption text-muted">{c.product}</span>
          <div className="flex flex-wrap items-center gap-1.5">
            <Tooltip content={st.hint}>
              <span>
                <Badge tone={st.tone}>
                  {c.status === "preview" ? (
                    <FlaskConical className="size-3" aria-hidden />
                  ) : (
                    <BadgeCheck className="size-3" aria-hidden />
                  )}
                  {st.label}
                </Badge>
              </span>
            </Tooltip>
            <Badge>{CATEGORY[c.category].name}</Badge>
            {c.monthlyUsd !== null ? (
              <Tooltip content="Indicative list price for a production footprint">
                <span>
                  <Badge mono>~{usd(c.monthlyUsd)}/mo</Badge>
                </span>
              </Tooltip>
            ) : null}
          </div>
        </div>
      </div>

      <section className="flex flex-col gap-1.5">
        <Eyebrow className="flex items-center gap-1.5">
          <ListChecks className="size-3.5" aria-hidden /> What it does here
        </Eyebrow>
        <p className="text-body-sm text-foreground">{c.purpose}</p>
      </section>
      <section className="flex flex-col gap-1.5">
        <Eyebrow className="flex items-center gap-1.5">
          <Lightbulb className="size-3.5" aria-hidden /> Why the solution needs it
        </Eyebrow>
        <p className="text-body-sm text-subtle">{c.why}</p>
      </section>

      {SERVES.map((g) => {
        const items = c.serves.filter((s) => s.kind === g.kind);
        if (!items.length) return null;
        const Icon = g.icon;
        return (
          <section key={g.kind} className="flex flex-col gap-1.5">
            <Eyebrow className="flex items-center gap-1.5">
              <Icon className="size-3.5" aria-hidden /> {g.label} · {items.length}
            </Eyebrow>
            <ul className="flex flex-col gap-1">
              {items.map((s) => (
                <li key={s.id} className="text-caption text-subtle flex gap-2">
                  <span className="text-agent-fg w-14 shrink-0 font-mono">{s.id}</span>
                  <span>{s.label}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {c.serves.length === 0 ? (
        <p className="text-caption text-faint">
          Not traced to a requirement yet. Link the architecture to its BRD to see what this component is for.
        </p>
      ) : null}

      {c.config.length ? (
        <section className="flex flex-col gap-1.5">
          <Eyebrow>Configuration</Eyebrow>
          <dl className="border-line divide-line divide-y rounded-lg border">
            {c.config.map((x) => (
              <div key={x.k} className="grid grid-cols-[8rem_minmax(0,1fr)] gap-3 px-3 py-2">
                <dt className="text-caption text-muted">{x.k}</dt>
                <dd className="text-caption text-foreground">{x.v}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {links.length ? (
        <section className="flex flex-col gap-1.5">
          <Eyebrow>Connections in this diagram · {links.length}</Eyebrow>
          <ul className="flex flex-col gap-1">
            {links.map((l) => (
              <li key={l.key}>
                <button
                  type="button"
                  onClick={() => onSelect?.(l.other)}
                  className="bg-surface-raised hover:bg-surface-sunken flex w-full cursor-pointer flex-col gap-0.5 rounded-md px-2.5 py-1.5 text-left"
                >
                  <span className="text-caption text-foreground flex items-center gap-1.5">
                    {l.out ? "→" : "←"} {name(l.other)}
                    {l.control ? (
                      <Badge tone="risk" mono>
                        {l.control}
                      </Badge>
                    ) : null}
                  </span>
                  <span className="text-micro text-muted">
                    {EDGE[l.kind].name}
                    {l.label ? ` · ${l.label}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {c.docsUrl ? (
        <a
          href={c.docsUrl}
          target="_blank"
          rel="noreferrer"
          className="text-caption text-agent-fg flex items-center gap-1.5 hover:underline"
        >
          <ExternalLink className="size-3.5" aria-hidden /> {c.product} documentation{" "}
          <ArrowRight className="size-3" aria-hidden />
        </a>
      ) : null}

      {c.choice ? (
        <Choice key={`${arch.id}-${arch.revision}-${c.choice}`} arch={arch} field={c.choice} />
      ) : null}
    </div>
  );
}
