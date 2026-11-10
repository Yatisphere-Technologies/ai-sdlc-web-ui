import { type Action, type ApiErrorBody, TENANT_HEADER, TenantId } from "@throughline/contracts";
import { HttpResponse } from "msw";
import { getMembership, getStore, isSignedIn } from "./db";

export function apiError(status: number, code: ApiErrorBody["error"]["code"], message: string) {
  return HttpResponse.json<ApiErrorBody>({ error: { code, message } }, { status });
}

/**
 * Mirrors what the real API must do on every tenant-scoped request:
 *  0. the caller is signed in
 *  1. the path tenant id is well formed
 *  2. the X-Tenant-Id header matches the path (stops a client bug from crossing tenants)
 *  3. the caller is a member; unknown and forbidden tenants both return 404, so ids can't be probed
 *  4. optionally, the caller's membership allows the action
 */
export function guardTenant(request: Request, rawTenantId: unknown, action?: Action) {
  if (!isSignedIn()) return { error: apiError(401, "unauthenticated", "Sign in first") } as const;

  const parsed = TenantId.safeParse(rawTenantId);
  if (!parsed.success) return { error: apiError(400, "invalid", "Malformed tenant id") } as const;
  const tenantId = parsed.data;

  if (request.headers.get(TENANT_HEADER) !== tenantId) {
    return { error: apiError(400, "tenant_mismatch", "Tenant header does not match the path") } as const;
  }

  const membership = getMembership(tenantId);
  const store = getStore(tenantId);
  if (!membership || !store) return { error: apiError(404, "not_found", "Not found") } as const;

  if (action && !membership.allowedActions.includes(action)) {
    return { error: apiError(403, "forbidden", "Your role in this workspace can't do that") } as const;
  }

  return { tenantId, membership, store } as const;
}
