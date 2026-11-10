import {
  type ArtifactLink,
  type ArtifactRef,
  type ArtifactSummary,
  type BrdContent,
  type LifecycleStep,
  type Portfolio,
  type Project,
  type ProjectOverview,
  type ProjectSummary,
  STAGES,
  type Stage,
} from "@throughline/contracts";
import type { StoredLink } from "./seed/projects";
import type { TenantSeed } from "./seed/types";

/**
 * Read models for programs and projects, built from the tenant store. The project is the root:
 * everything is found through it (work items by projectId; BRDs and architectures by projectId;
 * specs, designs, packs, builds, changes, releases and incidents through their work item).
 */

const stageIndex = (s: Stage) => STAGES.indexOf(s);

export function workItemKeys(store: TenantSeed, projectId: string): Set<string> {
  return new Set(store.workItems.items.filter((w) => w.projectId === projectId).map((w) => w.key));
}

/** The project a work item key belongs to, if any. */
export function projectOfWorkItem(store: TenantSeed, key: string): Project | undefined {
  const w = store.workItems.items.find((x) => x.key === key);
  return w ? store.projects.find((p) => p.id === w.projectId) : undefined;
}

/** The BRD content an architecture was derived from (its "derives-from" link), for traceability. */
export function sourceBrd(store: TenantSeed, architectureId: string): BrdContent | null {
  const l = store.links.find(
    (x) =>
      x.kind === "derives-from" &&
      x.from.type === "architecture" &&
      x.from.id === architectureId &&
      x.to.type === "brd",
  );
  const rec = l ? store.brds.find((r) => r.brd.id === l.to.id) : undefined;
  return rec?.brd.content ?? null;
}

const brdVersion = (store: TenantSeed, id: string) => store.brds.find((r) => r.brd.id === id)?.brd.version;

function withState(store: TenantSeed, l: StoredLink): ArtifactLink {
  const arch =
    l.to.type === "architecture"
      ? store.architectures.find((r) => r.architecture.id === l.to.id)?.architecture
      : undefined;
  const current = l.to.type === "brd" ? brdVersion(store, l.to.id) : arch ? `r${arch.revision}` : undefined;
  const stale = l.version !== null && current !== undefined && current !== l.version;
  return { ...l, state: stale ? "stale" : "current" };
}

/** Stored links plus the ones implied by the data (a backlog derives from its BRD version). */
export function allLinks(store: TenantSeed): ArtifactLink[] {
  const derived: StoredLink[] = store.brds
    .filter((r) => r.backlog.status !== "none")
    .map((r) => ({
      id: `auto-${r.backlog.id}`,
      from: { type: "backlog", id: r.backlog.id },
      to: { type: "brd", id: r.brd.id },
      kind: "derives-from",
      version: r.backlog.brdVersion,
      note: "Generated from the approved BRD",
    }));
  // A test plan derives from the BRD version and architecture revision it was generated from.
  for (const tp of store.testPlans) {
    if (tp.basis.brd)
      derived.push({
        id: `auto-${tp.id}-brd`,
        from: { type: "test-plan", id: tp.id },
        to: { type: "brd", id: tp.basis.brd.id },
        kind: "derives-from",
        version: tp.basis.brd.version,
        note: "Cases generated from the BRD's requirements, NFRs and rules",
      });
    if (tp.basis.architecture)
      derived.push({
        id: `auto-${tp.id}-arch`,
        from: { type: "test-plan", id: tp.id },
        to: { type: "architecture", id: tp.basis.architecture.id },
        kind: "derives-from",
        version: `r${tp.basis.architecture.revision}`,
        note: "Security, contract and resilience cases from the architecture",
      });
  }
  return [...store.links, ...derived].map((l) => withState(store, l));
}

