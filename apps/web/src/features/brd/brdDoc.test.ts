import {
  BRD_SECTION_SPEC,
  type BrdContent,
  buildBody,
  type DocNode,
  defaultLayout,
  deriveFromBody,
  syncBody,
  textOf,
} from "@throughline/contracts";
import { acmeBrds, fabrikamBrds, northwindBrds } from "@/mocks/ba";
import { SECTIONS } from "./sections";

const all = [...acmeBrds(), ...northwindBrds(), ...fabrikamBrds()].map((r) => r.brd);

describe("BRD as a free-flowing document", () => {
  it("keeps the editor sections and the document model in step", () => {
    expect(SECTIONS.map((s) => [s.id, s.title])).toEqual(BRD_SECTION_SPEC.map((s) => [s.id, s.title]));
    for (const s of SECTIONS) {
      const spec = BRD_SECTION_SPEC.find((x) => x.id === s.id);
      if (s.kind === "text") expect(spec).toMatchObject({ text: s.key });
      if (s.kind === "rows") expect(spec).toMatchObject({ rows: s.key });
      if (s.kind === "list")
        expect(spec && "lists" in spec && spec.lists.map((l) => l.key)).toEqual(s.keys.map((k) => k.key));
    }
  });

  it("round-trips every seeded BRD through the document without losing anything", () => {
    for (const brd of all) {
      const body = buildBody(brd.content, brd.layout, brd.customSections);
      const back = deriveFromBody(body);
      expect(back.content).toEqual(brd.content);
      expect(back.layout.hidden).toEqual([]);
    }
  });

  it("reads renamed, removed and new sections from the headings", () => {
    const brd = all[0];
    if (!brd) throw new Error("no seed");
    const body = buildBody(brd.content, defaultLayout(), []);
    const nodes = body.content ?? [];
    const summary = nodes.find((n) => n.attrs?.anchor === "summary") as DocNode;
    summary.content = [{ type: "text", text: "At a glance" }];
    const bg = nodes.findIndex((n) => n.attrs?.anchor === "background");
    nodes.splice(bg, 2);
    nodes.push(
      {
        type: "heading",
        attrs: { level: 2, anchor: null },
        content: [{ type: "text", text: "Rollout plan" }],
      },
      { type: "paragraph", content: [{ type: "text", text: "Pilot with 20 merchants." }] },
    );
    const out = deriveFromBody(body);
    expect(out.layout.titles.summary).toBe("At a glance");
    expect(out.layout.hidden).toContain("background");
    expect(out.content.background).toBe("");
    expect(out.customSections).toEqual([
      { id: "custom-1", title: "Rollout plan", body: "Pilot with 20 merchants." },
    ]);
  });

  it("writes agent changes back without touching what the author wrote", () => {
    const brd = all[0];
    if (!brd) throw new Error("no seed");
    let body = buildBody(brd.content, brd.layout, []);
    // The author adds a free note between two requirements.
    const nodes = body.content ?? [];
    const firstReq = nodes.findIndex((n) => n.type === "smartBlock" && n.attrs?.kind === "requirements");
    nodes.splice(firstReq + 1, 0, {
      type: "paragraph",
      content: [{ type: "text", text: "Note: confirm with ops." }],
    });

    const c: BrdContent = structuredClone(brd.content);
    c.summary = "A shorter summary.";
    c.outOfScope = [...c.outOfScope, "Refunds"];
    const br = c.requirements[0];
    if (!br) throw new Error("no requirement");
    br.statement = "Changed statement.";
    c.requirements.push({ ...br, id: "BR-99", title: "New one", statement: "New one." });
    c.risks = c.risks.slice(1);
    body = syncBody(body, c);

    const back = deriveFromBody(body);
    expect(back.content).toEqual(c);
    expect(body.content?.some((n) => textOf(n) === "Note: confirm with ops.")).toBe(true);
    const reqs = (body.content ?? []).filter((n) => n.attrs?.kind === "requirements");
    expect(reqs.at(-1)?.attrs?.ref).toBe("requirements:BR-99");
  });

  it("adds a section the document doesn't have yet when the agent fills it", () => {
    const empty = deriveFromBody({ type: "doc", content: [] }).content;
    const body = syncBody(
      { type: "doc", content: [] },
      { ...empty, problem: "Merchants raise 900 queries a month." },
    );
    expect(body.content?.[0]).toMatchObject({ type: "heading", attrs: { anchor: "problem" } });
    expect(deriveFromBody(body).content.problem).toBe("Merchants raise 900 queries a month.");
  });
});

describe("Outline operations on the document", () => {
  it("moves, hides, restores and adds sections while keeping hidden content", async () => {
    const { moveSection, removeSection, restoreSection, addSection } = await import("@throughline/contracts");
    const brd = all[0];
    if (!brd) throw new Error("no seed");
    let body = buildBody(brd.content, brd.layout, []);
    body = moveSection(body, "problem", -1);
    expect(deriveFromBody(body, brd.content).layout.order.slice(0, 2)).toEqual(["problem", "summary"]);
    body = removeSection(body, "requirements");
    const hidden = deriveFromBody(body, brd.content);
    expect(hidden.layout.hidden).toEqual(["requirements"]);
    expect(hidden.content.requirements).toEqual(brd.content.requirements);
    body = restoreSection(body, "requirements", hidden.content);
    expect(deriveFromBody(body).content.requirements).toEqual(brd.content.requirements);
    body = addSection(body, "custom-x", "Rollout");
    expect(deriveFromBody(body).customSections.at(-1)).toMatchObject({ id: "custom-x", title: "Rollout" });
  });
});
