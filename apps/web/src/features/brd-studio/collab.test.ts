import type { Brd, BrdContent, Proposal } from "@throughline/contracts";
import { anchorOf, participants, textChange } from "./collab";

const content = {
  summary: "Old summary.",
  requirements: [{ id: "BR-01", statement: "Merchants shall download reports quickly." }],
} as unknown as BrdContent;

const p = (x: Partial<Proposal>): Proposal => ({
  id: "P1",
  summary: "",
  op: "set-text",
  target: "summary",
  rowId: null,
  value: "",
  cites: [],
  status: "pending",
  ...x,
});

describe("BRD Studio collaboration adapters", () => {
  it("shows text rewrites as before/after", () => {
    expect(textChange(content, p({ value: "New summary." }))).toEqual({
      before: "Old summary.",
      after: "New summary.",
    });
    expect(
      textChange(
        content,
        p({
          op: "update-row",
          target: "requirements",
          rowId: "BR-01",
          value: { statement: "Merchants shall download reports within 2 seconds." },
        }),
      ),
    ).toMatchObject({ before: "Merchants shall download reports quickly." });
    expect(textChange(content, p({ op: "add-row", target: "risks", value: { id: "R-1" } }))).toBeNull();
  });

  it("anchors proposals to the section that holds their target", () => {
    expect(anchorOf(p({ target: "outOfScope" })).blockId).toBe("scope");
    expect(anchorOf(p({ target: "currentState" })).blockId).toBe("current");
    expect(anchorOf(p({ target: "requirements", rowId: "BR-02" }))).toEqual({
      blockId: "requirements",
      rowId: "BR-02",
    });
  });

  it("lists you, the agent and everyone who worked on the BRD once", () => {
    const brd = {
      owner: "Priya Nair",
      approvals: [
        { name: "Anil Kapoor", capacity: "Business sponsor" },
        { name: "Priya Nair", capacity: "Product owner" },
      ],
      history: [{ by: "BA agent" }, { by: "Rahul Mehta" }],
    } as unknown as Brd;
    const people = participants(brd, [], "Priya Nair");
    expect(people.map((x) => x.name)).toEqual(["Priya Nair", "BA agent", "Anil Kapoor", "Rahul Mehta"]);
    expect(people[0]).toMatchObject({ you: true, online: true, role: "Product owner approver" });
  });
});
