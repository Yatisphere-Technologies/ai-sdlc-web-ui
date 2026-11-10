import { AUDIT_CATEGORY_LABEL, type AuditCategory, type AuditEvent, AuditPage } from "@throughline/contracts";
import { Badge, Button, Card, cn, EmptyState, Select, Skeleton, StatusDot, toast } from "@throughline/ui";
import { Bot, Cog, Download, Link2, Lock, Search, ShieldCheck, ShieldX, User } from "lucide-react";
import { Suspense, useDeferredValue, useState } from "react";
import { download } from "@/features/architecture/export/download";
import { useTenant } from "@/tenancy";
import { ago, stamp, TabLink } from "./parts";
import { useAudit } from "./security.api";

type Filters = {
  q: string;
  category: AuditCategory | "all";
  actor: AuditEvent["actor"]["type"] | "all";
  outcome: AuditEvent["outcome"] | "all";
};

export function auditQuery(f: Filters, limit: number) {
  const p = new URLSearchParams();
  if (f.q) p.set("q", f.q);
  if (f.category !== "all") p.set("category", f.category);
  if (f.actor !== "all") p.set("actor", f.actor);
  if (f.outcome !== "all") p.set("outcome", f.outcome);
  p.set("limit", String(limit));
  return p.toString();
}

const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);
export function auditCsv(items: readonly AuditEvent[]) {
  const head = [
    "seq",
    "time",
    "actor_type",
    "actor",
    "category",
    "action",
    "target",
    "outcome",
    "ip",
    "detail",
    "prev_hash",
    "hash",
  ];
  const rows = items.map((e) =>
    [
      String(e.seq),
      e.at,
      e.actor.type,
      e.actor.name,
      e.category,
      e.action,
      e.target,
      e.outcome,
      e.ip ?? "",
      e.detail,
      e.prev,
      e.hash,
    ]
      .map(cell)
      .join(","),
  );
  return `${[head.join(","), ...rows].join("\r\n")}\r\n`;
}

const ACTOR_ICON = { human: User, agent: Bot, system: Cog } as const;
const OUTCOME_TONE = { success: "ok", denied: "risk", failure: "gate" } as const;

