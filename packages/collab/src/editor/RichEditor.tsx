import { cn } from "@throughline/ui";
import { Placeholder } from "@tiptap/extensions";
import { type Editor, EditorContent, type JSONContent, useEditor, useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { StarterKit } from "@tiptap/starter-kit";
import {
  Bold,
  Code,
  Italic,
  Link2,
  MessageSquarePlus,
  Sparkles,
  Strikethrough,
  Underline,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  AnchoredHeading,
  Annotations,
  type AnnotationTarget,
  annotationsKey,
  headingBefore,
  KeepAnchorsUnique,
  SectionHints,
  SmartBlock,
  SmartBlockContext,
  type SmartBlockHost,
  type SmartBlockRenderProps,
} from "./extensions";
import { type SlashItem, SlashMenu } from "./SlashMenu";
import { EditorToolbar } from "./Toolbar";

export type { AnnotationTarget, SmartBlockRenderProps };

/** A kind of structured item the author can insert (e.g. "Requirement"). */
export type SmartBlockSpec = {
  kind: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  keywords?: string[];
};

/** Something shown inside the document at a place: a suggestion, a comment thread, the agent working. */
export type Annotation = {
  id: string;
  target: AnnotationTarget;
  highlight?: "agent" | "comment" | null;
  render: () => ReactNode;
};

/** Where in the document a selection or the cursor is: the section (and sub-section) it's in. */
export type DocPlace = { section: string | null; subsection: string | null; quote: string | null };

export type AskAction = { label: string; prompt: string };

const QUICK_ASKS: AskAction[] = [
  { label: "Make it concise", prompt: "Make this concise" },
  { label: "Make it measurable", prompt: "Make this measurable" },
  { label: "More formal", prompt: "Make this more formal" },
  { label: "Fix grammar", prompt: "Fix the grammar" },
];

/** One stable, non-editable element per annotation id, reused across renders. */
function elementFor(map: Map<string, HTMLElement>, id: string) {
  let el = map.get(id);
  if (!el) {
    el = document.createElement("div");
    el.contentEditable = "false";
    el.className = "my-3";
    el.dataset.annotation = id;
    map.set(id, el);
  }
  return el;
}

/** Section heading anchors around a position: the last h2 and the last h3 before it. */
export function placeAt(editor: Editor, pos: number): Omit<DocPlace, "quote"> {
  let section: string | null = null;
  let subsection: string | null = null;
  editor.state.doc.forEach((n, offset) => {
    if (offset > pos || n.type.name !== "heading") return;
    if (n.attrs.level <= 2) {
      section = (n.attrs.anchor as string | null) ?? null;
      subsection = null;
    } else subsection = (n.attrs.anchor as string | null) ?? null;
  });
  return { section, subsection };
}

const PROSE = cn(
  "min-h-96 pb-40 outline-none",
  "[&_h2]:font-display [&_h2]:text-heading-md [&_h2]:text-strong [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:scroll-mt-24",
  "[&_h3]:text-heading-sm [&_h3]:text-strong [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:font-semibold",
  "[&_h1]:font-display [&_h1]:text-heading-lg [&_h1]:text-strong [&_h1]:mt-10 [&_h1]:mb-3",
  "[&_p]:text-body [&_p]:text-foreground [&_p]:my-2 [&_p]:leading-relaxed",
  "[&_li]:text-body [&_li_p]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6",
  "[&_blockquote]:border-line-strong [&_blockquote]:text-subtle [&_blockquote]:border-l-2 [&_blockquote]:pl-4",
  "[&_a]:text-ion-fg [&_strong]:text-strong [&_a]:underline [&_strong]:font-semibold",
  "[&_code]:bg-surface-sunken [&_code]:text-caption [&_code]:rounded-xs [&_code]:px-1 [&_code]:font-mono",
  "[&_hr]:border-line [&_hr]:my-8",
  "[&_.is-empty]:before:text-ghost [&_.is-empty]:before:pointer-events-none [&_.is-empty]:before:float-left [&_.is-empty]:before:h-0 [&_.is-empty]:before:content-[attr(data-placeholder)]",
);

function BubbleBar({
  editor,
  canAsk,
  canComment,
  agentName,
  onAsk,
  onComment,
}: {
  editor: Editor;
  canAsk: boolean;
  canComment: boolean;
  agentName: string;
  onAsk: (prompt: string) => void;
  onComment: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const [linking, setLinking] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [href, setHref] = useState("");
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      link: e.isActive("link"),
    }),
  });
  const btn = (on: boolean) =>
    cn(
      "grid size-8 cursor-pointer place-items-center rounded-md",
      on ? "bg-agent-wash text-agent-fg" : "text-muted hover:bg-surface-raised hover:text-foreground",
    );
  if (linking)
    return (
      <form
        className="flex items-center gap-1.5 p-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (/^https?:\/\/\S+$/i.test(href.trim()))
            editor.chain().focus().setLink({ href: href.trim() }).run();
          setLinking(false);
          setHref("");
        }}
      >
        <input
          // biome-ignore lint/a11y/noAutofocus: opened on request
          autoFocus
          aria-label="Link address"
          value={href}
          onChange={(e) => setHref(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setLinking(false)}
          placeholder="https://…"
          className="border-line bg-surface-sunken text-body-sm focus:border-agent w-64 rounded-md border px-2.5 py-1.5 outline-none"
        />
        <button type="submit" className="text-caption text-agent-fg cursor-pointer px-2 font-semibold">
          Link
        </button>
      </form>
    );
  if (asking)
    return (
      <form
        className="flex w-80 flex-col gap-2 p-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (prompt.trim()) {
            onAsk(prompt.trim());
            setAsking(false);
            setPrompt("");
          }
        }}
      >
        <input
          // biome-ignore lint/a11y/noAutofocus: opened on request
          autoFocus
          aria-label={`Ask ${agentName} about the selection`}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setAsking(false)}
          placeholder={`Ask ${agentName} to change this…`}
          className="border-line bg-surface-sunken text-body-sm focus:border-agent rounded-md border px-2.5 py-1.5 outline-none"
        />
        <div className="flex flex-wrap gap-1">
          {QUICK_ASKS.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => {
                onAsk(q.prompt);
                setAsking(false);
              }}
              className="border-line text-caption text-subtle hover:border-agent-line hover:text-agent-fg cursor-pointer rounded-full border px-2.5 py-0.5"
            >
              {q.label}
            </button>
          ))}
        </div>
      </form>
    );
  return (
    // Buttons keep the editor's selection: clicking them must not move focus out of the text.
    // biome-ignore lint/a11y/noStaticElementInteractions: only prevents focus loss; each control is a button
    <div className="flex items-center gap-0.5" onMouseDown={(e) => e.preventDefault()}>
      {editor.isEditable ? (
        <>
          <button
            type="button"
            aria-label="Bold"
            aria-pressed={active.bold}
            className={btn(active.bold)}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Italic"
            aria-pressed={active.italic}
            className={btn(active.italic)}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Underline"
            aria-pressed={active.underline}
            className={btn(active.underline)}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <Underline className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Strikethrough"
            aria-pressed={active.strike}
            className={btn(active.strike)}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <Strikethrough className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Inline code"
            aria-pressed={active.code}
            className={btn(active.code)}
            onClick={() => editor.chain().focus().toggleCode().run()}
          >
            <Code className="size-4" />
          </button>
          <button
            type="button"
            aria-label={active.link ? "Remove link" : "Add link"}
            aria-pressed={active.link}
            className={btn(active.link)}
            onClick={() => {
              if (active.link) editor.chain().focus().unsetLink().run();
              else setLinking(true);
            }}
          >
            <Link2 className="size-4" />
          </button>
          <span className="bg-line mx-1 h-5 w-px" aria-hidden />
        </>
      ) : null}
      {canAsk ? (
        <button
          type="button"
          onClick={() => setAsking(true)}
          className="text-caption text-agent-fg hover:bg-agent-wash flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 font-semibold"
        >
          <Sparkles className="size-3.5" aria-hidden /> Ask {agentName}
        </button>
      ) : null}
      {canComment ? (
        <button
          type="button"
          onClick={onComment}
          className="text-caption text-foreground hover:bg-surface-raised flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1.5 font-semibold"
        >
          <MessageSquarePlus className="size-3.5" aria-hidden /> Comment
        </button>
      ) : null}
    </div>
  );
}

