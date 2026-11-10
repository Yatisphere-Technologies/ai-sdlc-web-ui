import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "@/api/http";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Don't retry what will never succeed (missing tenant, no permission, bad request).
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
    },
  },
});
