import {
  type QueryClient,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { type LoginRequest, Session } from "@throughline/contracts";
import { z } from "zod";
import { ApiError, globalApi } from "@/api/http";
import { queryKeys } from "@/api/queryKeys";

/**
 * The signed-in user and the tenants they belong to. In mock mode MSW answers this; in live mode the
 * backend-for-frontend reads the OIDC session cookie. Tokens never reach the browser.
 */
export const sessionQueryOptions = () =>
  queryOptions({
    queryKey: queryKeys.session,
    queryFn: () => globalApi.get("/api/me", Session),
    staleTime: 5 * 60_000,
    retry: false,
  });

/** The session, or null when signed out. Other errors still throw. */
export async function loadSession(queryClient: QueryClient): Promise<Session | null> {
  try {
    return await queryClient.ensureQueryData(sessionQueryOptions());
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null;
    throw error;
  }
}

/** For route guards: the session, or a redirect to /login that comes back here afterwards. */
export async function requireSession(queryClient: QueryClient, returnTo: string): Promise<Session> {
  const session = await loadSession(queryClient);
  if (!session) throw redirect({ to: "/login", search: { redirect: returnTo } });
  return session;
}

/** Inside signed-in routes only (their guard has already loaded the session). */
export function useSession() {
  return useSuspenseQuery(sessionQueryOptions()).data;
}

/** On public pages: whether someone is signed in, without throwing. */
export function useOptionalSession() {
  const q = useQuery(sessionQueryOptions());
  return q.isSuccess ? q.data : null;
}

export function useSignIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: LoginRequest) => globalApi.post("/api/auth/login", Session, body),
    onSuccess: (session) => queryClient.setQueryData(queryKeys.session, session),
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => globalApi.post("/api/auth/logout", z.object({ ok: z.boolean() })),
    // Drop every cached tenant's data, not just the session.
    onSuccess: () => queryClient.clear(),
  });
}
