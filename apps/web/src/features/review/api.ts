import { ReviewList, type SignoffRole } from "@throughline/contracts";
import { useTenantData, useTenantWrite } from "@/api/tenantQuery";
import { useTenant } from "@/tenancy";

export function useReviews() {
  const { keys } = useTenant();
  // Poll while any pack is generating so artifacts appear as the agents finish them.
  return useTenantData(keys.reviews, "/reviews", ReviewList, {
    refetchInterval: (d) => (d?.items.some((p) => p.status === "generating") ? 800 : false),
  }).items;
}

export function useGeneratePack() {
  const { keys } = useTenant();
  return useTenantWrite(keys.reviews, ReviewList, (packId: string) => ({
    method: "post",
    path: `/reviews/${packId}/generate`,
  }));
}

export function useUpdateFinding() {
  const { keys } = useTenant();
  return useTenantWrite(
    keys.reviews,
    ReviewList,
    (v: { packId: string; findingId: string; status: "resolved" | "accepted" }) => ({
      method: "patch",
      path: `/reviews/${v.packId}/findings/${v.findingId}`,
      body: { status: v.status },
    }),
  );
}

export function useSignoff() {
  const { keys } = useTenant();
  return useTenantWrite(keys.reviews, ReviewList, (v: { packId: string; role: SignoffRole }) => ({
    method: "post",
    path: `/reviews/${v.packId}/signoff`,
    body: { role: v.role },
  }));
}
