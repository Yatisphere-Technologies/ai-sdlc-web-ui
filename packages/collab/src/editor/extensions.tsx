import { cn } from "@throughline/ui";
import { Extension, mergeAttributes, Node } from "@tiptap/core";
import { Heading } from "@tiptap/extension-heading";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { NodeViewWrapper, type ReactNodeViewProps, ReactNodeViewRenderer } from "@tiptap/react";
import { GripVertical } from "lucide-react";
import { createContext, type ReactNode, useContext } from "react";

/* ── Headings that know which section they start ───────────────────────────────────────────── */

/** Heading with a stable `anchor` id, so comments, suggestions and the host's data can find it. */
export const AnchoredHeading = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      anchor: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-anchor"),
        renderHTML: (attrs) =>
          attrs.anchor ? { "data-anchor": attrs.anchor, id: `block-${attrs.anchor}` } : {},
      },
    };
  },
});

/* ── Smart blocks: structured items inside the free text ───────────────────────────────────── */

export type SmartBlockRenderProps = {
  kind: string;
  refId: string;
  data: Record<string, unknown>;
  selected: boolean;
  editable: boolean;
  update: (data: Record<string, unknown>) => void;
  remove: () => void;
};

export type SmartBlockHost = {
  render: (p: SmartBlockRenderProps) => ReactNode;
  refOf: (kind: string, data: Record<string, unknown>) => string;
};

export const SmartBlockContext = createContext<SmartBlockHost | null>(null);

function SmartBlockView({ node, selected, deleteNode, updateAttributes, editor }: ReactNodeViewProps) {
  const host = useContext(SmartBlockContext);
  const kind = String(node.attrs.kind ?? "");
  const data = (node.attrs.data ?? {}) as Record<string, unknown>;
  const refId = String(node.attrs.ref ?? "");
  return (
    <NodeViewWrapper
      id={`block-${refId}`}
      data-smart-block={kind}
      data-ref={refId}
      className={cn(
        "group/smart relative my-3 scroll-mt-24 rounded-xl",
        selected && "ring-agent ring-offset-surface ring-2 ring-offset-2",
      )}
    >
      {editor.isEditable ? (
        <button
          type="button"
          data-drag-handle
          draggable
          contentEditable={false}
          aria-label="Drag to move"
          className="text-ghost hover:text-muted absolute top-3 -left-6 hidden cursor-grab group-hover/smart:block"
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
      ) : null}
      <div contentEditable={false}>
        {host
          ? host.render({
              kind,
              refId,
              data,
              selected,
              editable: editor.isEditable,
              update: (next) => updateAttributes({ data: next, ref: host.refOf(kind, next) }),
              remove: deleteNode,
            })
          : null}
      </div>
    </NodeViewWrapper>
  );
}

/**
 * An atom block that holds a structured item (`attrs.data`), rendered by the host. It moves, copies
 * and deletes like any other block; its fields are edited in place.
 */
export const SmartBlock = Node.create({
  name: "smartBlock",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return {
      kind: { default: "" },
      ref: { default: "" },
      data: { default: {} },
    };
  },
  parseHTML() {
    return [{ tag: "div[data-smart-block]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-smart-block": HTMLAttributes.kind })];
  },
  addNodeView() {
    return ReactNodeViewRenderer(SmartBlockView);
  },
});

/* ── Keeping anchors and item refs unique ──────────────────────────────────────────────────── */

let counter = 0;
const newAnchor = () => `custom-${Date.now().toString(36)}${(counter++).toString(36)}`;

/**
 * New top-level headings get an anchor so they become sections; copies of headings and of smart
 * blocks get fresh ids (via `copyBlock`) or are dropped, so every anchor and ref stays unique.
 */
