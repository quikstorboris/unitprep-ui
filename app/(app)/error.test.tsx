import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureException }));

import AppError from "./error";

describe("AppError (signed-in pages)", () => {
  it("reports the error, shows a way back, and retries on request", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const reset = vi.fn();
    const error = Object.assign(new Error("boom"), { digest: "abc123" });

    render(<AppError error={error} reset={reset} />);

    expect(captureException).toHaveBeenCalledWith(error);
    expect(screen.getByText("abc123")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to Clients" })).toHaveAttribute("href", "/clients");

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(reset).toHaveBeenCalledTimes(1);
    consoleError.mockRestore();
  });
});
