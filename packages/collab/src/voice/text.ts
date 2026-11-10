/** Joins dictated phrases onto what's already typed, with sensible spacing and capitals. */
export function appendDictation(current: string, phrase: string): string {
  const p = phrase.trim();
  if (!p) return current;
  const base = current.replace(/\s+$/, "");
  if (!base) return p.charAt(0).toUpperCase() + p.slice(1);
  const endsSentence = /[.!?]$/.test(base);
  const next = endsSentence ? p.charAt(0).toUpperCase() + p.slice(1) : p;
  return `${base} ${next}`;
}

/** Spoken punctuation commands people use while dictating. */
const SPOKEN: [RegExp, string][] = [
  [/\s*\b(full stop|period)\b/gi, "."],
  [/\s*\bcomma\b/gi, ","],
  [/\s*\bquestion mark\b/gi, "?"],
  [/\s*\bnew line\b\s*/gi, "\n"],
];
export function spokenPunctuation(text: string): string {
  return SPOKEN.reduce((t, [re, s]) => t.replace(re, s), text);
}

/** Markdown turned into something pleasant to hear: no symbols, links read as their text, short. */
export function speakable(markdown: string, maxSentences = 4): string {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, " (code omitted) ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/[*_~>|]/g, "")
    .replace(/\s*→\s*/g, " to ")
    .replace(/\s*·\s*/g, ", ")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, ". ")
    .replace(/\.\s*\./g, ".")
    .replace(/\s+([.,])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
  const sentences = plain.match(/[^.!?]+[.!?]*/g) ?? [plain];
  const kept = sentences
    .slice(0, maxSentences)
    .map((x) => x.trim())
    .join(" ");
  return sentences.length > maxSentences ? `${kept} The rest is on screen.` : kept;
}

/* ── Hands-free conversation state ───────────────────────────────────────────────────────────── */

export type VoiceTurn = "idle" | "listening" | "thinking" | "speaking" | "error";

export type VoiceState = {
  turn: VoiceTurn;
  interim: string;
  /** The last thing the user said. */
  heard: string;
  /** The last reply, as spoken. */
  reply: string;
  error: string | null;
  /** Listening resumes after a reply unless the user paused. */
  paused: boolean;
};

export type VoiceEvent =
  | { type: "listen" }
  | { type: "interim"; text: string }
  | { type: "heard"; text: string }
  | { type: "silence" }
  | { type: "reply"; text: string }
  | { type: "spoken" }
  | { type: "interrupt" }
  | { type: "pause" }
  | { type: "error"; message: string };

export const initialVoiceState: VoiceState = {
  turn: "idle",
  interim: "",
  heard: "",
  reply: "",
  error: null,
  paused: false,
};

export function voiceReducer(s: VoiceState, e: VoiceEvent): VoiceState {
  switch (e.type) {
    case "listen":
      return { ...s, turn: "listening", interim: "", error: null, paused: false };
    case "interim":
      return s.turn === "listening" ? { ...s, interim: e.text } : s;
    case "heard":
      return e.text.trim() ? { ...s, turn: "thinking", heard: e.text.trim(), interim: "" } : s;
    case "silence":
      // Recognition ended without words: wait for the user instead of looping on an empty room.
      return s.turn === "listening" ? { ...s, turn: "idle", interim: "" } : s;
    case "reply":
      return s.turn === "thinking" ? { ...s, turn: e.text ? "speaking" : "idle", reply: e.text } : s;
    case "spoken":
      return s.turn === "speaking" ? { ...s, turn: s.paused ? "idle" : "listening", interim: "" } : s;
    case "interrupt":
      return { ...s, turn: "listening", interim: "", paused: false };
    case "pause":
      return { ...s, turn: "idle", interim: "", paused: true };
    case "error":
      return { ...s, turn: "error", error: e.message, interim: "" };
  }
}
