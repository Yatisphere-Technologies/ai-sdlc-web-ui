import type { Milestone, ProjectPlan, WorkStatus } from "@throughline/contracts";
import { GATE_LABEL } from "@throughline/contracts";
import { Badge, Card, cn, Eyebrow, type Tone, Tooltip } from "@throughline/ui";
import { CalendarClock, Diamond } from "lucide-react";
import { useMemo } from "react";
import { ArtifactRefLink, RefChip } from "./parts";
import { dependencies, fmtDate, slipDays, timeline } from "./plan";

const STATUS_TONE: Record<WorkStatus, Tone> = {
  done: "ok",
  "in-progress": "agent",
  upcoming: "neutral",
  late: "risk",
  blocked: "risk",
};
const STATUS_LABEL: Record<WorkStatus, string> = {
  done: "Done",
  "in-progress": "In progress",
  upcoming: "Upcoming",
  late: "Late",
  blocked: "Blocked",
};
const BAR: Record<WorkStatus, string> = {
  done: "bg-ok-soft border-ok",
  "in-progress": "bg-agent-soft border-agent",
  upcoming: "bg-surface-raised border-line-strong",
  late: "bg-risk-soft border-risk",
  blocked: "bg-risk-soft border-risk",
};
const FILL: Record<WorkStatus, string> = {
  done: "bg-ok",
  "in-progress": "bg-agent",
  upcoming: "bg-ghost",
  late: "bg-risk",
  blocked: "bg-risk",
};
const DIAMOND: Record<WorkStatus, string> = {
  done: "text-ok fill-ok",
  "in-progress": "text-agent fill-agent",
  upcoming: "text-muted",
  late: "text-risk fill-risk",
  blocked: "text-risk fill-risk",
};

const pos = (left: number) => ({ left: `${left}%` });