function Events({ query, onMore }: { query: string; onMore: () => void }) {
  const page = useAudit(query);
  return (
    <>
      <Card
        padding="sm"
        tone={page.chain.verified ? "ok" : "risk"}
        className="flex flex-wrap items-center gap-x-6 gap-y-2"
      >
        <span className="text-body-sm flex items-center gap-2 font-semibold">
          {page.chain.verified ? (
            <ShieldCheck className="text-ok size-4" aria-hidden />
          ) : (
            <ShieldX className="text-risk size-4" aria-hidden />
          )}
          {page.chain.verified ? "Chain verified" : `Chain broken at event ${page.chain.brokenAt}`}
        </span>
        <span className="text-caption text-subtle flex items-center gap-1.5">
          <Link2 className="size-3.5" aria-hidden /> {page.chain.events.toLocaleString()} events · head{" "}
          <span className="font-mono">{page.chain.head}</span>
        </span>
        <span className="text-caption text-subtle flex items-center gap-1.5">
          <StatusDot tone={page.stream.target ? "ok" : "gate"} live={Boolean(page.stream.target)} />
          {page.stream.target ? (
            <>
              Streaming to {page.stream.target}
              {page.stream.lastShippedAt ? ` · last batch ${ago(page.stream.lastShippedAt)}` : ""}
            </>
          ) : (
            <>
              Not streamed to a SIEM · <TabLink tab="security">turn it on</TabLink>
            </>
          )}
        </span>
      </Card>
      <Card padding="none" className="overflow-hidden">
        {page.items.length ? (
          <ol className="divide-line flex flex-col divide-y">
            {page.items.map((e) => {
              const Icon = ACTOR_ICON[e.actor.type];
              return (
                <li
                  key={e.id}
                  className="grid grid-cols-[7rem_minmax(0,1fr)_auto] items-start gap-3 px-4 py-3 sm:grid-cols-[9rem_minmax(0,1fr)_auto]"
                >
                  <span className="flex flex-col">
                    <span className="text-caption text-subtle">{stamp(e.at)}</span>
                    <span className="text-nano text-faint font-mono">#{e.seq}</span>
                  </span>
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-body-sm text-foreground flex flex-wrap items-center gap-x-2">
                      <Icon
                        className={cn("size-3.5", e.actor.type === "agent" ? "text-agent" : "text-muted")}
                        aria-hidden
                      />
                      <span className="font-semibold">{e.actor.name}</span>
                      <span className="text-subtle">{e.action.toLowerCase()}</span>
                      <span className="text-micro text-foreground font-mono">{e.target}</span>
                    </span>
                    {e.detail ? <span className="text-caption text-muted">{e.detail}</span> : null}
                    <span className="text-nano text-faint font-mono">
                      {e.ip ? `${e.ip} · ` : ""}
                      {e.hash}
                    </span>
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <Badge tone={OUTCOME_TONE[e.outcome]}>{e.outcome}</Badge>
                    <span className="text-caption text-muted">{AUDIT_CATEGORY_LABEL[e.category]}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        ) : (
          <EmptyState title="No events match" className="py-10" />
        )}
      </Card>
      <div className="flex items-center justify-between gap-3">
        <span className="text-caption text-muted">
          Showing {page.items.length} of {page.matched} matching · {page.total} in total
        </span>
        {page.items.length < page.matched ? (
          <Button variant="secondary" size="sm" onClick={onMore}>
            Load more
          </Button>
        ) : null}
      </div>
    </>
  );
}

function Audit() {
  const { can, api, tenant } = useTenant();
  const [f, setF] = useState<Filters>({ q: "", category: "all", actor: "all", outcome: "all" });
  const [limit, setLimit] = useState(50);
  const deferred = useDeferredValue(f);
  const [exporting, setExporting] = useState(false);
  if (!can("audit.read"))
    return (
      <EmptyState
        icon={<Lock className="size-6" aria-hidden />}
        title="The audit log is restricted"
        description="Workspace admins and people granted “Read the audit log” can see it. Your attempt to open it has been recorded."
      />
    );
  const exportCsv = async () => {
    setExporting(true);
    try {
      const all = await api.get(`/audit?${auditQuery(f, 1000)}`, AuditPage);
      download(
        `${tenant.slug}-audit-${new Date().toISOString().slice(0, 10)}.csv`,
        auditCsv(all.items),
        "text/csv",
      );
      toast.success(`${all.items.length} events exported`, {
        description: "Includes hashes, so the file can be verified",
      });
    } catch (e) {
      toast.error("Export failed", { description: e instanceof Error ? e.message : undefined });
    } finally {
      setExporting(false);
    }
  };
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <label className="border-line bg-surface focus-within:border-agent flex h-9 min-w-56 flex-1 items-center gap-1.5 rounded-md border px-2.5 sm:max-w-sm">
          <Search className="text-muted size-4" aria-hidden />
          <span className="sr-only">Search events</span>
          <input
            type="search"
            value={f.q}
            onChange={(e) => setF({ ...f, q: e.target.value })}
            placeholder="Who, what or target"
            className="text-body-sm text-foreground placeholder:text-faint min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>
        <Select
          label="Category"
          prefix="Category"
          variant="toolbar"
          size="sm"
          value={f.category}
          onValueChange={(category) => setF({ ...f, category })}
          options={[
            { value: "all" as const, label: "All" },
            ...(Object.keys(AUDIT_CATEGORY_LABEL) as AuditCategory[]).map((c) => ({
              value: c,
              label: AUDIT_CATEGORY_LABEL[c],
            })),
          ]}
        />
        <Select
          label="Actor"
          prefix="Actor"
          variant="toolbar"
          size="sm"
          value={f.actor}
          onValueChange={(actor) => setF({ ...f, actor })}
          options={[
            { value: "all" as const, label: "Anyone" },
            { value: "human" as const, label: "People" },
            { value: "agent" as const, label: "Agents" },
            { value: "system" as const, label: "System" },
          ]}
        />
        <Select
          label="Outcome"
          prefix="Outcome"
          variant="toolbar"
          size="sm"
          value={f.outcome}
          onValueChange={(outcome) => setF({ ...f, outcome })}
          options={[
            { value: "all" as const, label: "All" },
            { value: "success" as const, label: "Success", dot: "ok" as const },
            { value: "denied" as const, label: "Denied", dot: "risk" as const },
            { value: "failure" as const, label: "Failure", dot: "gate" as const },
          ]}
        />
        <Button variant="ghost" size="sm" className="ml-auto" disabled={exporting} onClick={exportCsv}>
          <Download className="size-4" aria-hidden /> Export CSV
        </Button>
      </div>
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Events query={auditQuery(deferred, limit)} onMore={() => setLimit(limit + 50)} />
      </Suspense>
    </>
  );
}

export function AuditLogPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <Audit />
    </Suspense>
  );
}