function belongs(store: TenantSeed, projectId: string, ref: ArtifactRef): boolean {
  const keys = workItemKeys(store, projectId);
  const m = store.modules;
  switch (ref.type) {
    case "project":
      return ref.id === projectId;
    case "work-item":
      return keys.has(ref.id);
    case "brd":
      return store.brds.some((r) => r.brd.id === ref.id && r.brd.projectId === projectId);
    case "backlog":
      return store.brds.some((r) => r.backlog.id === ref.id && r.brd.projectId === projectId);
    case "architecture":
      return store.architectures.some(
        (r) => r.architecture.id === ref.id && r.architecture.projectId === projectId,
      );
    case "plan":
      return store.plans.some((p) => p.id === ref.id && p.projectId === projectId);
    case "spec":
      return m.specs.some((x) => x.id === ref.id && keys.has(x.workItemKey));
    case "design":
      return m.designs.some((x) => x.id === ref.id && keys.has(x.workItemKey));
    case "review":
      return m.reviews.some((x) => x.id === ref.id && keys.has(x.workItemKey));
    case "build":
      return m.build.some((x) => x.id === ref.id && keys.has(x.workItemKey));
    case "release":
      return m.releases.some((x) => x.id === ref.id && keys.has(x.workItemKey));
    case "incident":
      return m.incidents.some((x) => x.id === ref.id && keys.has(x.workItemKey));
    case "test-plan":
      return store.testPlans.some((x) => x.id === ref.id && x.projectId === projectId);
  }
}

/** Whether a reference points at something that exists in the tenant. */
export function exists(store: TenantSeed, ref: ArtifactRef): boolean {
  if (ref.type === "project") return store.projects.some((p) => p.id === ref.id);
  return store.projects.some((p) => belongs(store, p.id, ref));
}

export function artifactsFor(store: TenantSeed, projectId: string): ArtifactSummary[] {
  const keys = workItemKeys(store, projectId);
  const m = store.modules;
  const out: ArtifactSummary[] = [];
  const add = (a: ArtifactSummary) => out.push(a);
  for (const r of store.brds.filter((x) => x.brd.projectId === projectId)) {
    const b = r.brd;
    add({
      ref: { type: "brd", id: b.id },
      key: b.id,
      title: b.title,
      status: `${b.status === "approved" ? "Approved" : b.status === "in-review" ? "In review" : b.status === "changes-requested" ? "Changes requested" : "Draft"} · v${b.version}`,
      tone:
        b.status === "approved"
          ? "ok"
          : b.status === "in-review"
            ? "gate"
            : b.status === "changes-requested"
              ? "risk"
              : "agent",
      workItemKey: b.workItemKey,
      updatedAt: b.updatedAt,
    });
    const bl = r.backlog;
    if (bl.status !== "none") {
      const stale = bl.brdVersion !== b.version;
      add({
        ref: { type: "backlog", id: bl.id },
        key: `Backlog · ${b.id}`,
        title: `${bl.items.length} items from ${b.id} v${bl.brdVersion}`,
        status: stale ? "Out of date" : bl.pushedAt ? `Pushed to ${bl.project}` : "Generated, not pushed",
        tone: stale ? "risk" : bl.pushedAt ? "ok" : "gate",
        workItemKey: b.workItemKey,
        updatedAt: bl.pushedAt ?? bl.generatedAt,
      });
    }
  }
  for (const r of store.architectures.filter((x) => x.architecture.projectId === projectId)) {
    const a = r.architecture;
    add({
      ref: { type: "architecture", id: a.id },
      key: a.id,
      title: a.title,
      status:
        a.status === "ready"
          ? `Ready · revision ${a.revision}`
          : a.status === "stale"
            ? "Out of date"
            : a.status === "generating"
              ? "Generating"
              : "Brief",
      tone: a.status === "ready" ? "ok" : a.status === "stale" ? "risk" : "agent",
      workItemKey: a.workItemKey,
      updatedAt: a.generatedAt,
    });
  }
  for (const tp of store.testPlans.filter((x) => x.projectId === projectId))
    add({
      ref: { type: "test-plan", id: tp.id },
      key: tp.id.toUpperCase(),
      title: `${tp.cases.length} test cases · v${tp.version}`,
      status:
        tp.status === "approved"
          ? `Approved${tp.coverage.passRate !== null ? ` · ${tp.coverage.passRate}% passing` : ""}`
          : tp.status === "in-review"
            ? "In review"
            : tp.status === "stale"
              ? "Out of date"
              : "Draft",
      tone:
        tp.status === "approved"
          ? "ok"
          : tp.status === "in-review"
            ? "gate"
            : tp.status === "stale"
              ? "risk"
              : "agent",
      workItemKey: null,
      updatedAt: tp.runs[0]?.at ?? tp.generatedAt,
    });
  const plan = store.plans.find((p) => p.projectId === projectId);
  if (plan)
    add({
      ref: { type: "plan", id: plan.id },
      key: plan.id.toUpperCase(),
      title: `Project plan v${plan.version}`,
      status: plan.forecastEnd > plan.baselineEnd ? "Forecast behind baseline" : "On baseline",
      tone: plan.forecastEnd > plan.baselineEnd ? "gate" : "ok",
      workItemKey: null,
      updatedAt: plan.updatedAt,
    });
  for (const x of m.specs.filter((s) => keys.has(s.workItemKey)))
    add({
      ref: { type: "spec", id: x.id },
      key: x.id,
      title: x.title,
      status: x.status === "approved" ? "Approved" : x.status === "in-review" ? "In review" : "Drafting",
      tone: x.status === "approved" ? "ok" : x.status === "in-review" ? "gate" : "agent",
      workItemKey: x.workItemKey,
      updatedAt: null,
    });
  for (const x of m.designs.filter((d) => keys.has(d.workItemKey)))
    add({
      ref: { type: "design", id: x.id },
      key: x.id,
      title: x.title,
      status: x.status === "decided" ? "Decided" : "Comparing options",
      tone: x.status === "decided" ? "ok" : "agent",
      workItemKey: x.workItemKey,
      updatedAt: null,
    });
  for (const x of m.reviews.filter((r) => keys.has(r.workItemKey)))
    add({
      ref: { type: "review", id: x.id },
      key: x.id,
      title: x.title,
      status:
        x.status === "signed-off"
          ? "Signed off"
          : x.status === "in-review"
            ? "In review"
            : x.status === "generating"
              ? "Generating"
              : "Not started",
      tone: x.status === "signed-off" ? "ok" : x.status === "in-review" ? "gate" : "neutral",
      workItemKey: x.workItemKey,
      updatedAt: null,
    });
  for (const x of m.build.filter((l) => keys.has(l.workItemKey)))
    add({
      ref: { type: "build", id: x.id },
      key: x.agent,
      title: x.task,
      status: ["Planning", "Coding", "Testing", "Self-review", "PR open"][x.step] ?? "Working",
      tone: "agent",
      workItemKey: x.workItemKey,
      updatedAt: null,
    });
  for (const x of m.releases.filter((r) => keys.has(r.workItemKey)))
    add({
      ref: { type: "release", id: x.id },
      key: x.name,
      title: x.service,
      status:
        x.status === "complete" ? "Complete" : x.status === "rolled-back" ? "Rolled back" : "Rolling out",
      tone: x.status === "complete" ? "ok" : x.status === "rolled-back" ? "risk" : "agent",
      workItemKey: x.workItemKey,
      updatedAt: null,
    });
  for (const x of m.incidents.filter((i) => keys.has(i.workItemKey)))
    add({
      ref: { type: "incident", id: x.id },
      key: x.id,
      title: x.title,
      status: x.status === "open" ? `Open · ${x.severity}` : "Resolved",
      tone: x.status === "open" ? "risk" : "ok",
      workItemKey: x.workItemKey,
      updatedAt: null,
    });
  return out;
}

