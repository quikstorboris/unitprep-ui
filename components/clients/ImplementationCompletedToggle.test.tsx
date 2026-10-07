import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ImplementationCompletedToggle from "@/components/clients/ImplementationCompletedToggle";

const setImplementationCompleted = vi.fn();

vi.mock("@/lib/clientsCompanies", () => ({
  setImplementationCompleted: (...args: unknown[]) => setImplementationCompleted(...args),
}));

describe("ImplementationCompletedToggle", () => {
  beforeEach(() => {
    setImplementationCompleted.mockReset();
  });

  it("reflects the current state in aria-checked", () => {
    const { rerender } = render(
      <ImplementationCompletedToggle companyId="c1" completed={false} onChanged={() => {}} />,
    );
    expect(screen.getByRole("switch", { name: "Implementation Completed" })).toHaveAttribute(
      "aria-checked",
      "false",
    );

    rerender(<ImplementationCompletedToggle companyId="c1" completed onChanged={() => {}} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("marks the company completed and tells the page to refetch", async () => {
    setImplementationCompleted.mockResolvedValue({ kind: "ok", data: undefined });
    const onChanged = vi.fn();
    render(<ImplementationCompletedToggle companyId="c1" completed={false} onChanged={onChanged} />);

    await userEvent.click(screen.getByRole("switch"));

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(setImplementationCompleted).toHaveBeenCalledWith("c1", true);
  });

  it("reopens a completed company", async () => {
    setImplementationCompleted.mockResolvedValue({ kind: "ok", data: undefined });
    render(<ImplementationCompletedToggle companyId="c1" completed onChanged={() => {}} />);

    await userEvent.click(screen.getByRole("switch"));

    await waitFor(() => expect(setImplementationCompleted).toHaveBeenCalledWith("c1", false));
  });

  it("shows the error and does not refetch when the request fails", async () => {
    setImplementationCompleted.mockResolvedValue({ kind: "error", message: "Could not update this client" });
    const onChanged = vi.fn();
    render(<ImplementationCompletedToggle companyId="c1" completed={false} onChanged={onChanged} />);

    await userEvent.click(screen.getByRole("switch"));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not update this client");
    expect(onChanged).not.toHaveBeenCalled();
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });
});
