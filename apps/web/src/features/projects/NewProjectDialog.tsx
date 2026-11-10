import { useNavigate } from "@tanstack/react-router";
import { NewProgram, NewProject, type Program } from "@throughline/contracts";
import { Button, Dialog, DialogContent, DialogTrigger, Select, SwitchRow } from "@throughline/ui";
import { FolderPlus, Plus } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { useSession } from "@/auth/session";
import { useTenant } from "@/tenancy";
import { useCreateProgram, useCreateProject } from "./api";
import { setProjectScope } from "./scope";

export const INPUT =
  "w-full rounded-md border border-line bg-surface-sunken px-3 py-2 text-body-sm text-foreground outline-none placeholder:text-ghost focus:border-agent";

export function Field({
  label,
  hint,
  children,
  id,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  id: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-caption text-subtle font-medium">
        {label}
      </label>
      {children}
      {hint ? <span className="text-micro text-faint">{hint}</span> : null}
    </div>
  );
}

/** Suggests a key from a name: initials of the words, or the first letters of one word. */
export function keyFrom(name: string): string {
  const words = name
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const key = words.length > 1 ? words.map((w) => w[0]).join("") : (words[0] ?? "").slice(0, 4);
  return key.slice(0, 6);
}

const today = () => new Date().toISOString().slice(0, 10);
const inMonths = (n: number) => {
  const d = new Date();
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
};

