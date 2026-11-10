import { Skeleton } from "@throughline/ui";
import { type ReactNode, Suspense } from "react";

export function QueryBoundary({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div role="status" aria-label="Loading" className="grid gap-5 lg:grid-cols-3">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl lg:col-span-2" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
