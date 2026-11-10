import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { Toaster, TooltipProvider } from "@throughline/ui";
import { useResolvedTheme } from "@/theme";
import { queryClient } from "./queryClient";
import { router } from "./router";

export function App() {
  const theme = useResolvedTheme();
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RouterProvider router={router} />
        <Toaster theme={theme} />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
