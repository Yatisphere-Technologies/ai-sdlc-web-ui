import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { WorkItemList } from "@throughline/contracts";
import { useTenant } from "@/tenancy";

function useWorkItemsOptions() {
  const { api, keys } = useTenant();
  return queryOptions({ queryKey: keys.workItems, queryFn: () => api.get("/work-items", WorkItemList) });
}

export function useWorkItems() {
  return useSuspenseQuery(useWorkItemsOptions()).data;
}

/** Non-suspending variant, for links that only need the data when it is there. */
export function useWorkItemsQuery() {
  return useQuery(useWorkItemsOptions());
}
