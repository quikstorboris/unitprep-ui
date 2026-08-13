import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { useCurrentUser, passkeyReverify } = vi.hoisted(() => ({
  useCurrentUser: vi.fn(),
  passkeyReverify: vi.fn(),
}));

vi.mock("@/lib/currentUser", () => ({
  useCurrentUser,
}));

vi.mock("@/lib/auth", () => ({
  passkeyReverify,
}));

vi.mock("@/components/auth/TotpEnrollForm", () => ({
  default: ({ onCancel }: { onCancel?: () => void }) => (
    <div data-testid="totp-enroll-form">
      {onCancel && (
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      )}
    </div>
  ),
}));

import AccountPage from "./page";

describe("AccountPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCurrentUser.mockReturnValue({
      user: {
        user_id: "u1",
        roles: ["admin"],
        permissions: [],
        totp_enrolled: true,
      },
      checked: true,
      refresh: vi.fn(),
    });
  });

  // Regression test for the passkey-reverify gate added alongside
  // auth_passkey_reverify.rs: TOTP re-enrolment must require a fresh
  // passkey assertion first -- clicking "Update authenticator app" must
  // not reveal the enrolment form until passkeyReverify() reports
  // verified: true.
  it("does not show the TOTP enrolment form until passkey reverify succeeds", async () => {
    const user = userEvent.setup();
    passkeyReverify.mockResolvedValue({
      kind: "ok",
      data: { verified: true },
    });

    render(<AccountPage />);

    expect(screen.queryByTestId("totp-enroll-form")).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Update authenticator app" })
    );

    expect(passkeyReverify).toHaveBeenCalledTimes(1);

    await waitFor(() =>
      expect(screen.getByTestId("totp-enroll-form")).toBeInTheDocument()
    );
  });

  it("shows an error and stays on the status view when passkey reverify fails", async () => {
    const user = userEvent.setup();
    passkeyReverify.mockResolvedValue({
      kind: "error",
      message: "That passkey could not be verified.",
    });

    render(<AccountPage />);

    await user.click(
      screen.getByRole("button", { name: "Update authenticator app" })
    );

    await waitFor(() =>
      expect(
        screen.getByText("That passkey could not be verified.")
      ).toBeInTheDocument()
    );

    expect(screen.queryByTestId("totp-enroll-form")).not.toBeInTheDocument();
  });

  it("shows an unauthorized message from a failed reverify the same way", async () => {
    const user = userEvent.setup();
    passkeyReverify.mockResolvedValue({
      kind: "unauthorized",
      message: "Your session ended. Sign in again.",
    });

    render(<AccountPage />);

    await user.click(
      screen.getByRole("button", { name: "Update authenticator app" })
    );

    await waitFor(() =>
      expect(
        screen.getByText("Your session ended. Sign in again.")
      ).toBeInTheDocument()
    );

    expect(screen.queryByTestId("totp-enroll-form")).not.toBeInTheDocument();
  });

  it("goes straight to the enrolment form for first-time setup, with no reverify gate", () => {
    useCurrentUser.mockReturnValue({
      user: {
        user_id: "u1",
        roles: ["admin"],
        permissions: [],
        totp_enrolled: false,
      },
      checked: true,
      refresh: vi.fn(),
    });

    render(<AccountPage />);

    expect(screen.getByTestId("totp-enroll-form")).toBeInTheDocument();
    expect(passkeyReverify).not.toHaveBeenCalled();
  });
});
