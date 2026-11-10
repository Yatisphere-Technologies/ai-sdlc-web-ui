import type { ErrorComponentProps } from "@tanstack/react-router";
import { Button, Card } from "@throughline/ui";
import { ApiError } from "@/api/http";

export function RouteError({ error, reset }: ErrorComponentProps) {
  const message =
    error instanceof ApiError && error.status === 403
      ? "Your role in this workspace doesn't allow this."
      : "Something went wrong loading this view.";
  return (
    <div className="p-8">
      <Card tone="risk" className="flex max-w-xl flex-col gap-3">
        <h2 className="font-display text-heading-md text-strong">{message}</h2>
        <p className="text-caption text-risk-fg font-mono">
          {error instanceof Error ? error.message : String(error)}
        </p>
        <div>
          <Button variant="secondary" onClick={reset}>
            Try again
          </Button>
        </div>
      </Card>
    </div>
  );
}
