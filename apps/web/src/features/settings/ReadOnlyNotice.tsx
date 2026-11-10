import { Card } from "@throughline/ui";
import { Lock } from "lucide-react";

export function ReadOnlyNotice({ what }: { what: string }) {
  return (
    <Card tone="gate" padding="sm" className="text-body-sm text-gate-fg flex items-center gap-3">
      <Lock className="size-4 shrink-0" aria-hidden />
      Your role in this workspace can view {what} but not change them. A tenant admin can.
    </Card>
  );
}
