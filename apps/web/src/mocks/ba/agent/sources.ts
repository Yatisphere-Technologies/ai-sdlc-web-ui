import type { AddSource, BrdSource, WorkspaceDoc } from "@throughline/contracts";
import type { TenantSeed } from "../../seed/types";
import { NEED, NUMBER, passages, sentences, terms } from "./text";

export type WorkspaceEntry = WorkspaceDoc & { text: string };

/** Platform documents that can be attached as references: architecture packs and other BRDs. */
export function workspaceDocs(store: TenantSeed, exceptBrdId: string): WorkspaceEntry[] {
  const out: WorkspaceEntry[] = [];
  for (const { architecture: a } of store.architectures) {
    if (!a.document) continue;
    const text = a.document.sections
      .map((s) =>
        [
          s.title,
          s.intro ?? "",
          ...(s.bullets ?? []),
          ...(s.tables ?? []).flatMap((t) => [t.caption, ...t.table.rows.map((r) => r.join(" — "))]),
          ...(s.decisions ?? []).map((d) => `${d.id} ${d.title}: ${d.decision}`),
        ].join("\n"),
      )
      .join("\n\n");
    out.push({
      ref: `arch:${a.id}`,
      title: a.document.title,
      kind: "Architecture document",
      description: a.document.summary,
      text,
    });
  }
  for (const { brd } of store.brds) {
    if (brd.id === exceptBrdId) continue;
    const c = brd.content;
    const text = [
      c.summary,
      c.problem,
      ...c.requirements.map((r) => `${r.id} ${r.title}. ${r.statement} ${r.acceptance.join(". ")}`),
      ...c.rules.map((r) => r.statement),
      ...c.nfrs.map((n) => `${n.statement}: ${n.target}`),
    ].join("\n\n");
    out.push({
      ref: `brd:${brd.id}`,
      title: `${brd.id} · ${brd.title}`,
      kind: `BRD v${brd.version}`,
      description: c.summary.slice(0, 160),
      text,
    });
  }
  return out;
}

function analyse(id: string, text: string) {
  const parts = passages(text).map((t, i) => ({ id: `${id}.${i + 1}`, text: t }));
  const all = sentences(text);
  return {
    passages: parts,
    findings: {
      needs: all.filter((s) => NEED.test(s)).length,
      numbers: all.filter((s) => NUMBER.test(s)).length,
      terms: terms(text).length,
    },
  };
}

const fmtSize = (n: number) =>
  n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;

/**
 * Turns what the author attached into a citable source. Text is split into numbered passages (S3.4)
 * and scanned for needs, numbers and defined terms. Links are kept but not fetched here: the browser
 * can't read other sites, so the author pastes the part that matters (the agent server would fetch it).
 */
export function readSource(id: string, req: AddSource, by: string, workspace: WorkspaceEntry[]): BrdSource {
  const base = { id, addedBy: by, addedAt: new Date().toISOString(), mimeType: null, size: null };
  const ready = (title: string, origin: string, text: string, extra: Partial<BrdSource> = {}): BrdSource => {
    const a = analyse(id, text);
    const first = sentences(text)[0] ?? "";
    return {
      ...base,
      kind: req.kind,
      title,
      origin,
      status: a.passages.length ? "ready" : "failed",
      summary: a.passages.length
        ? `${first.slice(0, 180)}${first.length > 180 ? "…" : ""}`
        : "No readable text found.",
      ...a,
      ...extra,
    };
  };
  const empty = { passages: [], findings: { needs: 0, numbers: 0, terms: 0 } };

  switch (req.kind) {
    case "note":
      return ready(req.title, "Note", req.text);
    case "workspace": {
      const doc = workspace.find((w) => w.ref === req.ref);
      if (!doc)
        return {
          ...base,
          ...empty,
          kind: "workspace",
          title: req.ref,
          origin: req.ref,
          status: "failed",
          summary: "That document no longer exists.",
        };
      return ready(doc.title, doc.kind, doc.text);
    }
    case "link": {
      const host = new URL(req.url).hostname.replace(/^www\./, "");
      const title = req.title?.trim() || host;
      if (req.excerpt?.trim()) return ready(title, req.url, req.excerpt);
      return {
        ...base,
        ...empty,
        kind: "link",
        title,
        origin: req.url,
        status: "linked",
        summary:
          "Saved as a reference. Paste the relevant text to let the agent read it; a connected agent server fetches pages itself.",
      };
    }
    case "file": {
      const extra = { mimeType: req.mimeType || null, size: req.size };
      if (!req.text?.trim()) {
        return {
          ...base,
          ...empty,
          ...extra,
          kind: "file",
          title: req.fileName,
          origin: `${req.fileName} · ${fmtSize(req.size)}`,
          status: "failed",
          summary:
            "Couldn't extract text from this file (scanned image or unsupported format). Try PDF with text, DOCX, TXT, MD or CSV.",
        };
      }
      return ready(req.fileName, `${req.fileName} · ${fmtSize(req.size)}`, req.text, extra);
    }
  }
}
