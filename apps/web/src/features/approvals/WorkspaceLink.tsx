import { useRouter } from "@tanstack/react-router";
import type { MouseEvent, ReactNode } from "react";
import { useTenant } from "@/tenancy";
import type { ApprovalLink } from "./model";

/** Full href of a workspace-relative link, e.g. { path: "/review", search: { wi } } → /t/acme/review?wi=… */
export function hrefOf(slug: string, to: ApprovalLink): string {
  const q = to.search ? `?${new URLSearchParams(to.search).toString()}` : "";
  return `/t/${slug}${to.path}${q}`;
}

/**
 * A link to a workspace path built at runtime (approvals, search results). A real anchor, so
 * middle-click and screen readers work; a plain click navigates in-app.
 */
export function WorkspaceLink({
  to,
  className,
  children,
  onNavigate,
  ...rest
}: {
  to: ApprovalLink;
  className?: string;
  children: ReactNode;
  onNavigate?: () => void;
  "aria-label"?: string;
}) {
  const router = useRouter();
  const { tenant } = useTenant();
  const href = hrefOf(tenant.slug, to);
  return (
    <a
      {...rest}
      href={href}
      className={className}
      onClick={(e: MouseEvent) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        router.history.push(href);
        onNavigate?.();
      }}
    >
      {children}
    </a>
  );
}