export const KeepAnchorsUnique = Extension.create<{
  copyBlock: (
    kind: string,
    data: Record<string, unknown>,
    taken: Set<string>,
  ) => Record<string, unknown> | null;
  refOf: (kind: string, data: Record<string, unknown>) => string;
}>({
  name: "keepAnchorsUnique",
  addOptions() {
    return { copyBlock: () => null, refOf: (k, d) => `${k}:${String(d.id ?? "")}` };
  },
  addProseMirrorPlugins() {
    const { copyBlock, refOf } = this.options;
    return [
      new Plugin({
        key: new PluginKey("keepAnchorsUnique"),
        appendTransaction: (trs, _old, state) => {
          if (!trs.some((t) => t.docChanged)) return null;
          const tr = state.tr;
          const anchors = new Set<string>();
          const refs = new Set<string>();
          state.doc.descendants((n) => {
            if (n.type.name === "smartBlock") refs.add(String(n.attrs.ref));
            return n.type.name !== "smartBlock";
          });
          const seenRefs = new Set<string>();
          const remove: { pos: number; size: number }[] = [];
          state.doc.descendants((n, pos) => {
            if (n.type.name === "heading" && n.attrs.level === 2) {
              const a = n.attrs.anchor as string | null;
              if (!a || anchors.has(a)) tr.setNodeMarkup(pos, undefined, { ...n.attrs, anchor: newAnchor() });
              else anchors.add(a);
            }
            if (n.type.name === "smartBlock") {
              const ref = String(n.attrs.ref);
              if (seenRefs.has(ref)) {
                const copy = copyBlock(String(n.attrs.kind), n.attrs.data as Record<string, unknown>, refs);
                if (copy) {
                  const r = refOf(String(n.attrs.kind), copy);
                  refs.add(r);
                  seenRefs.add(r);
                  tr.setNodeMarkup(pos, undefined, { ...n.attrs, data: copy, ref: r });
                } else remove.push({ pos, size: n.nodeSize });
              } else seenRefs.add(ref);
              return false;
            }
            return true;
          });
          for (const r of remove.reverse()) tr.delete(tr.mapping.map(r.pos), tr.mapping.map(r.pos + r.size));
          return tr.docChanged ? tr : null;
        },
      }),
    ];
  },
});

/* ── Annotations: suggestions, comments and activity placed in the text ────────────────────── */

export type AnnotationTarget = {
  /** Heading anchor: the widget goes right after that heading. */
  heading?: string | null;
  /** Smart block ref: the widget goes right after that block. */
  block?: string | null;
  /** Text to highlight in that section. */
  quote?: string | null;
};

export type PlacedAnnotation = {
  id: string;
  target: AnnotationTarget;
  el: HTMLElement;
  highlight?: "agent" | "comment" | null;
};

export const annotationsKey = new PluginKey<PlacedAnnotation[]>("annotations");

const HIGHLIGHT = {
  agent: "bg-agent-wash rounded-xs",
  comment: "bg-gate-wash border-b border-gate-line",
} as const;

function findHeading(doc: PMNode, anchor: string) {
  let found: { pos: number; node: PMNode } | null = null;
  doc.descendants((n, pos) => {
    if (found) return false;
    if (n.type.name === "heading" && n.attrs.anchor === anchor) found = { pos, node: n };
    return n.isBlock && n.type.name !== "smartBlock";
  });
  return found as { pos: number; node: PMNode } | null;
}

function findBlock(doc: PMNode, ref: string) {
  let found: { pos: number; node: PMNode } | null = null;
  doc.descendants((n, pos) => {
    if (found) return false;
    if (n.type.name === "smartBlock" && n.attrs.ref === ref) found = { pos, node: n };
    return n.type.name !== "smartBlock";
  });
  return found as { pos: number; node: PMNode } | null;
}

/** End of a heading's section: the next heading of the same or a higher level. */
function sectionEnd(doc: PMNode, headingPos: number, level: number) {
  let end = doc.content.size;
  doc.forEach((n, offset) => {
    if (
      offset > headingPos &&
      end === doc.content.size &&
      n.type.name === "heading" &&
      n.attrs.level <= level
    )
      end = offset;
  });
  return end;
}

