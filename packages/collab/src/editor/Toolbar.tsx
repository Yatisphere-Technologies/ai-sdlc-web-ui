import { cn, Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@throughline/ui";
import { type Editor, useEditorState } from "@tiptap/react";
import {
  Bold,
  ChevronDown,
  Italic,
  List,
  ListOrdered,
  Minus,
  Plus,
  Quote,
  Redo2,
  Sparkles,
  Strikethrough,
  Underline,
  Undo2,
} from "lucide-react";
import type { AskAction, SmartBlockSpec } from "./RichEditor";

const STYLES = [
  { id: "p", label: "Text" },
  { id: "h2", label: "Section heading" },
  { id: "h3", label: "Sub-heading" },
] as const;

/** Formatting, block style, insert and "ask the agent about this section", for the cursor's place. */
export function EditorToolbar({
  editor,
  smartBlocks,
  onInsert,
  agentName,
  sectionActions,
  onAsk,
}: {
  editor: Editor;
  smartBlocks: SmartBlockSpec[];
  onInsert: (kind: string) => void;
  agentName: string;
  sectionActions?: (section: string | null) => AskAction[];
  onAsk?: (prompt: string) => void;
}) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      style: e.isActive("heading", { level: 2 }) ? "h2" : e.isActive("heading", { level: 3 }) ? "h3" : "p",
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      ul: e.isActive("bulletList"),
      ol: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
      section: (() => {
        let section: string | null = null;
        const pos = e.state.selection.from;
        e.state.doc.forEach((n, offset) => {
          if (offset <= pos && n.type.name === "heading" && n.attrs.level <= 2)
            section = n.attrs.anchor ?? null;
        });
        return section as string | null;
      })(),
    }),
  });
  const btn = (on: boolean) =>
    cn(
      "grid size-8 shrink-0 cursor-pointer place-items-center rounded-md disabled:cursor-not-allowed disabled:opacity-40",
      on ? "bg-agent-wash text-agent-fg" : "text-muted hover:bg-surface-raised hover:text-foreground",
    );
  const sep = <span className="bg-line mx-1 h-5 w-px shrink-0" aria-hidden />;
  const asks = sectionActions?.(s.section) ?? [];

  return (
    <div
      role="toolbar"
      aria-label="Formatting"
      className="border-line bg-surface/95 sticky top-0 z-30 -mx-2 mb-4 flex flex-wrap items-center gap-0.5 rounded-lg border px-1.5 py-1 backdrop-blur"
    >
      <button
        type="button"
        aria-label="Undo"
        className={btn(false)}
        disabled={!s.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <Undo2 className="size-4" />
      </button>
      <button
        type="button"
        aria-label="Redo"
        className={btn(false)}
        disabled={!s.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <Redo2 className="size-4" />
      </button>
      {sep}
      <Menu>
        <MenuTrigger asChild>
          <button
            type="button"
            aria-label="Text style"
            className="text-body-sm text-foreground hover:bg-surface-raised flex h-8 cursor-pointer items-center gap-1 rounded-md px-2"
          >
            {STYLES.find((x) => x.id === s.style)?.label}
            <ChevronDown className="text-muted size-3.5" aria-hidden />
          </button>
        </MenuTrigger>
        <MenuContent>
          {STYLES.map((x) => (
            <MenuItem
              key={x.id}
              onSelect={() => {
                const c = editor.chain().focus();
                if (x.id === "p") c.setParagraph().run();
                else c.setNode("heading", { level: x.id === "h2" ? 2 : 3, anchor: null }).run();
              }}
            >
              {x.label}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>
      {sep}
      <button
        type="button"
        aria-label="Bold"
        aria-pressed={s.bold}
        className={btn(s.bold)}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold className="size-4" />
      </button>
      <button
        type="button"
        aria-label="Italic"
        aria-pressed={s.italic}
        className={btn(s.italic)}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic className="size-4" />
      </button>
      <button
        type="button"
        aria-label="Underline"
        aria-pressed={s.underline}
        className={btn(s.underline)}
        onClick={() => editor.chain().focus().toggleUnderline().run()}
      >
        <Underline className="size-4" />
      </button>
      <button
        type="button"
        aria-label="Strikethrough"
        aria-pressed={s.strike}
        className={btn(s.strike)}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough className="size-4" />
      </button>
      {sep}
      <button
        type="button"
        aria-label="Bulleted list"
        aria-pressed={s.ul}
        className={btn(s.ul)}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List className="size-4" />
      </button>
      <button
        type="button"
        aria-label="Numbered list"
        aria-pressed={s.ol}
        className={btn(s.ol)}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered className="size-4" />
      </button>
      <button
        type="button"
        aria-label="Quote"
        aria-pressed={s.quote}
        className={btn(s.quote)}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote className="size-4" />
      </button>
      <button
        type="button"
        aria-label="Divider"
        className={btn(false)}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        <Minus className="size-4" />
      </button>
      {smartBlocks.length ? (
        <>
          {sep}
          <Menu>
            <MenuTrigger asChild>
              <button
                type="button"
                className="text-body-sm text-foreground hover:bg-surface-raised flex h-8 cursor-pointer items-center gap-1 rounded-md px-2"
              >
                <Plus className="size-4" aria-hidden /> Insert
                <ChevronDown className="text-muted size-3.5" aria-hidden />
              </button>
            </MenuTrigger>
            <MenuContent>
              <MenuLabel>Structured items</MenuLabel>
              {smartBlocks.map((b) => (
                <MenuItem key={b.kind} onSelect={() => onInsert(b.kind)}>
                  {b.icon ? <span className="text-muted">{b.icon}</span> : null}
                  <span className="flex flex-col">
                    <span>{b.label}</span>
                    {b.description ? <span className="text-caption text-faint">{b.description}</span> : null}
                  </span>
                </MenuItem>
              ))}
            </MenuContent>
          </Menu>
        </>
      ) : null}
      {onAsk ? (
        <div className="ml-auto">
          <Menu>
            <MenuTrigger asChild>
              <button
                type="button"
                aria-label={`Ask ${agentName} about this section`}
                className="text-body-sm text-agent-fg hover:bg-agent-wash flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-2.5 font-semibold"
              >
                <Sparkles className="size-4" aria-hidden /> Ask {agentName}
                <ChevronDown className="size-3.5" aria-hidden />
              </button>
            </MenuTrigger>
            <MenuContent align="end">
              <MenuLabel>About this section</MenuLabel>
              {asks.map((a) => (
                <MenuItem key={a.label} onSelect={() => onAsk(a.prompt)}>
                  {a.label}
                </MenuItem>
              ))}
              {asks.length ? <MenuSeparator /> : null}
              <MenuItem onSelect={() => onAsk("What's still missing?")}>What's still missing?</MenuItem>
            </MenuContent>
          </Menu>
        </div>
      ) : null}
    </div>
  );
}
