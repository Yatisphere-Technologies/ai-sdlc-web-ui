import { useQuery } from "@tanstack/react-query";
import { type NewProgram, type NewProject, Portfolio, ProjectOverview } from "@throughline/contracts";
import { useTenantData, useTenantWrite } from "@/api/tenantQuery";
import { useTenant } from "@/tenancy";

export function usePortfolio() {
  const { keys } = useTenant();
  return useTenantData(keys.portfolio, "/portfolio", Portfolio);
}

/** Non-suspending variant for chrome (top bar, pickers) that must render while it loads. */
export function usePortfolioQuery() {
  const { api, keys } = useTenant();
  return useQuery({ queryKey: keys.portfolio, queryFn: () => api.get("/portfolio", Portfolio) });
}

export function useProjectOverview(key: string) {
  const { keys } = useTenant();
  return useTenantData(keys.project(key), `/projects/${encodeURIComponent(key)}`, ProjectOverview);
}

export function useCreateProject() {
  const { keys } = useTenant();
  return useTenantWrite(
    keys.project("new"),
    ProjectOverview,
    (v: NewProject) => ({ method: "post", path: "/projects", body: v }),
    [keys.portfolio],
    { success: (v) => `${v.key} · ${v.name} created`, error: "Couldn't create the project" },
  );
}

export function useCreateProgram() {
  const { keys } = useTenant();
  return useTenantWrite(
    keys.portfolio,
    Portfolio,
    (v: NewProgram) => ({ method: "post", path: "/programs", body: v }),
    [],
    { success: (v) => `${v.key} · ${v.name} created`, error: "Couldn't create the program" },
  );
}
