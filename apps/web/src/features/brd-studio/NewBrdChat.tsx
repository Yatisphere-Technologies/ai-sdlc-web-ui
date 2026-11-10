import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  type ChatAttachment,
  ChatHome,
  ChatThread,
  Composer,
  DropZone,
  type Participant,
  type Starter,
} from "@throughline/collab";
import { type AddSource, StudioState } from "@throughline/contracts";
import { Button, Select, toast } from "@throughline/ui";
import { ArrowLeft, FileUp, Lightbulb, Mail, MessagesSquare, StickyNote, X } from "lucide-react";
import { useRef, useState } from "react";
import { ErrorNote } from "@/components/data/ErrorNote";
import { Logo } from "@/components/shell/Logo";
import { setProjectScope, usePortfolioQuery, useProjectScope } from "@/features/projects";
import { useTenant } from "@/tenancy";
import { ThemeMenu } from "@/theme";
import { ACCEPT, extractText, MAX_BYTES } from "./extract";

const AGENT: Participant = { id: "agent", name: "BA agent", kind: "agent", online: true };

type Pending = { chip: ChatAttachment; source: AddSource };

const STARTERS: Starter[] = [
  {
    label: "Describe a change",
    prompt:
      "Customers can't cancel UPI AutoPay mandates in the app. They call support and keep getting debited for days. We want to cut complaints from 2,400 to under 500 a month.",
    icon: <Lightbulb className="size-4" aria-hidden />,
  },
  {
    label: "Start from meeting notes",
    prompt: "Paste or attach the notes from a workshop and I'll pull out the needs, numbers and risks.",
    icon: <StickyNote className="size-4" aria-hidden />,
  },
  {
    label: "Upload a document",
    prompt: "A brief, a policy, a complaints analysis: PDF, Word, text, Markdown or CSV.",
    icon: <FileUp className="size-4" aria-hidden />,
  },
  {
    label: "Agentic email listener",
    prompt:
      "We need an AI agent that listens to our support mailboxes, classifies every email, creates the ServiceNow case in the right queue and drafts replies for agents. Median first response is 9.5 hours; we want under 2 hours. Agents must be able to approve replies, and complaints and fraud must always go to a person.",
    icon: <Mail className="size-4" aria-hidden />,
  },
];

/**
 * A new BRD starts as a conversation, like a modern assistant. The first message creates the BRD
 * (named from what you wrote), attaches anything you added, and opens the studio with the document
 * already being written on the right.
 */
