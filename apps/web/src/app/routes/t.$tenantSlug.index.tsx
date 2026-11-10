import { createFileRoute } from "@tanstack/react-router";
import { ControlRoomPage } from "@/features/control-room";

export const Route = createFileRoute("/t/$tenantSlug/")({ component: ControlRoomPage });
