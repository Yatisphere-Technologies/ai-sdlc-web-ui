import { ARTIFACT_LABEL, type Artifact, type ArtifactSection } from "@throughline/contracts";
import { Badge, Card, cn, Eyebrow } from "@throughline/ui";
import { ArrowRight } from "lucide-react";

const ZONE: Record<NonNullable<ArtifactSection["flow"]>[number]["zone"], string> = {
  user: "border-human-fg/40 bg-human-soft text-human-fg",
  edge: "border-ion bg-ion-soft text-ion-fg",
  app: "border-agent-line bg-agent-soft text-agent-fg",
  data: "border-gate-line bg-gate-wash text-gate-fg",
  external: "border-line-strong bg-surface-raised text-subtle",
};

const CHECK: Record<
  "pass" | "fail" | "partial" | "na",
  { label: string; tone: "ok" | "risk" | "gate" | "neutral" }
> = {
  pass: { label: "Pass", tone: "ok" },
  fail: { label: "Fail", tone: "risk" },
  partial: { label: "Partial", tone: "gate" },
  na: { label: "N/A", tone: "neutral" },
};

function Section({ section }: { section: ArtifactSection }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-display text-heading-sm text-strong">{section.heading}</h3>
      {section.flow ? (
        <ol className="flex flex-wrap items-center gap-2">
          {section.flow.map((node, i) => (
            <li key={node.name} className="flex items-center gap-2">
              <span className={cn("text-body-sm rounded-md border px-3 py-2 font-semibold", ZONE[node.zone])}>
                {node.name}
                <span className="text-nano block font-mono font-normal uppercase opacity-80">
                  {node.zone}
                </span>
              </span>
              {i < (section.flow?.length ?? 0) - 1 ? (
                <ArrowRight className="text-ghost size-4" aria-hidden />
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
      {section.body ? <p className="text-body text-subtle">{section.body}</p> : null}
      {section.table ? (
        <div className="border-line overflow-x-auto rounded-lg border">
          <table className="text-body-sm w-full border-collapse text-left">
            <thead className="bg-surface-raised">
              <tr>
                {section.table.columns.map((c) => (
                  <th key={c} scope="col" className="eyebrow text-muted px-3 py-2.5 font-normal">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.table.rows.map((row) => (
                <tr key={row.join("|")} className="border-line border-t">
                  {row
                    .map((cell, i) => ({ cell, col: section.table?.columns[i] ?? cell, first: i === 0 }))
                    .map(({ cell, col, first }) => (
                      <td
                        key={col}
                        className={cn(
                          "px-3 py-2.5 align-top",
                          first ? "text-foreground font-semibold" : "text-subtle",
                        )}
                      >
                        {cell}
                      </td>
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {section.checks ? (
        <ul className="flex flex-col gap-2">
          {section.checks.map((c) => (
            <li
              key={c.label}
              className="bg-surface-raised grid grid-cols-[4.5rem_minmax(0,1fr)] items-start gap-3 rounded-md px-3 py-2.5"
            >
              <Badge tone={CHECK[c.state].tone} mono className="justify-self-start">
                {CHECK[c.state].label}
              </Badge>
              <span className="flex flex-col gap-0.5">
                <span className="text-body-sm">{c.label}</span>
                <span className="text-caption text-muted">{c.note}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function ArtifactView({ artifact }: { artifact: Artifact }) {
  return (
    <Card padding="lg" className="animate-rise flex flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <Eyebrow className="text-agent-fg">{artifact.generatedBy}</Eyebrow>
          <h2 className="font-display text-heading-lg text-strong">{ARTIFACT_LABEL[artifact.kind]}</h2>
          <p className="text-body text-subtle max-w-2xl">{artifact.summary}</p>
        </div>
        <Badge tone={artifact.status === "approved" ? "ok" : "gate"} mono>
          {artifact.status === "approved" ? "Approved" : "Draft · in review"}
        </Badge>
      </header>
      {artifact.sections.map((s) => (
        <Section key={s.heading} section={s} />
      ))}
    </Card>
  );
}
