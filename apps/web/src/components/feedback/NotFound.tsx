import { Link } from "@tanstack/react-router";
import { Button, EmptyState } from "@throughline/ui";
import { Compass } from "lucide-react";

export function NotFound() {
  return (
    <div className="bg-grid flex min-h-screen items-center justify-center p-8">
      <EmptyState
        icon={<Compass className="size-8" />}
        title="Nothing here"
        description="This page doesn't exist, or it belongs to a workspace you're not a member of."
        action={
          <Button asChild>
            <Link to="/workspaces">Choose a workspace</Link>
          </Button>
        }
      />
    </div>
  );
}
