import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { QmsTag } from "@/lib/clientOps";

import TagPicker from "./TagPicker";

function tags(overrides: QmsTag[] = []): QmsTag[] {
  return [
    { tag_key: "TENANT_NAME", label: "Tenant Name", category: "identity", is_active: true },
    { tag_key: "UNIT_NUMBER", label: "Unit Number", category: "unit", is_active: true },
    { tag_key: "OLD_TAG", label: "Retired Tag", category: "misc", is_active: false },
    ...overrides,
  ];
}

describe("TagPicker", () => {
  it("renders closed, showing the current value and its label", () => {
    render(<TagPicker tags={tags()} value="TENANT_NAME" onChange={vi.fn()} />);

    expect(screen.getByRole("button")).toHaveTextContent("TENANT_NAME");
    expect(screen.getByRole("button")).toHaveTextContent("Tenant Name");
    expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument();
  });

  it("renders closed with just the raw value when it matches no known tag", () => {
    render(<TagPicker tags={tags()} value="UNKNOWN_TAG" onChange={vi.fn()} />);

    expect(screen.getByRole("button")).toHaveTextContent("UNKNOWN_TAG");
  });

  it("opens the search input on click and focuses it", async () => {
    const user = userEvent.setup();
    render(<TagPicker tags={tags()} value="TENANT_NAME" onChange={vi.fn()} />);

    await user.click(screen.getByRole("button"));

    const input = await screen.findByPlaceholderText(/search/i);
    await waitFor(() => expect(input).toHaveFocus());
  });

  it("lists only active tags when opened with no search query", async () => {
    const user = userEvent.setup();
    render(<TagPicker tags={tags()} value="TENANT_NAME" onChange={vi.fn()} />);

    await user.click(screen.getByRole("button"));

    expect(screen.getByText("TENANT_NAME")).toBeInTheDocument();
    expect(screen.getByText("UNIT_NUMBER")).toBeInTheDocument();
    expect(screen.queryByText("OLD_TAG")).not.toBeInTheDocument();
  });

  it("filters matches by tag key or label, case-insensitively", async () => {
    const user = userEvent.setup();
    render(<TagPicker tags={tags()} value="TENANT_NAME" onChange={vi.fn()} />);

    await user.click(screen.getByRole("button"));
    await user.type(screen.getByPlaceholderText(/search/i), "unit");

    expect(screen.getByText("UNIT_NUMBER")).toBeInTheDocument();
    expect(screen.queryByText("TENANT_NAME")).not.toBeInTheDocument();
  });

  it("never shows an inactive tag even when the query matches it", async () => {
    const user = userEvent.setup();
    render(<TagPicker tags={tags()} value="TENANT_NAME" onChange={vi.fn()} />);

    await user.click(screen.getByRole("button"));
    await user.type(screen.getByPlaceholderText(/search/i), "retired");

    expect(screen.queryByText("OLD_TAG")).not.toBeInTheDocument();
  });

  it("caps the visible match list at 8", async () => {
    const many: QmsTag[] = Array.from({ length: 10 }, (_, i) => ({
      tag_key: `TAG_${i}`,
      label: `Tag ${i}`,
      category: "misc",
      is_active: true,
    }));
    const user = userEvent.setup();
    render(<TagPicker tags={many} value="TAG_0" onChange={vi.fn()} />);

    await user.click(screen.getByRole("button"));

    for (let i = 0; i < 8; i++) {
      expect(screen.getByText(`TAG_${i}`)).toBeInTheDocument();
    }
    expect(screen.queryByText("TAG_8")).not.toBeInTheDocument();
    expect(screen.queryByText("TAG_9")).not.toBeInTheDocument();
  });

  it("selects a match on click, calling onChange and closing the picker", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TagPicker tags={tags()} value="TENANT_NAME" onChange={onChange} />);

    await user.click(screen.getByRole("button"));
    await user.click(screen.getByText("UNIT_NUMBER"));

    expect(onChange).toHaveBeenCalledWith("UNIT_NUMBER");
    expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument();
  });

  it("moves the highlight with ArrowDown/ArrowUp and selects the highlighted match on Enter", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TagPicker tags={tags()} value="TENANT_NAME" onChange={onChange} />);

    await user.click(screen.getByRole("button"));
    const input = screen.getByPlaceholderText(/search/i);

    // Highlight starts at index 0 (TENANT_NAME); one ArrowDown moves to
    // UNIT_NUMBER (the only other active tag).
    await user.type(input, "{ArrowDown}{Enter}");

    expect(onChange).toHaveBeenCalledWith("UNIT_NUMBER");
  });

  it("wraps ArrowUp from the first match to the last", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TagPicker tags={tags()} value="TENANT_NAME" onChange={onChange} />);

    await user.click(screen.getByRole("button"));
    const input = screen.getByPlaceholderText(/search/i);

    // Two active matches (TENANT_NAME, UNIT_NUMBER); ArrowUp from index 0
    // wraps to the last one.
    await user.type(input, "{ArrowUp}{Enter}");

    expect(onChange).toHaveBeenCalledWith("UNIT_NUMBER");
  });

  it("closes on Escape without calling onChange", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<TagPicker tags={tags()} value="TENANT_NAME" onChange={onChange} />);

    await user.click(screen.getByRole("button"));
    await user.type(screen.getByPlaceholderText(/search/i), "{Escape}");

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument();
  });

  it("closes without calling onChange when a click lands outside the picker", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <div>
        <TagPicker tags={tags()} value="TENANT_NAME" onChange={onChange} />
        <button>outside</button>
      </div>
    );

    await user.click(screen.getByRole("button", { name: /TENANT_NAME/ }));
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();

    await user.click(screen.getByText("outside"));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText(/search/i)).not.toBeInTheDocument();
  });

  it("resets the search query and highlight each time it reopens", async () => {
    const user = userEvent.setup();
    render(<TagPicker tags={tags()} value="TENANT_NAME" onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /TENANT_NAME/ }));
    await user.type(screen.getByPlaceholderText(/search/i), "unit");
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: /TENANT_NAME/ }));

    expect(screen.getByPlaceholderText(/search/i)).toHaveValue("");
    expect(screen.getByText("TENANT_NAME")).toBeInTheDocument();
    expect(screen.getByText("UNIT_NUMBER")).toBeInTheDocument();
  });
});
