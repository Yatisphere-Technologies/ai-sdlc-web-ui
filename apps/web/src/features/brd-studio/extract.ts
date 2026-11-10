/**
 * Reads the text out of a file the author attaches, in the browser, so the BA agent can cite it.
 * PDF (with a text layer) via pdf.js, Word via mammoth, and plain-text formats directly. Both
 * libraries load only when such a file is attached. Scanned PDFs and images return null: they need
 * OCR, which belongs on the agent server.
 */

export const ACCEPT = ".pdf,.docx,.txt,.md,.markdown,.csv,.json,.html,.htm,.xml,.yaml,.yml";
export const MAX_BYTES = 25 * 1024 * 1024;

const TEXT_TYPES = /\.(txt|md|markdown|csv|json|xml|ya?ml)$/i;

export async function extractText(file: File): Promise<string | null> {
  const name = file.name.toLowerCase();
  if (TEXT_TYPES.test(name) || file.type.startsWith("text/plain") || file.type === "text/csv") {
    return file.text();
  }
  if (/\.html?$/.test(name)) {
    const doc = new DOMParser().parseFromString(await file.text(), "text/html");
    for (const el of doc.querySelectorAll("script,style,nav,footer")) el.remove();
    return doc.body.textContent ?? "";
  }
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return value;
  }
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const pdfjs = await import("pdfjs-dist");
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
    const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= Math.min(pdf.numPages, 200); i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      let line = "";
      const lines: string[] = [];
      for (const item of content.items) {
        if (!("str" in item)) continue;
        line += item.str;
        if (item.hasEOL) {
          lines.push(line);
          line = "";
        }
      }
      if (line) lines.push(line);
      pages.push(lines.join("\n"));
    }
    const text = pages.join("\n\n").trim();
    return text.length > 20 ? text : null;
  }
  return null;
}
