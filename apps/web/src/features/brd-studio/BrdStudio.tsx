import { useIsMutating, useMutationState } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type Activity, PresenceBar, reveal, type SplitCollapsed, SplitPane } from "@throughline/collab";
import {
  anchorForKey,
  BRD_STATUS_LABEL,
  BRD_STEPS,
  type Brd,
  type BrdStepId,
  brdScore,
  type CaptureKind,
  checkBrd,
  type Proposal,
  stepOf,
  stepProgress,
} from "@throughline/contracts";
import {
  Badge,
  Button,
  cn,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuTrigger,
  Skeleton,
  Tooltip,
  toast,
} from "@throughline/ui";
import {
  ArrowLeft,
  CircleAlert,
  CloudCheck,
  Download,
  FileText,
  History,
  ListTree,
  LoaderCircle,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Paperclip,
  Send,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import { type ReactNode, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/auth/session";
import { Logo } from "@/components/shell/Logo";
import { useTenant } from "@/tenancy";
import { ThemeMenu } from "@/theme";
import { download } from "../architecture/export/download";
import { ApprovalsPanel } from "../brd/ApprovalsPanel";
import { useBacklogs } from "../brd/api";
import { BacklogView } from "../brd/BacklogView";
import { QualityPanel } from "../brd/QualityPanel";
import { placedSections } from "../brd/sections";
import { ActivityFeed, activityItems } from "./ActivityFeed";
import {
  type OutgoingMessage,
  studioMutation,
  useAddComment,
  useAgentMode,
  useDecideProposal,
  useReplyComment,
  useResolveComment,
  useSendMessage,
  useSetStep,
  useStudio,
} from "./api";
import { BrdEditor } from "./BrdEditor";
import { CaptureForm } from "./CaptureForm";
import { ChatPane } from "./ChatPane";
import { AGENT_ID, allProposals, anchorOf, participants } from "./collab";
import { OutlinePane } from "./OutlinePane";
import { SourcesPane } from "./SourcesPane";
import { StepHeader } from "./StepHeader";
import { StepRail } from "./StepRail";
import { useDocument } from "./useDocument";

type Mode = "write" | "signoff" | "backlog";
type Drawer = "outline" | "sources" | "activity" | null;

/** Which capture form fits the question the agent is asking. */
const FOCUS_KIND: Record<string, CaptureKind> = {
  summary: "text",
  background: "text",
  problem: "text",
  objectives: "objective",
  successCriteria: "success",
  inScope: "scope",
  outOfScope: "scope",
  stakeholders: "stakeholder",
  currentState: "process",
  futureState: "process",
  painPoints: "pain",
  requirements: "requirement",
  rules: "rule",
  nfrs: "nfr",
  data: "data",
  risks: "risk",
  assumptions: "note",
  constraints: "note",
  dependencies: "note",
};

/** How long a "the agent wrote this" marker stays in the document. */
const RECENT_MS = 9000;

function lockReason(brd: Brd, canEdit: boolean): string | null {
  if (!canEdit) return "Your role can read this BRD. A product owner or BA edits it.";
  if (brd.status === "in-review")
    return "Locked while approvers review this version. Request changes in Sign-off to reopen it.";
  if (brd.status === "approved")
    return `v${brd.version} is the approved baseline. Raise a change request in Sign-off to edit it.`;
  return null;
}

function Backlog({ brd }: { brd: Brd }) {
  const backlog = useBacklogs().find((b) => b.brdId === brd.id);
  return backlog ? <BacklogView brd={brd} backlog={backlog} /> : null;
}

const iconButton =
  "text-muted hover:text-foreground hover:bg-surface-raised grid size-8 shrink-0 cursor-pointer place-items-center rounded-md";

/** Chat / Document switch for narrow screens. */
function MobileSwitch({
  value,
  onChange,
}: {
  value: "start" | "end";
  onChange: (v: "start" | "end") => void;
}) {
  return (
    <div role="tablist" aria-label="Show" className="border-line flex rounded-md border p-0.5 lg:hidden">
      {(
        [
          ["start", "Chat", MessageSquare],
          ["end", "Document", FileText],
        ] as const
      ).map(([id, label, Icon]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={value === id}
          onClick={() => onChange(id)}
          className={cn(
            "text-caption flex cursor-pointer items-center gap-1 rounded-xs px-2 py-1 font-semibold",
            value === id ? "bg-agent text-agent-ink" : "text-muted",
          )}
        >
          <Icon className="size-3.5" aria-hidden /> {label}
        </button>
      ))}
    </div>
  );
}

function Studio({ brdId, initialView }: { brdId: string; initialView?: Mode }) {
  const { tenant, can } = useTenant();
  const { brd, thread, sources, comments } = useStudio(brdId);
  const me = useSession().user.name;
  const lock = lockReason(brd, can("brd.edit"));
  const readOnly = lock !== null;
  const { doc, update, flush, state, savedAt } = useDocument(brd, !readOnly);
  const checks = useMemo(() => checkBrd(doc.content), [doc.content]);
  const score = brdScore(checks);
  const errors = checks.filter((c) => c.severity === "error").length;
  const [mode, setMode] = useState<Mode>(initialView ?? (brd.status === "in-review" ? "signoff" : "write"));
  const [drawer, setDrawer] = useState<Drawer>(null);
  const [collapsed, setCollapsed] = useState<SplitCollapsed>(null);
  const [mobile, setMobile] = useState<"start" | "end">("start");
  const [docUpdated, setDocUpdated] = useState(false);
  const progress = useMemo(() => stepProgress(doc.content), [doc.content]);
  const [step, setStep] = useState<BrdStepId>(
    () =>
      (thread.step as BrdStepId | null) ??
      progress.find((p) => p.status === "todo" || p.status === "started")?.step ??
      "review",
  );
  const [kind, setKind] = useState<CaptureKind | null>(null);
  const canComment = can("brd.edit") || can("brd.approve");
  const decide = useDecideProposal(brd.id);
  const addComment = useAddComment(brd.id);
  const reply = useReplyComment(brd.id);
  const resolve = useResolveComment(brd.id);
  const setStepOnServer = useSetStep(brd.id);
  const agentMode = useAgentMode(brd.id);
  const ask = useSendMessage(brd.id);
  const talks = !readOnly;
  const [highlight, setHighlight] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const docScroll = useRef<HTMLDivElement>(null);

  /** Opens the document (on phones too) and scrolls to an element in it. */
  const showInDoc = useCallback((elementId: string, flash = false) => {
    setMode("write");
    setMobile("end");
    setCollapsed((c) => (c === "end" ? null : c));
    setDocUpdated(false);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const el = document.getElementById(elementId);
        reveal(el, { block: flash ? "center" : "start", margin: 88 });
        if (!el || !flash) return;
        const ring = ["ring-2", "ring-agent", "ring-offset-2", "ring-offset-surface"];
        el.classList.add(...ring);
        setTimeout(() => el.classList.remove(...ring), 1400);
      }),
    );
  }, []);
  const jump = useCallback((section: string) => showInDoc(`block-${section}`), [showInDoc]);

  const goStep = useCallback(
    async (id: BrdStepId) => {
      setStep(id);
      setKind(null);
      const first = stepOf(id).sections[0];
      if (first && window.matchMedia?.("(min-width: 64rem)").matches) jump(first);
      if (talks && thread.step !== id) {
        await flush();
        setStepOnServer.mutate(id);
      }
    },
    [talks, thread.step, flush, setStepOnServer, jump],
  );
  // Start the guided conversation on the first visit to an editable BRD.
  const started = useRef(false);
  useEffect(() => {
    if (started.current || !talks || thread.step) return;
    started.current = true;
    setStepOnServer.mutate(step);
  }, [talks, thread.step, step, setStepOnServer]);

  const current = stepOf(step);
  const focusKind = thread.focus ? FOCUS_KIND[thread.focus.split(":")[0] ?? ""] : undefined;
  const captureKind =
    kind ?? (focusKind && current.captures.includes(focusKind) ? focusKind : current.captures[0]) ?? null;
  const signedCount = `${brd.approvals.filter((a) => a.status === "approved").length}/${brd.approvals.length}`;
  const ready = progress.every((p) => p.checks.every((c) => !c.required || c.ok));
  const onSuggestion = (t: string) => {
    const goto = t.match(/^Go to (.+)$/)?.[1];
    const target = goto && BRD_STEPS.find((x) => x.title === goto);
    if (target) {
      void goStep(target.id);
      return true;
    }
    if (/^Submit for sign-off$/i.test(t)) {
      setMode("signoff");
      setMobile("end");
      return true;
    }
    return false;
  };
  const askAgent = async (m: string | OutgoingMessage) => {
    await flush();
    ask.mutate(m);
  };

  /* ── Live editing: mark what the agent just wrote, and take the reader there ── */
  const seen = useRef<Set<string> | null>(null);
  if (seen.current === null) seen.current = new Set(thread.messages.map((m) => m.id));
  const [recent, setRecent] = useState<Proposal[]>([]);
  useEffect(() => {
    const fresh = thread.messages.filter((m) => !seen.current?.has(m.id));
    if (!fresh.length) return;
    for (const m of fresh) seen.current?.add(m.id);
    const written = fresh.flatMap((m) =>
      m.proposals.filter((p) => p.status === "accepted" && p.undo && p.decidedBy === "BA agent"),
    );
    if (!written.length) return;
    setRecent(written);
    const first = anchorForKey(written[0]?.target ?? "")?.heading;
    if (collapsed === "end" || !window.matchMedia?.("(min-width: 64rem)").matches) setDocUpdated(true);
    else if (first)
      requestAnimationFrame(() =>
        reveal(document.getElementById(`block-${first}`), { block: "start", margin: 88 }),
      );
    const t = setTimeout(() => setRecent([]), RECENT_MS);
    return () => clearTimeout(t);
  }, [thread.messages, collapsed]);
  const undo = async (id: string) => {
    await flush();
    decide.mutate({ id, decision: "undo" });
    setRecent((r) => r.filter((p) => p.id !== id));
  };

  /* ── Who's here and what the agent is doing ── */
  const people = useMemo(() => participants(brd, comments, me), [brd, comments, me]);
  const sending = useMutationState({
    filters: { mutationKey: studioMutation(brd.id, "message"), status: "pending" },
    select: (m) => m.state.variables as string | OutgoingMessage | undefined,
  });
  const commenting = useMutationState({
    filters: { mutationKey: studioMutation(brd.id, "comment"), status: "pending" },
    select: (m) => m.state.variables as { anchor: { section: string }; askAgent: boolean } | undefined,
  });
  const replying = useIsMutating({ mutationKey: studioMutation(brd.id, "reply") }) > 0;
  const capturing = useIsMutating({ mutationKey: studioMutation(brd.id, "capture") }) > 0;
  const focusSection = thread.focus
    ? anchorOf({ target: thread.focus.split(":")[0] ?? "", rowId: null } as never).blockId
    : null;
  const activity: Activity | null = (() => {
    const msg = sending[0];
    if (msg !== undefined) {
      const ctx = typeof msg === "string" ? null : msg.context;
      return {
        participantId: AGENT_ID,
        blockId: ctx?.section ?? focusSection ?? current.sections[0] ?? null,
        label: ctx?.quote
          ? "Rewriting the selected text…"
          : thread.autoApply
            ? "Writing into the document…"
            : "Reading and drafting…",
      };
    }
    const c = commenting[0];
    if (c?.askAgent)
      return { participantId: AGENT_ID, blockId: c.anchor.section, label: "Replying to a comment…" };
    if (replying) return { participantId: AGENT_ID, blockId: null, label: "Replying in a thread…" };
    if (capturing) return { participantId: AGENT_ID, blockId: focusSection, label: "Reviewing your entry…" };
    return null;
  })();
  const proposals = useMemo(() => allProposals(thread, comments), [thread, comments]);
  const pending = proposals.filter((p) => p.status === "pending");
  const openComments = comments.filter((c) => !c.resolved);
  const layout = doc.layout;
  const customSections = doc.customSections;
  const feed = useMemo(() => {
    const titles = new Map(
      placedSections({ layout, customSections }, { includeHidden: true }).map((x) => [x.id, x.title]),
    );
    return activityItems(brd, thread, comments, sources, (id) => titles.get(id) ?? id);
  }, [brd, thread, comments, sources, layout, customSections]);
  const agentPerson = people.find((p) => p.id === AGENT_ID) ?? {
    id: AGENT_ID,
    name: "BA agent",
    kind: "agent" as const,
  };
  const cite = useCallback((id: string) => {
    setHighlight(id);
    setDrawer("sources");
    setMobile("end");
    setCollapsed((c) => (c === "end" ? null : c));
  }, []);
  const exportAs = async (format: "docx" | "md") => {
    await flush();
    const now: Brd = { ...brd, ...doc, approvals: brd.approvals };
    const slug = `${brd.id.toLowerCase()}-v${brd.version}`;
    if (format === "docx") {
      const { brdToDocx } = await import("../brd/export/brdDocx");
      download(
        `${slug}.docx`,
        await brdToDocx(now, sources),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      );
      toast.success("Word document downloaded", { description: `${slug}.docx` });
    } else {
      const { brdToMarkdown } = await import("../brd/export/brdMarkdown");
      download(`${slug}.md`, brdToMarkdown(now), "text/markdown");
      toast.success("Markdown downloaded", { description: `${slug}.md` });
    }
  };

  /* ── Chat column ── */
  const chat = (
    <div className="bg-surface flex h-full min-h-0 flex-col">
      <header className="border-line flex shrink-0 items-center gap-2 border-b px-3 py-2">
        <Tooltip content="Back to BRDs" side="bottom">
          <Link
            to="/t/$tenantSlug/brd"
            params={{ tenantSlug: tenant.slug }}
            className="text-muted hover:text-foreground flex shrink-0 items-center gap-1.5 rounded-md px-1 py-1"
            aria-label="Back to BRDs"
          >
            <ArrowLeft className="size-4" aria-hidden />
            <Logo withName={false} />
          </Link>
        </Tooltip>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-body-sm text-strong truncate font-semibold">{doc.title}</span>
          <span className="text-nano text-faint flex items-center gap-1.5 font-mono">
            <Sparkles className="text-agent size-3" aria-hidden />
            BA agent · {thread.agent === "simulated" ? "simulated" : "model"}
          </span>
        </div>
        <MobileSwitch value={mobile} onChange={setMobile} />
        {!readOnly ? (
          <Menu>
            <MenuTrigger asChild>
              <button
                type="button"
                className="text-caption text-muted hover:text-foreground hover:bg-surface-raised hidden h-8 cursor-pointer items-center gap-1.5 rounded-md px-2 sm:flex"
                aria-label="How the agent edits"
              >
                <span className={cn("size-1.5 rounded-full", thread.autoApply ? "bg-agent" : "bg-gate")} />
                {thread.autoApply ? "Live edits" : "Ask first"}
              </button>
            </MenuTrigger>
            <MenuContent align="end">
              <MenuLabel>How the agent edits</MenuLabel>
              <MenuItem onSelect={() => agentMode.mutate(true)}>
                <span className="flex flex-col">
                  <span>Live edits {thread.autoApply ? "✓" : ""}</span>
                  <span className="text-caption text-faint">
                    Writes into the document as you talk; undo any change
                  </span>
                </span>
              </MenuItem>
              <MenuItem onSelect={() => agentMode.mutate(false)}>
                <span className="flex flex-col">
                  <span>Ask first {thread.autoApply ? "" : "✓"}</span>
                  <span className="text-caption text-faint">
                    Suggests changes for you to accept or reject
                  </span>
                </span>
              </MenuItem>
            </MenuContent>
          </Menu>
        ) : null}
        <ThemeMenu className={cn(iconButton, "hidden sm:grid")} />
        {collapsed === "end" ? (
          <Button
            size="sm"
            variant={docUpdated ? "primary" : "secondary"}
            className="hidden lg:inline-flex"
            onClick={() => {
              setCollapsed(null);
              setDocUpdated(false);
            }}
          >
            <PanelRightOpen className="size-3.5" aria-hidden /> Document
            {docUpdated ? <span className="sr-only">(updated)</span> : null}
          </Button>
        ) : (
          <Tooltip content="Collapse the chat" side="bottom">
            <button
              type="button"
              aria-label="Collapse the chat"
              onClick={() => setCollapsed("start")}
              className={cn(iconButton, "hidden lg:grid")}
            >
              <PanelLeftClose className="size-4" />
            </button>
          </Tooltip>
        )}
      </header>
      {docUpdated ? (
        <button
          type="button"
          onClick={() => showInDoc(`block-${anchorForKey(recent[0]?.target ?? "")?.heading ?? "summary"}`)}
          className="border-agent-line bg-agent-wash text-caption text-agent-fg flex shrink-0 cursor-pointer items-center justify-center gap-1.5 border-b px-3 py-1.5 lg:hidden"
        >
          <FileText className="size-3.5" aria-hidden /> The document was updated · view it
        </button>
      ) : null}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col",
          collapsed === "end" && "lg:mx-auto lg:w-full lg:max-w-4xl",
        )}
      >
        <ChatPane
          brdId={brd.id}
          thread={thread}
          sources={sources}
          agent={agentPerson}
          canEdit={!readOnly}
          lockedReason={lock}
          draft={draft}
          setDraft={setDraft}
          beforeDecide={flush}
          onCite={cite}
          onShow={(p) =>
            p.status === "pending"
              ? showInDoc(`suggestion-${p.id}`, true)
              : jump(anchorForKey(p.target)?.heading ?? p.target)
          }
          onSuggestion={onSuggestion}
          header={
            <StepHeader
              step={step}
              progress={progress.find((p) => p.step === step)}
              checks={checks}
              onGo={(id) => void goStep(id)}
              onJump={jump}
              onSignoff={() => {
                setMode("signoff");
                setMobile("end");
              }}
              steps={
                <StepRail
                  progress={progress}
                  current={step}
                  onSelect={(id) => void goStep(id)}
                  signoff={{ signed: signedCount, ready }}
                  onSignoff={() => {
                    setMode("signoff");
                    setMobile("end");
                  }}
                />
              }
            />
          }
          form={
            captureKind && !readOnly ? (
              <CaptureForm
                brdId={brd.id}
                kinds={current.captures}
                kind={captureKind}
                onKind={setKind}
                content={doc.content}
                focus={thread.focus}
                textTargets={current.focuses.filter((f) => ["summary", "problem", "background"].includes(f))}
              />
            ) : undefined
          }
        />
      </div>
    </div>
  );

  /* ── Document panel ── */
  const drawers: { id: Exclude<Drawer, null>; label: string; icon: ReactNode; count?: number }[] = [
    { id: "outline", label: "Outline", icon: <ListTree className="size-4" aria-hidden /> },
    {
      id: "sources",
      label: "Sources",
      icon: <Paperclip className="size-4" aria-hidden />,
      count: sources.length,
    },
    { id: "activity", label: "Activity", icon: <History className="size-4" aria-hidden /> },
  ];
  const modes: { id: Mode; label: string; badge?: string }[] = [
    { id: "write", label: "Document" },
    { id: "signoff", label: "Sign-off", badge: signedCount },
    { id: "backlog", label: "Backlog" },
  ];

  const docPanel = (
    <div className="bg-surface-sunken flex h-full min-h-0 flex-col">
      <header className="border-line bg-surface-nav flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 border-b px-3 py-2">
        {collapsed === "start" ? (
          <Button
            size="sm"
            variant="secondary"
            className="hidden lg:inline-flex"
            onClick={() => setCollapsed(null)}
          >
            <PanelLeftOpen className="size-3.5" aria-hidden /> Chat
          </Button>
        ) : null}
        <MobileSwitch value={mobile} onChange={setMobile} />
        <div role="tablist" aria-label="View" className="border-line bg-surface flex rounded-md border p-0.5">
          {modes.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={mode === m.id}
              onClick={() => {
                void flush();
                setMode(m.id);
              }}
              className={cn(
                "text-caption flex cursor-pointer items-center gap-1.5 rounded-xs px-2.5 py-1 font-semibold",
                mode === m.id ? "bg-agent text-agent-ink" : "text-muted hover:text-foreground",
              )}
            >
              {m.label}
              {m.badge ? <span className="text-nano font-mono opacity-80">{m.badge}</span> : null}
            </button>
          ))}
        </div>
        <Badge
          tone={
            brd.status === "approved"
              ? "ok"
              : brd.status === "in-review"
                ? "gate"
                : brd.status === "changes-requested"
                  ? "risk"
                  : "neutral"
          }
          mono
        >
          {BRD_STATUS_LABEL[brd.status]} · v{brd.version}
        </Badge>
        <span className="text-caption text-muted hidden items-center gap-1.5 xl:flex" aria-live="polite">
          {readOnly ? (
            "Read only"
          ) : state === "saving" ? (
            <>
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden /> Saving…
            </>
          ) : state === "dirty" ? (
            "Editing…"
          ) : state === "error" ? (
            <span className="text-risk-fg">Couldn't save</span>
          ) : (
            <>
              <CloudCheck className="text-ok size-3.5" aria-hidden /> Saved{" "}
              {new Date(savedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
            </>
          )}
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <PresenceBar participants={people} activity={activity} max={4} />
          <Tooltip
            content={`Readiness ${score}/100 · ${errors} blocking, ${checks.length - errors} warnings. Open sign-off.`}
            side="bottom"
          >
            <button
              type="button"
              aria-label={`Readiness ${score} of 100`}
              onClick={() => {
                setMode("signoff");
              }}
              className={cn(
                "text-nano flex cursor-pointer items-center gap-1 rounded-md px-1.5 py-1 font-mono",
                errors ? "text-risk-fg" : checks.length ? "text-gate-fg" : "text-ok",
              )}
            >
              {errors ? (
                <CircleAlert className="size-3.5" aria-hidden />
              ) : checks.length ? (
                <TriangleAlert className="size-3.5" aria-hidden />
              ) : null}
              {score}
              <span className="hidden 2xl:inline">/100 · {errors} blocking</span>
            </button>
          </Tooltip>
          <Menu>
            <Tooltip content="Export" side="bottom">
              <MenuTrigger asChild>
                <button type="button" aria-label="Export" className={iconButton}>
                  <Download className="size-4" />
                </button>
              </MenuTrigger>
            </Tooltip>
            <MenuContent align="end">
              <MenuItem onSelect={() => void exportAs("docx")}>Word document (.docx)</MenuItem>
              <MenuItem onSelect={() => void exportAs("md")}>Markdown (.md)</MenuItem>
            </MenuContent>
          </Menu>
          {!readOnly ? (
            <Button
              size="sm"
              variant="gate"
              onClick={async () => {
                await flush();
                setMode("signoff");
              }}
            >
              <Send className="size-3.5" aria-hidden /> <span className="hidden sm:inline">Submit</span>
            </Button>
          ) : null}
          {collapsed === null ? (
            <Tooltip content="Collapse the document" side="bottom" align="end">
              <button
                type="button"
                aria-label="Collapse the document"
                onClick={() => setCollapsed("end")}
                className={cn(iconButton, "hidden lg:grid")}
              >
                <PanelRightClose className="size-4" />
              </button>
            </Tooltip>
          ) : null}
        </div>
      </header>

      {mode === "write" ? (
        <div className="flex min-h-0 flex-1">
          <nav
            aria-label="Document tools"
            className="border-line bg-surface hidden shrink-0 flex-col gap-1 border-r p-1.5 sm:flex"
          >
            {drawers.map((d) => (
              <Tooltip key={d.id} content={d.label} side="right">
                <button
                  type="button"
                  aria-label={d.label}
                  aria-pressed={drawer === d.id}
                  onClick={() => setDrawer((x) => (x === d.id ? null : d.id))}
                  className={cn(
                    "relative grid size-8 cursor-pointer place-items-center rounded-md",
                    drawer === d.id
                      ? "bg-agent-wash text-agent-fg"
                      : "text-muted hover:bg-surface-raised hover:text-foreground",
                  )}
                >
                  {d.icon}
                  {d.count ? (
                    <span className="bg-ion-soft text-ion-fg text-nano absolute -top-0.5 -right-0.5 grid size-4 place-items-center rounded-full font-mono">
                      {d.count}
                    </span>
                  ) : null}
                </button>
              </Tooltip>
            ))}
          </nav>
          {/* The drawer sits beside the page when there's room and slides over it when the panel is narrow. */}
          <div className="@container relative flex min-h-0 min-w-0 flex-1">
            {drawer ? (
              <aside
                aria-label={drawers.find((d) => d.id === drawer)?.label}
                className="border-line bg-surface animate-rise @max-3xl:shadow-raise flex w-full max-w-72 shrink-0 flex-col border-r @max-3xl:absolute @max-3xl:inset-y-0 @max-3xl:left-0 @max-3xl:z-40"
              >
                <div className="border-line flex items-center justify-between border-b px-3 py-2">
                  <span className="eyebrow text-muted">{drawers.find((d) => d.id === drawer)?.label}</span>
                  <Tooltip content="Close">
                    <button
                      type="button"
                      aria-label="Close"
                      onClick={() => setDrawer(null)}
                      className={iconButton}
                    >
                      <X className="size-4" />
                    </button>
                  </Tooltip>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-3">
                  {drawer === "outline" ? (
                    <OutlinePane
                      doc={doc}
                      update={update}
                      readOnly={readOnly}
                      checks={checks}
                      onJump={jump}
                    />
                  ) : drawer === "activity" ? (
                    <ActivityFeed
                      items={feed}
                      people={people}
                      onOpen={(t) => (t.id ? showInDoc(t.id, true) : jump(t.section))}
                    />
                  ) : (
                    <SourcesPane
                      brdId={brd.id}
                      sources={sources}
                      canEdit={can("brd.edit")}
                      highlight={highlight}
                      onUse={(t) => {
                        setDraft(t);
                        setMobile("start");
                        setCollapsed((c) => (c === "start" ? null : c));
                      }}
                    />
                  )}
                </div>
              </aside>
            ) : null}
            <div ref={docScroll} className="relative min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-6">
              {pending.length || openComments.length ? (
                <div className="mx-auto mb-3 flex max-w-4xl flex-wrap items-center justify-end gap-3">
                  {pending.length ? (
                    <button
                      type="button"
                      onClick={() => showInDoc(`suggestion-${pending[0]?.id}`, true)}
                      className="text-caption text-agent-fg cursor-pointer hover:underline"
                    >
                      {pending.length} suggestion{pending.length > 1 ? "s" : ""} to review
                    </button>
                  ) : null}
                  {openComments.length ? (
                    <button
                      type="button"
                      onClick={() => showInDoc(`thread-${openComments[0]?.id}`, true)}
                      className="text-caption text-gate-fg cursor-pointer hover:underline"
                    >
                      {openComments.length} open comment{openComments.length > 1 ? "s" : ""}
                    </button>
                  ) : null}
                </div>
              ) : null}
              {lock ? (
                <p className="border-line bg-surface text-body-sm text-muted mx-auto mb-4 max-w-4xl rounded-lg border px-4 py-2.5">
                  {lock}
                  {canComment ? " You can still comment." : ""}
                </p>
              ) : null}
              <article className="border-line bg-surface mx-auto w-full max-w-4xl rounded-2xl border px-5 py-6 sm:px-10 sm:py-8">
                <BrdEditor
                  brd={brd}
                  doc={doc}
                  update={update}
                  readOnly={readOnly}
                  checks={checks}
                  people={people}
                  proposals={pending}
                  comments={comments}
                  activity={activity ? { section: activity.blockId, label: activity.label } : null}
                  canComment={canComment}
                  busy={decide.isPending || addComment.isPending || reply.isPending || resolve.isPending}
                  onCite={cite}
                  onAsk={(m) => {
                    setMobile("start");
                    void askAgent(m);
                  }}
                  onDecide={async (id, d) => {
                    await flush();
                    decide.mutate({ id, decision: d });
                  }}
                  onComment={(c) => addComment.mutate(c)}
                  onReply={(threadId, text, askAgentToo) =>
                    reply.mutate({ threadId, text, askAgent: askAgentToo })
                  }
                  onResolve={(threadId, resolved) => resolve.mutate({ threadId, resolved })}
                  recent={recent}
                  onUndo={(id) => void undo(id)}
                />
              </article>
            </div>
          </div>
        </div>
      ) : mode === "signoff" ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 lg:px-8">
          <div className="mx-auto flex max-w-5xl flex-col gap-6">
            <ApprovalsPanel brd={brd} checks={checks} />
            <section className="flex flex-col gap-3">
              <h2 className="font-display text-heading-md text-strong">Quality review</h2>
              <QualityPanel checks={checks} onJump={jump} />
            </section>
          </div>
        </div>
      ) : (
        // The backlog fills the panel and scrolls its own parts (tree, plan, details).
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Suspense fallback={<Skeleton className="m-6 h-96 rounded-2xl" />}>
            <Backlog brd={brd} />
          </Suspense>
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-background fixed inset-0 flex min-h-0 flex-col overflow-hidden">
      <SplitPane
        start={chat}
        end={docPanel}
        startLabel="Chat with the BA agent"
        endLabel="Document"
        collapsed={collapsed}
        mobile={mobile}
        defaultRatio={0.4}
        minStart={340}
        minEnd={460}
        storageKey="throughline.brd-studio.split"
      />
    </div>
  );
}

/** BRD Studio: chat with the BA agent on the left, the live document on the right. */
export function BrdStudio({ brdId, initialView }: { brdId: string; initialView?: Mode }) {
  return (
    <Suspense
      fallback={
        <div
          role="status"
          aria-label="Loading BRD Studio"
          className="bg-background grid h-dvh place-items-center"
        >
          <LoaderCircle className="text-agent size-6 animate-spin" />
        </div>
      }
    >
      <Studio brdId={brdId} initialView={initialView} />
    </Suspense>
  );
}
