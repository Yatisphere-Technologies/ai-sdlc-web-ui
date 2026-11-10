import {
  ARCH_QUESTIONS,
  type ArchBrief,
  type Architecture,
  type ArchQuestion,
  type ArchSuggestion,
} from "@throughline/contracts";
import { Badge, Button, Card, cn, Eyebrow } from "@throughline/ui";
import { Check, Sparkles, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { ErrorNote } from "@/components/data/ErrorNote";
import { useTenant } from "@/tenancy";
import { useGenerateArchitecture, useSaveBrief } from "./api";
import { briefChanges, briefWarnings } from "./brief";

const BASIS: Record<ArchSuggestion["basis"], { label: string; tone: "ok" | "ion" | "agent" | "gate" }> = {
  stated: { label: "Stated", tone: "ok" },
  evidenced: { label: "Evidenced", tone: "ion" },
  inferred: { label: "Inferred", tone: "agent" },
  assumed: { label: "Assumed", tone: "gate" },
};

const SECTIONS: ArchQuestion["section"][] = ["Platform", "Application", "Network", "Security", "Operations"];

function Question({
  q,
  value,
  suggestion,
  readOnly,
  onChange,
}: {
  q: ArchQuestion;
  value: string | string[];
  suggestion: ArchSuggestion | undefined;
  readOnly: boolean;
  onChange: (v: string | string[]) => void;
}) {
  const selected = (v: string) => (Array.isArray(value) ? value.includes(v) : value === v);
  const suggested = (v: string) =>
    suggestion
      ? Array.isArray(suggestion.value)
        ? suggestion.value.includes(v)
        : suggestion.value === v
      : false;
  const toggle = (v: string) => {
    if (readOnly) return;
    if (q.multi && Array.isArray(value))
      onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
    else onChange(v);
  };
  const differs = suggestion && JSON.stringify(suggestion.value) !== JSON.stringify(value);
  return (
    <fieldset className="border-line flex flex-col gap-3 border-t pt-5 first:border-t-0 first:pt-0">
      <legend className="sr-only">{q.label}</legend>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex max-w-2xl flex-col gap-1">
          <span className="text-body-lg text-strong font-semibold">{q.label}</span>
          <span className="text-body-sm text-muted">{q.why}</span>
        </div>
        {differs ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={readOnly}
            onClick={() => suggestion && onChange(suggestion.value)}
          >
            <Undo2 className="size-3.5" aria-hidden /> Use agent's answer
          </Button>
        ) : null}
      </div>
      {suggestion ? (
        <p className="text-caption text-subtle flex flex-wrap items-center gap-2">
          <Sparkles className="text-agent size-3.5" aria-hidden />
          <Badge tone={BASIS[suggestion.basis].tone} mono>
            {BASIS[suggestion.basis].label}
          </Badge>
          {suggestion.reason}
        </p>
      ) : null}
      <div
        className={cn(
          "grid gap-2",
          q.options.length > 3 ? "sm:grid-cols-2 xl:grid-cols-4" : "sm:grid-cols-3",
        )}
      >
        {q.options.map((o) => {
          const on = selected(o.value);
          return (
            <label
              key={o.value}
              className={cn(
                "relative flex flex-col gap-1 rounded-xl border-2 p-3.5 text-left transition-colors",
                on ? "border-agent bg-agent-wash" : "border-line bg-surface",
                readOnly ? "cursor-default" : "hover:border-line-strong cursor-pointer",
              )}
            >
              <input
                type={q.multi ? "checkbox" : "radio"}
                name={q.id}
                value={o.value}
                checked={on}
                disabled={readOnly}
                onChange={() => toggle(o.value)}
                className="sr-only"
              />
              <span className="flex items-center justify-between gap-2">
                <span className="text-body-sm text-foreground font-semibold">{o.label}</span>
                {on ? <Check className="text-agent size-4 shrink-0" aria-hidden /> : null}
              </span>
              <span className="text-caption text-muted">{o.hint}</span>
              {suggested(o.value) ? <span className="eyebrow text-agent-fg mt-1">Agent suggests</span> : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** The architecture brief: the questions an architect asks, pre-answered by the agent with its evidence. */
export function BriefForm({ arch, onGenerated }: { arch: Architecture; onGenerated: () => void }) {
  const { can } = useTenant();
  const readOnly = !can("architecture.edit") || arch.status === "generating";
  const [brief, setBrief] = useState<ArchBrief>(arch.brief);
  const save = useSaveBrief();
  const generate = useGenerateArchitecture();
  const changes = useMemo(() => briefChanges(brief, arch.suggestions), [brief, arch.suggestions]);
  const warnings = useMemo(() => briefWarnings(brief), [brief]);
  const assumed = Object.values(arch.suggestions).filter((s) => s.basis === "assumed").length;
  const dirty = JSON.stringify(brief) !== JSON.stringify(arch.brief);

  const run = async () => {
    if (dirty) await save.mutateAsync({ id: arch.id, brief });
    await generate.mutateAsync({ id: arch.id });
    onGenerated();
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="flex flex-col gap-5">
        {SECTIONS.map((section) => (
          <Card key={section} padding="lg" className="flex flex-col gap-5">
            <Eyebrow>{section}</Eyebrow>
            {ARCH_QUESTIONS.filter((q) => q.section === section).map((q) => (
              <Question
                key={q.id}
                q={q}
                value={brief[q.id]}
                suggestion={arch.suggestions[q.id]}
                readOnly={readOnly}
                onChange={(v) => setBrief((b) => ({ ...b, [q.id]: v }) as ArchBrief)}
              />
            ))}
          </Card>
        ))}
      </div>
      <aside className="flex flex-col gap-4 xl:sticky xl:top-4 xl:self-start">
        <Card padding="lg" className="flex flex-col gap-3">
          <Eyebrow>Before the agent draws</Eyebrow>
          <p className="text-body-sm text-subtle">
            {ARCH_QUESTIONS.length} questions.{" "}
            {changes.length === 0
              ? "All match the agent's suggestions."
              : `${changes.length} changed from the agent's suggestion.`}{" "}
            {assumed === 1 ? "1 answer is an assumption" : `${assumed} answers are assumptions`} worth
            checking.
          </p>
          {warnings.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {warnings.map((w) => (
                <li
                  key={w}
                  className="border-risk-line bg-risk-soft text-caption text-risk-fg rounded-md border px-3 py-2"
                >
                  {w}
                </li>
              ))}
            </ul>
          ) : null}
          {readOnly && arch.status !== "generating" ? (
            <p className="text-caption text-muted">An architect fills in the brief. You can read it.</p>
          ) : (
            <div className="flex flex-col gap-2">
              <Button
                size="lg"
                disabled={readOnly || save.isPending || generate.isPending}
                onClick={() => void run()}
              >
                <Sparkles className="size-4" aria-hidden />
                {arch.diagrams.length > 0 ? "Regenerate architecture" : "Generate architecture"}
              </Button>
              {dirty ? (
                <Button
                  variant="secondary"
                  disabled={save.isPending}
                  onClick={() => save.mutate({ id: arch.id, brief })}
                >
                  Save brief only
                </Button>
              ) : null}
              <ErrorNote error={save.error ?? generate.error} />
            </div>
          )}
        </Card>
      </aside>
    </div>
  );
}
