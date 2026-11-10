import type { AssistantConversation } from "@throughline/contracts";
import type { AssistantStore } from "./handlers";

const msg = (
  id: string,
  role: "user" | "assistant",
  text: string,
  at: string,
  extra: Partial<AssistantConversation["messages"][number]> = {},
): AssistantConversation["messages"][number] => ({
  id,
  role,
  text,
  at,
  via: "text",
  speech: null,
  sources: [],
  actions: [],
  context: null,
  followUps: [],
  ...extra,
});

/** One earlier conversation so the history list isn't empty in the demo. */
export const acmeAssistant: AssistantStore = {
  seq: 10,
  conversations: [
    {
      id: "cv-1",
      title: "Which projects are at risk?",
      updatedAt: "2026-10-25T09:40:00Z",
      messages: [
        msg("m-1", "user", "Which projects are at risk?", "2026-10-25T09:39:40Z", {
          context: "Programs & projects",
        }),
        msg(
          "m-2",
          "assistant",
          [
            "**3 of 6 projects need attention.**",
            "",
            "- **CARD** Card platform upgrade · Off track · tokenisation certification slipped",
            "- **UPI** UPI AutoPay self-service · At risk · build started while BRD-31 is still in review",
            "- **SUP** Support automation · At risk · waits on the MCP gateway (MCP:M4)",
          ].join("\n"),
          "2026-10-25T09:40:00Z",
          {
            speech:
              "Three projects need attention: card platform upgrade, UPI AutoPay and support automation.",
            sources: [{ label: "Project plans", tool: "Throughline" }],
            actions: [
              { label: "Open CARD", to: "/projects/CARD" },
              { label: "Open UPI", to: "/projects/UPI" },
            ],
            followUps: ["What's blocking UPI?"],
          },
        ),
      ],
    },
  ],
};
