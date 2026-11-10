import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./Dialog";

describe("ConfirmDialog", () => {
  it("asks, then confirms or cancels", () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Create 12 items in Jira?"
        description="Each links back to the BRD."
        confirmLabel="Create 12 items"
        onConfirm={onConfirm}
      />,
    );
    const dialog = screen.getByRole("alertdialog", { name: "Create 12 items in Jira?" });
    expect(dialog).toHaveTextContent("Each links back to the BRD.");
    fireEvent.click(screen.getByRole("button", { name: "Create 12 items" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