export function NewProjectDialog({
  programs,
  defaultProgram,
}: {
  programs: Program[];
  defaultProgram?: string;
}) {
  const { tenant } = useTenant();
  const me = useSession().user.name;
  const navigate = useNavigate();
  const create = useCreateProject();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [keyTouched, setKeyTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [v, setV] = useState({
    programId: defaultProgram ?? programs[0]?.id ?? "",
    name: "",
    key: "",
    objective: "",
    sponsor: "",
    owner: me,
    teams: "",
    startDate: today(),
    targetDate: inMonths(4),
    budget: "",
    platform: false,
  });
  const set = (patch: Partial<typeof v>) => setV((x) => ({ ...x, ...patch }));

  const submit = () => {
    const parsed = NewProject.safeParse({
      ...v,
      teams: v.teams
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      budgetUsd: Number(v.budget || 0),
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError(
        issue ? `${String(issue.path[0] ?? "")}: ${issue.message}`.replace(/^: /, "") : "Check the details",
      );
      return;
    }
    setError(null);
    create.mutate(parsed.data, {
      onSuccess: (o) => {
        setOpen(false);
        setProjectScope(tenant.id, o.project.id);
        void navigate({
          to: "/t/$tenantSlug/projects/$projectKey",
          params: { tenantSlug: tenant.slug, projectKey: o.project.key },
        });
      },
      onError: (e) => setError(e instanceof Error ? e.message : "Couldn't create the project"),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary">
          <Plus className="size-4" aria-hidden /> New project
        </Button>
      </DialogTrigger>
      <DialogContent
        size="lg"
        title="New project"
        description="Every BRD, architecture, plan and backlog belongs to a project. It starts with a plan you can fill in."
        footer={
          <>
            {error ? <span className="text-caption text-risk-fg mr-auto">{error}</span> : null}
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create project"}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Field label="Program" id={`${id}-program`}>
              <Select
                id={`${id}-program`}
                label="Program"
                value={v.programId}
                onValueChange={(programId) => set({ programId })}
                options={programs.map((p) => ({
                  value: p.id,
                  label: `${p.key} · ${p.name}`,
                  description: p.objective,
                }))}
              />
            </Field>
          </div>
          <Field label="Name" id={`${id}-name`}>
            <input
              id={`${id}-name`}
              className={INPUT}
              value={v.name}
              placeholder="Claims triage agent"
              onChange={(e) =>
                set({ name: e.target.value, key: keyTouched ? v.key : keyFrom(e.target.value) })
              }
            />
          </Field>
          <Field label="Key" id={`${id}-key`} hint="Used in ids and links, e.g. CLM">
            <input
              id={`${id}-key`}
              className={`${INPUT} font-mono uppercase`}
              value={v.key}
              maxLength={10}
              onChange={(e) => {
                setKeyTouched(true);
                set({ key: e.target.value.toUpperCase() });
              }}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field
              label="Objective"
              id={`${id}-objective`}
              hint="What changes for the business when this is done"
            >
              <textarea
                id={`${id}-objective`}
                className={`${INPUT} min-h-20`}
                value={v.objective}
                onChange={(e) => set({ objective: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Sponsor" id={`${id}-sponsor`}>
            <input
              id={`${id}-sponsor`}
              className={INPUT}
              value={v.sponsor}
              onChange={(e) => set({ sponsor: e.target.value })}
            />
          </Field>
          <Field label="Owner" id={`${id}-owner`}>
            <input
              id={`${id}-owner`}
              className={INPUT}
              value={v.owner}
              onChange={(e) => set({ owner: e.target.value })}
            />
          </Field>
          <Field label="Teams" id={`${id}-teams`} hint="Comma-separated">
            <input
              id={`${id}-teams`}
              className={INPUT}
              value={v.teams}
              placeholder="Support, Platform"
              onChange={(e) => set({ teams: e.target.value })}
            />
          </Field>
          <Field label="Budget (USD)" id={`${id}-budget`}>
            <input
              id={`${id}-budget`}
              className={INPUT}
              inputMode="numeric"
              value={v.budget}
              placeholder="250000"
              onChange={(e) => set({ budget: e.target.value.replace(/[^0-9]/g, "") })}
            />
          </Field>
          <Field label="Start" id={`${id}-start`}>
            <input
              id={`${id}-start`}
              type="date"
              className={INPUT}
              value={v.startDate}
              onChange={(e) => set({ startDate: e.target.value })}
            />
          </Field>
          <Field label="Target" id={`${id}-target`}>
            <input
              id={`${id}-target`}
              type="date"
              className={INPUT}
              value={v.targetDate}
              onChange={(e) => set({ targetDate: e.target.value })}
            />
          </Field>
          <div className="sm:col-span-2">
            <SwitchRow
              checked={v.platform}
              onCheckedChange={(platform) => set({ platform })}
              label="Shared platform"
              description="Other projects build on it and link to it as a dependency."
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function NewProgramDialog() {
  const create = useCreateProgram();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [v, setV] = useState({ name: "", key: "", objective: "", sponsor: "", horizon: "FY27" });
  const set = (patch: Partial<typeof v>) => setV((x) => ({ ...x, ...patch }));
  const submit = () => {
    const parsed = NewProgram.safeParse(v);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError(issue ? `${String(issue.path[0] ?? "")}: ${issue.message}` : "Check the details");
      return;
    }
    create.mutate(parsed.data, {
      onSuccess: () => {
        setOpen(false);
        setError(null);
      },
      onError: (e) => setError(e instanceof Error ? e.message : "Couldn't create the program"),
    });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <FolderPlus className="size-4" aria-hidden /> New program
        </Button>
      </DialogTrigger>
      <DialogContent
        title="New program"
        description="A program groups projects that share an outcome and a sponsor."
        footer={
          <>
            {error ? <span className="text-caption text-risk-fg mr-auto">{error}</span> : null}
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={submit} disabled={create.isPending}>
              Create program
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" id={`${id}-name`}>
            <input
              id={`${id}-name`}
              className={INPUT}
              value={v.name}
              onChange={(e) => set({ name: e.target.value, key: keyFrom(e.target.value) })}
            />
          </Field>
          <Field label="Key" id={`${id}-key`}>
            <input
              id={`${id}-key`}
              className={`${INPUT} font-mono uppercase`}
              value={v.key}
              onChange={(e) => set({ key: e.target.value.toUpperCase() })}
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Objective" id={`${id}-objective`}>
              <textarea
                id={`${id}-objective`}
                className={`${INPUT} min-h-20`}
                value={v.objective}
                onChange={(e) => set({ objective: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Sponsor" id={`${id}-sponsor`}>
            <input
              id={`${id}-sponsor`}
              className={INPUT}
              value={v.sponsor}
              onChange={(e) => set({ sponsor: e.target.value })}
            />
          </Field>
          <Field label="Horizon" id={`${id}-horizon`} hint="e.g. FY27 H1">
            <input
              id={`${id}-horizon`}
              className={INPUT}
              value={v.horizon}
              onChange={(e) => set({ horizon: e.target.value })}
            />
          </Field>
        </div>
      </DialogContent>
    </Dialog>
  );
}
