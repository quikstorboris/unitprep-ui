import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import CreateTagForm from "./CreateTagForm";

vi.mock("@/lib/clientOps", () => ({ createQmsTag: vi.fn() }));

describe("CreateTagForm tag key input", () => {
  it("ignores braces and other disallowed characters while typing", async () => {
    const user = userEvent.setup();
    render(<CreateTagForm categories={["Tenant", "Unit"]} onCreated={() => {}} />);
    const input = screen.getByPlaceholderText("e.g. e.fname");

    await user.type(input, "{{{{ex_am ple+1-2.x}}}}");

    expect(input).toHaveValue("example+1-2.x");
  });

  it("offers only the existing categories and requires choosing one", async () => {
    const user = userEvent.setup();
    render(<CreateTagForm categories={["Tenant", "Unit"]} onCreated={() => {}} />);
    const select = screen.getByRole("combobox");

    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Select a category",
      "Tenant",
      "Unit",
    ]);
    expect(select).toHaveValue("");

    await user.selectOptions(select, "Unit");
    expect(select).toHaveValue("Unit");
  });
});
