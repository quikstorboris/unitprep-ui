import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import Tooltip from "./Tooltip";

describe("Tooltip", () => {
  it("hides the tooltip text until hovered or focused", () => {
    render(<Tooltip text="Company names don't match." />);

    expect(
      screen.queryByRole("tooltip")
    ).not.toBeInTheDocument();
  });

  it("sets the text as a native title fallback on the trigger", () => {
    render(<Tooltip text="Company names don't match." />);

    expect(
      screen.getByRole("button", {
        name: "Why does this matter?",
      })
    ).toHaveAttribute("title", "Company names don't match.");
  });

  it("shows the tooltip text on hover", async () => {
    const user = userEvent.setup();

    render(<Tooltip text="Company names don't match." />);

    await user.hover(
      screen.getByRole("button", {
        name: "Why does this matter?",
      })
    );

    expect(
      screen.getByRole("tooltip")
    ).toHaveTextContent("Company names don't match.");
  });

  it("hides the tooltip text again on unhover", async () => {
    const user = userEvent.setup();

    render(<Tooltip text="Company names don't match." />);

    const trigger = screen.getByRole("button", {
      name: "Why does this matter?",
    });

    await user.hover(trigger);
    await user.unhover(trigger);

    expect(
      screen.queryByRole("tooltip")
    ).not.toBeInTheDocument();
  });

  it("shows the tooltip text on keyboard focus", async () => {
    const user = userEvent.setup();

    render(<Tooltip text="Company names don't match." />);

    await user.tab();

    expect(
      screen.getByRole("tooltip")
    ).toHaveTextContent("Company names don't match.");
  });

  it("hides the tooltip text again on blur", async () => {
    const user = userEvent.setup();

    render(
      <>
        <Tooltip text="Company names don't match." />
        <button type="button">Elsewhere</button>
      </>
    );

    await user.tab();
    await user.tab();

    expect(
      screen.queryByRole("tooltip")
    ).not.toBeInTheDocument();
  });
});
