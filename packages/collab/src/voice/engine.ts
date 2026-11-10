/* ── Speech engines ──────────────────────────────────────────────────────────────────────────────
 * Voice is pluggable: the UI talks to a SpeechEngine, never to a browser API. The default engine
 * uses the browser's Web Speech API. Note where audio goes: Chrome and Edge send recognition audio
 * to their vendor's cloud; Safari may process on device. Workspaces with data-residency rules
 * should plug in an in-region engine (e.g. Azure AI Speech in the tenant's region) with the same
 * interface, or turn browser voice off.
 */

export type VoiceErrorCode =
  | "unsupported"
  | "not-allowed"
  | "no-microphone"
  | "no-speech"
  | "network"
  | "aborted"
  | "other";

export type VoiceError = { code: VoiceErrorCode; message: string };

export const VOICE_ERROR_MESSAGE: Record<VoiceErrorCode, string> = {
  unsupported: "This browser can't turn speech into text. Try Chrome, Edge or Safari, or type instead.",
  "not-allowed": "Microphone access is blocked. Allow it in the browser's site settings and try again.",
  "no-microphone": "No microphone was found. Plug one in or check your system settings.",
  "no-speech": "I didn't hear anything. Try again a little closer to the microphone.",
  network: "The speech service couldn't be reached. Check your connection or type instead.",
  aborted: "Listening stopped.",
  other: "Voice input failed. Try again or type instead.",
};

export const voiceError = (code: VoiceErrorCode): VoiceError => ({
  code,
  message: VOICE_ERROR_MESSAGE[code],
});

export type ListenOptions = {
  lang: string;
  /** Keep listening across pauses (dictation); false ends after the first utterance (voice mode). */
  continuous: boolean;
};

export type ListenEvents = {
  onStart?: () => void;
  /** Words recognised so far that may still change. */
  onInterim?: (text: string) => void;
  /** A finished phrase. */
  onFinal: (text: string) => void;
  onError?: (error: VoiceError) => void;
  onEnd?: () => void;
};

export type ListenSession = { stop: () => void; abort: () => void };

export type SpeakOptions = {
  lang: string;
  rate?: number;
  voiceName?: string | null;
  onStart?: () => void;
  onEnd?: () => void;
};

export type SpeakHandle = { cancel: () => void };

export type VoiceInfo = { name: string; lang: string; local: boolean };

export interface SpeechEngine {
  id: string;
  label: string;
  /** Plain words for where audio is processed, shown to the user. */
  where: string;
  canListen: boolean;
  canSpeak: boolean;
  listen: (options: ListenOptions, events: ListenEvents) => ListenSession;
  speak: (text: string, options: SpeakOptions) => SpeakHandle;
  voices: () => VoiceInfo[];
}

/* ── Browser engine (Web Speech API) ─────────────────────────────────────────────────────────── */

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

const recognitionCtor = (): RecognitionCtor | null => {
  const w = globalThis as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

const ERROR_MAP: Record<string, VoiceErrorCode> = {
  "not-allowed": "not-allowed",
  "service-not-allowed": "not-allowed",
  "audio-capture": "no-microphone",
  "no-speech": "no-speech",
  network: "network",
  aborted: "aborted",
  "language-not-supported": "unsupported",
};

export function browserSpeechEngine(): SpeechEngine {
  const Ctor = recognitionCtor();
  const synth = (globalThis as { speechSynthesis?: SpeechSynthesis }).speechSynthesis;
  const isChromium = typeof navigator !== "undefined" && /Chrome|Edg\//.test(navigator.userAgent);
  return {
    id: "browser",
    label: "Browser speech",
    where: isChromium
      ? "Your browser sends recognition audio to its vendor's speech service (Google or Microsoft)."
      : "Your browser's built-in speech service; it may process audio on the device or in the vendor's cloud.",
    canListen: Ctor !== null,
    canSpeak: Boolean(synth),
    listen(options, events) {
      if (!Ctor) {
        events.onError?.(voiceError("unsupported"));
        events.onEnd?.();
        return { stop() {}, abort() {} };
      }
      const r = new Ctor();
      r.lang = options.lang;
      r.continuous = options.continuous;
      r.interimResults = true;
      r.maxAlternatives = 1;
      r.onstart = () => events.onStart?.();
      r.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          if (!res) continue;
          const text = res[0].transcript;
          if (res.isFinal) events.onFinal(text.trim());
          else interim += text;
        }
        events.onInterim?.(interim.trim());
      };
      r.onerror = (e) => events.onError?.(voiceError(ERROR_MAP[e.error] ?? "other"));
      r.onend = () => events.onEnd?.();
      try {
        r.start();
      } catch {
        events.onError?.(voiceError("other"));
        events.onEnd?.();
      }
      return { stop: () => r.stop(), abort: () => r.abort() };
    },
    speak(text, options) {
      if (!synth) {
        options.onEnd?.();
        return { cancel() {} };
      }
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = options.lang;
      u.rate = options.rate ?? 1;
      const voice =
        synth.getVoices().find((v) => v.name === options.voiceName) ??
        synth.getVoices().find((v) => v.lang === options.lang && v.localService) ??
        synth.getVoices().find((v) => v.lang.startsWith(options.lang.split("-")[0] ?? "en"));
      if (voice) u.voice = voice;
      let ended = false;
      const end = () => {
        if (ended) return;
        ended = true;
        options.onEnd?.();
      };
      u.onstart = () => options.onStart?.();
      u.onend = end;
      u.onerror = end;
      synth.speak(u);
      return {
        cancel: () => {
          synth.cancel();
          end();
        },
      };
    },
    voices: () =>
      synth ? synth.getVoices().map((v) => ({ name: v.name, lang: v.lang, local: v.localService })) : [],
  };
}

/** An engine that can do nothing; used when voice is turned off. */
export const silentEngine: SpeechEngine = {
  id: "off",
  label: "Off",
  where: "Voice is turned off.",
  canListen: false,
  canSpeak: false,
  listen: (_o, events) => {
    events.onError?.(voiceError("unsupported"));
    events.onEnd?.();
    return { stop() {}, abort() {} };
  },
  speak: (_t, o) => {
    o.onEnd?.();
    return { cancel() {} };
  },
  voices: () => [],
};
