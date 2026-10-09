import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { totpStepUp } = vi.hoisted(() => ({ totpStepUp: vi.fn() }));

vi.mock("@/lib/auth-session", () => ({ totpStepUp }));

import StepUpPrompt from "./StepUpPrompt";

function setup() {
  const onVerified = vi.fn();
  const onSignOut = vi.fn();
  render(<StepUpPrompt onVerified={onVerified} onSignOut={onSignOut} />);
  return { onVerified, onSignOut };
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("StepUpPrompt", () => {
  it("explains why it is asking and does nothing until a code is typed", () => {
    setup();
    expect(screen.getByRole("heading", { name: /confirm it.s you/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
    expect(totpStepUp).not.toHaveBeenCalled();
  });

  it("sends the trimmed code and, once accepted, tells the shell it is verified", async () => {
    totpStepUp.mockResolvedValue({ kind: "ok", data: { confirmed: true } });
    const { onVerified } = setup();

    await userEvent.type(screen.getByLabelText("6-digit code"), " 123456 ");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(totpStepUp).toHaveBeenCalledWith("123456");
    await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1));
  });

  it("shows the server's message for a wrong code and lets the person try again", async () => {
    totpStepUp.mockResolvedValue({ kind: "error", message: "That code was not correct." });
    const { onVerified } = setup();

    await userEvent.type(screen.getByLabelText("6-digit code"), "000000");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("That code was not correct.");
    expect(onVerified).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("offers Sign out instead of a code", async () => {
    const { onSignOut } = setup();
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
    expect(totpStepUp).not.toHaveBeenCalled();
  });
});
