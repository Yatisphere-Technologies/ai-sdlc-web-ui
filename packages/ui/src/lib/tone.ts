/** Colour meaning shared by every component. See tokens.css for what each tone means. */
export type Tone = "neutral" | "agent" | "gate" | "ok" | "risk" | "ion" | "human";

export const toneText: Record<Tone, string> = {
  neutral: "text-muted",
  agent: "text-agent",
  gate: "text-gate",
  ok: "text-ok",
  risk: "text-risk",
  ion: "text-ion",
  human: "text-human-fg",
};

export const toneFill: Record<Tone, string> = {
  neutral: "bg-ghost",
  agent: "bg-agent",
  gate: "bg-gate",
  ok: "bg-ok",
  risk: "bg-risk",
  ion: "bg-ion",
  human: "bg-human-fg",
};
