import { describe, expect, it } from "vitest";
import {
  actorOf,
  asStatement,
  baselineTarget,
  briefParts,
  listItems,
  objectiveFrom,
  passages,
  shortTitle,
  targetPhrase,
  terms,
  titleFrom,
} from "./text";

describe("BA agent text helpers", () => {
  it("turns a need into a titled requirement statement", () => {
    const s = "Merchants must be able to download a daily settlement report as CSV and PDF.";
    expect(shortTitle(s)).toBe("Download a daily settlement report as CSV");
    expect(actorOf(s)).toBe("Merchants");
    expect(asStatement(s)).toBe(
      "Merchants shall be able to download a daily settlement report as CSV and PDF.",
    );
    expect(actorOf("We need to cut costs")).toBe("System");
  });

  it("reads objectives with baseline and target", () => {
    expect(objectiveFrom("We want to reduce settlement queries from 900 to under 150 a month.")).toEqual({
      statement: "Reduce settlement queries from 900 to under 150 a month",
      kpi: "Settlement queries",
      baseline: "900",
      target: "under 150 a month",
    });
  });

  it("finds the measurable part of a target", () => {
    expect(targetPhrase("Reports must be available within 2 seconds at p95 for 2,000 merchants.")).toBe(
      "within 2 seconds at p95 for 2,000 merchants",
    );
    expect(targetPhrase("Finance needs unsettled amounts by 10:00 IST every day")).toBe(
      "by 10:00 IST every day",
    );
    expect(targetPhrase("Uptime of 99.9% monthly")).toBe("99.9%");
  });

  it("splits lists, passages and defined terms", () => {
    expect(listItems("Daily report; CSV download\nHistory")).toEqual([
      "Daily report",
      "CSV download",
      "History",
    ]);
    expect(passages("One.\n\nTwo.")).toEqual(["One.", "Two."]);
    expect(terms("Merchant Discount Rate (MDR) applies. KYC (Know Your Customer) too.")).toEqual([
      { term: "MDR", definition: "Merchant Discount Rate" },
      { term: "KYC", definition: "Know Your Customer" },
    ]);
  });
});

describe("titleFrom", () => {
  it("names a document from the first message", async () => {
    const { titleFrom } = await import("./text");
    expect(
      titleFrom("I need a BRD for merchant settlement reports. Merchants can't see what they were paid."),
    ).toBe("Merchant settlement reports");
    expect(titleFrom("We want to build self-service mandate cancellation in the app")).toBe(
      "Self-service mandate cancellation in the app",
    );
    expect(titleFrom("hi")).toBe("Untitled BRD");
  });
});

describe("briefParts", () => {
  const brief =
    "We need an AI agent that listens to our support mailboxes, classifies every email, creates the ServiceNow case in the right queue and drafts replies for agents. Median first response is 9.5 hours; we want under 2 hours. Agents must be able to approve replies, and complaints and fraud must always go to a person.";
  const p = briefParts(brief, () => false);

  it("splits a capability list into one requirement each", () => {
    expect(p.requirements).toEqual([
      "The AI agent must listen to our support mailboxes",
      "The AI agent must classify every email",
      "The AI agent must create the ServiceNow case in the right queue",
      "The AI agent must draft replies for agents",
      "Agents must be able to approve replies",
    ]);
  });

  it("finds the objective, the problem and the rules", () => {
    expect(p.objectives).toEqual(["Median first response is 9.5 hours; we want under 2 hours"]);
    expect(p.problem[0]).toMatch(/9\.5 hours/);
    expect(p.rules).toEqual(["complaints and fraud must always go to a person"]);
    expect(baselineTarget(p.objectives[0] ?? "")).toEqual({ baseline: "9.5 hours", target: "under 2 hours" });
  });

  it("titles a brief that starts with 'We need an'", () => {
    expect(titleFrom(brief)).toBe("AI agent that listens to our support mailboxes");
  });
});