function lifecycle(store: TenantSeed, project: Project, links: ArtifactLink[]): LifecycleStep[] {
  const brds = store.brds.filter((r) => r.brd.projectId === project.id);
  const archs = store.architectures.filter((r) => r.architecture.projectId === project.id);
  const work = store.workItems.items.filter((w) => w.projectId === project.id);
  const keys = new Set(work.map((w) => w.key));
  const openG2 = store.controlRoom.decisions.some(
    (d) => d.gate === "g2" && d.status === "open" && keys.has(d.workItemKey),
  );
  const plan = store.plans.find((p) => p.projectId === project.id);
  const furthest = Math.max(-1, ...work.map((w) => stageIndex(w.stage)));
  const at = (s: Stage) => work.filter((w) => w.stage === s);
  const m = store.modules;
  const steps: LifecycleStep[] = [];

  const brdRefs = brds.map((r) => ({ type: "brd" as const, id: r.brd.id }));
  if (brds.length === 0) steps.push({ stage: "brd", state: "not-started", note: "No BRD yet", refs: [] });
  else if (brds.every((r) => r.brd.status === "approved"))
    steps.push({
      stage: "brd",
      state: "done",
      note: brds.map((r) => `${r.brd.id} v${r.brd.version} approved`).join(" · "),
      refs: brdRefs,
    });
  else {
    const review = brds.find((r) => r.brd.status === "in-review");
    steps.push(
      review
        ? {
            stage: "brd",
            state: "waiting",
            note: `${review.brd.id} v${review.brd.version} waiting for sign-off`,
            refs: brdRefs,
          }
        : { stage: "brd", state: "active", note: "BRD being drafted", refs: brdRefs },
    );
  }

  const archRefs = archs.map((r) => ({ type: "architecture" as const, id: r.architecture.id }));
  const staleArch = archs.some(
    (r) =>
      r.architecture.status === "stale" ||
      links.some((l) => l.from.id === r.architecture.id && l.kind === "derives-from" && l.state === "stale"),
  );
  const draftSource = links.find(
    (l) =>
      l.from.type === "architecture" &&
      archRefs.some((a) => a.id === l.from.id) &&
      l.to.type === "brd" &&
      store.brds.find((r) => r.brd.id === l.to.id)?.brd.status !== "approved",
  );
  if (archs.length === 0)
    steps.push({ stage: "architecture", state: "not-started", note: "No architecture yet", refs: [] });
  else if (staleArch)
    steps.push({
      stage: "architecture",
      state: "stale",
      note: "The BRD changed after the architecture was generated",
      refs: archRefs,
    });
  else if (archs.some((r) => r.architecture.status !== "ready"))
    steps.push({
      stage: "architecture",
      state: "active",
      note: "Brief being confirmed or diagrams being drawn",
      refs: archRefs,
    });
  else
    steps.push({
      stage: "architecture",
      state: openG2 ? "waiting" : "done",
      note: `${openG2 ? "Waiting for G2" : "Ready"}${draftSource ? ` · built on draft ${draftSource.to.id} v${draftSource.version}` : ""}`,
      refs: archRefs,
    });

  if (!plan) steps.push({ stage: "plan", state: "not-started", note: "No plan yet", refs: [] });
  else {
    const late = plan.milestones.filter((x) => x.status === "late").length;
    const slip = plan.forecastEnd > plan.baselineEnd;
    steps.push({
      stage: "plan",
      state: late > 0 || slip ? "waiting" : "done",
      note: `v${plan.version} · ends ${plan.forecastEnd}${slip ? ` (baseline ${plan.baselineEnd})` : ""}${late ? ` · ${late} late milestone${late > 1 ? "s" : ""}` : ""}`,
      refs: [{ type: "plan", id: plan.id }],
    });
  }

  const backlogs = brds.filter((r) => r.backlog.status !== "none");
  const blRefs = backlogs.map((r) => ({ type: "backlog" as const, id: r.backlog.id }));
  if (backlogs.length === 0)
    steps.push({
      stage: "backlog",
      state: "not-started",
      note: brds.length ? "Generated once the BRD is approved" : "No BRD yet",
      refs: [],
    });
  else if (backlogs.some((r) => r.backlog.brdVersion !== r.brd.version))
    steps.push({
      stage: "backlog",
      state: "stale",
      note: "BRD changed since the backlog was generated",
      refs: blRefs,
    });
  else if (backlogs.every((r) => r.backlog.pushedAt))
    steps.push({
      stage: "backlog",
      state: "done",
      note: `Pushed to ${backlogs[0]?.backlog.project}`,
      refs: blRefs,
    });
  else
    steps.push({
      stage: "backlog",
      state: "active",
      note: `${backlogs.reduce((a, r) => a + r.backlog.items.length, 0)} items generated, not pushed`,
      refs: blRefs,
    });

  const tp = store.testPlans.find((x) => x.projectId === project.id);
  if (!tp) steps.push({ stage: "test", state: "not-started", note: "No test plan yet", refs: [] });
  else {
    const ref = [{ type: "test-plan" as const, id: tp.id }];
    const c = tp.coverage;
    const run = c.executed > 0 ? ` · ${c.executed}% run, ${c.passRate ?? 0}% passing` : "";
    steps.push(
      tp.status === "stale"
        ? { stage: "test", state: "stale", note: "Its BRD or architecture changed; regenerate", refs: ref }
        : tp.status === "approved"
          ? {
              stage: "test",
              state: c.passRate !== null && c.passRate < 95 ? "waiting" : "done",
              note: `${tp.cases.length} cases approved${run}`,
              refs: ref,
            }
          : tp.status === "in-review"
            ? {
                stage: "test",
                state: "waiting",
                note: `${tp.cases.length} cases waiting for sign-off`,
                refs: ref,
              }
            : { stage: "test", state: "active", note: `${tp.cases.length} cases drafted`, refs: ref },
    );
  }

  const lanes = m.build
    .filter((l) => keys.has(l.workItemKey))
    .map((l) => ({ type: "build" as const, id: l.id }));
  const build = at("build").length + at("verify").length;
  steps.push(
    furthest > stageIndex("verify")
      ? { stage: "build", state: "done", note: "Built and verified", refs: lanes }
      : build > 0
        ? {
            stage: "build",
            state: "active",
            note: `${build} work item${build > 1 ? "s" : ""} in build or verify`,
            refs: lanes,
          }
        : { stage: "build", state: "not-started", note: "Not started", refs: [] },
  );
  const rel = m.releases
    .filter((r) => keys.has(r.workItemKey))
    .map((r) => ({ type: "release" as const, id: r.id }));
  steps.push(
    at("release").length > 0 || rel.length > 0
      ? { stage: "release", state: "active", note: "Rolling out", refs: rel }
      : furthest > stageIndex("release")
        ? { stage: "release", state: "done", note: "Released", refs: rel }
        : { stage: "release", state: "not-started", note: "Not started", refs: [] },
  );
  const inc = m.incidents.filter((i) => keys.has(i.workItemKey));
  steps.push(
    at("operate").length + at("learn").length > 0 || inc.length > 0
      ? {
          stage: "operate",
          state: inc.some((i) => i.status === "open") ? "waiting" : "active",
          note: inc.some((i) => i.status === "open")
            ? `${inc.filter((i) => i.status === "open").length} open incident`
            : "In service",
          refs: inc.map((i) => ({ type: "incident" as const, id: i.id })),
        }
      : { stage: "operate", state: "not-started", note: "Not in service yet", refs: [] },
  );
  return steps;
}

