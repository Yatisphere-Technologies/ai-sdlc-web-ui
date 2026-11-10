import { Select } from "@throughline/ui";
import { useTenant } from "@/tenancy";
import { usePortfolioQuery } from "./api";
import { HEALTH_TONE } from "./parts";
import { useProjectScope } from "./scope";

/** Top-bar picker for the project the person is working in; module pages follow it. */
export function ProjectSwitcher() {
  const { tenant } = useTenant();
  const { data } = usePortfolioQuery();
  const [scope, setScope] = useProjectScope(tenant.id);
  if (!data) return null;
  const valid = scope && data.projects.some((p) => p.id === scope) ? scope : "";
  return (
    <Select
      label="Project"
      prefix="Project"
      variant="toolbar"
      size="lg"
      className="w-full max-w-full sm:w-56 2xl:w-64"
      contentClassName="w-80"
      value={valid}
      onValueChange={(v) => setScope(v || null)}
      options={[
        {
          value: "",
          label: "All projects",
          description: `${data.projects.length} projects in ${data.programs.length} programs`,
        },
        ...data.programs.flatMap((g) =>
          data.projects
            .filter((p) => p.programId === g.id)
            .map((p) => ({
              value: p.id,
              label: `${p.key} · ${p.name}`,
              description: p.platform ? "Shared platform" : p.objective,
              dot: HEALTH_TONE[p.health],
              group: `${g.key} · ${g.name}`,
            })),
        ),
      ]}
    />
  );
}
