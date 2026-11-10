import { fireEvent, render, screen } from "@testing-library/react";
import { ChatThread } from "./chat/ChatThread";
import { Composer } from "./chat/Composer";
import { CollabDocument } from "./doc/CollabDocument";
import type { Participant } from "./types";

const agent: Participant = { id: "agent", name: "BA agent", kind: "agent", online: true };
const me: Participant = { id: "me", name: "Priya Nair", kind: "human", you: true, online: true };

describe("CollabDocument", () => {
  it("shows a suggestion as a tracked change in its block and reports the decision", () => {
    const onDecide = vi.fn();
    render(
      <CollabDocument
        participants={[me, agent]}
        blocks={[{ id: "summary", label: "Summary", title: <h2>Summary</h2>, content: <p>Old text</p> }]}
        suggestions={[
          {
            id: "P1",
            blockId: "summary",
            authorId: "agent",
            summary: "Tighten",
            before: "Customers wait days.",
            after: "Customers wait 3 days.",
          },
        ]}
        onDecide={onDecide}
      />,
    );
    const card = screen.getByRole("article", { name: "Suggestion: Tighten" });
    expect(card.querySelector("ins")?.textContent).toContain("3");
    fireEvent.click(screen.getByRole("button", { name: /Accept/ }));
    expect(onDecide).toHaveBeenCalledWith("P1", "accept");
  });

  it("adds a comment that asks the agent when it mentions @agent", () => {
    const onComment = vi.fn();
    render(
      <CollabDocument
        participants={[me, agent]}
        canComment
        blocks={[{ id: "scope", label: "Scope", title: <h2>Scope</h2>, content: null }]}
        onDecide={() => {}}
        onComment={onComment}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Comment on Scope" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "@agent is refunds in?" } });
    fireEvent.click(screen.getByRole("button", { name: "Comment" }));
    expect(onComment).toHaveBeenCalledWith({
      blockId: "scope",
      quote: null,
      text: "@agent is refunds in?",
      askAgent: true,
    });
  });

  it("hides decisions when read-only", () => {
    render(
      <CollabDocument
        readOnly
        participants={[agent]}
        blocks={[{ id: "a", label: "A", title: "A", content: null }]}
        suggestions={[{ id: "P1", blockId: "a", authorId: "agent", summary: "S", detail: "d" }]}
        onDecide={() => {}}
      />,
    );
    expect(screen.queryByRole("button", { name: /Accept/ })).toBeNull();
  });
});

describe("Composer", () => {
  it("sends text with ready attachments and blocks while one is uploading", () => {
    const onSend = vi.fn();
    const { rerender } = render(
      <Composer
        value="use these"
        onChange={() => {}}
        onSend={onSend}
        attachments={[{ id: "S1", name: "notes.pdf", kind: "file", status: "uploading" }]}
      />,
    );
    expect(screen.getByRole("button", { name: "Send message" })).toBeDisabled();
    rerender(
      <Composer
        value="use these"
        onChange={() => {}}
        onSend={onSend}
        attachments={[
          { id: "S1", name: "notes.pdf", kind: "file", status: "ready" },
          { id: "S2", name: "scan.pdf", kind: "file", status: "failed" },
        ]}
      />,
    );
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(onSend).toHaveBeenCalledWith("use these", ["S1"]);
  });

  it("turns a pasted URL into a link attachment", () => {
    const onLink = vi.fn();
    render(<Composer value="" onChange={() => {}} onSend={() => {}} onLink={onLink} />);
    fireEvent.paste(screen.getByRole("textbox"), {
      clipboardData: { files: [], getData: () => "https://www.npci.org.in/autopay" },
    });
    expect(onLink).toHaveBeenCalledWith("https://www.npci.org.in/autopay");
  });
});

describe("ChatThread", () => {
  it("renders the agent's Markdown and the user's attachments", () => {
    render(
      <ChatThread
        agent={agent}
        messages={[
          {
            id: "1",
            role: "user",
            text: "use this",
            at: "2026-10-25T08:00:00Z",
            attachments: [{ id: "S1", name: "brief.docx", kind: "file", status: "ready" }],
          },
          {
            id: "2",
            role: "assistant",
            text: "Found **2** gaps:\n- scope\n- owners",
            at: "2026-10-25T08:00:01Z",
          },
        ]}
      />,
    );
    expect(screen.getByText("brief.docx")).toBeInTheDocument();
    expect(screen.getByText("2").tagName).toBe("STRONG");
    expect(screen.getAllByRole("listitem").length).toBeGreaterThanOrEqual(2);
  });
});
