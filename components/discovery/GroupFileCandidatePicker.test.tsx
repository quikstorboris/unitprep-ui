import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { GroupFileCandidatePicker } from "./GroupFileCandidatePicker";
import type { DiscoverResponse } from "@/types/api";

function baseDiscovery(
  overrides: Partial<DiscoverResponse> = {}
): DiscoverResponse {
  return {
    unit_files_found: 1,
    group_files_found: 2,
    group_file_names: ["Wave 1/groups.csv", "Wave 2/groups.csv"],
    selected_group_file_name: null,
    group_file_format_valid: null,
    group_file_confirmed: false,
    ready: false,
    discovered_group_names: [],
    uncommon_group_names: [],
    unit_file_candidates: [],
    selected_unit_file_names: [],
    requires_unit_file_selection: false,
    requires_format_resolution: false,
    current_unit_file_name: null,
    pending_unit_file_names: [],
    mismatched_header_files: [],
    detected_vendor_name: null,
    confirmed_vendor_name: null,
    source_headers: [],
    suggested_mapping: [],
    canonical_target_fields: [],
    required_target_fields: [],
    ...overrides,
  };
}

function baseProps(
  overrides: Partial<
    React.ComponentProps<typeof GroupFileCandidatePicker>
  > = {}
) {
  return {
    discovery: baseDiscovery(),
    choice: "",
    onChoiceChange: vi.fn(),
    onSelect: vi.fn(),
    onCancel: vi.fn(),
    selecting: false,
    busy: false,
    error: null,
    ...overrides,
  };
}

describe("GroupFileCandidatePicker", () => {
  it("shows the candidate count and each candidate by parent folder + basename, not the full path", () => {
    render(<GroupFileCandidatePicker {...baseProps()} />);

    expect(screen.getByText(/2 candidate master group files found/)).toBeInTheDocument();
    expect(screen.getByText("Wave 1/groups.csv")).toBeInTheDocument();
    expect(screen.getByText("Wave 2/groups.csv")).toBeInTheDocument();
  });

  it("calls onChoiceChange with the full candidate path when a radio option is picked", async () => {
    const user = userEvent.setup();
    const onChoiceChange = vi.fn();

    render(
      <GroupFileCandidatePicker {...baseProps({ onChoiceChange })} />
    );

    await user.click(screen.getByText("Wave 2/groups.csv"));

    expect(onChoiceChange).toHaveBeenCalledWith("Wave 2/groups.csv");
  });

  it("disables Select until a choice is made", () => {
    render(<GroupFileCandidatePicker {...baseProps({ choice: "" })} />);

    expect(screen.getByRole("button", { name: "Select" })).toBeDisabled();
  });

  it("enables Select once a choice is made and calls onSelect when clicked", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();

    render(
      <GroupFileCandidatePicker
        {...baseProps({ choice: "Wave 1/groups.csv", onSelect })}
      />
    );

    const selectButton = screen.getByRole("button", { name: "Select" });
    expect(selectButton).toBeEnabled();

    await user.click(selectButton);
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('shows "Selecting..." while a selection is in flight', () => {
    render(
      <GroupFileCandidatePicker
        {...baseProps({ choice: "Wave 1/groups.csv", selecting: true })}
      />
    );

    expect(
      screen.getByRole("button", { name: "Selecting..." })
    ).toBeInTheDocument();
  });

  it("only shows Cancel once a group file is already selected, and clicking it calls onCancel", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();

    const { rerender } = render(
      <GroupFileCandidatePicker
        {...baseProps({
          discovery: baseDiscovery({ selected_group_file_name: null }),
        })}
      />
    );

    expect(
      screen.queryByRole("button", { name: "Cancel" })
    ).not.toBeInTheDocument();

    rerender(
      <GroupFileCandidatePicker
        {...baseProps({
          discovery: baseDiscovery({
            selected_group_file_name: "Wave 1/groups.csv",
          }),
          onCancel,
        })}
      />
    );

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    await user.click(cancelButton);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows an error message when given one", () => {
    render(
      <GroupFileCandidatePicker
        {...baseProps({ error: "Could not select that file" })}
      />
    );

    expect(screen.getByText("Could not select that file")).toBeInTheDocument();
  });
});
