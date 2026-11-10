import {
  type Action,
  ControlRoom,
  type GateDecision,
  type Integration,
  IntegrationList,
  LoginRequest,
  UpdateControl,
  WorkItemList,
} from "@throughline/contracts";
import { delay, HttpResponse, http } from "msw";
import { z } from "zod";
import { assistantHandlers } from "./assistant/handlers";
import { brdHandlers } from "./brdHandlers";
import { getSession, isSignedIn, setSignedIn } from "./db";
import { apiError, guardTenant } from "./guard";
import { moduleHandlers } from "./moduleHandlers";
import { projectHandlers } from "./projectHandlers";
import { securityHandlers } from "./security/handlers";
import { studioHandlers } from "./studioHandlers";
import { testHandlers } from "./testHandlers";

const T = "/api/t/:tenantId";
const latency = () => (import.meta.env.MODE === "test" ? Promise.resolve() : delay(250));

export const handlers = [
  http.get("/api/me", async () => {
    await latency();
    if (!isSignedIn()) return apiError(401, "unauthenticated", "Not signed in");
    return HttpResponse.json(getSession());
  }),

  http.post("/api/auth/login", async ({ request }) => {
    await delay(import.meta.env.MODE === "test" ? 0 : 700);
    const body = LoginRequest.safeParse(await request.json());
    if (!body.success) return apiError(400, "invalid", "Choose a sign-in method");
    setSignedIn(true);
    return HttpResponse.json(getSession());
  }),

  http.post("/api/auth/logout", async () => {
    await latency();
    setSignedIn(false);
    return HttpResponse.json({ ok: true });
  }),

  http.get(`${T}/control-room`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId);
    if ("error" in g) return g.error;
    return HttpResponse.json(ControlRoom.parse(g.store.controlRoom));
  }),

  http.post(`${T}/gates/:decisionId/approve`, async ({ request, params }) => {
    await latency();
    const pre = guardTenant(request, params.tenantId);
    if ("error" in pre) return pre.error;
    const d = pre.store.controlRoom.decisions.find((x) => x.id === params.decisionId);
    if (!d) return apiError(404, "not_found", "Decision not found");
    const g = guardTenant(request, params.tenantId, `gate.approve.${d.gate}` as Action);
    if ("error" in g) return g.error;
    const updated: GateDecision = { ...d, status: "approved", approvedBy: getSession().user.name };
    g.store.controlRoom.decisions = g.store.controlRoom.decisions.map((x) => (x.id === d.id ? updated : x));
    return HttpResponse.json(updated);
  }),

  http.get(`${T}/work-items`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId);
    if ("error" in g) return g.error;
    return HttpResponse.json(WorkItemList.parse(g.store.workItems));
  }),

  http.get(`${T}/integrations`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId);
    if ("error" in g) return g.error;
    return HttpResponse.json(IntegrationList.parse({ items: g.store.integrations }));
  }),

  http.post(`${T}/integrations/:integrationId/connect`, async ({ request, params }) => {
    await delay(import.meta.env.MODE === "test" ? 0 : 900);
    const g = guardTenant(request, params.tenantId, "integrations.manage");
    if ("error" in g) return g.error;
    const body = z.object({ auth: z.string() }).safeParse(await request.json());
    if (!body.success) return apiError(400, "invalid", "auth is required");
    let found: Integration | undefined;
    g.store.integrations = g.store.integrations.map((i) => {
      if (i.id !== params.integrationId) return i;
      found = { ...i, status: "connected", auth: body.data.auth };
      return found;
    });
    return found ? HttpResponse.json(found) : apiError(404, "not_found", "Integration not found");
  }),

  http.patch(`${T}/integrations/:integrationId/write-back/:optionId`, async ({ request, params }) => {
    await latency();
    const g = guardTenant(request, params.tenantId, "integrations.manage");
    if ("error" in g) return g.error;
    const body = UpdateControl.safeParse(await request.json());
    if (!body.success) return apiError(400, "invalid", "enabled must be a boolean");
    let found: Integration | undefined;
    g.store.integrations = g.store.integrations.map((i) => {
      if (i.id !== params.integrationId) return i;
      found = {
        ...i,
        writeBack: i.writeBack.map((w) =>
          w.id === params.optionId ? { ...w, enabled: body.data.enabled } : w,
        ),
      };
      return found;
    });
    return found ? HttpResponse.json(found) : apiError(404, "not_found", "Integration not found");
  }),

  ...securityHandlers,
  ...assistantHandlers,
  ...moduleHandlers,
  ...projectHandlers,
  ...testHandlers,
  ...brdHandlers,
  ...studioHandlers,
];