/** A Gantt-style view: workstreams as bars, milestones as diamonds, today and the baseline end marked. */
export function PlanView({
  plan,
  today,
  projectKey,
}: {
  plan: ProjectPlan;
  today: string;
  projectKey: string;
}) {
  const tl = useMemo(() => timeline(plan, today), [plan, today]);
  const slip = slipDays(plan);
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <div className="flex flex-col gap-0.5">
          <Eyebrow>Plan · v{plan.version}</Eyebrow>
          <span className="text-body-sm text-subtle">Updated {fmtDate(plan.updatedAt.slice(0, 10))}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-caption text-muted">Baseline end</span>
          <span className="text-body text-foreground font-mono">{fmtDate(plan.baselineEnd)}</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="text-caption text-muted">Forecast end</span>
          <span className={cn("text-body font-mono", slip ? "text-gate" : "text-ok")}>
            {fmtDate(plan.forecastEnd)}
          </span>
        </div>
        {slip ? (
          <Badge tone="gate">
            <CalendarClock className="size-3" aria-hidden /> {slip} days behind baseline
          </Badge>
        ) : (
          <Badge tone="ok">On baseline</Badge>
        )}
        <span className="text-caption text-muted ml-auto">
          {plan.milestones.filter((m) => m.status === "done").length} of {plan.milestones.length} milestones
          done
        </span>
      </Card>

      <Card padding="none" className="overflow-x-auto">
        <div className="min-w-4xl">
          <div className="border-line grid grid-cols-[16rem_minmax(0,1fr)] border-b">
            <span className="eyebrow text-muted px-4 py-2.5">Workstream</span>
            <div className="relative h-9">
              {tl.months.map((m) => (
                <span
                  key={`${m.label}-${m.left}`}
                  className="text-micro text-faint absolute top-2.5 font-mono"
                  style={pos(m.left)}
                >
                  <span className="pl-1.5">{m.label}</span>
                </span>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 right-0 left-64" aria-hidden>
              {tl.months.map((m) => (
                <span key={`g-${m.left}`} className="bg-line absolute inset-y-0 w-px" style={pos(m.left)} />
              ))}
              <span className="bg-agent absolute inset-y-0 w-0.5" style={pos(tl.at(today))} />
              <span
                className="border-gate absolute inset-y-0 w-0 border-l border-dashed"
                style={pos(tl.at(plan.baselineEnd))}
              />
            </div>
            {plan.workstreams.map((w) => {
              const left = tl.at(w.start);
              const width = Math.max(1.5, tl.at(w.end) - left);
              return (
                <div
                  key={w.id}
                  className="border-surface-raised grid grid-cols-[16rem_minmax(0,1fr)] items-center border-b"
                >
                  <div className="flex min-w-0 flex-col gap-0.5 px-4 py-2.5">
                    <span className="text-body-sm text-foreground truncate font-medium">{w.name}</span>
                    <span className="text-caption text-muted truncate">
                      {w.owner} · {STATUS_LABEL[w.status]}
                    </span>
                  </div>
                  <div className="relative h-12">
                    <Tooltip
                      content={`${w.name}: ${fmtDate(w.start)} – ${fmtDate(w.end)} · ${w.progress}% · ${STATUS_LABEL[w.status]}`}
                    >
                      <div
                        className={cn("absolute top-3 h-6 overflow-hidden rounded-md border", BAR[w.status])}
                        style={{ left: `${left}%`, width: `${width}%` }}
                      >
                        <div
                          className={cn("h-full opacity-40", FILL[w.status])}
                          style={{ width: `${w.progress}%` }}
                        />
                      </div>
                    </Tooltip>
                  </div>
                </div>
              );
            })}
            <div className="grid grid-cols-[16rem_minmax(0,1fr)] items-center">
              <span className="text-body-sm text-foreground px-4 py-3 font-medium">Milestones</span>
              <div className="relative h-12">
                {plan.milestones.map((m) => (
                  <Tooltip
                    key={m.id}
                    content={`${m.id} · ${m.title} · ${fmtDate(m.due)} · ${STATUS_LABEL[m.status]}`}
                  >
                    <span className="absolute top-3 -translate-x-1/2" style={pos(tl.at(m.due))}>
                      <Diamond
                        className={cn("size-5", DIAMOND[m.status])}
                        aria-label={`${m.id} ${m.title}`}
                      />
                    </span>
                  </Tooltip>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="border-line text-caption text-muted flex flex-wrap gap-4 border-t px-4 py-2.5">
          <span className="flex items-center gap-1.5">
            <span className="bg-agent h-3 w-0.5" /> Today
          </span>
          <span className="flex items-center gap-1.5">
            <span className="border-gate h-3 w-0 border-l border-dashed" /> Baseline end
          </span>
          <span>Bar fill = progress</span>
        </div>
      </Card>

      <Card padding="none" className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-line border-b">
              {["Milestone", "Due", "Status", "Gate", "Owner", "Depends on", "Evidence"].map((h) => (
                <th key={h} scope="col" className="eyebrow text-muted px-4 py-3 font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {plan.milestones.map((m) => (
              <MilestoneRow key={m.id} m={m} projectKey={projectKey} />
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function MilestoneRow({ m, projectKey }: { m: Milestone; projectKey: string }) {
  const deps = dependencies(m);
  return (
    <tr className="border-surface-raised border-b align-top">
      <td className="px-4 py-3">
        <span className="text-micro text-faint mr-2 font-mono">{m.id}</span>
        <span className="text-body-sm text-foreground">{m.title}</span>
      </td>
      <td className="text-caption text-subtle px-4 py-3 font-mono whitespace-nowrap">{fmtDate(m.due)}</td>
      <td className="px-4 py-3">
        <Badge tone={STATUS_TONE[m.status]}>{STATUS_LABEL[m.status]}</Badge>
      </td>
      <td className="text-caption text-subtle px-4 py-3">{m.gate ? GATE_LABEL[m.gate] : "—"}</td>
      <td className="text-caption text-subtle px-4 py-3">{m.owner}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          {deps.local.map((d) => (
            <Badge key={d} mono>
              {projectKey}:{d}
            </Badge>
          ))}
          {deps.external.map((d) => (
            <Tooltip
              key={`${d.project}:${d.milestone}`}
              content={`Milestone ${d.milestone} in project ${d.project}`}
            >
              <span>
                <Badge tone="ion" mono>
                  <ArtifactRefLink refTo={{ type: "plan", id: `plan-${d.project.toLowerCase()}` }}>
                    {d.project}:{d.milestone}
                  </ArtifactRefLink>
                </Badge>
              </span>
            </Tooltip>
          ))}
          {m.dependsOn.length === 0 ? <span className="text-caption text-faint">—</span> : null}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          {m.refs.map((r) => (
            <RefChip key={`${r.type}-${r.id}`} refTo={r} />
          ))}
        </div>
      </td>
    </tr>
  );
}
