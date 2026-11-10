import { createFileRoute, redirect } from "@tanstack/react-router";
import { safeRedirect } from "@/auth/safeRedirect";
import { loadSession } from "@/auth/session";
import { LoginPage } from "@/features/auth";

type LoginSearch = { redirect?: string };

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: typeof search.redirect === "string" ? search.redirect : undefined,
  }),
  beforeLoad: async ({ context, search }) => {
    // Already signed in? Skip the form.
    if (await loadSession(context.queryClient)) throw redirect({ href: safeRedirect(search.redirect) });
  },
  component: function LoginRoute() {
    const { redirect: target } = Route.useSearch();
    return <LoginPage redirectTo={safeRedirect(target)} />;
  },
});
