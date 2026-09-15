import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import MultiSelectDropdown from "./MultiSelectDropdown";

const options = [
  { value: "az", label: "Arizona" },
  { value: "ca", label: "California" },
  { value: "co", label: "Colorado" },
];

describe("MultiSelectDropdown", () => {
  it("shows a no-options-available summary when there's nothing to pick", () => {
    render(
      <MultiSelectDropdown options={[]} selected={[]} onChange={vi.fn()} noun="states" />
    );

    expect(screen.getByText("No states available")).toBeInTheDocument();
  });

  it("summarizes none/some/all selected", () => {
    const { rerender } = render(
      <MultiSelectDropdown options={options} selected={[]} onChange={vi.fn()} noun="states" />
    );
    expect(screen.getByText("No states selected")).toBeInTheDocument();

    rerender(
      <MultiSelectDropdown options={options} selected={["az"]} onChange={vi.fn()} noun="states" />
    );
    expect(screen.getByText("1 of 3 states")).toBeInTheDocument();

    rerender(
      <MultiSelectDropdown
        options={options}
        selected={["az", "ca", "co"]}
        onChange={vi.fn()}
        noun="states"
      />
    );
    expect(screen.getByText("All states (3)")).toBeInTheDocument();
  });

  it("opens the panel and toggles an option on click", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <MultiSelectDropdown options={options} selected={[]} onChange={onChange} noun="states" />
    );

    await user.click(screen.getByRole("button", { name: /No states selected/ }));
    await user.click(screen.getByRole("checkbox", { name: "California" }));

    expect(onChange).toHaveBeenCalledWith(["ca"]);
  });

  it("unchecks an already-selected option", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <MultiSelectDropdown
        options={options}
        selected={["ca"]}
        onChange={onChange}
        noun="states"
      />
    );

    await user.click(screen.getByRole("button", { name: /1 of 3 states/ }));
    await user.click(screen.getByRole("checkbox", { name: "California" }));

    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("filters the visible options by the search box", async () => {
    const user = userEvent.setup();

    render(
      <MultiSelectDropdown options={options} selected={[]} onChange={vi.fn()} noun="states" />
    );

    await user.click(screen.getByRole("button", { name: /No states selected/ }));
    await user.type(screen.getByPlaceholderText("Search states…"), "co");

    expect(screen.getByRole("checkbox", { name: "Colorado" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Arizona" })).not.toBeInTheDocument();
  });

  it("selects and clears everything via Select all / Clear all", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <MultiSelectDropdown options={options} selected={[]} onChange={onChange} noun="states" />
    );

    await user.click(screen.getByRole("button", { name: /No states selected/ }));
    await user.click(screen.getByRole("button", { name: "Select all" }));
    expect(onChange).toHaveBeenCalledWith(["az", "ca", "co"]);

    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("toggles the highlighted option on Enter and closes on Escape", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(
      <MultiSelectDropdown options={options} selected={[]} onChange={onChange} noun="states" />
    );

    await user.click(screen.getByRole("button", { name: /No states selected/ }));
    const search = screen.getByPlaceholderText("Search states…");
    await user.type(search, "{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith(["ca"]);

    await user.type(search, "{Escape}");
    expect(screen.queryByPlaceholderText("Search states…")).not.toBeInTheDocument();
  });
});
