import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Select } from "./Select";

const options = [
  { value: "all", label: "All releases" },
  { value: "mvp", label: "MVP", meta: "31", dot: "agent" as const },
  { value: "", label: "Not set" },
];

describe("Select", () => {
  it("shows the chosen option and prefix in an accessible trigger", () => {
    render(
      <Select label="Release" prefix="Release" value="mvp" onValueChange={() => {}} options={options} />,
    );
    const trigger = screen.getByRole("combobox", { name: "Release" });
    expect(trigger).toHaveTextContent("Release");
    expect(trigger).toHaveTextContent("MVP");
  });

  it("supports an empty value", () => {
    render(<Select label="Owner" value="" onValueChange={() => {}} options={options} />);
    expect(screen.getByRole("combobox", { name: "Owner" })).toHaveTextContent("Not set");
  });
});