/**
 * A free-flowing rich-text document editor, like a modern docs app: headings, lists, quotes,
 * formatting, links, a "/" menu, drag-to-move blocks, and the host's structured "smart blocks"
 * typed inline. Collaboration is layered on top: annotations (suggestions, comment threads, the
 * agent at work) render in place, and selecting text offers "Ask agent" and "Comment".
 *
 * The value is ProseMirror JSON; the host persists it and derives whatever it needs from it.
 */
export function RichEditor({
  value,
  onChange,
  editable = true,
  placeholder = "Write, or type / for blocks…",
  smartBlocks = [],
  host,
  createSmartBlock,
  copySmartBlock,
  annotations = [],
  agentName = "agent",
  onAsk,
  onComment,
  sectionActions,
  sectionHint,
  header,
  className,
}: {
  value: JSONContent;
  onChange: (json: JSONContent) => void;
  editable?: boolean;
  placeholder?: string;
  smartBlocks?: SmartBlockSpec[];
  /** Renders smart blocks and computes their refs. */
  host: SmartBlockHost;
  /** New item data for a kind inserted from the / menu or the toolbar; null cancels. */
  createSmartBlock?: (kind: string) => Record<string, unknown> | null;
  /** A pasted or duplicated item needs a fresh id; return null to drop the copy. */
  copySmartBlock?: (
    kind: string,
    data: Record<string, unknown>,
    taken: Set<string>,
  ) => Record<string, unknown> | null;
  annotations?: Annotation[];
  agentName?: string;
  /** Ask the agent about the selection or the section at the cursor. */
  onAsk?: (place: DocPlace, prompt: string) => void;
  /** Start a comment on the selection. */
  onComment?: (place: DocPlace) => void;
  /** Quick asks for the section the cursor is in (toolbar menu). */
  sectionActions?: (section: string | null) => AskAction[];
  /** Placeholder for an empty line right under a section heading, e.g. what the section is for. */
  sectionHint?: (anchor: string) => string | null;
  /** Content above the editable text (title, metadata). */
  header?: ReactNode;
  className?: string;
}) {
  const latest = useRef(value);
  const emit = useRef(onChange);
  emit.current = onChange;
  const slashKey = useRef<((e: KeyboardEvent) => boolean) | null>(null);
  const hints = useRef(sectionHint);
  hints.current = sectionHint;
  const editor = useEditor(
    {
      editable,
      immediatelyRender: true,
      content: value,
      extensions: [
        StarterKit.configure({
          heading: false,
          link: { openOnClick: false, autolink: true, protocols: ["https", "http"] },
        }),
        AnchoredHeading.configure({ levels: [1, 2, 3] }),
        SmartBlock,
        Annotations,
        KeepAnchorsUnique.configure({
          copyBlock: copySmartBlock ?? (() => null),
          refOf: host.refOf,
        }),
        Placeholder.configure({
          placeholder: ({ node, pos, editor: e }) => {
            if (node.type.name === "heading") return "Heading";
            const view = e.isInitialized ? e.view : null;
            const anchor = view ? headingBefore(view.state.doc, pos) : null;
            return (anchor !== null && hints.current?.(anchor)) || placeholder;
          },
        }),
        SectionHints.configure({ hint: (a) => hints.current?.(a) ?? null }),
      ],
      editorProps: {
        attributes: { class: PROSE, "aria-label": "Document", "aria-multiline": "true", role: "textbox" },
        handleKeyDown: (_view, event) => slashKey.current?.(event) ?? false,
      },
      onUpdate: ({ editor: e }) => {
        const json = e.getJSON();
        latest.current = json;
        emit.current(json);
      },
    },
    [],
  );

  // Follow the value from outside (e.g. the agent's accepted change) without disturbing typing.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (JSON.stringify(value) === JSON.stringify(latest.current)) return;
    latest.current = value;
    const { from, to } = editor.state.selection;
    editor.commands.setContent(value, { emitUpdate: false });
    const max = editor.state.doc.content.size;
    editor.commands.setTextSelection({ from: Math.min(from, max), to: Math.min(to, max) });
  }, [editor, value]);

  useEffect(() => {
    if (editor && !editor.isDestroyed) editor.setEditable(editable);
  }, [editor, editable]);

  // Portals for annotations: one stable element per id, placed by the Annotations plugin.
  const els = useRef(new Map<string, HTMLElement>());
  const elFor = (id: string) => elementFor(els.current, id);

  // Re-place widgets only when what's placed (or where) changes, not on every render.
  const placement = JSON.stringify(annotations.map((a) => [a.id, a.target, a.highlight ?? null]));
  const placed = useMemo(
    () =>
      (JSON.parse(placement) as [string, AnnotationTarget, Annotation["highlight"]][]).map(
        ([id, target, highlight]) => ({
          id,
          target,
          highlight: highlight ?? null,
          el: elementFor(els.current, id),
        }),
      ),
    [placement],
  );
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.view.dispatch(editor.state.tr.setMeta(annotationsKey, placed).setMeta("addToHistory", false));
  }, [editor, placed]);

  const slashItems = useMemo<SlashItem[]>(
    () => [
      {
        id: "h2",
        label: "Section heading",
        description: "Starts a new section",
        group: "Text",
        keywords: ["h2", "heading", "section"],
      },
      { id: "h3", label: "Sub-heading", group: "Text", keywords: ["h3", "subheading"] },
      { id: "p", label: "Text", group: "Text", keywords: ["paragraph", "plain"] },
      { id: "ul", label: "Bulleted list", group: "Text", keywords: ["bullet", "list", "ul"] },
      { id: "ol", label: "Numbered list", group: "Text", keywords: ["numbered", "ordered", "ol"] },
      { id: "quote", label: "Quote", group: "Text", keywords: ["blockquote"] },
      { id: "hr", label: "Divider", group: "Text", keywords: ["rule", "line", "hr"] },
      ...smartBlocks.map((s) => ({
        id: `smart:${s.kind}`,
        label: s.label,
        description: s.description,
        icon: s.icon,
        group: "Structured items",
        keywords: s.keywords ?? [],
      })),
    ],
    [smartBlocks],
  );

  const insertSmart = (kind: string) => {
    if (!editor || !createSmartBlock) return;
    const data = createSmartBlock(kind);
    if (!data) return;
    editor
      .chain()
      .focus()
      .insertContent({ type: "smartBlock", attrs: { kind, data, ref: host.refOf(kind, data) } })
      .run();
  };

  const runSlash = (id: string, range: { from: number; to: number }) => {
    if (!editor) return;
    const chain = editor.chain().focus().deleteRange(range);
    if (id === "h2") chain.setNode("heading", { level: 2, anchor: null }).run();
    else if (id === "h3") chain.setNode("heading", { level: 3, anchor: null }).run();
    else if (id === "p") chain.setParagraph().run();
    else if (id === "ul") chain.toggleBulletList().run();
    else if (id === "ol") chain.toggleOrderedList().run();
    else if (id === "quote") chain.toggleBlockquote().run();
    else if (id === "hr") chain.setHorizontalRule().run();
    else if (id.startsWith("smart:")) {
      chain.run();
      insertSmart(id.slice(6));
    }
  };

  const selectionPlace = (): DocPlace | null => {
    if (!editor) return null;
    const { from, to } = editor.state.selection;
    const quote = editor.state.doc.textBetween(from, to, " ").trim().slice(0, 2000) || null;
    return { ...placeAt(editor, from), quote };
  };

  if (!editor) return null;
  return (
    <SmartBlockContext.Provider value={host}>
      <div className={cn("relative flex flex-col", className)}>
        {editable ? (
          <EditorToolbar
            editor={editor}
            smartBlocks={smartBlocks}
            onInsert={insertSmart}
            agentName={agentName}
            sectionActions={sectionActions}
            onAsk={
              onAsk
                ? (prompt) => onAsk({ ...placeAt(editor, editor.state.selection.from), quote: null }, prompt)
                : undefined
            }
          />
        ) : null}
        {header}
        <EditorContent editor={editor} />
        <BubbleMenu
          editor={editor}
          options={{ placement: "top" }}
          shouldShow={({ state, from, to }) =>
            from !== to &&
            state.doc.textBetween(from, to, " ").trim().length > 0 &&
            !state.selection.toJSON().type?.includes("node")
          }
          className="border-line-strong bg-surface shadow-raise z-40 rounded-lg border p-1"
          role="toolbar"
          aria-label="Selected text"
        >
          <BubbleBar
            editor={editor}
            agentName={agentName}
            canAsk={Boolean(onAsk) && editable}
            canComment={Boolean(onComment)}
            onAsk={(prompt) => {
              const p = selectionPlace();
              if (p && onAsk) onAsk(p, prompt);
            }}
            onComment={() => {
              const p = selectionPlace();
              if (p && onComment) onComment(p);
            }}
          />
        </BubbleMenu>
        {editable ? (
          <SlashMenu editor={editor} items={slashItems} onRun={runSlash} keyHandler={slashKey} />
        ) : null}
        {annotations.map((a) => createPortal(a.render(), elFor(a.id), a.id))}
      </div>
    </SmartBlockContext.Provider>
  );
}
