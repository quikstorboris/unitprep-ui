import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SecretField } from "./SecretField";

// userEvent.setup() installs its own navigator.clipboard stub (to back
// user.copy()/paste()), so stubbing clipboard in a beforeEach that runs
// *before* setup() gets silently clobbered -- stubClipboard must run
// after each test's own userEvent.setup() call instead.
function stubClipboard() {
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
  return writeText;
}

describe("SecretField", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("masks the value as a password field by default", () => {
    render(<SecretField label="App secret" value="s3cr3t" onChange={vi.fn()} />);

    expect(screen.getByLabelText("Show App secret")).toBeInTheDocument();
    const input = screen.getByDisplayValue("s3cr3t");
    expect(input).toHaveAttribute("type", "password");
  });

  it("reveals and re-hides the value on toggle", async () => {
    const user = userEvent.setup();
    render(<SecretField label="App secret" value="s3cr3t" onChange={vi.fn()} />);

    await user.click(screen.getByLabelText("Show App secret"));
    expect(screen.getByDisplayValue("s3cr3t")).toHaveAttribute("type", "text");

    await user.click(screen.getByLabelText("Hide App secret"));
    expect(screen.getByDisplayValue("s3cr3t")).toHaveAttribute("type", "password");
  });

  it("calls onChange as the field is edited", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(
      <SecretField label="App secret" value="" onChange={onChange} />
    );

    const input = container.querySelector("input");
    expect(input).not.toBeNull();
    await user.type(input as HTMLInputElement, "x");

    expect(onChange).toHaveBeenCalledWith("x");
  });

  it("copies the current value to the clipboard and shows a confirmation", async () => {
    const user = userEvent.setup();
    const writeText = stubClipboard();
    render(<SecretField label="Refresh token" value="tok-123" onChange={vi.fn()} />);

    await user.click(screen.getByLabelText("Copy Refresh token"));

    expect(writeText).toHaveBeenCalledWith("tok-123");
    expect(await screen.findByText("Copied.")).toBeInTheDocument();
  });

  it("disables the copy button when there is no value yet", () => {
    render(<SecretField label="App secret" value="" onChange={vi.fn()} />);

    expect(screen.getByLabelText("Copy App secret")).toBeDisabled();
  });

  it("shows the hint text when provided and not currently showing the copied confirmation", () => {
    render(
      <SecretField
        label="App secret"
        value="s3cr3t"
        onChange={vi.fn()}
        hint="Stored encrypted at rest."
      />
    );

    expect(screen.getByText("Stored encrypted at rest.")).toBeInTheDocument();
  });

  it("does not throw when the clipboard write is rejected", async () => {
    const user = userEvent.setup();
    stubClipboard().mockRejectedValue(new Error("denied"));
    render(<SecretField label="App secret" value="s3cr3t" onChange={vi.fn()} />);

    await user.click(screen.getByLabelText("Copy App secret"));

    expect(screen.queryByText("Copied.")).not.toBeInTheDocument();
  });
});
