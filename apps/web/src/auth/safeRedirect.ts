/**
 * Only allow redirects back into this app after sign-in. Rejects absolute URLs, protocol-relative
 * URLs (//evil.com) and backslash tricks, which would otherwise make /login an open redirect.
 */
export function safeRedirect(target: unknown, fallback = "/workspaces"): string {
  if (typeof target !== "string") return fallback;
  if (!target.startsWith("/") || target.startsWith("//") || target.includes("\\")) return fallback;
  if (target.startsWith("/login")) return fallback;
  return target;
}
