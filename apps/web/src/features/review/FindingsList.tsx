import { ARTIFACT_LABEL, type ReviewPack, type Severity } from "@throughline/contracts";
import { Badge, Button, Card, CardHeader, CardTitle, cn } from "@throughline/ui";
import { ErrorNote } from "@/components/data/ErrorNote";
import { useTenant } from "@/tenancy";
import { useUpdateFinding } from "./api";

const SEVERITY: Record<Severity, "risk" | "gate" | "ion" | "neutral"> = {
  critical: "risk",
  high: "risk",
  medium: "gate",
  low: "ion",
};

export function FindingsList({
  pack,
  onOpenArtifact,
}: {
  pack: ReviewPack;
  onOpenArtifact: (id: string) => void;
}) {
  const { can } = useTenant();
  const update = useUpdateFinding();
  const reviewer = can("gate.approve.g2") || can("review.security.signoff");
  const open = pack.findings.filter((f) => f.status === "open").length;

  return (
    <Card className="flex flex-col gap-3">
      <CardHeader className="mb-0">
        <CardTitle>Findings</CardTitle>
        <span className="text-micro text-muted font-mono">{open} OPEN</span>
      </CardHeader>
      <ul className="flex flex-col gap-2.5">
        {pack.findings.map((f) => {
          const artifact = pack.artifacts.find((a) => a.id === f.artifactId);
          return (
            <li
              key={f.id}
              className={cn(
                "flex flex-col gap-2 rounded-lg border p-3.5",
                f.status === "open" ? "border-line bg-surface-raised" : "border-ok-line bg-ok-wash",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge tone={SEVERITY[f.severity]} mono>
                  {f.severity}
                </Badge>
                {f.status === "open" ? null : (
                  <span className="text-micro text-ok font-mono">
                    {f.status.toUpperCase()} · {f.resolvedBy}
                  </span>
                )}
              </div>
              <span className="text-body font-semibold">{f.title}</span>
              <span className="text-body-sm text-subtle">{f.detail}</span>
              <div className="flex flex-wrap items-center gap-2">
                {artifact ? (
                  <Button variant="ghost" size="sm" onClick={() => onOpenArtifact(artifact.id)}>
                    In {ARTIFACT_LABEL[artifact.kind]}
                  </Button>
                ) : null}
                {f.status === "open" && reviewer ? (
                  <>
                    <Button
                      size="sm"
                      disabled={update.isPending}
                      onClick={() => update.mutate({ packId: pack.id, findingId: f.id, status: "resolved" })}
                    >
                      Mark resolved
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={update.isPending}
                      onClick={() => update.mutate({ packId: pack.id, findingId: f.id, status: "accepted" })}
                    >
                      Accept risk
                    </Button>
                  </>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <ErrorNote error={update.error} />
    </Card>
  );
}
