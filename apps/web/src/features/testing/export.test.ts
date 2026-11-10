import { acmeSeed } from "@/mocks/seed/acme";
import { northwindSeed } from "@/mocks/seed/northwind";
import { azureTestPlansCsv, testPlanMarkdown, xrayCsv, zephyrCsv } from "./export";

const sup = acmeSeed.testPlans.find((p) => p.id === "tp-sup");
const iso = northwindSeed.testPlans.find((p) => p.id === "tp-iso");
if (!sup || !iso) throw new Error("seed changed");

/** Minimal RFC 4180 parser, enough to prove the files round-trip. */
function parse(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let f = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"' && text[i + 1] === '"') {
        f += '"';
        i++;
      } else if (ch === '"') q = false;
      else f += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      row.push(f);
      f = "";
    } else if (ch === "\r") {
      // part of \r\n
    } else if (ch === "\n") {
      row.push(f);
      rows.push(row);
      row = [];
      f = "";
    } else f += ch;
  }
  return rows;
}

const steps = (p: typeof sup) =>
  p.cases.filter((c) => c.status !== "retired").reduce((n, c) => n + Math.max(1, c.steps.length), 0);

describe("test tool exports", () => {
  it("writes one Xray row per step, grouped by TCID", () => {
    const rows = parse(xrayCsv(sup));
    expect(rows[0]?.[0]).toBe("TCID");
    expect(rows).toHaveLength(steps(sup) + 1);
    expect(rows.every((r) => r.length === rows[0]?.length)).toBe(true);
    expect(new Set(rows.slice(1).map((r) => r[0])).size).toBe(sup.cases.length);
  });

  it("writes Zephyr Scale rows with a folder per test level", () => {
    const rows = parse(zephyrCsv(sup));
    expect(rows[0]).toContain("Test Script (Step-by-Step) - Step");
    expect(rows.filter((r) => r[0]).length - 1).toBe(sup.cases.length);
    expect(rows[1]?.[6]).toMatch(/^\/.+\/.+/);
  });

  it("writes Azure Test Plans rows: a Test Case row, then numbered steps", () => {
    const rows = parse(azureTestPlansCsv(iso, "Northwind\\ISO"));
    expect(rows[0]?.slice(0, 6)).toEqual([
      "ID",
      "Work Item Type",
      "Title",
      "Test Step",
      "Step Action",
      "Step Expected",
    ]);
    expect(rows.filter((r) => r[1] === "Test Case")).toHaveLength(iso.cases.length);
    expect(rows).toHaveLength(steps(iso) + 1);
  });

  it("renders the whole plan as Markdown", () => {
    const md = testPlanMarkdown(sup, "Support");
    expect(md).toContain("## 8. Exit criteria");
    expect(md).toContain(sup.cases[0]?.id ?? "?");
  });
});
