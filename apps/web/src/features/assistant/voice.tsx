import { VoiceProvider } from "@throughline/collab";
import { type ReactNode, useCallback, useSyncExternalStore } from "react";
import { useConversations } from "./api";

const KEY = "throughline.voice.autoRead";
const listeners = new Set<() => void>();
const read = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

/** Read assistant replies aloud automatically; a per-browser preference. */
export function useAutoRead(): [boolean, (v: boolean) => void] {
  const value = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => false,
  );
  const set = useCallback((v: boolean) => {
    try {
      localStorage.setItem(KEY, v ? "1" : "0");
    } catch {
      /* storage blocked: the setting lasts for this page only */
    }
    for (const l of listeners) l();
  }, []);
  return [value, set];
}

/**
 * Voice for everything in a workspace: the browser engine, switched off with a reason when the
 * workspace's admin blocked browser speech (data residency). Wraps every tenant layout.
 */
export function WorkspaceVoice({ children }: { children: ReactNode }) {
  const policy = useConversations().data?.voice;
  const lang = typeof navigator !== "undefined" ? navigator.language || "en-GB" : "en-GB";
  return (
    <VoiceProvider lang={lang} disabledReason={policy && !policy.allowed ? policy.reason : null}>
      {children}
    </VoiceProvider>
  );
}
