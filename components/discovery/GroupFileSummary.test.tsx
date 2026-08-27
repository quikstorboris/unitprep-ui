import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { GroupFileSummary } from "./GroupFileSummary";
import type { DiscoverResponse } from "@/types/api";

function baseDiscovery(
  overrides: Partial<DiscoverResponse> = {}
): DiscoverResponse {
  return {
    unit_files_found: 1,
    group_files_found: 1,
    group_file_names: ["groups.csv"],
    selected_group_file_name: "groups.csv",
    group_file_format_valid: true,
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
  overrides: Partial<React.ComponentProps<typeof GroupFileSummary>> = {}
) {
  return {
    discovery: baseDiscovery(),
    busy: false,
    confirming: false,
    uploading: false,
    onConfirm: vi.fn(),
    onChooseFromDiscovered: vi.fn(),
    onSelectDifferentFile: vi.fn(),
    ...overrides,
  };
}

describe("GroupFileSummary", () => {
  it("shows the invalid-format message and hides Confirm when the format is invalid", () => {
    render(
      <GroupFileSummary
        {...baseProps({
          discovery: baseDiscovery({ group_file_format_valid: false }),
        })}
      />
    );

    expect(screen.getByText(/File format invalid/)).toBeInTheDocument();
    expect(screen.getByText("groups.csv")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Confirm/ })
    ).not.toBeInTheDocument();
  });

  it("shows the confirmed message once the file is confirmed", () => {
    render(
      <GroupFileSummary
        {...baseProps({
          discovery: baseDiscovery({ group_file_confirmed: true }),
        })}
      />
    );

    expect(screen.getByText(/Master file confirmed/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Confirm" })
    ).not.toBeInTheDocument();
  });

  it("shows a good-file message with a Confirm button when valid but not yet confirmed", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    render(
      <GroupFileSummary
        {...baseProps({
          discovery: baseDiscovery({
            group_file_format_valid: true,
            group_file_confirmed: false,
          }),
          onConfirm,
        })}
      />
    );

    expect(screen.getByText(/Master file is good/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirm" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("shows a neutral checking-format message and hides Confirm when validity is null, instead of treating null as valid", () => {
    render(
      <GroupFileSummary
        {...baseProps({
          discovery: baseDiscovery({ group_file_format_valid: null }),
        })}
      />
    );

    expect(screen.getByText(/Checking file format/)).toBeInTheDocument();
    expect(screen.queryByText(/Master file is good/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Master file confirmed/)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Confirm/ })
    ).not.toBeInTheDocument();
  });

  it('shows "Confirming..." on the Confirm button while confirming', () => {
    render(<GroupFileSummary {...baseProps({ confirming: true })} />);

    expect(
      screen.getByRole("button", { name: "Confirming..." })
    ).toBeInTheDocument();
  });

  it("only shows Choose From Discovered Files when more than one candidate was found", () => {
    const { rerender } = render(
      <GroupFileSummary
        {...baseProps({
          discovery: baseDiscovery({ group_files_found: 1 }),
        })}
      />
    );

    expect(
      screen.queryByRole("button", { name: "Choose From Discovered Files" })
    ).not.toBeInTheDocument();

    const onChooseFromDiscovered = vi.fn();
    rerender(
      <GroupFileSummary
        {...baseProps({
          discovery: baseDiscovery({ group_files_found: 3 }),
          onChooseFromDiscovered,
        })}
      />
    );

    expect(
      screen.getByRole("button", { name: "Choose From Discovered Files" })
    ).toBeInTheDocument();
  });

  it("calls onChooseFromDiscovered and onSelectDifferentFile when clicked", async () => {
    const user = userEvent.setup();
    const onChooseFromDiscovered = vi.fn();
    const onSelectDifferentFile = vi.fn();

    render(
      <GroupFileSummary
        {...baseProps({
          discovery: baseDiscovery({ group_files_found: 2 }),
          onChooseFromDiscovered,
          onSelectDifferentFile,
        })}
      />
    );

    await user.click(
      screen.getByRole("button", { name: "Choose From Discovered Files" })
    );
    await user.click(
      screen.getByRole("button", { name: "Select Different File" })
    );

    expect(onChooseFromDiscovered).toHaveBeenCalledTimes(1);
    expect(onSelectDifferentFile).toHaveBeenCalledTimes(1);
  });

  it('shows "Uploading..." on the select-different-file button while uploading', () => {
    render(<GroupFileSummary {...baseProps({ uploading: true })} />);

    expect(
      screen.getByRole("button", { name: "Uploading..." })
    ).toBeInTheDocument();
  });
});
