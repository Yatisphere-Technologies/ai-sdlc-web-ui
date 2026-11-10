import {
  type Annotation,
  Avatar,
  CommentBox,
  type DocPlace,
  type Participant,
  RichEditor,
  type SmartBlockRenderProps,
  type SmartBlockSpec,
  SuggestionCard,
  ThreadCard,
} from "@throughline/collab";
import {
  anchorForKey,
  BRD_SECTION_SPEC,
  type Brd,
  type BrdCheck,
  type BusinessRequirement,
  type CommentThread,
  type DocNode,
  deriveFromBody,
  type Proposal,
  rowRef,
} from "@throughline/contracts";
import {
  BookOpen,
  CircleHelp,
  Database,
  Footprints,
  Gauge,
  ListChecks,
  ScrollText,
  ShieldAlert,
  Target,
  Users,
} from "lucide-react";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { blankRow, SECTIONS, type Section } from "../brd/sections";
import type { OutgoingMessage } from "./api";
import { DocumentHeader, GENERIC_ACTIONS, RequirementCard, RowCard, SECTION_ACTIONS } from "./BrdBlocks";
import { AGENT_ID, personId, textChange } from "./collab";
import { ProposalPreview } from "./ProposalPreview";
import type { LocalDoc } from "./useDocument";

type Update = (fn: (d: LocalDoc) => LocalDoc) => void;
type Row = Record<string, unknown>;
type RowsSection = Extract<Section, { kind: "rows" }>;

const ROW_SECTIONS = new Map(
  SECTIONS.filter((s): s is RowsSection => s.kind === "rows").map((s) => [s.key as string, s]),
);

const icon = (I: typeof Target) => <I className="size-4" aria-hidden />;

/** Structured items the author can type into the document. */
export const BRD_SMART_BLOCKS: SmartBlockSpec[] = [
  {
    kind: "requirements",
    label: "Requirement",
    description: "Who needs to do what, with acceptance criteria",
    icon: icon(ListChecks),
    keywords: ["br", "need", "shall"],
  },
  {
    kind: "objectives",
    label: "Objective",
    description: "Measurable outcome with a KPI and target",
    icon: icon(Target),
    keywords: ["kpi", "goal", "okr"],
  },
  {
    kind: "rules",
    label: "Business rule",
    description: "A policy the solution must enforce",
    icon: icon(ScrollText),
    keywords: ["policy", "rule"],
  },
  {
    kind: "nfrs",
    label: "Non-functional requirement",
    description: "Availability, performance, security…",
    icon: icon(Gauge),
    keywords: ["nfr", "quality", "performance"],
  },
  {
    kind: "risks",
    label: "Risk",
    description: "Impact, likelihood, mitigation, owner",
    icon: icon(ShieldAlert),
    keywords: ["risk", "issue"],
  },
  {
    kind: "stakeholders",
    label: "Stakeholder",
    description: "Name, role and RACI",
    icon: icon(Users),
    keywords: ["raci", "person", "owner"],
  },
  {
    kind: "data",
    label: "Data item",
    description: "Entity, classification, retention",
    icon: icon(Database),
    keywords: ["data", "entity"],
  },
  {
    kind: "currentState",
    label: "Current step",
    description: "How it works today",
    icon: icon(Footprints),
    keywords: ["as-is", "process"],
  },
  {
    kind: "futureState",
    label: "Future step",
    description: "How it will work",
    icon: icon(Footprints),
    keywords: ["to-be", "process"],
  },
  { kind: "glossary", label: "Glossary term", icon: icon(BookOpen), keywords: ["term", "definition"] },
  { kind: "openQuestions", label: "Open question", icon: icon(CircleHelp), keywords: ["question", "tbd"] },
];

/** Section id → the kind of items it holds (for anchoring comments on an item). */
const KIND_OF_SECTION = new Map(
  BRD_SECTION_SPEC.flatMap((s) => ("rows" in s ? [[s.id, s.rows] as const] : [])),
);

export type EditorActivity = { section: string | null; label: string } | null;

