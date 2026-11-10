import { ARTIFACT_LABEL, type ReviewPack } from "@throughline/contracts";
import {
  Badge,
  Button,
  Card,
  cn,
  EmptyState,
  Eyebrow,
  PageHeader,
  Progress,
  StatusDot,
} from "@throughline/ui";
import { FileCheck2, Sparkles } from "lucide-react";
import { useState } from "react";
import { ErrorNote } from "@/components/data/ErrorNote";
import { PickList } from "@/components/data/PickList";
import { QueryBoundary } from "@/components/data/QueryBoundary";
import { useTenant } from "@/tenancy";
import { ArtifactView } from "./ArtifactView";
import { useGeneratePack, useReviews } from "./api";
import { FindingsList } from "./FindingsList";
import { SignoffPanel } from "./SignoffPanel";

const STATUS: Record<ReviewPack["status"], { label: string; tone: "neutral" | "agent" | "gate" | "ok" }> = {
  "not-started": { label: "Not generated", tone: "neutral" },
  generating: { label: "Generating", tone: "agent" },
  "in-review": { label: "In review", tone: "gate" },
  "signed-off": { label: "Signed off", tone: "ok" },
};

function NotStarted({ pack }: { pack: ReviewPack }) {
  const { can } = useTenant();
  const generate = useGeneratePack();
  const allowed = can("gate.approve.g2") || can("review.security.signoff") || can("work.create");
  return (
    <EmptyState
      icon={<Sparkles className="size-8" />}
      title="No review pack yet"
      description={`Review agents read the spec, the chosen design and the codebase for ${pack.title}, then write 7 artifacts: architecture, decision records, threat model, security review, NFRs, data protection and the compliance map.`}
      action={
        allowed ? (
          <div className="flex flex-col items-center gap-2">
            <Button size="lg" disabled={generate.isPending} onClick={() => generate.mutate(pack.id)}>
              Generate review pack
            </Button>
            <ErrorNote error={generate.error} />
          </div>
        ) : (
          <Badge mono>Your role can view packs only</Badge>
        )
      }
    />
  );
}

function Generating({ pack }: { pack: ReviewPack }) {
  return (
    <Card padding="lg" tone="agent" className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-heading-md text-strong flex items-center gap-2.5">
          <StatusDot live size="md" /> Agents are writing the pack
        </h2>
        <span className="text-agent-fg text-micro font-mono">{pack.progress}%</span>
      </div>
      <Progress value={pack.progress} working size="lg" label="Review pack generation" />
      <ul className="grid gap-2 md:grid-cols-2">
        {pack.artifacts.map((a) => (
          <li
            key={a.id}
            className="border-line bg-surface flex items-center justify-between gap-3 rounded-md border px-3 py-2.5"
          >
            <span className="text-body-sm">{ARTIFACT_LABEL[a.kind]}</span>
            <Badge tone={a.status === "draft" ? "ok" : a.status === "generating" ? "agent" : "neutral"} mono>
              {a.status === "draft" ? "Ready" : a.status}
            </Badge>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function PackDetail({ pack }: { pack: ReviewPack }) {
  const [artifactId, setArtifactId] = useState(pack.artifacts[0]?.id ?? "");
  const artifact = pack.artifacts.find((a) => a.id === artifactId) ?? pack.artifacts[0];
  const openFindings = (id: string) =>
    pack.findings.filter((f) => f.artifactId === id && f.status === "open").length;

  if (pack.status === "not-started") return <NotStarted pack={pack} />;
  if (pack.status === "generating") return <Generating pack={pack} />;

  return (
    <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="flex min-w-0 flex-col gap-4">
        <div role="tablist" aria-label="Artifacts" className="flex flex-wrap gap-2">
          {pack.artifacts.map((a) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={a.id === artifact?.id}
              onClick={() => setArtifactId(a.id)}
              className={cn(
                "press text-body-sm flex cursor-pointer items-center gap-2 rounded-xs border px-3.5 py-2",
                a.id === artifact?.id
                  ? "border-agent bg-agent-wash text-agent-fg"
                  : "border-line-strong bg-surface text-subtle",
              )}
            >
              {ARTIFACT_LABEL[a.kind]}
              {openFindings(a.id) ? (
                <span className="bg-risk-soft text-nano text-risk-fg rounded-xs px-1.5 font-mono">
                  {openFindings(a.id)}
                </span>
              ) : null}
            </button>
          ))}
        </div>
        {artifact ? <ArtifactView key={artifact.id} artifact={artifact} /> : null}
      </div>
      <div className="flex flex-col gap-5">
        <SignoffPanel pack={pack} />
        <FindingsList pack={pack} onOpenArtifact={setArtifactId} />
      </div>
    </div>
  );
}

function Review({ wi }: { wi?: string }) {
  const packs = useReviews();
  const [selectedId, setSelectedId] = useState(
    packs.find((p) => p.workItemKey === wi)?.id ?? packs[0]?.id ?? "",
  );
  const pack = packs.find((p) => p.id === selectedId) ?? packs[0];
  if (!pack)
    return <EmptyState icon={<FileCheck2 className="size-8" />} title="No work has reached review yet" />;

  return (
    <div className="grid gap-5 xl:grid-cols-[18rem_minmax(0,1fr)]">
      <PickList
        label="Review packs"
        items={packs}
        selectedId={pack.id}
        onSelect={setSelectedId}
        render={(p) => (
          <>
            <span className="flex items-center justify-between gap-2">
              <span className="text-faint text-micro font-mono">{p.workItemKey}</span>
              <Badge tone={STATUS[p.status].tone} mono>
                {STATUS[p.status].label}
              </Badge>
            </span>
            <span className="text-body font-semibold">{p.title}</span>
            <span className="text-caption text-muted">
              Risk tier {p.risk} · {p.artifacts.length} artifacts ·{" "}
              {p.findings.filter((f) => f.status === "open").length} open findings
            </span>
          </>
        )}
      />
      <PackDetail key={pack.id} pack={pack} />
    </div>
  );
}

export function ReviewPage({ wi }: { wi?: string }) {
  const { tenant } = useTenant();
  return (
    <>
      <PageHeader
        eyebrow={<Eyebrow>Review · architecture and security · {tenant.name}</Eyebrow>}
        title="Prove it's safe to build."
        accent="Before a line is written."
      />
      <QueryBoundary>
        <Review key={wi ?? "all"} wi={wi} />
      </QueryBoundary>
    </>
  );
}
