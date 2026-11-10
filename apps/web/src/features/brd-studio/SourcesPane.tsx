import { reveal } from "@throughline/collab";
import type { BrdSource } from "@throughline/contracts";
import { Badge, Button, cn } from "@throughline/ui";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  FolderOpen,
  Link2,
  LoaderCircle,
  MessageSquareQuote,
  StickyNote,
  Trash2,
  Upload,
} from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { ErrorNote } from "@/components/data/ErrorNote";
import { useAddSource, useRemoveSource, useWorkspaceDocs } from "./api";
import { ACCEPT, extractText, MAX_BYTES } from "./extract";

const INPUT =
  "w-full rounded-md border border-line bg-surface-sunken px-2.5 py-1.5 text-body-sm text-foreground outline-none focus:border-agent";

const KIND = { link: Link2, file: FileText, note: StickyNote, workspace: FolderOpen } as const;
const STATUS = {
  ready: { label: "Read", tone: "ok" as const },
  linked: { label: "Link only", tone: "gate" as const },
  failed: { label: "Unreadable", tone: "risk" as const },
};

type Mode = null | "link" | "note" | "workspace";

export function WorkspacePicker({
  brdId,
  onPick,
  busy,
}: {
  brdId: string;
  onPick: (ref: string) => void;
  busy: boolean;
}) {
  const docs = useWorkspaceDocs(brdId);
  if (!docs.length)
    return <p className="text-caption text-muted">No other documents in this workspace yet.</p>;
  return (
    <ul className="flex flex-col gap-1.5">
      {docs.map((d) => (
        <li key={d.ref}>
          <button
            type="button"
            disabled={busy}
            onClick={() => onPick(d.ref)}
            className="border-line hover:border-agent-line hover:bg-agent-wash flex w-full cursor-pointer flex-col gap-0.5 rounded-md border px-2.5 py-2 text-left"
          >
            <span className="text-body-sm text-foreground">{d.title}</span>
            <span className="text-caption text-muted">{d.kind}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function SourceItem({
  s,
  open,
  highlight,
  onToggle,
  onRemove,
  onUse,
  canEdit,
}: {
  s: BrdSource;
  open: boolean;
  highlight: string | null;
  onToggle: () => void;
  onRemove: () => void;
  onUse: () => void;
  canEdit: boolean;
}) {
  const Icon = KIND[s.kind];
  const ref = useRef<HTMLLIElement>(null);
  const hit = highlight && (highlight === s.id || highlight.startsWith(`${s.id}.`));
  useEffect(() => {
    if (hit) reveal(ref.current);
  }, [hit]);
  return (
    <li
      ref={ref}
      id={`src-${s.id}`}
      className={cn("bg-surface rounded-lg border", hit ? "border-ion" : "border-line")}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-start gap-2 px-3 py-2.5 text-left"
      >
        {open ? (
          <ChevronDown className="text-muted mt-0.5 size-4 shrink-0" />
        ) : (
          <ChevronRight className="text-muted mt-0.5 size-4 shrink-0" />
        )}
        <Icon className="text-ion mt-0.5 size-4 shrink-0" aria-hidden />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-1.5">
            <span className="text-micro text-ion-fg font-mono">{s.id}</span>
            <span className="text-body-sm text-foreground truncate">{s.title}</span>
          </span>
          <span className="text-caption text-muted truncate">{s.origin}</span>
        </span>
        <Badge tone={STATUS[s.status].tone} mono>
          {STATUS[s.status].label}
        </Badge>
      </button>
      {open ? (
        <div className="border-line flex flex-col gap-2 border-t px-3 py-2.5">
          <p className="text-caption text-subtle">{s.summary}</p>
          {s.status === "ready" ? (
            <p className="text-nano text-muted font-mono">
              {s.passages.length} passages · {s.findings.needs} needs · {s.findings.numbers} numbers ·{" "}
              {s.findings.terms} terms
            </p>
          ) : null}
          {s.passages.length ? (
            <ol className="flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-1">
              {s.passages.map((p) => (
                <li
                  key={p.id}
                  id={`src-${p.id}`}
                  className={cn(
                    "text-caption rounded-md px-2 py-1.5",
                    highlight === p.id ? "bg-ion-soft text-foreground" : "bg-surface-raised text-subtle",
                  )}
                >
                  <span className="text-nano text-ion-fg mr-1.5 font-mono">{p.id}</span>
                  {p.text}
                </li>
              ))}
            </ol>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {canEdit && s.status === "ready" ? (
              <Button size="sm" variant="secondary" onClick={onUse}>
                <MessageSquareQuote className="size-3.5" aria-hidden /> Use in chat
              </Button>
            ) : null}
            {s.kind === "link" ? (
              <a
                href={s.origin}
                target="_blank"
                rel="noreferrer noopener"
                className="text-caption text-ion-fg self-center hover:underline"
              >
                Open link ↗
              </a>
            ) : null}
            {canEdit ? (
              <Button size="sm" variant="ghost" className="ml-auto" onClick={onRemove}>
                <Trash2 className="size-3.5" aria-hidden /> Remove
              </Button>
            ) : null}
          </div>
          <p className="text-nano text-faint">
            Added by {s.addedBy} ·{" "}
            {new Date(s.addedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
          </p>
        </div>
      ) : null}
    </li>
  );
}

/** Reference material the agent reads and cites: uploads, links, notes and documents already in the platform. */
export function SourcesPane({
  brdId,
  sources,
  canEdit,
  highlight,
  onUse,
}: {
  brdId: string;
  sources: BrdSource[];
  canEdit: boolean;
  highlight: string | null;
  onUse: (text: string) => void;
}) {
  const add = useAddSource(brdId);
  const remove = useRemoveSource(brdId);
  const [mode, setMode] = useState<Mode>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [reading, setReading] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [link, setLink] = useState({ url: "", title: "", excerpt: "" });
  const [note, setNote] = useState({ title: "", text: "" });
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (highlight) setOpen(highlight.split(".")[0] ?? null);
  }, [highlight]);

  const onFiles = async (files: FileList | null) => {
    setFileError(null);
    for (const file of Array.from(files ?? [])) {
      if (file.size > MAX_BYTES) {
        setFileError(`${file.name} is over 25 MB.`);
        continue;
      }
      setReading(file.name);
      let text: string | null = null;
      try {
        text = await extractText(file);
      } catch {
        text = null;
      }
      setReading(null);
      await add.mutateAsync({
        kind: "file",
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        text: text?.slice(0, 400_000) ?? null,
      });
    }
    if (fileInput.current) fileInput.current.value = "";
  };

  return (
    <div className="flex flex-col gap-3">
      {canEdit ? (
        <>
          <div className="grid grid-cols-4 gap-1.5">
            {(
              [
                ["upload", "Upload", Upload],
                ["link", "Link", Link2],
                ["note", "Note", StickyNote],
                ["workspace", "Platform", FolderOpen],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() =>
                  id === "upload" ? fileInput.current?.click() : setMode(mode === id ? null : id)
                }
                className={cn(
                  "text-caption flex cursor-pointer flex-col items-center gap-1 rounded-lg border px-1 py-2",
                  mode === id
                    ? "border-agent bg-agent-wash text-agent-fg"
                    : "border-line text-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
              </button>
            ))}
          </div>
          <input
            ref={fileInput}
            type="file"
            multiple
            accept={ACCEPT}
            className="sr-only"
            aria-label="Upload reference files"
            onChange={(e) => void onFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void onFiles(e.dataTransfer.files);
            }}
            className="border-line text-caption text-muted hover:border-agent-line cursor-pointer rounded-lg border border-dashed px-3 py-2.5 text-center"
          >
            Drop PDF, Word, Markdown, text or CSV here, or click to choose
          </button>
          {reading ? (
            <p className="text-caption text-agent-fg flex items-center gap-2">
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> Reading {reading}…
            </p>
          ) : null}
          {fileError ? <p className="text-caption text-risk-fg">{fileError}</p> : null}
          {mode === "link" ? (
            <form
              className="border-line flex flex-col gap-2 rounded-lg border p-3"
              onSubmit={(e) => {
                e.preventDefault();
                add.mutate(
                  {
                    kind: "link",
                    url: link.url.trim(),
                    title: link.title || undefined,
                    excerpt: link.excerpt || undefined,
                  },
                  {
                    onSuccess: () => {
                      setLink({ url: "", title: "", excerpt: "" });
                      setMode(null);
                    },
                  },
                );
              }}
            >
              <input
                className={INPUT}
                type="url"
                required
                placeholder="https://…"
                aria-label="Link URL"
                value={link.url}
                onChange={(e) => setLink({ ...link, url: e.target.value })}
              />
              <input
                className={INPUT}
                placeholder="Title (optional)"
                aria-label="Link title"
                value={link.title}
                onChange={(e) => setLink({ ...link, title: e.target.value })}
              />
              <textarea
                className={INPUT}
                rows={3}
                placeholder="Paste the part of the page that matters (optional). Without it the link is saved but not read."
                aria-label="Text from the page"
                value={link.excerpt}
                onChange={(e) => setLink({ ...link, excerpt: e.target.value })}
              />
              <Button type="submit" size="sm" disabled={add.isPending}>
                Add link
              </Button>
            </form>
          ) : null}
          {mode === "note" ? (
            <form
              className="border-line flex flex-col gap-2 rounded-lg border p-3"
              onSubmit={(e) => {
                e.preventDefault();
                add.mutate(
                  { kind: "note", title: note.title, text: note.text },
                  {
                    onSuccess: () => {
                      setNote({ title: "", text: "" });
                      setMode(null);
                    },
                  },
                );
              }}
            >
              <input
                className={INPUT}
                required
                placeholder="Title, e.g. Call with compliance"
                aria-label="Note title"
                value={note.title}
                onChange={(e) => setNote({ ...note, title: e.target.value })}
              />
              <textarea
                className={INPUT}
                required
                rows={5}
                placeholder="Paste meeting notes, an email thread, interview answers…"
                aria-label="Note text"
                value={note.text}
                onChange={(e) => setNote({ ...note, text: e.target.value })}
              />
              <Button type="submit" size="sm" disabled={add.isPending}>
                Add note
              </Button>
            </form>
          ) : null}
          {mode === "workspace" ? (
            <div className="border-line rounded-lg border p-3">
              <Suspense fallback={<p className="text-caption text-muted">Loading…</p>}>
                <WorkspacePicker
                  brdId={brdId}
                  busy={add.isPending}
                  onPick={(ref) => add.mutate({ kind: "workspace", ref }, { onSuccess: () => setMode(null) })}
                />
              </Suspense>
            </div>
          ) : null}
          <ErrorNote error={add.error ?? remove.error} />
        </>
      ) : null}
      {sources.length === 0 ? (
        <p className="text-caption text-muted">
          No references yet. The agent cites every passage it uses, so approvers can check where a requirement
          came from.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sources.map((s) => (
            <SourceItem
              key={s.id}
              s={s}
              open={open === s.id}
              highlight={highlight}
              canEdit={canEdit}
              onToggle={() => setOpen(open === s.id ? null : s.id)}
              onRemove={() => remove.mutate(s.id)}
              onUse={() => onUse(`Use ${s.id} for requirements`)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