export function projectSummary(store: TenantSeed, project: Project, links = allLinks(store)): ProjectSummary {
  const keys = workItemKeys(store, project.id);
  const plan = store.plans.find((p) => p.projectId === project.id);
  const progress = plan?.workstreams.length
    ? Math.round(plan.workstreams.reduce((a, w) => a + w.progress, 0) / plan.workstreams.length)
    : 0;
  const mine = links.filter((l) => belongs(store, project.id, l.from));
  return {
    ...project,
    progress,
    counts: {
      workItems: keys.size,
      artifacts: artifactsFor(store, project.id).length,
      openGates: store.controlRoom.decisions.filter((d) => d.status === "open" && keys.has(d.workItemKey))
        .length,
      staleLinks: mine.filter((l) => l.state === "stale").length,
    },
    dependsOn: links
      .filter(
        (l) =>
          l.kind === "depends-on" &&
          l.from.type === "project" &&
          l.from.id === project.id &&
          l.to.type === "project",
      )
      .map((l) => store.projects.find((p) => p.id === l.to.id)?.key)
      .filter((k): k is string => Boolean(k)),
  };
}

export function portfolio(store: TenantSeed): Portfolio {
  const links = allLinks(store);
  return { programs: store.programs, projects: store.projects.map((p) => projectSummary(store, p, links)) };
}

