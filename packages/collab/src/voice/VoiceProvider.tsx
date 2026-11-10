import { createContext, type ReactNode, useContext, useMemo } from "react";
import { browserSpeechEngine, type SpeechEngine, silentEngine } from "./engine";

export type VoiceSettings = {
  engine: SpeechEngine;
  /** BCP-47, e.g. "en-IN". */
  lang: string;
  /** Why voice is unavailable (admin policy, unsupported browser); null when it works. */
  disabledReason: string | null;
  /** Read assistant replies aloud automatically. */
  autoRead: boolean;
  rate: number;
  voiceName: string | null;
};

const defaultLang = () => (typeof navigator !== "undefined" ? navigator.language : "en-GB") || "en-GB";

const VoiceContext = createContext<VoiceSettings | null>(null);

/**
 * Supplies the speech engine and voice settings to every chat below it. Without a provider, chats
 * use the browser engine. Pass `disabledReason` to switch voice off with an explanation.
 */
export function VoiceProvider({
  children,
  engine,
  lang,
  disabledReason = null,
  autoRead = false,
  rate = 1,
  voiceName = null,
}: Partial<VoiceSettings> & { children: ReactNode }) {
  const value = useMemo<VoiceSettings>(
    () => ({
      engine: disabledReason ? silentEngine : (engine ?? browserSpeechEngine()),
      lang: lang ?? defaultLang(),
      disabledReason,
      autoRead,
      rate,
      voiceName,
    }),
    [engine, lang, disabledReason, autoRead, rate, voiceName],
  );
  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}

let fallback: VoiceSettings | null = null;

export function useVoiceSettings(): VoiceSettings {
  const ctx = useContext(VoiceContext);
  if (ctx) return ctx;
  fallback ??= {
    engine: browserSpeechEngine(),
    lang: defaultLang(),
    disabledReason: null,
    autoRead: false,
    rate: 1,
    voiceName: null,
  };
  return fallback;
}

/** Why the microphone can't be used right now, or null. */
export function useListenBlocked(): string | null {
  const v = useVoiceSettings();
  if (v.disabledReason) return v.disabledReason;
  if (!v.engine.canListen) return "This browser can't turn speech into text. Try Chrome, Edge or Safari.";
  return null;
}
