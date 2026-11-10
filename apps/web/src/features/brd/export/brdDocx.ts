import { BRD_STATUS_LABEL, type Brd, type BrdSource, MOSCOW_LABEL } from "@throughline/contracts";
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { placedSections } from "../sections";
import STYLE from "./docxStyle.json";

/**
 * The BRD as a Word document: cover block, approvals, every section in the author's order,
 * requirements with acceptance criteria and citations, a sources appendix and the change history.
 * Built in the browser; loaded only when someone exports.
 */

const p = (text: string, opts: { bold?: boolean; color?: string; size?: number; italics?: boolean } = {}) =>
  new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text, ...opts, font: STYLE.font })] });

const cellText = (v: unknown) => (Array.isArray(v) ? v.join("; ") : String(v ?? ""));

function table(header: string[], rows: string[][]) {
  const border = { style: BorderStyle.SINGLE, size: 4, color: STYLE.border };
  const cell = (text: string, head: boolean) =>
    new TableCell({
      borders: { top: border, bottom: border, left: border, right: border },
      shading: head ? { type: ShadingType.CLEAR, color: "auto", fill: STYLE.headerFill } : undefined,
      margins: { top: 60, bottom: 60, left: 100, right: 100 },
      children: [
        new Paragraph({ children: [new TextRun({ text, bold: head, size: 18, font: STYLE.font })] }),
      ],
    });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: header.map((h) => cell(h, true)) }),
      ...rows.map((r) => new TableRow({ children: r.map((c) => cell(c, false)) })),
    ],
  });
}

const bullets = (items: string[]) =>
  items.length
    ? items.map(
        (x) =>
          new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: x, font: STYLE.font })] }),
      )
    : [p("None.", { italics: true, color: STYLE.muted })];

export async function brdToDocx(brd: Brd, sources: BrdSource[]): Promise<Blob> {
  const c = brd.content;
  const body: (Paragraph | Table)[] = [
    new Paragraph({
      children: [
        new TextRun({
          text: `${brd.id} · Business requirements document`,
          color: STYLE.accent,
          font: STYLE.font,
          size: 20,
        }),
      ],
    }),
    new Paragraph({
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: brd.title, font: STYLE.font })],
    }),
    table(
      ["Version", "Status", "Owner", "Work item", "Last updated"],
      [
        [
          brd.version,
          BRD_STATUS_LABEL[brd.status],
          brd.owner,
          brd.workItemKey || "—",
          brd.updatedAt.slice(0, 10),
        ],
      ],
    ),
    p(""),
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: "Approvals", font: STYLE.font })],
    }),
    table(
      ["Capacity", "Name", "Decision", "Date", "Comment"],
      brd.approvals.map((a) => [a.capacity, a.name, a.status, a.at?.slice(0, 10) ?? "", a.comment ?? ""]),
    ),
  ];

  for (const placed of placedSections(brd)) {
    body.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 360 },
        children: [new TextRun({ text: `${placed.number}. ${placed.title}`, font: STYLE.font })],
      }),
    );
    if (placed.kind === "custom") {
      for (const para of (placed.custom.body || "—").split(/\n\n+/)) body.push(p(para));
      continue;
    }
    const s = placed.section;
    if (s.kind === "text") body.push(p(c[s.key] || "—"));
    else if (s.kind === "list") {
      for (const { key, label } of s.keys) {
        if (s.keys.length > 1) body.push(p(label, { bold: true }));
        body.push(...bullets(c[key]));
      }
    } else if (s.key === "requirements") {
      for (const r of c.requirements) {
        body.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_3,
            children: [
              new TextRun({ text: `${r.id} · ${r.title}  `, font: STYLE.font }),
              new TextRun({
                text: MOSCOW_LABEL[r.priority].toUpperCase(),
                color: STYLE.accent,
                size: 18,
                font: STYLE.font,
              }),
            ],
          }),
          p(r.statement),
          p(`Rationale: ${r.rationale || "—"}`, { color: STYLE.muted }),
          p(
            `Actor: ${r.actor} · Objective: ${r.objective || "—"} · Area: ${r.area} · Source: ${r.source || "—"}${r.sources?.length ? ` · Cites: ${r.sources.join(", ")}` : ""}`,
            { color: STYLE.muted, size: 18 },
          ),
          p("Acceptance criteria", { bold: true }),
          ...r.acceptance.map(
            (a, i) =>
              new Paragraph({
                numbering: undefined,
                indent: { left: 360 },
                children: [new TextRun({ text: `${i + 1}. ${a}`, font: STYLE.font })],
              }),
          ),
        );
      }
    } else {
      const rows = c[s.key] as unknown as Record<string, unknown>[];
      body.push(
        rows.length
          ? table(
              s.fields.map((f) => f.label),
              rows.map((r) => s.fields.map((f) => cellText(r[f.key]))),
            )
          : p("None recorded.", { italics: true, color: STYLE.muted }),
      );
    }
  }

  if (sources.length) {
    body.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 360 },
        children: [new TextRun({ text: "Appendix A. Reference sources", font: STYLE.font })],
      }),
    );
    body.push(
      table(
        ["Id", "Title", "Type", "Origin", "Added by"],
        sources.map((s) => [s.id, s.title, s.kind, s.origin, s.addedBy]),
      ),
    );
  }
  body.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 360 },
      children: [new TextRun({ text: "Appendix B. Change history", font: STYLE.font })],
    }),
  );
  body.push(
    table(
      ["Version", "Date", "By", "Change"],
      brd.history.map((h) => [h.version, h.at.slice(0, 10), h.by, h.what]),
    ),
  );

  const doc = new Document({
    creator: "Throughline BRD Studio",
    title: brd.title,
    styles: { default: { document: { run: { font: STYLE.font, size: 21, color: STYLE.text } } } },
    sections: [
      {
        properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } },
        children: [
          ...body,
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 400 },
            children: [
              new TextRun({
                text: `Generated ${new Date().toISOString().slice(0, 10)}`,
                size: 16,
                color: STYLE.muted,
                font: STYLE.font,
              }),
            ],
          }),
        ],
      },
    ],
  });
  return Packer.toBlob(doc);
}
