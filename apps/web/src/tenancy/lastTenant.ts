const KEY = "throughline.lastTenant";

// Browser storage can be missing or throw (private mode, blocked storage); it is a convenience only.
export function rememberTenant(slug: string) {
  try {
    localStorage.setItem(KEY, slug);
  } catch {
    /* ignore */
  }
}

export function lastTenant(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}
