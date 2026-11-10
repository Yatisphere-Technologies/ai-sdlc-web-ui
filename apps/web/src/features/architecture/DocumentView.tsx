import {
  type ArchDecision,
  type ArchDocSection,
  type Architecture,
  DIAGRAM_LABEL,
  type DocTable,
} from "@throughline/contracts";
import { Badge, Card, cn, Eyebrow } from "@throughline/ui";
import { CircleCheck, CircleMinus, CirclePlus, CircleX } from "lucide-react";

function Table({ caption, table }: { caption: string; table: DocTable }) {
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="eyebrow text-muted">{caption}</figcaption>
      <div className="border-line overflow-x-auto rounded-lg border">
        <table className="text-body-sm w-full border-collapse text-left">
          <thead className="bg-surface-raised">
            <tr>
              {table.columns.map((c) => (
                <th key={c} scope="col" className="eyebrow text-muted px-3 py-2.5 font-normal">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row) => (
              <tr key={row.join("|")} className="border-line border-t">
                {row
                  .map((cell, i) => ({ cell, col: `${table.columns[i] ?? i}`, first: i === 0 }))
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
    </figure>
  );
}

const FIT = {
  chosen: { label: "Chosen", tone: "ok" as const, Icon: CircleCheck, ring: "border-ok-line bg-ok-wash" },
  viable: { label: "Viable", tone: "neutral" as const, Icon: CircleMinus, ring: "border-line bg-surface" },
  rejected: { label: "Rejected", tone: "risk" as const, Icon: CircleX, ring: "border-risk-line bg-surface" },
};

function Decision({ d }: { d: ArchDecision }) {
  return (
    <article className="border-line bg-surface-sunken flex flex-col gap-3 rounded-xl border p-4">
      <header className="flex flex-col gap-1">
        <span className="text-micro text-agent-fg font-mono">{d.id}</span>
        <h4 className="font-display text-heading-sm text-strong">{d.title}</h4>
        <p className="text-body-sm text-muted">{d.context}</p>
      </header>
      <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-4">
        {d.options.map((o) => {
          const f = FIT[o.fit];
          return (
            <div key={o.name} className={cn("flex flex-col gap-2 rounded-lg border p-3", f.ring)}>
              <div className="flex items-start justify-between gap-2">
                <span className="text-body-sm text-foreground font-semibold">{o.name}</span>
                <Badge tone={f.tone} mono>
                  {f.label}
                </Badge>
              </div>
              <ul className="flex flex-col gap-1">
                {o.pros.map((p) => (
                  <li key={p} className="text-caption text-subtle flex gap-1.5">
                    <CirclePlus className="text-ok mt-0.5 size-3.5 shrink-0" aria-label="Pro" />
                    {p}
                  </li>
                ))}
                {o.cons.map((c) => (
                  <li key={c} className="text-caption text-subtle flex gap-1.5">
                    <CircleMinus className="text-risk mt-0.5 size-3.5 shrink-0" aria-label="Con" />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="text-body-sm text-subtle">
        <span className="text-ok font-semibold">Decision: </span>
        {d.decision}
      </p>
      {d.consequences.length > 0 ? (
        <ul className="text-caption text-muted flex list-disc flex-col gap-0.5 pl-5">
          {d.consequences.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function Section({
  s,
  arch,
  onOpenDiagram,
}: {
  s: ArchDocSection;
  arch: Architecture;
  onOpenDiagram: (id: string) => void;
}) {
  const diagram = s.diagram ? arch.diagrams.find((d) => d.kind === s.diagram) : undefined;
  return (
    <section id={`doc-${s.id}`} className="flex scroll-mt-4 flex-col gap-4">
      <h3 className="font-display text-heading-md text-strong">{s.title}</h3>
      {s.intro ? <p className="text-body text-subtle max-w-3xl">{s.intro}</p> : null}
      {diagram ? (
        <button
          type="button"
          onClick={() => onOpenDiagram(diagram.id)}
          className="press border-agent-line bg-agent-wash text-body-sm text-agent-fg flex w-fit cursor-pointer items-center gap-2 rounded-lg border px-3 py-2"
        >
          See diagram: {DIAGRAM_LABEL[diagram.kind]} →
        </button>
      ) : null}
      {s.tables?.map((t) => (
        <Table key={t.caption} caption={t.caption} table={t.table} />
      ))}
      {s.decisions?.map((d) => (
        <Decision key={d.id} d={d} />
      ))}
      {s.bullets ? (
        <ul className="text-body-sm text-subtle flex max-w-3xl list-disc flex-col gap-1 pl-5">
          {s.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** The architecture document: summary, NFRs, decisions with pros/cons, network, security, DR, cost, risks. */
export function DocumentView({
  arch,
  onOpenDiagram,
}: {
  arch: Architecture;
  onOpenDiagram: (id: string) => void;
}) {
  const doc = arch.document;
  if (!doc) return null;
  return (
    <div className="grid gap-5 xl:grid-cols-[14rem_minmax(0,1fr)]">
      <nav aria-label="Document sections" className="hidden xl:sticky xl:top-4 xl:block xl:self-start">
        <ol className="flex flex-col gap-1">
          {doc.sections.map((s) => (
            <li key={s.id}>
              <a
                href={`#doc-${s.id}`}
                className="text-body-sm text-muted hover:bg-surface-raised hover:text-foreground block rounded-md px-2 py-1.5"
              >
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <Card padding="lg" className="flex flex-col gap-8">
        <header className="flex flex-col gap-1.5">
          <Eyebrow className="text-agent-fg">architect-agent · {doc.version}</Eyebrow>
          <h2 className="font-display text-heading-lg text-strong">{doc.title}</h2>
          <p className="text-caption text-muted font-mono">{doc.summary}</p>
        </header>
        {doc.sections.map((s) => (
          <Section key={s.id} s={s} arch={arch} onOpenDiagram={onOpenDiagram} />
        ))}
      </Card>
    </div>
  );
}
