import { describe, expect, it } from "vitest";
import { northwindBrds } from "@/mocks/ba";
import { ordered, toAdoCsv, toJiraCsv } from "./backlogCsv";
import { brdToMarkdown } from "./brdMarkdown";

const rec = northwindBrds()[0];
if (!rec) throw new Error("seed");
const { backlog, brd } = rec;

/** Minimal RFC 4180 parser so the test checks real structure, not string fragments. */
function parse(csv: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (quoted) {
      if (ch === '"' && csv[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      cur.push(field);
      field = "";
    } else if (ch === "\n") {
      cur.push(field.replace(/\r$/, ""));
      rows.push(cur);
      cur = [];
      field = "";
    } else field += ch;
  }
  return rows;
}

describe("backlog exports", () => {
  it("orders parents before children", () => {
    const seen = new Set<string>();
    for (const { item } of ordered(backlog.items)) {
      if (item.parentId) expect(seen.has(item.parentId)).toBe(true);
      seen.add(item.id);
    }
  });

  it("writes a Jira CSV whose parent ids all resolve and that skips the feature level", () => {
    const rows = parse(toJiraCsv(backlog));
    const [header, ...body] = rows;
    expect(header?.slice(0, 4)).toEqual(["Issue Id", "Parent Id", "Issue Type", "Summary"]);
    const ids = new Set(body.map((r) => r[0]));
    for (const r of body) if (r[1]) expect(ids.has(r[1])).toBe(true);
    expect(new Set(body.map((r) => r[2]))).toEqual(new Set(["Epic", "Story", "Sub-task"]));
    expect(body.every((r) => r.length === header?.length)).toBe(true);
  });

  it("writes an Azure Boards CSV with the hierarchy in the Title columns", () => {
    const [header, ...body] = parse(toAdoCsv(backlog));
    expect(header?.[1]).toBe("Work Item Type");
    const epic = body.find((r) => r[1] === "Epic");
    const feature = body.find((r) => r[1] === "Feature");
    const story = body.find((r) => r[1] === "User Story");
    expect(epic?.[2]).not.toBe("");
    expect(feature?.[3]).not.toBe("");
    expect(story?.[4]).not.toBe("");
    expect(body.every((r) => r.length === header?.length)).toBe(true);
  });

  it("exports the whole BRD, approvals and history as Markdown", () => {
    const md = brdToMarkdown(brd);
    expect(md).toContain("## 10. Business requirements");
    expect(md).toContain("### BR-01");
    expect(md).toContain("Fatima Al Mansoori");
    expect(md).toContain("## Change history");
  });
});
