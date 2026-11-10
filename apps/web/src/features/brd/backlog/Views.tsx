import {
  type BacklogItem,
  type Brd,
  DEFINITION_OF_DONE,
  DEFINITION_OF_READY,
  MOSCOW_LABEL,
  SPRINT_CAPACITY,
  storyChecks,
} from "@throughline/contracts";
import { Badge, cn, Progress } from "@throughline/ui";
import { CircleCheck, Link2, TriangleAlert } from "lucide-react";
import { type Index, sprintPlan } from "./meta";
import { KindBadge, PRIORITY, TraceChip } from "./parts";

function StoryCard({ s, ix, onSelect }: { s: BacklogItem; ix: Index; onSelect: (id: string) => void }) {
  const issues = storyChecks(s).length;
  const feature = s.parentId ? ix.byId.get(s.parentId) : undefined;
  return (
    <button
      type="button"
      onClick={() => onSelect(s.id)}
      className="border-line bg-surface hover:border-agent-line flex w-full cursor-pointer flex-col gap-1.5 rounded-md border p-2.5 text-left"
    >
      <span className="flex items-center gap-1.5">
        <span className="text-micro text-faint font-mono">{s.id}</span>
        <KindBadge kind={s.kind} />
        <span className="text-micro text-subtle ml-auto font-mono">{s.points ?? "–"}pt</span>
      </span>
      <span className="text-body-sm text-foreground line-clamp-2">{s.title}</span>
      <span className="text-caption text-muted flex items-center gap-1.5">
        <span className="min-w-0 truncate">{feature?.title}</span>
        {s.dependsOn.length ? (
          <span className="flex shrink-0 items-center gap-0.5" title={`Needs ${s.dependsOn.join(", ")}`}>
            <Link2 className="size-3" aria-hidden />
            {s.dependsOn.join(", ")}
          </span>
        ) : null}
        {issues ? <TriangleAlert className="text-gate size-3 shrink-0" aria-label="Not ready" /> : null}
      </span>
    </button>
  );
}

