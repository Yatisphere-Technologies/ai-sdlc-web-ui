import {
  ApiErrorBody,
  TENANT_HEADER,
  TenantId,
  type TenantId as TenantIdType,
  tenantApiPath,
} from "@throughline/contracts";
import type { z } from "zod";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

async function request<S extends z.ZodType>(
  url: string,
  schema: S,
  {
    method = "GET",
    body,
    headers,
  }: { method?: Method; body?: unknown; headers?: Record<string, string> } = {},
): Promise<z.infer<S>> {
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!res.ok) {
    const parsed = ApiErrorBody.safeParse(await res.json().catch(() => null));
    throw parsed.success
      ? new ApiError(res.status, parsed.data.error.code, parsed.data.error.message)
      : new ApiError(res.status, "internal", `Request failed with ${res.status}`);
  }
  // Every response is validated against the shared contract, so a drifting API fails loudly here.
  return schema.parse(await res.json());
}

/** Calls that are not scoped to a tenant (who am I, which tenants can I enter). */
export const globalApi = {
  get: <S extends z.ZodType>(path: `/api/${string}`, schema: S) => request(path, schema),
  post: <S extends z.ZodType>(path: `/api/${string}`, schema: S, body?: unknown) =>
    request(path, schema, { method: "POST", body: body ?? {} }),
};

/**
 * The only way feature code talks to tenant data. The tenant id goes in the path AND the header,
 * so the server can reject a request whose two ids disagree.
 */
export function createTenantApi(tenantId: TenantIdType) {
  TenantId.parse(tenantId);
  const headers = { [TENANT_HEADER]: tenantId };
  const url = (path: `/${string}`) => tenantApiPath(tenantId, path);

  return {
    tenantId,
    get: <S extends z.ZodType>(path: `/${string}`, schema: S) => request(url(path), schema, { headers }),
    post: <S extends z.ZodType>(path: `/${string}`, schema: S, body?: unknown) =>
      request(url(path), schema, { method: "POST", body: body ?? {}, headers }),
    patch: <S extends z.ZodType>(path: `/${string}`, schema: S, body: unknown) =>
      request(url(path), schema, { method: "PATCH", body, headers }),
    put: <S extends z.ZodType>(path: `/${string}`, schema: S, body: unknown) =>
      request(url(path), schema, { method: "PUT", body, headers }),
    delete: <S extends z.ZodType>(path: `/${string}`, schema: S) =>
      request(url(path), schema, { method: "DELETE", headers }),
  };
}

export type TenantApi = ReturnType<typeof createTenantApi>;
