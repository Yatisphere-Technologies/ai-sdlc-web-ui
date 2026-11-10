import { useEffect, useSyncExternalStore } from "react";

export type ThemeChoice = "dark" | "light" | "system";
export type Theme = "dark" | "light";

/** Keep in step with the inline script in index.html, which applies the theme before first paint. */
export const THEME_KEY = "throughline.theme";
const CHOICES: ThemeChoice[] = ["dark", "light", "system"];

export function parseChoice(v: unknown): ThemeChoice {
  return CHOICES.includes(v as ThemeChoice) ? (v as ThemeChoice) : "dark";
}

export function resolveTheme(choice: ThemeChoice, prefersLight: boolean): Theme {
  return choice === "system" ? (prefersLight ? "light" : "dark") : choice;
}

function stored(): ThemeChoice {
  try {
    return parseChoice(localStorage.getItem(THEME_KEY));
  } catch {
    return "dark";
  }
}

const query = () =>
  typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: light)")
    : null;

let choice: ThemeChoice = typeof window === "undefined" ? "dark" : stored();
/** A page can pin a theme (the public pages stay dark); null follows the user's choice. */
let pinned: Theme | null = null;
const listeners = new Set<() => void>();

function apply() {
  if (typeof document === "undefined") return;
  const theme = pinned ?? resolveTheme(choice, Boolean(query()?.matches));
  document.documentElement.dataset.theme = theme;
}

function emit() {
  apply();
  for (const l of listeners) l();
}

apply();

query()?.addEventListener?.("change", () => {
  if (choice === "system") emit();
});

export function setThemeChoice(next: ThemeChoice) {
  choice = next;
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    // Storage is a convenience; the theme still applies for this visit.
  }
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** The user's theme choice and a setter. */
export function useThemeChoice(): [ThemeChoice, (c: ThemeChoice) => void] {
  const c = useSyncExternalStore(
    subscribe,
    () => choice,
    () => "dark" as ThemeChoice,
  );
  return [c, setThemeChoice];
}

/** Pins the page to a theme while mounted (e.g. the dark marketing pages). */
export function usePinnedTheme(theme: Theme) {
  useEffect(() => {
    pinned = theme;
    emit();
    return () => {
      pinned = null;
      emit();
    };
  }, [theme]);
}

const current = (): Theme => pinned ?? resolveTheme(choice, Boolean(query()?.matches));

/** The theme actually showing (after "system" and any pinned page), for third-party widgets. */
export function useResolvedTheme(): Theme {
  return useSyncExternalStore(subscribe, current, () => "dark" as Theme);
}
