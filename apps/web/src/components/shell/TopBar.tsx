import { useNavigate } from "@tanstack/react-router";
import {
  Badge,
  Kbd,
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuSeparator,
  MenuTrigger,
} from "@throughline/ui";
import { LayoutGrid, LogOut, Search } from "lucide-react";
import { useCallback, useState } from "react";
import { config } from "@/app/config";
import { useSession, useSignOut } from "@/auth/session";
import { CommandPalette, useCommandShortcut } from "@/features/command";
import { ProjectSwitcher } from "@/features/projects";
import { useTenant } from "@/tenancy";
import { ThemeMenu } from "@/theme";
import { TenantSwitcher } from "./TenantSwitcher";

export function TopBar() {
  const { user } = useSession();
  const { membership } = useTenant();
  const navigate = useNavigate();
  const signOut = useSignOut();
  const [searching, setSearching] = useState(false);
  useCommandShortcut(useCallback(() => setSearching(true), []));
  return (
    <header className="border-line bg-scrim sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b px-6 py-3 backdrop-blur-md lg:px-9">
      <div className="min-w-0 flex-1 sm:flex-none">
        <TenantSwitcher />
      </div>
      {/* On phones the project picker gets its own row under the workspace and actions. */}
      <div className="order-last w-full sm:order-none sm:w-auto">
        <ProjectSwitcher />
      </div>
      <button
        type="button"
        onClick={() => setSearching(true)}
        aria-label="Search or ask (⌘K)"
        className="border-line bg-surface text-muted hover:border-line-strong flex size-11 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md border text-left sm:ml-auto sm:w-auto sm:max-w-xs sm:min-w-44 sm:flex-1 sm:justify-start sm:px-3"
      >
        <Search className="size-4" aria-hidden />
        <span className="text-body text-faint hidden min-w-0 flex-1 truncate sm:inline">Search or ask…</span>
        <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
      </button>
      <CommandPalette open={searching} onOpenChange={setSearching} />
      {config.useMocks ? (
        <Badge mono className="hidden sm:inline-flex">
          Sample data
        </Badge>
      ) : null}
      <ThemeMenu />
      <Menu>
        <MenuTrigger asChild>
          <button
            type="button"
            className="press hover:bg-surface-raised flex cursor-pointer items-center gap-2.5 rounded-md p-1"
            aria-label={`Account: ${user.name}`}
          >
            <span className="bg-human-soft text-human-fg text-micro flex size-9 items-center justify-center rounded-full font-mono">
              {user.initials}
            </span>
            <span className="hidden flex-col text-left xl:flex">
              <span className="text-body-sm text-foreground">{user.name}</span>
              <span className="text-caption text-muted">{membership.roles.join(" · ")}</span>
            </span>
          </button>
        </MenuTrigger>
        <MenuContent align="end">
          <MenuLabel>{user.email}</MenuLabel>
          <MenuItem onSelect={() => navigate({ to: "/workspaces" })}>
            <LayoutGrid className="text-muted size-4" aria-hidden /> All workspaces
          </MenuItem>
          <MenuSeparator />
          <MenuItem
            onSelect={() => signOut.mutate(undefined, { onSuccess: () => navigate({ to: "/" }) })}
            className="text-risk-fg"
          >
            <LogOut className="size-4" aria-hidden /> Sign out
          </MenuItem>
        </MenuContent>
      </Menu>
    </header>
  );
}
