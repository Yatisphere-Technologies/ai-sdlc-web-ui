import type { ReactNode } from "react";
import { AssistantLauncher, AssistantPanel, AssistantProvider } from "@/features/assistant";
import { MODULES } from "@/features/modules";
import { NavItem, SideNav } from "./SideNav";
import { TopBar } from "./TopBar";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AssistantProvider>
      <div className="bg-grid flex min-h-screen">
        <SideNav className="sticky top-0 hidden h-screen w-60 shrink-0 overflow-y-auto lg:flex" />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <nav
            aria-label="Main"
            className="border-line flex gap-1 overflow-x-auto border-b px-4 py-2 lg:hidden"
          >
            {MODULES.map((m) => (
              <NavItem key={m.id} module={m} />
            ))}
          </nav>
          <main className="flex min-w-0 flex-1 flex-col gap-6 px-6 py-7 pb-24 lg:px-9">{children}</main>
        </div>
        <AssistantPanel />
        <AssistantLauncher />
      </div>
    </AssistantProvider>
  );
}
