import { act, fireEvent, render, screen } from "@testing-library/react";
import { TooltipProvider } from "@throughline/ui";
import type { ReactNode } from "react";
import { Chat } from "../chat/Chat";
import { Composer } from "../chat/Composer";
import type { ListenEvents, SpeechEngine } from "./engine";
import { VoiceProvider } from "./VoiceProvider";

/** A scripted engine: tests decide what was "heard" and when speech ends. */
function fakeEngine() {
  const calls = { listen: [] as ListenEvents[], spoken: [] as string[], endSpeech: [] as (() => void)[] };
  const engine: SpeechEngine = {
    id: "fake",
    label: "Fake",
    where: "In the test",
    canListen: true,
    canSpeak: true,
    listen: (_o, events) => {
      calls.listen.push(events);
      events.onStart?.();
      return { stop: () => events.onEnd?.(), abort: () => events.onEnd?.() };
    },
    speak: (text, o) => {
      calls.spoken.push(text);
      calls.endSpeech.push(() => o.onEnd?.());
      return { cancel: () => o.onEnd?.() };
    },
    voices: () => [],
  };
  return { engine, calls };
}

const wrap = (engine: SpeechEngine, ui: ReactNode, disabledReason: string | null = null) => (
  <TooltipProvider>
    <VoiceProvider engine={engine} lang="en-GB" disabledReason={disabledReason}>
      {ui}
    </VoiceProvider>
  </TooltipProvider>
);

const agent = { id: "a", name: "Assistant", kind: "agent" as const };

describe("dictation in the composer", () => {
  it("types what was said into the box", () => {
    const { engine, calls } = fakeEngine();
    const onChange = vi.fn();
    render(wrap(engine, <Composer value="Show" onChange={onChange} onSend={() => {}} voice />));
    fireEvent.click(screen.getByRole("button", { name: "Dictate with your voice" }));
    act(() => calls.listen[0]?.onInterim?.("the plan"));
    expect(screen.getByText("the plan")).toBeInTheDocument();
    act(() => calls.listen[0]?.onFinal("the plan for UPI question mark"));
    expect(onChange).toHaveBeenLastCalledWith("Show the plan for UPI?");
  });

  it("explains when an admin turned voice off", () => {
    const { engine } = fakeEngine();
    render(
      wrap(
        engine,
        <Composer value="" onChange={() => {}} onSend={() => {}} voice />,
        "Off for data residency",
      ),
    );
    expect(screen.getByLabelText(/Voice input unavailable: Off for data residency/)).toBeInTheDocument();
  });
});

describe("hands-free voice mode", () => {
  it("listens, sends what it heard, speaks the reply and listens again", async () => {
    const { engine, calls } = fakeEngine();
    const onSend = vi.fn(async () => "**Three** decisions are waiting.");
    render(wrap(engine, <Chat messages={[]} agent={agent} onSend={onSend} home={{ title: "Hi" }} />));
    fireEvent.click(screen.getByRole("button", { name: "Talk hands-free" }));
    expect(screen.getByRole("dialog", { name: /conversation/ })).toBeInTheDocument();
    expect(calls.listen).toHaveLength(1);
    await act(async () => {
      calls.listen[0]?.onFinal("what's waiting on me");
      calls.listen[0]?.onEnd?.();
    });
    expect(onSend).toHaveBeenCalledWith("what's waiting on me", [], "voice");
    expect(calls.spoken).toEqual(["Three decisions are waiting."]);
    await act(async () => calls.endSpeech[0]?.());
    expect(calls.listen).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "End voice conversation" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
