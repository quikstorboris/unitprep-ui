import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import PreserveUnderscoresDialog from "./PreserveUnderscoresDialog";

describe("PreserveUnderscoresDialog", () => {
  it("calls onChoose(true) when Preserve underscores is clicked", async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();

    render(<PreserveUnderscoresDialog onChoose={onChoose} onCancel={() => {}} />);
    await user.click(
      screen.getByRole("button", { name: /Preserve underscores/ })
    );

    expect(onChoose).toHaveBeenCalledWith(true);
  });

  it("calls onChoose(false) when Replace outright is clicked", async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();

    render(<PreserveUnderscoresDialog onChoose={onChoose} onCancel={() => {}} />);
    await user.click(screen.getByRole("button", { name: /Replace outright/ }));

    expect(onChoose).toHaveBeenCalledWith(false);
  });

  it("calls onCancel and not onChoose when Cancel is clicked", async () => {
    const user = userEvent.setup();
    const onChoose = vi.fn();
    const onCancel = vi.fn();

    render(<PreserveUnderscoresDialog onChoose={onChoose} onCancel={onCancel} />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalled();
    expect(onChoose).not.toHaveBeenCalled();
  });
});
