import type { Milestone, ProjectPlan } from "@throughline/contracts";

const DAY = 86_400_000;
const t = (d: string) => Date.parse(`${d}T00:00:00Z`);

export type Timeline = {
  start: number;
  end: number;
  /** Position of a date on the timeline, 0–100. */
  at: (date: string) => number;
  months: { label: string; left: number }[];
};

/** Timeline that spans every workstream and milestone, padded to whole months. */
export function timeline(plan: ProjectPlan, today: string): Timeline {
  const dates = [
    ...plan.workstreams.flatMap((w) => [w.start, w.end]),
    ...plan.milestones.map((m) => m.due),
    plan.baselineEnd,
    plan.forecastEnd,
    today,
  ].map(t);
  const first = new Date(Math.min(...dates));
  const last = new Date(Math.max(...dates));
  const start = Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1);
  const end = Date.UTC(last.getUTCFullYear(), last.getUTCMonth() + 1, 1);
  const span = Math.max(end - start, DAY);
  const at = (date: string) => Math.min(100, Math.max(0, ((t(date) - start) / span) * 100));
  const months: Timeline["months"] = [];
  for (
    let d = new Date(start);
    d.getTime() < end;
    d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
  ) {
    months.push({
      label: d.toLocaleString("en-GB", {
        month: "short",
        year: d.getUTCMonth() === 0 ? "2-digit" : undefined,
        timeZone: "UTC",
      }),
      left: ((d.getTime() - start) / span) * 100,
    });
  }
  return { start, end, at, months };
}

/** Days the forecast is behind the baseline (0 when on or ahead). */
export function slipDays(plan: ProjectPlan): number {
  return Math.max(0, Math.round((t(plan.forecastEnd) - t(plan.baselineEnd)) / DAY));
}

/** A milestone's dependencies, split into this project's and other projects' ("KEY:M3"). */
export function dependencies(m: Milestone): {
  local: string[];
  external: { project: string; milestone: string }[];
} {
  const local: string[] = [];
  const external: { project: string; milestone: string }[] = [];
  for (const d of m.dependsOn) {
    const [project, milestone] = d.split(":");
    if (milestone && project) external.push({ project, milestone });
    else local.push(d);
  }
  return { local, external };
}

export const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