/** The BRD as a free-flowing document: write freely, type structured items inline, work with the agent in place. */
export function BrdEditor({
  brd,
  doc,
  update,
  readOnly,
  checks,
  people,
  proposals,
  comments,
  activity,
  canComment,
  busy,
  onCite,
  onAsk,
  onDecide,
  onComment,
  onReply,
  onResolve,
  recent = [],
  onUndo,
}: {
  brd: Brd;
  doc: LocalDoc;
  update: Update;
  readOnly: boolean;
  checks: BrdCheck[];
  people: Participant[];
  /** Pending proposals from the chat and comment threads. */
  proposals: Proposal[];
  comments: CommentThread[];
  activity: EditorActivity;
  canComment: boolean;
  busy: boolean;
  onCite: (id: string) => void;
  onAsk: (m: OutgoingMessage) => void;
  onDecide: (id: string, d: "accept" | "reject") => void;
  onComment: (c: {
    anchor: { section: string; rowId: string | null; quote: string | null };
    text: string;
    askAgent: boolean;
  }) => void;
  onReply: (threadId: string, text: string, askAgent: boolean) => void;
  onResolve: (threadId: string, resolved: boolean) => void;
  /** Edits the agent just wrote into the document, marked where they landed for a few seconds. */
  recent?: Proposal[];
  onUndo?: (id: string) => void;
}) {
  const [draft, setDraft] = useState<DocPlace | null>(null);
  const peopleById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const agent = peopleById.get(AGENT_ID);
  const content = doc.content;

  const onChange = useCallback(
    (json: unknown) =>
      update((d) => {
        const body = json as DocNode;
        const derived = deriveFromBody(body, d.content);
        return { ...d, body, ...derived };
      }),
    [update],
  );

  const objectiveIds = useMemo(() => content.objectives.map((o) => o.id), [content.objectives]);
  const host = useMemo(
    () => ({
      refOf: (kind: string, data: Row) => rowRef(kind, data),
      render: (p: SmartBlockRenderProps): ReactNode => {
        const own = checks.filter((c) => c.target !== null && c.target === p.data.id);
        if (p.kind === "requirements")
          return (
            <RequirementCard
              r={p.data as unknown as BusinessRequirement}
              objectives={objectiveIds}
              readOnly={!p.editable}
              checks={own}
              onCite={onCite}
              onAsk={p.editable ? (text) => onAsk({ text }) : undefined}
              onChange={(next) => p.update(next as unknown as Row)}
              onRemove={p.remove}
            />
          );
        const section = ROW_SECTIONS.get(p.kind);
        if (!section) return <p className="text-caption text-risk-fg">Unknown item type: {p.kind}</p>;
        return (
          <div className="flex flex-col gap-1">
            <span className="eyebrow text-faint">
              {BRD_SMART_BLOCKS.find((b) => b.kind === p.kind)?.label}
            </span>
            <RowCard
              section={section}
              row={p.data}
              readOnly={!p.editable}
              checks={checks}
              onCite={onCite}
              onChange={p.update}
              onRemove={p.remove}
            />
          </div>
        );
      },
    }),
    [checks, objectiveIds, onCite, onAsk],
  );

  const createSmartBlock = (kind: string) => {
    const section = ROW_SECTIONS.get(kind);
    if (!section) return null;
    const rows = (content as unknown as Record<string, Row[]>)[kind] ?? [];
    const row = blankRow(section, rows);
    if (kind === "requirements") row.objective = content.objectives[0]?.id ?? "";
    return row;
  };
  const copySmartBlock = (kind: string, data: Row) => {
    const section = ROW_SECTIONS.get(kind);
    if (!section) return null;
    const rows = (content as unknown as Record<string, Row[]>)[kind] ?? [];
    if ("id" in data && section.idPrefix) return { ...data, id: blankRow(section, rows).id };
    for (const k of ["name", "term", "entity", "step"])
      if (typeof data[k] === "string") return { ...data, [k]: `${data[k]} (copy)` };
    return null;
  };

  const annotations: Annotation[] = [];
  for (const p of proposals) {
    const change = textChange(content, p);
    const heading = anchorForKey(p.target)?.heading ?? p.target;
    annotations.push({
      id: `s-${p.id}`,
      target: p.rowId ? { block: `${p.target}:${p.rowId}`, heading } : { heading },
      render: () => (
        <SuggestionCard
          s={{
            id: p.id,
            blockId: heading,
            rowId: p.rowId,
            authorId: AGENT_ID,
            summary: p.summary,
            before: change?.before ?? null,
            after: change?.after ?? null,
            detail: change ? undefined : <ProposalPreview p={p} />,
            cites: p.cites,
          }}
          author={agent}
          canDecide={!readOnly}
          busy={busy}
          onDecide={onDecide}
          renderCite={(id) => (
            <button type="button" onClick={() => onCite(id)} className="cursor-pointer hover:underline">
              {id}
            </button>
          )}
        />
      ),
    });
  }
  for (const c of comments) {
    if (c.resolved) continue;
    const kind = KIND_OF_SECTION.get(c.anchor.section);
    annotations.push({
      id: `c-${c.id}`,
      target: {
        heading: c.anchor.section,
        block: c.anchor.rowId && kind ? `${kind}:${c.anchor.rowId}` : null,
        quote: c.anchor.quote,
      },
      highlight: "comment",
      render: () => (
        <ThreadCard
          t={{
            id: c.id,
            blockId: c.anchor.section,
            rowId: c.anchor.rowId,
            quote: c.anchor.quote,
            resolved: c.resolved,
            messages: c.messages.map((m) => ({
              id: m.id,
              authorId: m.role === "agent" ? AGENT_ID : personId(m.author),
              text: m.text,
              at: m.at,
              detail: m.proposals.length ? (
                <ul className="text-caption text-agent-fg flex flex-col gap-0.5">
                  {m.proposals.map((p) => (
                    <li key={p.id}>
                      {p.status === "pending"
                        ? `Suggested: ${p.summary} (shown in the document)`
                        : `${p.status === "accepted" ? "Accepted" : "Rejected"}: ${p.summary}`}
                    </li>
                  ))}
                </ul>
              ) : undefined,
            })),
          }}
          people={peopleById}
          canComment={canComment}
          busy={busy}
          agentName="BA agent"
          onReply={onReply}
          onResolve={onResolve}
        />
      ),
    });
  }
  if (draft) {
    const section = draft.section ?? "summary";
    annotations.push({
      id: "draft-comment",
      target: { heading: draft.subsection ?? section, quote: draft.quote },
      highlight: "comment",
      render: () => (
        <div className="border-gate-line bg-surface-raised rounded-lg border px-3 py-2.5">
          <CommentBox
            autoFocus
            quote={draft.quote}
            busy={busy}
            agentName="BA agent"
            onCancel={() => setDraft(null)}
            onSubmit={(text, askAgent) => {
              onComment({ anchor: { section, rowId: null, quote: draft.quote }, text, askAgent });
              setDraft(null);
            }}
          />
        </div>
      ),
    });
  }
  const recentByHeading = new Map<string, Proposal[]>();
  for (const p of recent) {
    const heading = anchorForKey(p.target)?.heading ?? p.target;
    recentByHeading.set(heading, [...(recentByHeading.get(heading) ?? []), p]);
  }
  for (const [heading, ps] of recentByHeading) {
    annotations.push({
      id: `live-${heading}`,
      target: { heading },
      render: () => (
        <div
          className="border-agent-line bg-agent-wash animate-rise flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-1.5"
          aria-live="polite"
        >
          <Avatar p={agent} size="sm" />
          <span className="text-caption text-agent-fg min-w-0 flex-1">
            BA agent wrote {ps.length === 1 ? `“${ps[0]?.summary}”` : `${ps.length} changes`} here
          </span>
          {onUndo && !readOnly
            ? ps.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onUndo(p.id)}
                  className="text-caption text-agent-fg cursor-pointer font-semibold hover:underline"
                  title={p.summary}
                >
                  Undo{ps.length > 1 ? ` ${p.summary.slice(0, 24)}…` : ""}
                </button>
              ))
            : null}
        </div>
      ),
    });
  }
  if (activity) {
    annotations.unshift({
      id: "agent-activity",
      target: { heading: activity.section },
      render: () => (
        <div
          className="border-agent-line bg-agent-wash flex items-center gap-2.5 rounded-lg border px-3 py-2"
          aria-live="polite"
        >
          <Avatar p={agent} size="sm" />
          <span className="text-caption text-agent-fg">{activity.label}</span>
          <span className="bg-working ml-auto h-1.5 w-24 rounded-full" aria-hidden />
        </div>
      ),
    });
  }

  return (
    <RichEditor
      value={doc.body as never}
      onChange={onChange}
      editable={!readOnly}
      smartBlocks={BRD_SMART_BLOCKS}
      host={host}
      createSmartBlock={createSmartBlock}
      copySmartBlock={copySmartBlock}
      annotations={annotations}
      agentName="BA agent"
      onAsk={
        readOnly
          ? undefined
          : (place, prompt) =>
              onAsk({
                text: prompt,
                context: place.section ? { section: place.section, rowId: null, quote: place.quote } : null,
              })
      }
      onComment={canComment ? (place) => setDraft(place) : undefined}
      sectionActions={(section) =>
        (section ? (SECTION_ACTIONS[section] ?? GENERIC_ACTIONS) : GENERIC_ACTIONS).map((a) => ({
          label: a.label,
          prompt: a.prompt,
        }))
      }
      sectionHint={(anchor) => {
        const s = SECTIONS.find((x) => x.id === anchor);
        if (s) return readOnly ? null : `${s.hint} Type, or / to insert.`;
        const list = SECTIONS.flatMap((x) => (x.kind === "list" ? x.keys : [])).find((k) => k.key === anchor);
        return list && !readOnly ? `${list.label}: one per bullet. Type - to start a list.` : null;
      }}
      header={<DocumentHeader brd={brd} doc={doc} update={update} readOnly={readOnly} />}
    />
  );
}
