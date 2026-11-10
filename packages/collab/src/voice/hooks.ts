import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { type ListenSession, type SpeakHandle, type VoiceError, voiceError } from "./engine";
import { initialVoiceState, speakable, spokenPunctuation, voiceReducer } from "./text";
import { useListenBlocked, useVoiceSettings } from "./VoiceProvider";

export type DictationState = "idle" | "listening" | "error";

/**
 * Speech-to-text into a text box. Finished phrases go to `onFinal`; words still being recognised
 * are in `interim`. Stops on blur of the page, unmount, or `stop()`.
 */
export function useDictation({
  onFinal,
  continuous = true,
}: {
  onFinal: (text: string) => void;
  continuous?: boolean;
}) {
  const { engine, lang } = useVoiceSettings();
  const blocked = useListenBlocked();
  const [state, setState] = useState<DictationState>("idle");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<VoiceError | null>(null);
  const session = useRef<ListenSession | null>(null);
  const final = useRef(onFinal);
  final.current = onFinal;

  const stop = useCallback(() => {
    session.current?.stop();
  }, []);

  const start = useCallback(() => {
    if (blocked) {
      setError({ code: "unsupported", message: blocked });
      setState("error");
      return;
    }
    session.current?.abort();
    setError(null);
    setInterim("");
    setState("listening");
    session.current = engine.listen(
      { lang, continuous },
      {
        onInterim: setInterim,
        onFinal: (t) => {
          setInterim("");
          if (t) final.current(spokenPunctuation(t));
        },
        onError: (e) => {
          if (e.code === "aborted" || e.code === "no-speech") return;
          setError(e);
          setState("error");
        },
        onEnd: () => {
          session.current = null;
          setInterim("");
          setState((s) => (s === "error" ? s : "idle"));
        },
      },
    );
  }, [blocked, engine, lang, continuous]);

  const toggle = useCallback(() => (session.current ? stop() : start()), [start, stop]);

  useEffect(() => () => session.current?.abort(), []);

  return { state, interim, error, blocked, start, stop, toggle, listening: state === "listening" };
}

/** Text-to-speech for replies; one thing speaks at a time. */
export function useSpeaker() {
  const { engine, lang, rate, voiceName, disabledReason } = useVoiceSettings();
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const handle = useRef<SpeakHandle | null>(null);
  const stop = useCallback(() => {
    handle.current?.cancel();
    handle.current = null;
    setSpeakingId(null);
  }, []);
  const speak = useCallback(
    (text: string, id = "speech", onEnd?: () => void) => {
      handle.current?.cancel();
      setSpeakingId(id);
      handle.current = engine.speak(speakable(text), {
        lang,
        rate,
        voiceName,
        onEnd: () => {
          setSpeakingId((cur) => (cur === id ? null : cur));
          onEnd?.();
        },
      });
    },
    [engine, lang, rate, voiceName],
  );
  useEffect(() => () => handle.current?.cancel(), []);
  return { speak, stop, speakingId, canSpeak: engine.canSpeak && !disabledReason };
}

/**
 * Microphone loudness (0–1) for a waveform while `active`. Uses a separate audio stream that is
 * released when inactive; returns null if the mic can't be read, and the UI falls back to a
 * gentle animation.
 */
export function useMicLevel(active: boolean) {
  const [level, setLevel] = useState<number | null>(null);
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setLevel(null);
      return;
    }
    let stopped = false;
    let raf = 0;
    let stream: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    navigator.mediaDevices
      .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      .then((s) => {
        if (stopped) {
          for (const t of s.getTracks()) t.stop();
          return;
        }
        stream = s;
        ctx = new AudioContext();
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        ctx.createMediaStreamSource(s).connect(analyser);
        const data = new Uint8Array(analyser.fftSize);
        const tick = () => {
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (const v of data) sum += ((v - 128) / 128) ** 2;
          setLevel(Math.min(1, Math.sqrt(sum / data.length) * 4));
          raf = requestAnimationFrame(tick);
        };
        tick();
      })
      .catch(() => setLevel(null));
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      for (const t of stream?.getTracks() ?? []) t.stop();
      void ctx?.close();
      setLevel(null);
    };
  }, [active]);
  return level;
}

/**
 * Hands-free conversation: listen for one utterance, hand it to `respond`, speak the reply, listen
 * again. Tap to interrupt the reply; pause to stop listening.
 */
export function useVoiceConversation(respond: (text: string) => Promise<string | null>) {
  const { engine, lang, rate, voiceName } = useVoiceSettings();
  const blocked = useListenBlocked();
  const [state, dispatch] = useReducer(voiceReducer, initialVoiceState);
  const listen = useRef<ListenSession | null>(null);
  const speech = useRef<SpeakHandle | null>(null);
  const heardSomething = useRef(false);
  const respondRef = useRef(respond);
  respondRef.current = respond;
  const alive = useRef(true);

  // Start or stop the recogniser to match the turn.
  useEffect(() => {
    if (state.turn !== "listening") return;
    if (blocked) {
      dispatch({ type: "error", message: blocked });
      return;
    }
    heardSomething.current = false;
    listen.current = engine.listen(
      { lang, continuous: false },
      {
        onInterim: (t) => dispatch({ type: "interim", text: t }),
        onFinal: (t) => {
          if (!t) return;
          heardSomething.current = true;
          dispatch({ type: "heard", text: spokenPunctuation(t) });
        },
        onError: (e: VoiceError) => {
          if (e.code === "no-speech" || e.code === "aborted") return;
          dispatch({ type: "error", message: e.message });
        },
        onEnd: () => {
          listen.current = null;
          if (!heardSomething.current) dispatch({ type: "silence" });
        },
      },
    );
    return () => {
      listen.current?.abort();
      listen.current = null;
    };
  }, [state.turn, blocked, engine, lang]);

  // Ask for a reply once something was heard.
  useEffect(() => {
    if (state.turn !== "thinking") return;
    let cancelled = false;
    respondRef
      .current(state.heard)
      .then((reply) => {
        if (!cancelled && alive.current) dispatch({ type: "reply", text: reply ? speakable(reply) : "" });
      })
      .catch(() => {
        if (!cancelled && alive.current) dispatch({ type: "error", message: voiceError("other").message });
      });
    return () => {
      cancelled = true;
    };
  }, [state.turn, state.heard]);

  // Speak the reply.
  useEffect(() => {
    if (state.turn !== "speaking") return;
    speech.current = engine.speak(state.reply, {
      lang,
      rate,
      voiceName,
      onEnd: () => {
        if (alive.current) dispatch({ type: "spoken" });
      },
    });
    return () => {
      speech.current?.cancel();
      speech.current = null;
    };
  }, [state.turn, state.reply, engine, lang, rate, voiceName]);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  return {
    state,
    blocked,
    start: () => dispatch({ type: "listen" }),
    interrupt: () => {
      speech.current?.cancel();
      dispatch({ type: "interrupt" });
    },
    pause: () => {
      speech.current?.cancel();
      listen.current?.abort();
      dispatch({ type: "pause" });
    },
    /** Stop listening now and send what was heard so far. */
    finish: () => listen.current?.stop(),
  };
}
