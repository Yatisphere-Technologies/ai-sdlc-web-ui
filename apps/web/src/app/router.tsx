import { createRouter } from "@tanstack/react-router";
import { NotFound } from "@/components/feedback/NotFound";
import { RouteError } from "@/components/feedback/RouteError";
import { queryClient } from "./queryClient";
import { routeTree } from "./routeTree.gen";

export const router = createRouter({
  routeTree,
  context: { queryClient },
  defaultPreload: "intent",
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
  defaultNotFoundComponent: NotFound,
  defaultErrorComponent: RouteError,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
