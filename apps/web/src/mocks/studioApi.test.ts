import {
  BrdList,
  buildBody,
  type Capture,
  checkBrd,
  type DocNode,
  StudioState,
  stepProgress,
  textOf,
} from "@throughline/contracts";
import { createTenantApi } from "@/api/http";
import { resetDb, setSignedIn } from "./db";
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
const last = (s: StudioState) => s.thread.messages.at(-1);

/** A new BRD in "ask first" mode, so the agent's edits wait as proposals (most tests check those). */
async function create(brief?: string) {
  const s = await acme().post("/brds", StudioState, {
    title: "Merchant settlement reports",
    projectId: "prj-mrc",
  });
  const review = await acme().post(`/brds/${s.brd.id}/agent-mode`, StudioState, { autoApply: false });
  return brief ? acme().post(`/brds/${s.brd.id}/messages`, StudioState, { text: brief }) : review;
}
const say = (id: string, text: string) => acme().post(`/brds/${id}/messages`, StudioState, { text });
const acceptAll = (id: string) =>
  acme().post(`/brds/${id}/proposals/all`, StudioState, { decision: "accept" });

describe("BRD Studio conversation", () => {
  it("drafts from a brief, proposing edits instead of changing the document", async () => {
    const s = await create(
      "Merchants can't see what they were paid. Today ops emails CSVs by hand and it takes 3 days. We want to reduce settlement queries from 900 to under 150 a month. Merchants must be able to download daily settlement reports. Refund reconciliation is out of scope.",
    );
    const reply = last(s);
    expect(reply?.role).toBe("agent");
    const targets = reply?.proposals.map((p) => p.target) ?? [];
    expect(targets).toEqual(
      expect.arrayContaining(["summary", "problem", "objectives", "requirements", "outOfScope"]),
    );
    expect(s.brd.content.requirements).toHaveLength(0);

    const after = await acceptAll(s.brd.id);
    expect(after.brd.content.requirements[0]?.statement).toMatch(
      /Merchants shall be able to download daily settlement reports/,
    );
    expect(after.brd.content.objectives[0]?.target).toMatch(/under 150/);
  });

  it("interviews section by section until the BRD has no blocking checks", async () => {
    let s = await create();
    const id = s.brd.id;
    const answers: Record<string, string> = {
      summary:
        "Give merchants self-service daily settlement reports so they stop raising queries with operations.",
      problem:
        "Merchants raise 900 settlement queries a month because reports are emailed by hand and arrive 3 days late.",
      objectives: "Reduce settlement queries from 900 to under 150 a month.",
      inScope: "Daily settlement report; CSV and PDF download; report history for 13 months",
      outOfScope: "Refund reconciliation; real-time balances",
      stakeholders: "Anil Kapoor – Head of Payments (A); Suresh Rao – Payments operations (C)",
      currentState: "Ops: export settlement file\nOps: email CSV to merchant",
      requirements:
        "Merchants must be able to download a daily settlement report. Merchants should see 13 months of report history.",
      nfrs: "Report available by 08:00 IST 99.9% of days",
      risks: "Settlement file arrives late from the bank",
      successCriteria: "Use the objective targets",
    };
    for (let i = 0; i < 20 && s.thread.focus; i++) {
      const focus = s.thread.focus;
      const text = focus.startsWith("acceptance:")
        ? "Report downloads in under 5 seconds; totals match the bank file to the cent"
        : (answers[focus] ?? "skip");
      s = await say(id, text);
      s = await acceptAll(id);
    }
    expect(s.thread.focus).toBeNull();
    expect(checkBrd(s.brd.content).filter((c) => c.severity === "error")).toEqual([]);
    expect(s.brd.content.requirements.length).toBeGreaterThanOrEqual(2);
  });

  it("reads an attached note and proposes requirements that cite the passage", async () => {
    const s = await create();
    const withSource = await acme().post(`/brds/${s.brd.id}/sources`, StudioState, {
      kind: "note",
      title: "Merchant interviews",
      text: "Merchants need to reconcile payouts against their own sales.\n\nFinance must be able to see unsettled amounts by 10:00 IST every day.\n\nRisk: the bank file format changes without notice.",
    });
    expect(withSource.sources[0]?.status).toBe("ready");
    expect(last(withSource)?.text).toMatch(/S1/);
    const reply = last(await say(s.brd.id, "use S1 for requirements"));
    const reqs = reply?.proposals.filter((p) => p.target === "requirements") ?? [];
    expect(reqs.length).toBe(2);
    expect(reqs.every((p) => p.cites[0]?.startsWith("S1."))).toBe(true);
    expect(reply?.proposals.some((p) => p.target === "risks")).toBe(true);
  });

  it("keeps links it can't read, and says so honestly", async () => {
    const s = await create();
    const out = await acme().post(`/brds/${s.brd.id}/sources`, StudioState, {
      kind: "link",
      url: "https://example.com/policy",
    });
    expect(out.sources[0]?.status).toBe("linked");
    const reply = last(await say(s.brd.id, "use S1"));
    expect(reply?.text).toMatch(/can't read S1/);
  });

  it("rewrites vague requirements into measurable ones on request", async () => {
    const s = await create("Shoppers must be able to see their points quickly and in a user-friendly way.");
    await acceptAll(s.brd.id);
    const reply = last(await say(s.brd.id, "make BR-01 testable"));
    const value = reply?.proposals[0]?.value as { statement: string };
    expect(value.statement).toMatch(/within 2 seconds at p95/);
    expect(value.statement).toMatch(/no more than 3 steps/);
  });

  it("saves direct edits to every part of the document, including layout and approvers", async () => {
    const s = await create();
    const doc = {
      title: "Merchant settlement reporting",
      owner: "Priya Nair",
      workItemKey: "INT-36",
      content: { ...s.brd.content, summary: "Edited directly in the document." },
      layout: {
        order: ["requirements", ...s.brd.layout.order.filter((x) => x !== "requirements"), "custom-1"],
        titles: { requirements: "What merchants need" },
        hidden: ["glossary"],
      },
      customSections: [{ id: "custom-1", title: "Rollout notes", body: "Pilot with 20 merchants." }],
      approvals: [
        ...s.brd.approvals.map(({ id, capacity, name }) => ({ id, capacity, name })),
        { id: "ap-risk", capacity: "Risk", name: "Kavya Rao" },
      ],
    };
    const out = await acme().put(`/brds/${s.brd.id}/document`, StudioState, doc);
    expect(out.brd.title).toBe("Merchant settlement reporting");
    expect(out.brd.layout.titles.requirements).toBe("What merchants need");
    expect(out.brd.customSections[0]?.title).toBe("Rollout notes");
    expect(out.brd.approvals).toHaveLength(4);
  });

  it("locks the document and the conversation while a BRD is in review", async () => {
    await expect(say("BRD-31", "add risk: anything")).rejects.toMatchObject({ status: 409 });
    await expect(
      createTenantApi("t_fab4d0").post("/brds/BRD-12/messages", StudioState, { text: "hi" }),
    ).rejects.toMatchObject({ status: 403 });
  });
});

const step = (id: string, s: string) => acme().post(`/brds/${id}/step`, StudioState, { step: s });
const capture = (id: string, c: Capture) => acme().post(`/brds/${id}/capture`, StudioState, c);

describe("Guided BRD flow", () => {
  it("keeps the agent's questions inside the current step and remembers skips", async () => {
    const s0 = await create();
    const id = s0.brd.id;
    let s = await step(id, "process");
    expect(last(s)?.text).toMatch(/Step 4 of 8 · Today & tomorrow/);
    expect(s.thread.focus).toBe("currentState");
    s = await say(id, "Ops: export the settlement file\nOps: email the CSV to each merchant");
    expect(last(s)?.proposals.map((p) => p.target)).toEqual(["currentState", "currentState"]);
    s = await acceptAll(id);
    s = await say(id, "skip");
    expect(s.thread.skipped).toContain("painPoints");
    expect(s.thread.focus).toBe("futureState");

    // Required questions can't be skipped.
    s = await step(id, "context");
    expect(s.thread.focus).toBe("summary");
    s = await say(id, "skip");
    expect(last(s)?.text).toMatch(/needed before approval/);
    expect(s.thread.focus).toBe("summary");
  });

  it("adds structured entries straight away, then proposes refinements", async () => {
    const s0 = await create();
    const id = s0.brd.id;
    await capture(id, {
      kind: "objective",
      statement: "Cut settlement queries",
      kpi: "Settlement queries per month",
      baseline: "900",
      target: "under 150",
    });
    await step(id, "requirements");
    const s = await capture(id, {
      kind: "requirement",
      actor: "merchant",
      action: "download the daily settlement report quickly",
      benefit: "so that they stop raising queries",
      priority: "must",
      area: "Reporting",
      objective: "",
      acceptance: [],
    });
    const br = s.brd.content.requirements[0];
    expect(br).toMatchObject({
      id: "BR-01",
      statement: "Merchant shall be able to download the daily settlement report quickly.",
      rationale: "They stop raising queries",
      objective: "OBJ-1",
      priority: "must",
    });
    const user = s.thread.messages.at(-2);
    expect(user?.capture).toMatchObject({ kind: "requirement" });
    expect(user?.text).toMatch(/^Requirement · BR-01/);
    const refined = last(s)?.proposals ?? [];
    expect(refined[0]).toMatchObject({ op: "update-row", rowId: "BR-01", status: "pending" });
    expect(last(s)?.text).toMatch(/no acceptance criteria/);
    const after = await acceptAll(id);
    expect(after.brd.content.requirements[0]?.acceptance.length).toBeGreaterThan(0);
  });

  it("proposes a security requirement when restricted data is captured", async () => {
    const { brd } = await create();
    const s = await capture(brd.id, {
      kind: "data",
      entity: "Merchant bank account",
      description: "Account the settlement is paid into",
      classification: "restricted",
      retention: "8 years",
    });
    expect(last(s)?.proposals[0]?.value).toMatchObject({ category: "security" });
  });

  it("reaches sign-off readiness through structured entries alone", async () => {
    const { brd } = await create();
    const id = brd.id;
    const entries: Capture[] = [
      {
        kind: "text",
        target: "summary",
        text: "Give merchants self-service daily settlement reports so they stop raising queries with operations.",
      },
      {
        kind: "text",
        target: "problem",
        text: "Merchants raise 900 settlement queries a month because reports are emailed by hand, 3 days late.",
      },
      {
        kind: "objective",
        statement: "Cut settlement queries",
        kpi: "Queries a month",
        baseline: "900",
        target: "under 150",
      },
      { kind: "scope", inScope: true, text: "Daily settlement report download" },
      {
        kind: "stakeholder",
        name: "Anil Kapoor",
        role: "Head of Payments",
        raci: "A",
        interest: "Fewer queries",
      },
      {
        kind: "requirement",
        actor: "Merchant",
        action: "download a daily settlement report as CSV",
        benefit: "",
        priority: "must",
        area: "Reporting",
        objective: "OBJ-1",
        acceptance: ["The report for day D is available by 08:00 IST on D+1"],
      },
    ];
    let s = await create();
    for (const e of entries) s = await capture(id, e);
    const required = stepProgress(s.brd.content).flatMap((p) => p.checks.filter((c) => c.required));
    expect(required.every((c) => c.ok)).toBe(true);
    expect(checkBrd(s.brd.content).filter((c) => c.severity === "error")).toHaveLength(0);
  });

  it("treats a BRD as ready for sign-off exactly when the quality checks have no blocking errors", async () => {
    for (const t of ["t_acme7f", "t_nwb21c", "t_fab4d0"]) {
      const { items } = await createTenantApi(t).get("/brds", BrdList);
      for (const b of items) {
        const ready = stepProgress(b.content).every((p) => p.checks.every((c) => !c.required || c.ok));
        const errors = checkBrd(b.content).filter((c) => c.severity === "error").length;
        expect([b.id, ready]).toEqual([b.id, errors === 0]);
      }
    }
  });

  it("enforces permissions and locks on the guided endpoints", async () => {
    const viewer = createTenantApi("t_fab4d0");
    await expect(
      viewer.post("/brds/BRD-12/capture", StudioState, { kind: "pain", text: "Slow" }),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      acme().post("/brds/BRD-31/capture", StudioState, { kind: "pain", text: "Slow" }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(acme().post("/brds/BRD-31/step", StudioState, { step: "nowhere" })).rejects.toMatchObject({
      status: 400,
    });
  });
});

describe("Collaborating on the document", () => {
  const anchor = (section: string, quote: string | null = null, rowId: string | null = null) => ({
    section,
    rowId,
    quote,
  });

  it("rewrites a selected passage as a tracked change", async () => {
    const { brd } = await create();
    const id = brd.id;
    await capture(id, {
      kind: "text",
      target: "summary",
      text: "In order to stop settlement queries, we basically want merchants to download reports themselves. They can't today.",
    });
    const s = await acme().post(`/brds/${id}/messages`, StudioState, {
      text: "Make this concise",
      context: anchor("summary", "In order to stop settlement queries, we basically want"),
    });
    const p = last(s)?.proposals[0];
    expect(p).toMatchObject({ op: "set-text", target: "summary", status: "pending" });
    expect(String(p?.value)).toMatch(/^To stop settlement queries, we want merchants/);
    expect(s.thread.messages.at(-2)?.context?.quote).toMatch(/In order to/);
  });

  it("uses files attached to a message", async () => {
    const { brd } = await create();
    let s = await acme().post(`/brds/${brd.id}/sources`, StudioState, {
      kind: "note",
      title: "Ops notes",
      text: "Merchants must be able to download the daily settlement report by 08:00 IST.\n\nRefunds are out of scope.",
    });
    s = await acme().post(`/brds/${brd.id}/messages`, StudioState, { text: "", attachments: ["S1"] });
    expect(s.thread.messages.at(-2)?.attachments).toEqual(["S1"]);
    expect(last(s)?.proposals.some((p) => p.target === "requirements" && p.cites.includes("S1.1"))).toBe(
      true,
    );
  });

  it("answers @agent in a comment thread with a change you can accept", async () => {
    const { brd } = await create();
    const id = brd.id;
    await capture(id, {
      kind: "text",
      target: "problem",
      text: "Merchants can't see what they were paid and ops emails reports by hand, which takes days.",
    });
    let s = await acme().post(`/brds/${id}/comments`, StudioState, {
      anchor: anchor("problem"),
      text: "@agent make this more formal",
      askAgent: true,
    });
    const thread = s.comments.at(-1);
    expect(thread?.messages.map((m) => m.role)).toEqual(["human", "agent"]);
    const p = thread?.messages[1]?.proposals[0];
    expect(p?.target).toBe("problem");
    s = await acme().post(`/brds/${id}/proposals/${p?.id}`, StudioState, { decision: "accept" });
    expect(s.brd.content.problem).toMatch(/cannot see/);
    expect(s.comments.at(-1)?.messages[1]?.proposals[0]).toMatchObject({
      status: "accepted",
      decidedBy: "Priya Nair",
    });

    s = await acme().post(`/brds/${id}/comments/${thread?.id}/resolve`, StudioState, { resolved: true });
    expect(s.comments.at(-1)).toMatchObject({ resolved: true, resolvedBy: "Priya Nair" });
    await expect(
      acme().post(`/brds/${id}/comments/${thread?.id}/replies`, StudioState, { text: "one more" }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("lets reviewers comment on a locked version but not change it", async () => {
    const s = await acme().post("/brds/BRD-31/comments", StudioState, {
      anchor: anchor("requirements", null, "BR-04"),
      text: "@agent tighten this",
      askAgent: true,
    });
    const t = s.comments.at(-1);
    expect(t?.messages[1]?.text).toMatch(/locked/);
    expect(t?.messages[1]?.proposals).toHaveLength(0);
    expect(s.comments.filter((c) => c.id === "C1")[0]?.messages).toHaveLength(2);
    await expect(
      createTenantApi("t_fab4d0").post("/brds/BRD-12/comments", StudioState, {
        anchor: anchor("summary"),
        text: "hi",
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("says so instead of inventing content when asked to expand", async () => {
    const { brd } = await create();
    await capture(brd.id, {
      kind: "text",
      target: "summary",
      text: "Self-service settlement reports for merchants, to cut queries to operations.",
    });
    const s = await acme().post(`/brds/${brd.id}/messages`, StudioState, {
      text: "expand this",
      context: anchor("summary"),
    });
    expect(last(s)?.text).toMatch(/can't add facts/);
    expect(last(s)?.proposals).toHaveLength(0);
  });
});

describe("The BRD as a free-flowing document", () => {
  it("reads the content from the document on save and keeps the author's text when the agent changes it", async () => {
    const s0 = await create();
    const id = s0.brd.id;
    const body = buildBody(s0.brd.content, s0.brd.layout, []);
    const nodes = body.content ?? [];
    const at = nodes.findIndex((n) => n.attrs?.anchor === "summary");
    nodes.splice(at + 1, 1, {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "In order to stop queries, merchants get self-service settlement reports every day.",
        },
      ],
    });
    nodes.push({ type: "paragraph", content: [{ type: "text", text: "A note only the document keeps." }] });
    const doc = {
      title: s0.brd.title,
      owner: s0.brd.owner,
      workItemKey: s0.brd.workItemKey,
      content: s0.brd.content,
      layout: s0.brd.layout,
      customSections: [],
      approvals: s0.brd.approvals.map(({ id: a, capacity, name }) => ({ id: a, capacity, name })),
      body,
    };
    let s = await acme().put(`/brds/${id}/document`, StudioState, doc);
    expect(s.brd.content.summary).toMatch(/^In order to stop queries/);

    s = await acme().post(`/brds/${id}/messages`, StudioState, {
      text: "Make this concise",
      context: { section: "summary", rowId: null, quote: null },
    });
    s = await acceptAll(id);
    expect(s.brd.content.summary).toMatch(/^To stop queries/);
    const saved = s.brd.body as DocNode;
    expect((saved.content ?? []).some((n) => textOf(n) === "A note only the document keeps.")).toBe(true);
    expect((saved.content ?? []).some((n) => textOf(n).startsWith("To stop queries"))).toBe(true);

    await capture(id, {
      kind: "risk",
      description: "Late bank file",
      impact: "high",
      likelihood: "low",
      mitigation: "Retry at 07:00",
      owner: "",
    });
    const after = (await acme().get(`/brds/${id}/studio`, StudioState)).brd.body as DocNode;
    expect((after.content ?? []).some((n) => n.type === "smartBlock" && n.attrs?.kind === "risks")).toBe(
      true,
    );
  });

  it("rejects a document whose items are incomplete", async () => {
    const s0 = await create();
    const body = {
      type: "doc",
      content: [
        {
          type: "smartBlock",
          attrs: { kind: "requirements", ref: "requirements:BR-01", data: { id: "BR-01" } },
        },
      ],
    };
    await expect(
      acme().put(`/brds/${s0.brd.id}/document`, StudioState, {
        title: s0.brd.title,
        owner: s0.brd.owner,
        workItemKey: "",
        content: s0.brd.content,
        layout: s0.brd.layout,
        customSections: [],
        approvals: s0.brd.approvals.map(({ id: a, capacity, name }) => ({ id: a, capacity, name })),
        body,
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe("Live editing (the default for a new BRD)", () => {
  const BRIEF =
    "I need a BRD for merchant settlement reports. Merchants can't see what they were paid. Today ops emails CSVs by hand and it takes 3 days. We want to reduce settlement queries from 900 to under 150 a month. Merchants must be able to download daily settlement reports.";

  it("names the BRD from the first message and writes the agent's draft straight into the document", async () => {
    const created = await acme().post("/brds", StudioState, { titleFrom: BRIEF, projectId: "prj-sup" });
    expect(created.brd.title).toBe("Merchant settlement reports");
    expect(created.thread.autoApply).toBe(true);
    const s = await say(created.brd.id, BRIEF);
    const reply = last(s);
    expect(reply?.proposals.length).toBeGreaterThan(2);
    expect(
      reply?.proposals.every((p) => p.status === "accepted" && p.decidedBy === "BA agent" && p.undo),
    ).toBe(true);
    expect(reply?.text).toMatch(/started the document/);
    expect(s.brd.content.requirements[0]?.statement).toMatch(/download daily settlement reports/);
    expect(JSON.stringify(s.brd.body)).toMatch(/download daily settlement reports/);
  });

  it("undoes a live edit, and refuses once the author has changed that part", async () => {
    const created = await acme().post("/brds", StudioState, { titleFrom: BRIEF, projectId: "prj-sup" });
    const id = created.brd.id;
    let s = await say(id, BRIEF);
    const summary = last(s)?.proposals.find((p) => p.target === "summary");
    const problem = last(s)?.proposals.find((p) => p.target === "problem");
    s = await acme().post(`/brds/${id}/proposals/${summary?.id}`, StudioState, { decision: "undo" });
    expect(s.brd.content.summary).toBe("");
    expect(s.thread.messages.flatMap((m) => m.proposals).find((p) => p.id === summary?.id)?.status).toBe(
      "reverted",
    );

    // The author edits the problem statement, so undoing the agent's version would lose their words.
    await acme().put(`/brds/${id}/document`, StudioState, {
      title: s.brd.title,
      owner: s.brd.owner,
      workItemKey: "",
      content: { ...s.brd.content, problem: "Rewritten by the author, with 900 queries a month." },
      layout: s.brd.layout,
      customSections: [],
      approvals: s.brd.approvals.map(({ id: a, capacity, name }) => ({ id: a, capacity, name })),
    });
    await expect(
      acme().post(`/brds/${id}/proposals/${problem?.id}`, StudioState, { decision: "undo" }),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("can be switched to ask first", async () => {
    const created = await acme().post("/brds", StudioState, {
      titleFrom: "Refund automation",
      projectId: "prj-mrc",
    });
    await acme().post(`/brds/${created.brd.id}/agent-mode`, StudioState, { autoApply: false });
    const s = await say(created.brd.id, BRIEF);
    expect(last(s)?.proposals.every((p) => p.status === "pending")).toBe(true);
    expect(s.brd.content.requirements).toHaveLength(0);
  });
});
