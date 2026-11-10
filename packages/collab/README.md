# @throughline/collab

Reusable pieces for documents that people and agents write together. Nothing in here knows about
BRDs: the host owns the content, persistence and permissions, and passes everything in as props.

## RichEditor (free-flowing document)

A docs-style editor built on Tiptap/ProseMirror. The value is ProseMirror JSON; the host persists it.

- Writing: headings (`h2` start sections and get a stable `anchor`), lists, quotes, dividers, bold /
  italic / underline / strike / code / links, undo/redo, drag-to-move blocks, a sticky toolbar and a
  `/` menu (type `/` on an empty line).
- **Smart blocks**: structured items typed inline (`smartBlocks` + `host.render`). The node stores
  the item in `attrs.data`; the host renders its fields and calls `update`/`remove`. Pasted copies
  get fresh ids via `copySmartBlock`.
- **Annotations**: anything the host wants in the text (suggestions as tracked changes, comment
  threads, a "draft comment" box, the agent working) placed after a heading or a smart block, with
  optional highlighting of the quoted text. They render through portals, so they're ordinary React.
- **Selection bubble**: formatting plus "Ask agent" (quick asks or free text) and "Comment"; the
  host gets the section anchor and the quote (`DocPlace`). The toolbar adds "Ask agent about this
  section" with host-defined asks (`sectionActions`), and `sectionHint` fills empty sections with a
  hint.

```tsx
<RichEditor
  value={json}
  onChange={setJson}
  smartBlocks={[{ kind: "requirements", label: "Requirement" }]}
  host={{ refOf: (kind, d) => `${kind}:${d.id}`, render: (p) => <MyItem {...p} /> }}
  createSmartBlock={(kind) => ({ id: nextId(kind) })}
  annotations={[{ id: "s1", target: { heading: "summary" }, render: () => <SuggestionCard … /> }]}
  onAsk={(place, prompt) => …}
  onComment={(place) => …}
/>
```

## CollabDocument (section-based)

A document made of blocks (sections). Each block renders its own editor; the component adds the
collaboration layer around it:

- **Suggestions** (`DocSuggestion`): a change someone proposed. With `before`/`after` strings it shows
  as a tracked change (word-level diff, `diffWords`); otherwise `detail` describes it. Accept/Reject
  calls `onDecide`.
- **Comments** (`DocThread`): threads anchored to a block, a row inside it, or a quoted selection.
  Replies, resolve/reopen, and "@agent" (or the tick box) asks the agent to answer.
- **Selection toolbar**: select text in any block (page text or inside a text field) to get
  "Ask agent" (with quick asks: concise, measurable, formal, grammar) and "Comment".
- **Block menu**: per-block quick asks (`DocBlock.actions`) and a free-form "Ask something else…".
- **Activity**: `activity.blockId` marks the block an agent is working on, with a live label.

```tsx
<CollabDocument
  header={<TitleAndMeta />}
  blocks={[{ id: "summary", label: "Summary", title: <h2>Summary</h2>, content: <Editor /> }]}
  participants={[me, agent]}
  suggestions={pending}
  threads={threads}
  activity={agentBusy ? { participantId: "agent", blockId: "summary", label: "Drafting…" } : null}
  canComment
  onDecide={(id, d) => …}
  onComment={(c) => …}
  onReply={(threadId, text, askAgent) => …}
  onResolve={(threadId, resolved) => …}
  onAsk={({ blockId, quote, prompt }) => …}
/>
```

## Chat

- `ChatThread`: an assistant-style conversation. User messages are bubbles (with attachment chips
  and the quoted context); agent replies are Markdown (`Markdown`, a small safe subset that never
  injects HTML), with copy, and new replies stream in (instant with reduced motion). `body` puts
  extra content (e.g. proposal cards) under a reply.
- `Composer`: grows as you type, Enter sends, `+` menu (upload files, add a link, plus host items),
  paste a file or a bare URL to attach it, suggestion chips, a quoted-context chip and a `panel`
  slot for tools such as forms. Uploading/reading is the host's job via `onFiles` / `onLink`; the
  composer shows each attachment's status and only sends ready ones.
- `DropZone`: drop files anywhere on an area.
- `PresenceBar` / `Avatar`: who is in the document and what the agent is doing.

Real-time editing between several people needs a sync service (e.g. a CRDT over websockets); the
component is ready for it because every change already flows through the host as data.