function quoteRange(doc: PMNode, from: number, to: number, quote: string) {
  let hit: [number, number] | null = null;
  doc.nodesBetween(from, to, (n, pos) => {
    if (hit || !n.isTextblock) return !hit;
    const at = n.textContent.indexOf(quote);
    if (at >= 0) hit = [pos + 1 + at, pos + 1 + at + quote.length];
    return false;
  });
  return hit as [number, number] | null;
}

function decorate(doc: PMNode, items: PlacedAnnotation[]) {
  const decos: Decoration[] = [];
  items.forEach((a, i) => {
    let pos = 0;
    let range: [number, number] = [0, doc.content.size];
    const block = a.target.block ? findBlock(doc, a.target.block) : null;
    const head = a.target.heading ? findHeading(doc, a.target.heading) : null;
    if (block) {
      pos = block.pos + block.node.nodeSize;
      range = [block.pos, pos];
    } else if (head) {
      pos = head.pos + head.node.nodeSize;
      range = [head.pos, sectionEnd(doc, head.pos, Number(head.node.attrs.level ?? 2))];
    }
    decos.push(
      Decoration.widget(pos, a.el, { key: a.id, side: 1 + i, ignoreSelection: true, stopEvent: () => true }),
    );
    if (a.target.quote && a.highlight && !block) {
      const hit = quoteRange(doc, range[0], range[1], a.target.quote);
      if (hit) decos.push(Decoration.inline(hit[0], hit[1], { class: HIGHLIGHT[a.highlight] }));
    }
  });
  return DecorationSet.create(doc, decos);
}

/** Places host-rendered widgets (via portals) after headings or smart blocks, and highlights quotes. */
export const Annotations = Extension.create({
  name: "annotations",
  addProseMirrorPlugins() {
    return [
      new Plugin<PlacedAnnotation[]>({
        key: annotationsKey,
        state: {
          init: () => [],
          apply: (tr, prev) => (tr.getMeta(annotationsKey) as PlacedAnnotation[] | undefined) ?? prev,
        },
        props: {
          decorations(state) {
            return decorate(state.doc, annotationsKey.getState(state) ?? []);
          },
        },
      }),
    ];
  },
});

/* ── Hints under empty sections ────────────────────────────────────────────────────────────── */

const EMPTY_HINT = "is-empty";

/** Heading anchor right before an empty paragraph at `pos`, if there is one. */
export function headingBefore(doc: PMNode, pos: number): string | null {
  const before = pos > 0 ? doc.resolve(pos).nodeBefore : null;
  return before?.type.name === "heading" ? String(before.attrs.anchor ?? "") : null;
}

/**
 * Shows what belongs in a section on the empty line right under its heading, so an empty document
 * still reads as a guide. The line with the cursor is left to the regular placeholder.
 */
export const SectionHints = Extension.create<{ hint: (anchor: string) => string | null }>({
  name: "sectionHints",
  addOptions() {
    return { hint: () => null };
  },
  addProseMirrorPlugins() {
    const hint = (a: string) => this.options.hint(a);
    return [
      new Plugin({
        key: new PluginKey("sectionHints"),
        props: {
          decorations: (state) => {
            if (!this.editor.isEditable) return DecorationSet.empty;
            const decos: Decoration[] = [];
            const cursor = state.selection.$from.pos;
            state.doc.forEach((n, pos) => {
              if (n.type.name !== "paragraph" || n.content.size > 0) return;
              if (cursor >= pos && cursor <= pos + n.nodeSize) return;
              const anchor = headingBefore(state.doc, pos);
              const text = anchor !== null ? hint(anchor) : null;
              if (text)
                decos.push(
                  Decoration.node(pos, pos + n.nodeSize, { class: EMPTY_HINT, "data-placeholder": text }),
                );
            });
            return DecorationSet.create(state.doc, decos);
          },
        },
      }),
    ];
  },
});
