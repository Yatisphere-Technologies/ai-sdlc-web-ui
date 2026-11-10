import { createFileRoute, notFound, redirect } from "@tanstack/react-router";

/** Screens folded into others in the October 2026 navigation clean-up; old links land on their new home. */
const MOVED: Record<string, { to: string; search?: Record<string, string> }> = {
  portfolio: { to: "/t/$tenantSlug/projects" },
  trace: { to: "/t/$tenantSlug/projects" },
  shape: { to: "/t/$tenantSlug/brd/new" },
  specs: { to: "/t/$tenantSlug/brd", search: { view: "specs" } },
  design: { to: "/t/$tenantSlug/architecture", search: { view: "options" } },
  build: { to: "/t/$tenantSlug/delivery" },
  verify: { to: "/t/$tenantSlug/delivery", search: { tab: "verify" } },
  release: { to: "/t/$tenantSlug/delivery", search: { tab: "release" } },
};

/** Every module has its own route file; anything else under a workspace is a 404. */
export const Route = createFileRoute("/t/$tenantSlug/$module")({
  beforeLoad: ({ params }) => {
    const moved = MOVED[params.module];
    if (moved)
      throw redirect({
        to: moved.to as "/t/$tenantSlug/projects",
        params: { tenantSlug: params.tenantSlug },
        search: moved.search as never,
        replace: true,
      });
    throw notFound();
  },
});
