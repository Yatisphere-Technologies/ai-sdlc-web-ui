import {
  type ChatAttachment,
  type ChatMessageView,
  ChatThread,
  Composer,
  DropZone,
  type Participant,
} from "@throughline/collab";
import {
  type BrdSource,
  type BrdThread,
  type ChatMessage,
  type Proposal,
  stepOf,
} from "@throughline/contracts";
import { Button, ConfirmDialog, cn, Tooltip, toast } from "@throughline/ui";
import {
  Check,
  ChevronDown,
  CircleCheck,
  CircleX,
  FilePen,
  FileStack,
  ListChecks,
  LocateFixed,
  StickyNote,
  Undo2,
  X,
} from "lucide-react";
import { type ReactNode, Suspense, useRef, useState } from "react";
import { ErrorNote } from "@/components/data/ErrorNote";
import { placedSections } from "../brd/sections";
import { type OutgoingMessage, useAddSource, useDecideProposal, useSendMessage } from "./api";
import { sourceDetail } from "./collab";
import { ACCEPT, extractText, MAX_BYTES } from "./extract";
import { focusLabel, ProposalPreview, TARGET_LABEL } from "./ProposalPreview";
import { WorkspacePicker } from "./SourcesPane";

type Panel = "form" | "workspace" | "note" | null;

/** An edit the agent made straight into the document (live mode), whether or not it was undone since. */
const isEdit = (p: Proposal) =>
  (Boolean(p.undo) || p.decidedBy === "BA agent") && (p.status === "accepted" || p.status === "reverted");

const toChip = (s: BrdSource): ChatAttachment => ({
  id: s.id,
  name: s.title,
  kind: s.kind,
  status: s.status === "failed" ? "failed" : s.status === "linked" ? "linked" : "ready",
  detail: sourceDetail(s),
});

