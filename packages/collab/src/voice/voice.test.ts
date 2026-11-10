import { appendDictation, initialVoiceState, speakable, spokenPunctuation, voiceReducer } from "./text";

describe("dictation text", () => {
  it("capitalises and spaces phrases", () => {
    expect(appendDictation("", "what is waiting on me")).toBe("What is waiting on me");
    expect(appendDictation("Hello.", "show the plan")).toBe("Hello. Show the plan");
    expect(appendDictation("Show the plan", "for UPI")).toBe("Show the plan for UPI");
    expect(appendDictation("x", "  ")).toBe("x");
  });

  it("understands spoken punctuation", () => {
    expect(spokenPunctuation("is UPI on track question mark")).toBe("is UPI on track?");
    expect(spokenPunctuation("first comma second full stop")).toBe("first, second.");
  });
});

describe("speakable", () => {
  it("strips Markdown and reads links as text", () => {
    expect(speakable("**3 decisions** are waiting.\n\n- [BRD-31](/x) · sign-off")).toBe(
      "3 decisions are waiting. BRD-31, sign-off",
    );
  });

  it("keeps replies short", () => {
    const s = speakable("One. Two. Three. Four. Five. Six.", 2);
    expect(s).toBe("One. Two. The rest is on screen.");
  });
});

describe("voice conversation", () => {
  it("goes listen → think → speak → listen", () => {
    let s = voiceReducer(initialVoiceState, { type: "listen" });
    s = voiceReducer(s, { type: "interim", text: "what's" });
    expect(s.interim).toBe("what's");
    s = voiceReducer(s, { type: "heard", text: "what's waiting" });
    expect(s).toMatchObject({ turn: "thinking", heard: "what's waiting", interim: "" });
    s = voiceReducer(s, { type: "reply", text: "Three decisions." });
    expect(s.turn).toBe("speaking");
    s = voiceReducer(s, { type: "spoken" });
    expect(s.turn).toBe("listening");
  });

  it("stays quiet after a pause and stops on silence", () => {
    let s = voiceReducer({ ...initialVoiceState, turn: "speaking" }, { type: "pause" });
    expect(s.turn).toBe("idle");
    s = voiceReducer(voiceReducer(initialVoiceState, { type: "listen" }), { type: "silence" });
    expect(s.turn).toBe("idle");
  });

  it("ignores empty utterances and late replies", () => {
    const listening = voiceReducer(initialVoiceState, { type: "listen" });
    expect(voiceReducer(listening, { type: "heard", text: " " })).toBe(listening);
    expect(voiceReducer(listening, { type: "reply", text: "late" })).toBe(listening);
  });
});
