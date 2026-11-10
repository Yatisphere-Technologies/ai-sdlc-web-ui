import {
  NewProgram,
  NewProject,
  Portfolio,
  type Program,
  type Project,
  ProjectOverview,
} from "@throughline/contracts";
import { delay, HttpResponse, http } from "msw";
import { getSession } from "./db";
import { apiError, guardTenant } from "./guard";
import { overview, portfolio } from "./projects";

const T = "/api/t/:tenantId";
const latency = () => (import.meta.env.MODE === "test" ? Promise.resolve() : delay(220));
const me = () => getSession().user.name;

export const projectHandlers = [
  http.get(`${T}/portfolio`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId);
    if ("error" in g) return g.error;
    return HttpResponse.json(Portfolio.parse(portfolio(g.store)));
  }),

  http.get(`${T}/projects/:projectKey`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId);
    if ("error" in g) return g.error;
    const o = overview(g.store, String(params.projectKey));
    if (!o) return apiError(404, "not_found", "No such project");
    return HttpResponse.json(ProjectOverview.parse(o));
  }),

  http.post(`${T}/programs`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId, "work.create");
    if ("error" in g) return g.error;
    const body = NewProgram.safeParse(await request.json());
    if (!body.success)
      return apiError(400, "invalid", body.error.issues[0]?.message ?? "Check the program details");
    if (g.store.programs.some((p) => p.key === body.data.key))
      return apiError(409, "conflict", `A program with key ${body.data.key} already exists`);
    const program: Program = {
      id: `pgm-${body.data.key.toLowerCase()}`,
      ...body.data,
      owner: me(),
      status: "planned",
      health: "on-track",
      budgetUsd: 0,
      outcomes: [],
    };
    g.store.programs.push(program);
    return HttpResponse.json(Portfolio.parse(portfolio(g.store)), { status: 201 });
  }),

  http.post(`${T}/projects`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId, "work.create");
    if ("error" in g) return g.error;
    const body = NewProject.safeParse(await request.json());
    if (!body.success)
      return apiError(400, "invalid", body.error.issues[0]?.message ?? "Check the project details");
    const d = body.data;
    if (!g.store.programs.some((p) => p.id === d.programId))
      return apiError(400, "invalid", "Choose a program");
    if (g.store.projects.some((p) => p.key === d.key))
      return apiError(409, "conflict", `A project with key ${d.key} already exists`);
    if (d.targetDate < d.startDate)
      return apiError(400, "invalid", "The target date is before the start date");
    const id = `prj-${d.key.toLowerCase()}`;
    const project: Project = {
      id,
      key: d.key,
      programId: d.programId,
      name: d.name,
      objective: d.objective,
      sponsor: d.sponsor,
      owner: d.owner,
      teams: d.teams,
      phase: "discovery",
      health: "on-track",
      healthNote: "Just created: add a BRD to start.",
      startDate: d.startDate,
      targetDate: d.targetDate,
      budgetUsd: d.budgetUsd,
      spentUsd: 0,
      tools: { jira: null, repo: null, cloud: null, confluence: null },
      platform: d.platform,
    };
    g.store.projects.push(project);
    // Every project starts with a plan, so it is never left without one.
    g.store.plans.push({
      id: `plan-${d.key.toLowerCase()}`,
      projectId: id,
      version: "0.1",
      baselineEnd: d.targetDate,
      forecastEnd: d.targetDate,
      workstreams: [],
      milestones: [
        {
          id: "M1",
          title: "BRD approved",
          due: d.startDate,
          status: "upcoming",
          gate: "brd",
          owner: d.owner,
          refs: [],
          dependsOn: [],
        },
        {
          id: "M2",
          title: "Go-live (G4)",
          due: d.targetDate,
          status: "upcoming",
          gate: "g4",
          owner: d.owner,
          refs: [],
          dependsOn: ["M1"],
        },
      ],
      updatedAt: new Date().toISOString(),
    });
    const o = overview(g.store, d.key);
    return HttpResponse.json(ProjectOverview.parse(o), { status: 201 });
  }),
];