export function NewBrdChat() {
  const { tenant, api, keys, can } = useTenant();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [pending, setPending] = useState<Pending[]>([]);
  const [note, setNote] = useState<{ title: string; text: string } | null>(null);
  const [sent, setSent] = useState<{ text: string; chips: ChatAttachment[] } | null>(null);
  const tmp = useRef(0);
  // Every BRD belongs to a project; start in the one the person is working in.
  const portfolio = usePortfolioQuery().data;
  const [scope] = useProjectScope(tenant.id);
  const [chosen, setChosen] = useState<string | null>(null);
  const projectId = chosen ?? (scope && portfolio?.projects.some((p) => p.id === scope) ? scope : null);
  const fileInput = useRef<HTMLInputElement>(null);

  const start = useMutation({
    mutationFn: async (v: { text: string; items: Pending[] }) => {
      if (!projectId) throw new Error("Choose the project this BRD belongs to");
      const created = await api.post("/brds", StudioState, {
        titleFrom: v.text || v.items[0]?.chip.name,
        projectId,
      });
      const id = created.brd.id;
      const before = new Set<string>();
      const attached: string[] = [];
      for (const p of v.items) {
        const s = await api.post(`/brds/${id}/sources`, StudioState, p.source);
        const added = s.sources.find((x) => !before.has(x.id) && !attached.includes(x.id));
        if (added) attached.push(added.id);
        for (const x of s.sources) before.add(x.id);
      }
      const message = v.text || "Use what I've attached to start the BRD.";
      return api.post(`/brds/${id}/messages`, StudioState, {
        text: message,
        attachments: attached,
        context: null,
      });
    },
    onSuccess: (state) => {
      qc.setQueryData(keys.brdStudio(state.brd.id), state);
      void qc.invalidateQueries({ queryKey: keys.brds });
      void qc.invalidateQueries({ queryKey: keys.backlogs });
      void qc.invalidateQueries({ queryKey: keys.projects });
      void qc.invalidateQueries({ queryKey: keys.workItems });
      if (projectId) setProjectScope(tenant.id, projectId);
      void navigate({
        to: "/t/$tenantSlug/brd/$brdId",
        params: { tenantSlug: tenant.slug, brdId: state.brd.id },
        replace: true,
      });
    },
  });

  const addFiles = async (files: File[]) => {
    for (const file of files.slice(0, 10)) {
      const id = `tmp-${tmp.current++}`;
      if (file.size > MAX_BYTES) {
        setPending((xs) => [
          ...xs,
          {
            chip: { id, name: file.name, kind: "file", status: "failed", detail: "Over 25 MB" },
            source: { kind: "file", fileName: file.name, mimeType: file.type, size: file.size, text: null },
          },
        ]);
        continue;
      }
      setPending((xs) => [
        ...xs,
        {
          chip: { id, name: file.name, kind: "file", status: "uploading" },
          source: { kind: "file", fileName: file.name, mimeType: file.type, size: file.size, text: null },
        },
      ]);
      let extracted: string | null = null;
      try {
        extracted = await extractText(file);
      } catch {
        extracted = null;
      }
      setPending((xs) =>
        xs.map((x) =>
          x.chip.id === id
            ? {
                chip: {
                  ...x.chip,
                  status: extracted ? "ready" : "failed",
                  detail: extracted ? "Ready to read" : "No readable text (scanned?)",
                },
                source: {
                  kind: "file",
                  fileName: file.name,
                  mimeType: file.type || "application/octet-stream",
                  size: file.size,
                  text: extracted,
                },
              }
            : x,
        ),
      );
    }
  };

  const send = (t: string) => {
    const items = pending.filter((p) => p.chip.status !== "failed" && p.chip.status !== "uploading");
    if (!t.trim() && !items.length) return;
    if (!projectId) {
      toast.error("Choose a project first", { description: "Every BRD belongs to a project." });
      return;
    }
    setSent({ text: t.trim(), chips: items.map((p) => p.chip) });
    start.mutate({ text: t.trim(), items });
  };

  if (!can("brd.edit"))
    return (
      <div className="bg-background grid h-dvh place-items-center px-4">
        <p className="text-body text-muted">Your role can read BRDs but not start one.</p>
      </div>
    );

  const composer = (
    <Composer
      value={text}
      onChange={setText}
      voice
      autoFocus
      sending={start.isPending}
      placeholder="Describe the change: who it's for, what's wrong today, what good looks like…"
      attachments={pending.map((p) => p.chip)}
      onRemoveAttachment={(id) => setPending((xs) => xs.filter((x) => x.chip.id !== id))}
      onFiles={(f) => void addFiles(f)}
      onLink={(url, title, excerpt) =>
        setPending((xs) => [
          ...xs,
          {
            chip: {
              id: `tmp-${tmp.current++}`,
              name: title ?? url.replace(/^https?:\/\/(www\.)?/, ""),
              kind: "link",
              status: excerpt ? "ready" : "linked",
              detail: excerpt ? "Excerpt pasted" : "Saved as a reference",
            },
            source: { kind: "link", url, title, excerpt },
          },
        ])
      }
      accept={ACCEPT}
      menu={[
        {
          id: "note",
          label: "Paste text",
          hint: "Meeting notes, an email, a policy extract",
          icon: <StickyNote className="text-muted size-4" aria-hidden />,
          onSelect: () => setNote({ title: "", text: "" }),
        },
      ]}
      panel={
        note ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!note.title.trim() || !note.text.trim()) return;
              setPending((xs) => [
                ...xs,
                {
                  chip: {
                    id: `tmp-${tmp.current++}`,
                    name: note.title.trim(),
                    kind: "note",
                    status: "ready",
                    detail: "Pasted text",
                  },
                  source: { kind: "note", title: note.title.trim(), text: note.text.trim() },
                },
              ]);
              setNote(null);
            }}
          >
            <div className="flex items-center justify-between">
              <span className="eyebrow text-muted">Paste text as a source</span>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setNote(null)}
                className="text-muted hover:text-foreground cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>
            <input
              aria-label="Note title"
              placeholder="Title, e.g. Ops workshop notes"
              value={note.title}
              onChange={(e) => setNote({ ...note, title: e.target.value })}
              className="border-line bg-surface-sunken text-body-sm focus:border-agent rounded-md border px-3 py-2 outline-none"
            />
            <textarea
              aria-label="Note text"
              rows={4}
              value={note.text}
              onChange={(e) => setNote({ ...note, text: e.target.value })}
              placeholder="Paste the text here"
              className="border-line bg-surface-sunken text-body-sm focus:border-agent field-sizing-content max-h-60 min-h-24 resize-none rounded-md border px-3 py-2 outline-none"
            />
            <Button
              size="sm"
              type="submit"
              className="self-end"
              disabled={!note.title.trim() || !note.text.trim()}
            >
              Attach
            </Button>
          </form>
        ) : undefined
      }
      onSend={(t) => send(t)}
      footer="Enter to send · Shift+Enter for a new line · drop files anywhere"
    />
  );

  return (
    <DropZone
      onFiles={(f) => void addFiles(f)}
      disabled={start.isPending}
      className="bg-background fixed inset-0 flex flex-col overflow-hidden"
    >
      <header className="flex shrink-0 items-center justify-between gap-3 px-4 py-3">
        <Link
          to="/t/$tenantSlug/brd"
          params={{ tenantSlug: tenant.slug }}
          className="text-body-sm text-muted hover:text-foreground flex items-center gap-2"
          aria-label="Back to BRDs"
        >
          <ArrowLeft className="size-4" aria-hidden />
          <Logo withName={false} />
          <span className="hidden sm:inline">BRDs</span>
        </Link>
        <span className="text-caption text-faint flex items-center gap-1.5">
          <MessagesSquare className="size-3.5" aria-hidden />
          <span className="hidden sm:inline">New business requirements document</span>
          <ThemeMenu />
        </span>
      </header>
      {sent ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <ChatThread
            agent={AGENT}
            pending={start.isPending}
            pendingLabel="Starting the document…"
            messages={[
              {
                id: "first",
                role: "user",
                text: sent.text,
                at: new Date().toISOString(),
                attachments: sent.chips,
              },
            ]}
          />
          <div className="mx-auto w-full max-w-3xl px-4 pb-4">
            <ErrorNote error={start.error} />
            {start.error ? (
              <Button
                variant="secondary"
                className="mt-2"
                onClick={() => {
                  setSent(null);
                  start.reset();
                }}
              >
                Try again
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <ChatHome
          kind="Business requirements document"
          title="What are we building?"
          subtitle="Tell me about the change in your own words, or attach notes and documents. I'll write the BRD on the right as we talk, and you can edit anything."
          composer={
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  label="Project"
                  prefix="Project"
                  variant="toolbar"
                  className="w-96 max-w-full"
                  placeholder="Choose the project…"
                  value={projectId ?? ""}
                  onValueChange={(v) => setChosen(v || null)}
                  options={(portfolio?.programs ?? []).flatMap((g) =>
                    (portfolio?.projects ?? [])
                      .filter((p) => p.programId === g.id)
                      .map((p) => ({
                        value: p.id,
                        label: `${p.key} · ${p.name}`,
                        description: p.objective,
                        group: `${g.key} · ${g.name}`,
                      })),
                  )}
                />
                {!projectId ? (
                  <span className="text-caption text-gate-fg">
                    A BRD must belong to a project so it can be tracked.
                  </span>
                ) : null}
              </div>
              {composer}
            </div>
          }
          starters={STARTERS}
          onStarter={(s) => {
            if (s.label === "Upload a document") fileInput.current?.click();
            else if (s.label === "Start from meeting notes") setNote({ title: "Workshop notes", text: "" });
            else setText(s.prompt);
          }}
        />
      )}
      <input
        ref={fileInput}
        type="file"
        multiple
        accept={ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          if (files.length) void addFiles(files);
          e.target.value = "";
        }}
      />
    </DropZone>
  );
}
