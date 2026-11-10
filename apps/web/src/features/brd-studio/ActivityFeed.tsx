import { Avatar, type Participant } from "@throughline/collab";
import type { Brd, BrdSource, BrdThread, CommentThread } from "@throughline/contracts";
import { AGENT_ID, personId } from "./collab";

type Item = { id: string; at: string; who: string; what: string; target?: { section: string; id?: string } };

/** Everything that happened to this BRD, newest first: edits accepted, comments, sources, versions. */
export function activityItems(
  brd: Brd,
  thread: BrdThread,
  comments: CommentThread[],
  sources: BrdSource[],
  sectionTitle: (id: string) => string,
): Item[] {
  const out: Item[] = [];
  for (const m of thread.messages)
    for (const p of m.proposals) {
      if (p.status === "pending") continue;
      out.push({
        id: `p-${p.id}`,
        at: p.decidedAt ?? m.at,
        who: p.decidedBy ?? brd.owner,
        what: `${p.status === "accepted" ? "accepted" : "rejected"} “${p.summary}”`,
      });
    }
  for (const c of comments)
    for (const [i, m] of c.messages.entries())
      out.push({
        id: `c-${m.id}`,
        at: m.at,
        who: m.author,
        what: `${i === 0 ? "commented on" : "replied on"} ${sectionTitle(c.anchor.section)}${c.anchor.rowId ? ` · ${c.anchor.rowId}` : ""}: “${m.text.slice(0, 80)}${m.text.length > 80 ? "…" : ""}”`,
        target: { section: c.anchor.section, id: `thread-${c.id}` },
      });
  for (const s of sources)
    out.push({ id: `s-${s.id}`, at: s.addedAt, who: s.addedBy, what: `attached ${s.id} “${s.title}”` });
  for (const h of brd.history)
    out.push({ id: `h-${h.version}-${h.at}`, at: h.at, who: h.by, what: `v${h.version} · ${h.what}` });
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

export function ActivityFeed({
  items,
  people,
  onOpen,
}: {
  items: Item[];
  people: Participant[];
  onOpen: (target: { section: string; id?: string }) => void;
}) {
  const byName = new Map(people.map((p) => [p.name, p]));
  if (!items.length) return <p className="text-caption text-muted">Nothing yet.</p>;
  return (
    <ol className="flex flex-col gap-3">
      {items.slice(0, 80).map((it) => {
        const p =
          byName.get(it.who) ??
          (it.who === "BA agent"
            ? { id: AGENT_ID, name: "BA agent", kind: "agent" as const }
            : { id: personId(it.who), name: it.who, kind: "human" as const });
        const body = (
          <>
            <span className="text-foreground font-semibold">{it.who}</span> {it.what}
          </>
        );
        return (
          <li key={it.id} className="flex gap-2">
            <Avatar p={p} size="sm" />
            <div className="flex min-w-0 flex-col gap-0.5">
              {it.target ? (
                <button
                  type="button"
                  onClick={() => it.target && onOpen(it.target)}
                  className="text-caption text-subtle cursor-pointer text-left hover:underline"
                >
                  {body}
                </button>
              ) : (
                <span className="text-caption text-subtle">{body}</span>
              )}
              <time className="text-nano text-faint" dateTime={it.at}>
                {new Date(it.at).toLocaleString("en-GB", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