function ProposalRow({
  p,
  canEdit,
  busy,
  onDecide,
  onShow,
}: {
  p: Proposal;
  canEdit: boolean;
  busy: boolean;
  onDecide: (d: "accept" | "reject" | "undo") => void;
  onShow: () => void;
}) {
  const pending = p.status === "pending";
  const live = p.status === "accepted" && Boolean(p.undo);
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-lg border px-3 py-2",
        pending
          ? "border-agent-line bg-agent-wash"
          : live
            ? "border-line bg-surface-raised"
            : "border-line bg-surface-raised opacity-75",
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className={cn(
            "text-body-sm min-w-0 flex-1",
            p.status === "reverted" ? "text-muted line-through" : "text-foreground",
          )}
        >
          {p.summary}
        </span>
        {p.status === "accepted" ? (
          <span className="text-caption text-ok flex shrink-0 items-center gap-1">
            <CircleCheck className="size-3.5" aria-hidden /> {live ? "In the document" : "Accepted"}
          </span>
        ) : null}
        {p.status === "rejected" ? (
          <CircleX className="text-ghost size-4 shrink-0" aria-label="Rejected" />
        ) : null}
        {p.status === "reverted" ? (
          <span className="text-caption text-muted flex shrink-0 items-center gap-1">
            <Undo2 className="size-3.5" aria-hidden /> Undone
          </span>
        ) : null}
      </div>
      <span className="eyebrow text-faint">
        {TARGET_LABEL[p.target] ?? p.target}
        {p.cites.length ? (
          <span className="text-ion-fg normal-case"> · cites {p.cites.join(", ")}</span>
        ) : null}
      </span>
      {pending ? <ProposalPreview p={p} /> : null}
      {pending || live ? (
        <div className="flex flex-wrap gap-1.5">
          {canEdit && pending ? (
            <>
              <Button size="sm" disabled={busy} onClick={() => onDecide("accept")}>
                <Check className="size-3.5" aria-hidden /> Accept
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => onDecide("reject")}>
                <X className="size-3.5" aria-hidden /> Reject
              </Button>
            </>
          ) : null}
          {canEdit && live ? (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => onDecide("undo")}>
              <Undo2 className="size-3.5" aria-hidden /> Undo
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={onShow}>
            <LocateFixed className="size-3.5" aria-hidden /> Show in document
          </Button>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Edits the agent already made to the document, as one compact card (like an assistant's "edited the
 * document" chip). Each line can be undone or located; the whole set can be undone at once.
 */
function EditList({
  edits,
  canEdit,
  busy,
  onDecide,
  onShow,
}: {
  edits: Proposal[];
  canEdit: boolean;
  busy: boolean;
  onDecide: (ids: string[]) => void;
  onShow: (p: Proposal) => void;
}) {
  const [open, setOpen] = useState(edits.length <= 3);
  const [confirm, setConfirm] = useState(false);
  const live = edits.filter((p) => p.status === "accepted" && p.undo);
  const undone = edits.filter((p) => p.status === "reverted").length;
  return (
    <div className="border-line bg-surface-raised flex flex-col rounded-lg border">
      <div className="flex items-center gap-2 px-3 py-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
        >
          <FilePen className="text-agent-fg size-4 shrink-0" aria-hidden />
          <span className="text-body-sm text-strong min-w-0 truncate font-semibold">
            Edited the document · {edits.length} change{edits.length > 1 ? "s" : ""}
          </span>
          {undone ? (
            <span className="text-caption text-muted hidden shrink-0 sm:inline">({undone} undone)</span>
          ) : null}
          <ChevronDown
            className={cn("text-muted ml-auto size-4 shrink-0 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </button>
        {canEdit && live.length > 1 ? (
          <>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirm(true)}>
              <Undo2 className="size-3.5" aria-hidden /> Undo all
            </Button>
            <ConfirmDialog
              open={confirm}
              onOpenChange={setConfirm}
              title={`Undo ${live.length} edits?`}
              description="The agent's changes from this reply are taken out of the document. Anything you've edited since stays as it is."
              confirmLabel={`Undo ${live.length} edits`}
              tone="danger"
              onConfirm={() => {
                setConfirm(false);
                onDecide(live.map((p) => p.id).reverse());
              }}
            >
              <ul className="text-caption text-subtle border-line mt-1 flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md border p-2">
                {live.map((p) => (
                  <li key={p.id} className="truncate">
                    · {p.summary}
                  </li>
                ))}
              </ul>
            </ConfirmDialog>
          </>
        ) : null}
      </div>
      {open ? (
        <ul className="border-line flex flex-col border-t py-1">
          {edits.map((p) => {
            const isLive = p.status === "accepted" && Boolean(p.undo);
            return (
              <li key={p.id} className="hover:bg-surface flex items-center gap-2 px-3 py-1">
                {p.status === "reverted" ? (
                  <Undo2 className="text-faint size-3.5 shrink-0" aria-label="Undone" />
                ) : (
                  <CircleCheck className="text-ok size-3.5 shrink-0" aria-label="In the document" />
                )}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span
                    className={cn(
                      "text-caption truncate",
                      p.status === "reverted" ? "text-muted line-through" : "text-foreground",
                    )}
                    title={p.summary}
                  >
                    {p.summary}
                  </span>
                  <span className="text-nano text-faint font-mono uppercase">
                    {TARGET_LABEL[p.target] ?? p.target}
                    {p.cites.length ? <span className="text-ion-fg"> · {p.cites.join(", ")}</span> : null}
                  </span>
                </span>
                {p.status === "accepted" ? (
                  <Tooltip content="Show in document">
                    <button
                      type="button"
                      aria-label={`Show in document: ${p.summary}`}
                      onClick={() => onShow(p)}
                      className="text-muted hover:text-foreground grid size-7 shrink-0 cursor-pointer place-items-center rounded-md"
                    >
                      <LocateFixed className="size-3.5" />
                    </button>
                  </Tooltip>
                ) : null}
                {isLive && canEdit ? (
                  <Tooltip content="Undo this edit">
                    <button
                      type="button"
                      aria-label={`Undo: ${p.summary}`}
                      disabled={busy}
                      onClick={() => onDecide([p.id])}
                      className="text-muted hover:text-foreground grid size-7 shrink-0 cursor-pointer place-items-center rounded-md disabled:opacity-50"
                    >
                      <Undo2 className="size-3.5" />
                    </button>
                  </Tooltip>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function NoteForm({ busy, onAdd }: { busy: boolean; onAdd: (title: string, text: string) => void }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim() && text.trim()) onAdd(title.trim(), text.trim());
      }}
    >
      <span className="eyebrow text-muted">Paste text as a source</span>
      <input
        aria-label="Note title"
        placeholder="Title, e.g. Ops workshop notes"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="border-line bg-surface-sunken text-body-sm focus:border-agent rounded-md border px-3 py-2 outline-none"
      />
      <textarea
        aria-label="Note text"
        placeholder="Paste meeting notes, an email, a policy extract…"
        rows={4}
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="border-line bg-surface-sunken text-body-sm focus:border-agent field-sizing-content max-h-60 min-h-24 resize-none rounded-md border px-3 py-2 outline-none"
      />
      <Button size="sm" type="submit" className="self-end" disabled={busy || !title.trim() || !text.trim()}>
        Attach note
      </Button>
    </form>
  );
}

/**
 * The conversation with the BA agent, laid out like a modern assistant chat. Attach files, links,
 * notes or platform documents to a message; answer with a structured form when that's quicker.
 */
export function ChatPane({
  brdId,
  thread,
  sources,
  agent,
  canEdit,
  lockedReason,
  draft,
  setDraft,
  beforeDecide,
  onCite,
  onShow,
  header,
  form,
  onSuggestion,
}: {
  brdId: string;
  thread: BrdThread;
  sources: BrdSource[];
  agent: Participant;
  canEdit: boolean;
  lockedReason: string | null;
  draft: string;
  setDraft: (s: string) => void;
  beforeDecide: () => Promise<void>;
  onCite: (id: string) => void;
  /** Scroll the document to a proposal. */
  onShow: (p: Proposal) => void;
  header?: ReactNode;
  /** Structured entry form for the current step. */
  form?: ReactNode;
  /** Handles a quick reply locally (e.g. "Go to Scope"); return true to stop it being sent. */
  onSuggestion?: (s: string) => boolean;
}) {
  const send = useSendMessage(brdId);
  const decide = useDecideProposal(brdId);
  const add = useAddSource(brdId);
  const [panel, setPanel] = useState<Panel>(null);
  const [attached, setAttached] = useState<ChatAttachment[]>([]);
  const tmp = useRef(0);
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const proposals = thread.messages.flatMap((m) => m.proposals);
  const pending = proposals.filter((p) => p.status === "pending");
  const lastAgent = [...thread.messages].reverse().find((m) => m.role === "agent");
  const disabled = Boolean(lockedReason);

  /** Adds a source and swaps the placeholder chip for the real one. */
  const attach = async (
    placeholder: ChatAttachment,
    req: Parameters<typeof add.mutateAsync>[0],
    shown = false,
  ) => {
    if (!shown) setAttached((xs) => [...xs, placeholder]);
    try {
      const before = new Set(sources.map((s) => s.id));
      const state = await add.mutateAsync(req);
      const created = state.sources.find((s) => !before.has(s.id));
      setAttached((xs) => xs.map((x) => (x.id === placeholder.id && created ? toChip(created) : x)));
    } catch {
      setAttached((xs) =>
        xs.map((x) => (x.id === placeholder.id ? { ...x, status: "failed", detail: "Couldn't attach" } : x)),
      );
    }
  };
  const onFiles = async (files: File[]) => {
    for (const file of files.slice(0, 10)) {
      const id = `tmp-${tmp.current++}`;
      if (file.size > MAX_BYTES) {
        setAttached((xs) => [
          ...xs,
          { id, name: file.name, kind: "file", status: "failed", detail: "Over 25 MB" },
        ]);
        continue;
      }
      let text: string | null = null;
      setAttached((xs) => [...xs, { id, name: file.name, kind: "file", status: "uploading" }]);
      try {
        text = await extractText(file);
      } catch {
        text = null;
      }
      await attach(
        { id, name: file.name, kind: "file", status: "uploading" },
        {
          kind: "file",
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
          text,
        },
        true,
      );
    }
  };
  const submit = async (m: OutgoingMessage) => {
    if (send.isPending) return;
    if (onSuggestion?.(m.text) && !m.attachments?.length) return;
    if (/^accept all$/i.test(m.text) && !m.attachments?.length) {
      await beforeDecide();
      decide.mutate({ id: "all", decision: "accept" });
      return;
    }
    await beforeDecide();
    send.mutate(m, {
      onSuccess: () => {
        setDraft("");
        setAttached([]);
      },
    });
  };

  let prevStep: string | null | undefined;
  const sectionTitle = new Map(
    placedSections({ layout: { order: [], titles: {}, hidden: [] }, customSections: [] }).map((s) => [
      s.id,
      s.title,
    ]),
  );
  const view: ChatMessageView[] = thread.messages.map((m: ChatMessage) => {
    const divider = m.step && m.step !== prevStep ? stepOf(m.step).title : null;
    prevStep = m.step ?? prevStep;
    if (m.role === "agent")
      return {
        id: m.id,
        role: "assistant",
        text: m.text,
        at: m.at,
        divider,
        body: m.proposals.length ? (
          <div className="flex flex-col gap-1.5">
            {m.proposals.some(isEdit) ? (
              <EditList
                edits={m.proposals.filter(isEdit)}
                canEdit={canEdit}
                busy={decide.isPending}
                onShow={onShow}
                onDecide={async (ids) => {
                  await beforeDecide();
                  if (ids.length === 1) {
                    decide.mutate({ id: ids[0] ?? "", decision: "undo" });
                    return;
                  }
                  let undone = 0;
                  for (const id of ids)
                    await decide
                      .mutateAsync({ id, decision: "undo", quiet: true })
                      .then(() => undone++)
                      .catch(() => undefined);
                  if (undone === ids.length) toast.success(`${undone} edits undone`);
                  else
                    toast.warning(`${undone} of ${ids.length} edits undone`, {
                      description: "The others were edited since; change them by hand.",
                    });
                }}
              />
            ) : null}
            {m.proposals
              .filter((p) => !isEdit(p))
              .map((p) => (
                <ProposalRow
                  key={p.id}
                  p={p}
                  canEdit={canEdit}
                  busy={decide.isPending}
                  onShow={() => onShow(p)}
                  onDecide={async (d) => {
                    await beforeDecide();
                    decide.mutate({ id: p.id, decision: d });
                  }}
                />
              ))}
          </div>
        ) : undefined,
      };
    const [kind, ...rest] = m.text.split(" · ");
    return {
      id: m.id,
      role: "user",
      text: m.text,
      at: m.at,
      divider,
      attachments: (m.attachments ?? []).map((id) => {
        const s = sourceById.get(id);
        return s
          ? toChip(s)
          : { id, name: id, kind: "file" as const, status: "failed" as const, detail: "Removed" };
      }),
      context: m.context
        ? `${sectionTitle.get(m.context.section) ?? m.context.section}${m.context.rowId ? ` · ${m.context.rowId}` : ""}${m.context.quote ? `: “${m.context.quote}”` : ""}`
        : null,
      card: m.capture ? (
        <div className="border-human-soft bg-surface-raised flex max-w-[calc(100%-3rem)] flex-col gap-1 rounded-2xl border px-4 py-2.5">
          <span className="eyebrow text-human-fg flex items-center gap-1.5">
            <ListChecks className="size-3" aria-hidden /> Added · {kind}
          </span>
          <span className="text-body-sm text-foreground">{rest.join(" · ")}</span>
        </div>
      ) : undefined,
    };
  });

  const cite = (text: string, key: string) => {
    const parts = text.split(/(\bS\d+(?:\.\d+)?\b)/g);
    if (parts.length === 1) return text;
    let at = 0;
    return parts.map((part) => {
      const k = `${key}@${at}`;
      at += part.length;
      return /^S\d+(\.\d+)?$/.test(part) ? (
        <button
          key={k}
          type="button"
          onClick={() => onCite(part)}
          className="bg-ion-soft text-caption text-ion-fg cursor-pointer rounded-xs px-1 font-mono hover:underline"
        >
          {part}
        </button>
      ) : (
        <span key={k}>{part}</span>
      );
    });
  };

  const empty = (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <span className="font-display text-heading-md text-strong">What are we writing?</span>
      <p className="text-body-sm text-muted max-w-sm">
        Describe the change, attach notes or documents, or answer the questions step by step. I propose every
        edit; you decide what goes in.
      </p>
    </div>
  );

  const panelNode =
    panel === "form" && form ? (
      form
    ) : panel === "workspace" ? (
      <div className="flex flex-col gap-2">
        <span className="eyebrow text-muted">Attach a document from this workspace</span>
        <Suspense fallback={<span className="text-caption text-muted">Loading…</span>}>
          <WorkspacePicker
            brdId={brdId}
            busy={add.isPending}
            onPick={(ref) => {
              setPanel(null);
              void attach(
                { id: `tmp-${tmp.current++}`, name: ref, kind: "workspace", status: "uploading" },
                { kind: "workspace", ref },
              );
            }}
          />
        </Suspense>
      </div>
    ) : panel === "note" ? (
      <NoteForm
        busy={add.isPending}
        onAdd={(title, text) => {
          setPanel(null);
          void attach(
            { id: `tmp-${tmp.current++}`, name: title, kind: "note", status: "uploading" },
            { kind: "note", title, text },
          );
        }}
      />
    ) : null;

  return (
    <DropZone onFiles={(f) => void onFiles(f)} disabled={disabled} className="flex h-full min-h-0 flex-col">
      {header}
      {pending.length > 1 && canEdit ? (
        <div className="border-line bg-agent-wash flex items-center justify-between gap-2 border-b px-4 py-2">
          <span className="text-caption text-agent-fg">{pending.length} suggested edits waiting</span>
          <div className="flex gap-1.5">
            <Button
              size="sm"
              disabled={decide.isPending}
              onClick={async () => {
                await beforeDecide();
                decide.mutate({ id: "all", decision: "accept" });
              }}
            >
              Accept all
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={decide.isPending}
              onClick={() => decide.mutate({ id: "all", decision: "reject" })}
            >
              Reject all
            </Button>
          </div>
        </div>
      ) : null}
      <ChatThread
        messages={view}
        agent={agent}
        pending={send.isPending}
        pendingLabel="Reading and drafting…"
        empty={empty}
        transform={cite}
        onOpenAttachment={onCite}
      />
      <div className="flex flex-col gap-2 px-3 pt-1 pb-3">
        <ErrorNote error={send.error ?? decide.error ?? add.error} />
        {lockedReason ? (
          <p className="border-line bg-surface-raised text-caption text-muted rounded-lg border px-3 py-2">
            {lockedReason}
          </p>
        ) : (
          <>
            {thread.focus ? (
              <span className="eyebrow text-agent-fg flex items-center justify-between gap-2 px-1">
                <span>Asking about · {focusLabel(thread.focus)}</span>
                {form && panel !== "form" ? (
                  <button
                    type="button"
                    onClick={() => setPanel("form")}
                    className="text-agent-fg cursor-pointer tracking-normal normal-case hover:underline"
                  >
                    Answer with a form
                  </button>
                ) : null}
              </span>
            ) : null}
            <Composer
              value={draft}
              onChange={setDraft}
              sending={send.isPending}
              placeholder="Reply to the BA agent, or ask for a change…"
              voice
              attachments={attached}
              onRemoveAttachment={(id) => setAttached((xs) => xs.filter((x) => x.id !== id))}
              onFiles={(f) => void onFiles(f)}
              onLink={(url, title, excerpt) =>
                void attach(
                  {
                    id: `tmp-${tmp.current++}`,
                    name: title ?? url.replace(/^https?:\/\/(www\.)?/, ""),
                    kind: "link",
                    status: "uploading",
                  },
                  { kind: "link", url, title, excerpt },
                )
              }
              accept={ACCEPT}
              menu={[
                ...(form
                  ? [
                      {
                        id: "form",
                        label: "Structured entry",
                        hint: "Add a requirement, risk, objective… with a form",
                        icon: <ListChecks className="text-muted size-4" aria-hidden />,
                        onSelect: () => setPanel("form"),
                      },
                    ]
                  : []),
                {
                  id: "workspace",
                  label: "From this workspace",
                  hint: "Architecture documents and other BRDs",
                  icon: <FileStack className="text-muted size-4" aria-hidden />,
                  onSelect: () => setPanel("workspace"),
                },
                {
                  id: "note",
                  label: "Paste text",
                  hint: "Meeting notes, an email, a policy extract",
                  icon: <StickyNote className="text-muted size-4" aria-hidden />,
                  onSelect: () => setPanel("note"),
                },
              ]}
              panel={
                panelNode ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        aria-label="Close panel"
                        onClick={() => setPanel(null)}
                        className="text-muted hover:text-foreground cursor-pointer"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                    {panelNode}
                  </div>
                ) : undefined
              }
              suggestions={lastAgent?.suggestions ?? []}
              onSuggestion={(s) => void submit({ text: s })}
              onSend={(text, ids) => void submit({ text, attachments: ids })}
              footer="Enter to send · Shift+Enter for a new line · drop files anywhere"
            />
          </>
        )}
      </div>
    </DropZone>
  );
}