/** Suggested sprints as columns, grouped by release, with load against capacity. */
export function SprintPlan({
  items,
  ix,
  onSelect,
}: {
  items: BacklogItem[];
  ix: Index;
  onSelect: (id: string) => void;
}) {
  const plan = sprintPlan(items);
  return (
    <div className="flex h-full min-h-0 gap-3 overflow-x-auto p-4">
      {plan.map((sp, n) => {
        const releaseStart = n === 0 || plan[n - 1]?.release !== sp.release;
        return (
          <section
            key={sp.name}
            aria-label={sp.name}
            className={cn(
              "bg-surface-raised flex w-72 shrink-0 flex-col rounded-lg",
              releaseStart && n > 0 && "border-line-strong ml-3 border-l-2 pl-0",
            )}
          >
            <header className="flex flex-col gap-1.5 px-3 pt-3 pb-2">
              <span className="flex items-center gap-2">
                <span className="text-body-sm text-strong font-semibold">{sp.name}</span>
                <Badge tone={sp.release === "MVP" ? "agent" : "neutral"} mono>
                  {sp.release}
                </Badge>
                <span className="text-micro text-muted ml-auto font-mono">
                  {sp.points}/{SPRINT_CAPACITY}
                </span>
              </span>
              <Progress
                value={(sp.points / SPRINT_CAPACITY) * 100}
                tone={sp.points > SPRINT_CAPACITY ? "risk" : "agent"}
                label={`${sp.name} load`}
              />
            </header>
            <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3">
              {sp.stories.map((s) => (
                <li key={s.id}>
                  <StoryCard s={s} ix={ix} onSelect={onSelect} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** Every BRD item and what delivers it: requirements, rules, NFRs, objectives and open questions. */
export function Traceability({
  brd,
  items,
  ix,
  onSelect,
}: {
  brd: Brd;
  items: BacklogItem[];
  ix: Index;
  onSelect: (id: string) => void;
}) {
  const c = brd.content;
  const stories = items.filter((i) => i.type === "story");
  const parentTraces = (s: BacklogItem) => (s.parentId ? (ix.byId.get(s.parentId)?.traces ?? []) : []);
  const by = (id: string) =>
    stories.filter(
      (s) =>
        s.traces.includes(id) || s.rules.includes(id) || s.nfrs.includes(id) || parentTraces(s).includes(id),
    );
  const groups: { title: string; rows: { id: string; text: string; tag?: string; excluded?: boolean }[] }[] =
    [
      {
        title: "Business requirements",
        rows: c.requirements.map((r) => ({
          id: r.id,
          text: r.title,
          tag: MOSCOW_LABEL[r.priority],
          excluded: r.priority === "wont",
        })),
      },
      {
        title: "Objectives",
        rows: c.objectives.map((o) => ({ id: o.id, text: `${o.statement} · ${o.target}` })),
      },
      { title: "Business rules", rows: c.rules.map((r) => ({ id: r.id, text: r.statement })) },
      {
        title: "Non-functional",
        rows: c.nfrs.map((n) => ({ id: n.id, text: `${n.statement} · ${n.target}`, tag: n.category })),
      },
      {
        title: "Open questions",
        rows: c.openQuestions.map((q) => ({
          id: q.id,
          text: q.question,
          tag: q.status,
          excluded: q.status === "resolved",
        })),
      },
    ];
  return (
    <div className="flex flex-col gap-6 p-4">
      {groups
        .filter((g) => g.rows.length)
        .map((g) => {
          const covered = g.rows.filter((r) => !r.excluded && by(r.id).length).length;
          const total = g.rows.filter((r) => !r.excluded).length;
          return (
            <section key={g.title} className="flex flex-col gap-2">
              <h3 className="text-body text-strong flex items-center gap-2 font-semibold">
                {g.title}
                <span className={cn("text-micro font-mono", covered === total ? "text-ok" : "text-gate-fg")}>
                  {covered}/{total} covered
                </span>
              </h3>
              <div className="border-line overflow-x-auto rounded-lg border">
                <table className="text-body-sm w-full border-collapse text-left">
                  <tbody>
                    {g.rows.map((r) => {
                      const s = by(r.id);
                      return (
                        <tr key={r.id} className="border-line border-t first:border-t-0">
                          <td className="w-24 px-3 py-2 align-top">
                            <TraceChip id={r.id} />
                          </td>
                          <td className="text-foreground px-3 py-2 align-top">
                            {r.text}
                            {r.tag ? <span className="text-caption text-muted"> · {r.tag}</span> : null}
                          </td>
                          <td className="px-3 py-2 align-top">
                            <span className="flex flex-wrap gap-1">
                              {s.map((x) => (
                                <button
                                  key={x.id}
                                  type="button"
                                  onClick={() => onSelect(x.id)}
                                  title={x.title}
                                  className="text-micro text-agent-fg bg-agent-wash hover:bg-agent-soft cursor-pointer rounded-xs px-1.5 py-0.5 font-mono"
                                >
                                  {x.id}
                                </button>
                              ))}
                            </span>
                          </td>
                          <td className="w-28 px-3 py-2 text-right align-top">
                            {r.excluded ? (
                              <Badge tone="neutral" mono>
                                {g.title === "Open questions" ? "Resolved" : "Excluded"}
                              </Badge>
                            ) : s.length ? (
                              <Badge tone="ok" mono>
                                {s.reduce((a, x) => a + (x.points ?? 0), 0)} pts
                              </Badge>
                            ) : (
                              <Badge tone="risk" mono>
                                Missing
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      <p className="text-caption text-muted">
        Hover a story id for its title; select it to open the details.
      </p>
    </div>
  );
}

/** The team's definition of ready and done, and which stories don't meet ready yet. */
export function Readiness({ items, onSelect }: { items: BacklogItem[]; onSelect: (id: string) => void }) {
  const stories = items.filter((i) => i.type === "story");
  const notReady = stories.map((s) => ({ s, checks: storyChecks(s) })).filter((x) => x.checks.length);
  return (
    <div className="grid gap-6 p-4 @4xl:grid-cols-2">
      <section className="flex flex-col gap-2">
        <h3 className="text-body text-strong font-semibold">Definition of ready</h3>
        <p className="text-caption text-muted">
          {stories.length - notReady.length} of {stories.length} stories meet it.
        </p>
        <ul className="flex flex-col gap-1.5">
          {DEFINITION_OF_READY.map((d) => (
            <li key={d} className="text-body-sm text-subtle flex items-start gap-2">
              <CircleCheck className="text-ok mt-0.5 size-3.5 shrink-0" aria-hidden /> {d}
            </li>
          ))}
        </ul>
        {notReady.length ? (
          <ul className="border-gate-line bg-gate-wash mt-2 flex flex-col gap-1 rounded-md border p-2">
            {notReady.map(({ s, checks }) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => onSelect(s.id)}
                  className="text-caption text-gate-fg cursor-pointer text-left hover:underline"
                >
                  {s.id} {s.title}: {checks.map((c) => c.message).join(" ")}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <section className="flex flex-col gap-2">
        <h3 className="text-body text-strong font-semibold">Definition of done</h3>
        <p className="text-caption text-muted">
          Applies to every story; stories add their own items (rules enforced, NFRs verified, data handling).
        </p>
        <ul className="flex flex-col gap-1.5">
          {DEFINITION_OF_DONE.map((d) => (
            <li key={d} className="text-body-sm text-subtle flex items-start gap-2">
              <CircleCheck className="text-agent mt-0.5 size-3.5 shrink-0" aria-hidden /> {d}
            </li>
          ))}
        </ul>
        <h3 className="text-body text-strong mt-4 font-semibold">Priority mapping</h3>
        <ul className="text-caption text-muted flex flex-col gap-1">
          {(["must", "should", "could"] as const).map((m) => (
            <li key={m} className="flex items-center gap-2">
              <span className="w-16">{MOSCOW_LABEL[m]}</span>→
              <Badge tone={PRIORITY[m === "must" ? "highest" : m === "should" ? "high" : "medium"].tone} mono>
                {PRIORITY[m === "must" ? "highest" : m === "should" ? "high" : "medium"].label}
              </Badge>
              <span>· {m === "must" ? "MVP" : m === "should" ? "Release 2" : "Release 3"}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
