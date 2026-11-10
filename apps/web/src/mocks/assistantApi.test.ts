import { AssistantConversation, AssistantConversationList } from "@throughline/contracts";
import { createTenantApi } from "@/api/http";
import { FOREIGN_TENANT_ID, resetDb, setSignedIn } from "./db";
import { mockServer } from "./node";

const BASE = window.location.origin;
let realFetch: typeof fetch;
beforeAll(() => {
  mockServer.listen({ onUnhandledFrame: "error" });
  realFetch = globalThis.fetch;
  globalThis.fetch = (input, init) =>
    realFetch(typeof input === "string" && input.startsWith("/") ? `${BASE}${input}` : input, init);
});
beforeEach(() => setSignedIn(true));
afterEach(() => resetDb());
afterAll(() => {
  mockServer.close();
  globalThis.fetch = realFetch;
});

const acme = () => createTenantApi("t_acme7f");
const send = (text: string, extra: Record<string, unknown> = {}) =>
  acme().post("/assistant/messages", AssistantConversation, {
    conversationId: null,
    text,
    via: "text",
    context: null,
    ...extra,
  });
const last = (c: AssistantConversation) => c.messages[c.messages.length - 1];

describe("workspace assistant", () => {
  it("starts a conversation and keeps it in history", async () => {
    const c = await send("Which projects are at risk?");
    expect(c.messages.map((m) => m.role)).toEqual(["user", "assistant"]);
    expect(last(c)?.text).toMatch(/need attention/);
    expect(last(c)?.speech).toBeTruthy();
    const next = await acme().post("/assistant/messages", AssistantConversation, {
      conversationId: c.id,
      text: "What's waiting on me?",
      via: "text",
      context: null,
    });
    expect(next.messages).toHaveLength(4);
    const list = await acme().get("/assistant/conversations", AssistantConversationList);
    expect(list.items[0]?.id).toBe(c.id);
  });

  it("uses the page context for 'this project' and links to it", async () => {
    const c = await send("Summarise this project", {
      context: { label: "Project UPI", path: "/projects/UPI", projectId: "prj-upi" },
    });
    expect(last(c)?.text).toMatch(/UPI · UPI AutoPay/);
    expect(last(c)?.actions[0]).toEqual({ label: "Open UPI", to: "/projects/UPI" });
    expect(c.messages[0]?.context).toBe("Project UPI");
  });

  it("navigates on request", async () => {
    expect(last(await send("open the test plan for SUP"))?.actions[0]?.to).toBe("/testing?plan=tp-sup");
    expect(last(await send("go to the audit log"))?.actions[0]?.to).toBe("/settings/audit");
    expect(last(await send("show me BRD-40"))?.actions[0]?.to).toBe("/brd/BRD-40");
  });

  it("refuses voice where the workspace turned browser voice off", async () => {
    const nw = createTenantApi("t_nwb21c");
    expect((await nw.get("/assistant/conversations", AssistantConversationList)).voice.allowed).toBe(false);
    await expect(
      nw.post("/assistant/messages", AssistantConversation, {
        conversationId: null,
        text: "status",
        via: "voice",
        context: null,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("keeps conversations inside their workspace", async () => {
    const c = await send("hello");
    await expect(
      createTenantApi("t_nwb21c").get(`/assistant/conversations/${c.id}`, AssistantConversation),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      createTenantApi(FOREIGN_TENANT_ID).get("/assistant/conversations", AssistantConversationList),
    ).rejects.toMatchObject({ status: 404 });
  });
});
