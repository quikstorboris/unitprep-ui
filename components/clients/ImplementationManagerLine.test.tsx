import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ImplementationManagerLine from "./ImplementationManagerLine";

const listStaff = vi.fn();
const setImplementationManager = vi.fn();

vi.mock("@/lib/clientsCompanies", () => ({
  listStaff: (...args: unknown[]) => listStaff(...args),
  setImplementationManager: (...args: unknown[]) =>
    setImplementationManager(...args),
}));

const staff = [
  { id: "u1", name: "John Doe" },
  { id: "u2", name: "Jane Roe" },
];

describe("ImplementationManagerLine", () => {
  beforeEach(() => {
    listStaff.mockReset();
    setImplementationManager.mockReset();
    listStaff.mockResolvedValue({ kind: "ok", data: { staff } });
  });

  it("names the assigned manager", () => {
    render(
      <ImplementationManagerLine
        companyId="c1"
        manager={{ id: "u1", name: "John Doe" }}
        onChanged={() => {}}
      />,
    );

    expect(screen.getByText("Implementation manager:")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
  });

  it("says so when nobody is assigned", () => {
    render(
      <ImplementationManagerLine
        companyId="c1"
        manager={null}
        onChanged={() => {}}
      />,
    );

    expect(screen.getByText("Not assigned")).toBeInTheDocument();
  });

  it("assigns the chosen staff member and tells the page to refetch", async () => {
    setImplementationManager.mockResolvedValue({ kind: "ok", data: undefined });
    const onChanged = vi.fn();
    render(
      <ImplementationManagerLine
        companyId="c1"
        manager={null}
        onChanged={onChanged}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Change" }));
    await userEvent.selectOptions(await screen.findByRole("combobox"), "u2");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(setImplementationManager).toHaveBeenCalledWith("c1", "u2");
  });

  it("clears the assignment when Not assigned is chosen", async () => {
    setImplementationManager.mockResolvedValue({ kind: "ok", data: undefined });
    render(
      <ImplementationManagerLine
        companyId="c1"
        manager={{ id: "u1", name: "John Doe" }}
        onChanged={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Change" }));
    await userEvent.selectOptions(await screen.findByRole("combobox"), "");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(setImplementationManager).toHaveBeenCalledWith("c1", null),
    );
  });

  it("shows the error and keeps editing when the save fails", async () => {
    setImplementationManager.mockResolvedValue({
      kind: "error",
      message: "No such staff member.",
    });
    const onChanged = vi.fn();
    render(
      <ImplementationManagerLine
        companyId="c1"
        manager={null}
        onChanged={onChanged}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Change" }));
    await userEvent.selectOptions(await screen.findByRole("combobox"), "u1");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No such staff member.",
    );
    expect(onChanged).not.toHaveBeenCalled();
  });
});