export function overview(store: TenantSeed, key: string): ProjectOverview | null {
  const project = store.projects.find((p) => p.key === key);
  const program = project && store.programs.find((p) => p.id === project.programId);
  if (!project || !program) return null;
  const links = allLinks(store);
  const keys = workItemKeys(store, project.id);
  const mine = links.filter((l) => belongs(store, project.id, l.from) || belongs(store, project.id, l.to));
  const related = links
    .filter(
      (l) =>
        l.from.type === "project" &&
        l.to.type === "project" &&
        (l.from.id === project.id || l.to.id === project.id),
    )
    .map((l) => {
      const out = l.from.id === project.id;
      const other = store.projects.find((p) => p.id === (out ? l.to.id : l.from.id));
      return other
        ? {
            key: other.key,
            name: other.name,
            direction: out ? ("depends-on" as const) : ("used-by" as const),
            note: l.note,
          }
        : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  const work = store.workItems.items.filter((w) => w.projectId === project.id);
  return {
    project: projectSummary(store, project, links),
    program,
    workItems: work,
    artifacts: artifactsFor(store, project.id),
    links: mine,
    lifecycle: lifecycle(store, project, links),
    plan: store.plans.find((p) => p.projectId === project.id) ?? null,
    gates: store.controlRoom.decisions.filter((d) => keys.has(d.workItemKey)),
    related,
    stages: STAGES.map((stage) => ({ stage, count: work.filter((w) => w.stage === stage).length })).filter(
      (s) => s.count > 0,
    ),
  };
}

/** Problems that would leave something orphaned or pointing nowhere. Empty for a healthy tenant. */
export function integrityProblems(store: TenantSeed): string[] {
  const out: string[] = [];
  const projectIds = new Set(store.projects.map((p) => p.id));
  const workKeys = new Map(store.workItems.items.map((w) => [w.key, w.projectId]));
  for (const p of store.projects)
    if (!store.programs.some((g) => g.id === p.programId)) out.push(`project ${p.key} has no program`);
  for (const w of store.workItems.items)
    if (!projectIds.has(w.projectId)) out.push(`work item ${w.key} has no project`);
  for (const r of store.brds) {
    if (!projectIds.has(r.brd.projectId)) out.push(`${r.brd.id} has no project`);
    if (workKeys.get(r.brd.workItemKey) !== r.brd.projectId)
      out.push(`${r.brd.id} work item is not in its project`);
  }
  for (const r of store.architectures) {
    const a = r.architecture;
    if (!projectIds.has(a.projectId)) out.push(`${a.id} has no project`);
    if (workKeys.get(a.workItemKey) !== a.projectId) out.push(`${a.id} work item is not in its project`);
  }
  for (const p of store.plans) if (!projectIds.has(p.projectId)) out.push(`${p.id} has no project`);
  for (const p of store.projects)
    if (!store.plans.some((x) => x.projectId === p.id)) out.push(`project ${p.key} has no plan`);
  for (const p of store.projects)
    if (!store.testPlans.some((x) => x.projectId === p.id)) out.push(`project ${p.key} has no test plan`);
  for (const tp of store.testPlans) {
    if (!projectIds.has(tp.projectId)) out.push(`${tp.id} has no project`);
    const brd = tp.basis.brd ? store.brds.find((r) => r.brd.id === tp.basis.brd?.id)?.brd : undefined;
    const known = new Set([
      ...(brd?.content.requirements.map((r) => r.id) ?? []),
      ...(brd?.content.nfrs.map((r) => r.id) ?? []),
      ...(brd?.content.rules.map((r) => r.id) ?? []),
      ...(brd?.content.objectives.map((r) => r.id) ?? []),
    ]);
    for (const c of tp.cases)
      for (const t of c.traces) {
        if (["requirement", "nfr", "rule", "objective"].includes(t.kind) && !known.has(t.id))
          out.push(`${tp.id} ${c.id} traces to unknown ${t.id}`);
        if (t.kind === "work-item" && workKeys.get(t.id) !== tp.projectId)
          out.push(`${tp.id} ${c.id} traces to work item ${t.id} outside the project`);
      }
  }
  const m = store.modules;
  for (const x of [
    ...m.specs,
    ...m.designs,
    ...m.reviews,
    ...m.build,
    ...m.verify,
    ...m.releases,
    ...m.incidents,
  ])
    if (!workKeys.has(x.workItemKey)) out.push(`${x.id} points at unknown work item ${x.workItemKey}`);
  for (const d of store.controlRoom.decisions)
    if (!workKeys.has(d.workItemKey))
      out.push(`decision ${d.id} points at unknown work item ${d.workItemKey}`);
  for (const l of store.links) {
    if (!exists(store, l.from)) out.push(`link ${l.id} from ${l.from.type} ${l.from.id} points nowhere`);
    if (!exists(store, l.to)) out.push(`link ${l.id} to ${l.to.type} ${l.to.id} points nowhere`);
  }
  for (const p of store.plans)
    for (const x of [...p.milestones.flatMap((ms) => ms.refs), ...p.workstreams.flatMap((w) => w.refs)])
      if (!exists(store, x)) out.push(`${p.id} refers to missing ${x.type} ${x.id}`);
  for (const p of store.plans)
    for (const ms of p.milestones)
      for (const dep of ms.dependsOn) {
        const [k, id] = dep.includes(":") ? dep.split(":") : [undefined, dep];
        const target = k
          ? store.plans.find((x) => store.projects.find((pr) => pr.key === k)?.id === x.projectId)
          : p;
        if (!target?.milestones.some((x) => x.id === id))
          out.push(`${p.id} ${ms.id} depends on missing ${dep}`);
      }
  return out;
}
