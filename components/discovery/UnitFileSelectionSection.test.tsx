import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { UnitFileSelectionSection } from "./UnitFileSelectionSection";
import type { DiscoverResponse } from "@/types/api";

function baseDiscovery(
  overrides: Partial<DiscoverResponse> = {}
): DiscoverResponse {
  return {
    unit_files_found: 2,
    group_files_found: 0,
    group_file_names: [],
    selected_group_file_name: null,
    group_file_format_valid: null,
    group_file_confirmed: false,
    ready: false,
    discovered_group_names: [],
    uncommon_group_names: [],
    unit_file_candidates: [
      {
        file_name: "Wave 1/units.csv",
        modified_at: null,
        detected_vendor: "QSX",
      },
      {
        file_name: "Wave 2/units.csv",
        modified_at: 1700000000000,
        detected_vendor: "DoorSwap",
      },
    ],
    selected_unit_file_names: [],
    requires_unit_file_selection: true,
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
    React.ComponentProps<typeof UnitFileSelectionSection>
  > = {}
) {
  return {
    sessionId: "session-1",
    discovery: baseDiscovery(),
    onDiscoveryUpdated: vi.fn(),
    onSessionExpired: vi.fn(),
    showSelectionSection: true,
    forceShowSelection: false,
    onSelectionConfirmed: vi.fn(),
    ...overrides,
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("UnitFileSelectionSection", () => {
  it("shows each candidate's basename, not its full uploaded path, with every candidate checked by default", () => {
    render(<UnitFileSelectionSection {...baseProps()} />);

    expect(screen.getAllByText("units.csv")).toHaveLength(2);
    expect(screen.queryByText(/Wave 1\//)).not.toBeInTheDocument();
    expect(screen.queryByText(/Wave 2\//)).not.toBeInTheDocument();

    expect(
      (screen.getByLabelText("Select All / None") as HTMLInputElement)
        .checked
    ).toBe(true);
  });

  it("shows an unknown-modified-date fallback only for candidates without one", () => {
    render(<UnitFileSelectionSection {...baseProps()} />);

    expect(screen.getByText(/modified date unknown/)).toBeInTheDocument();
  });

  it("unchecks Select All once any single candidate is unchecked, and disables Confirm at zero checked", async () => {
    const user = userEvent.setup();

    render(<UnitFileSelectionSection {...baseProps()} />);

    const checkboxes = screen.getAllByRole("checkbox");
    await user.click(checkboxes[1]);
    await user.click(checkboxes[2]);

    expect(
      (screen.getByLabelText("Select All / None") as HTMLInputElement)
        .checked
    ).toBe(false);
    expect(
      screen.getByRole("button", { name: "Confirm Selection" })
    ).toBeDisabled();
  });

  it("posts the checked file names and forwards the confirmation callbacks", async () => {
    const user = userEvent.setup();
    const onSelectionConfirmed = vi.fn();
    const onDiscoveryUpdated = vi.fn();
    const updatedDiscovery = baseDiscovery({
      selected_unit_file_names: ["Wave 1/units.csv", "Wave 2/units.csv"],
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => updatedDiscovery,
    });

    render(
      <UnitFileSelectionSection
        {...baseProps({ onSelectionConfirmed, onDiscoveryUpdated })}
      />
    );

    await user.click(
      screen.getByRole("button", { name: "Confirm Selection" })
    );

    await waitFor(() =>
      expect(onDiscoveryUpdated).toHaveBeenCalledWith(updatedDiscovery)
    );
    expect(onSelectionConfirmed).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/unit-file/select");
    expect(JSON.parse(init.body)).toEqual({
      session_id: "session-1",
      unit_file_names: ["Wave 1/units.csv", "Wave 2/units.csv"],
    });
  });

  it("treats a 404 on confirm as a session expiry", async () => {
    const user = userEvent.setup();
    const onSessionExpired = vi.fn();

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => "",
    });

    render(
      <UnitFileSelectionSection {...baseProps({ onSessionExpired })} />
    );

    await user.click(
      screen.getByRole("button", { name: "Confirm Selection" })
    );

    await waitFor(() =>
      expect(onSessionExpired).toHaveBeenCalledTimes(1)
    );
  });

  it("renders a read-only summary by basename once selection is no longer being edited", () => {
    render(
      <UnitFileSelectionSection
        {...baseProps({
          showSelectionSection: false,
          discovery: baseDiscovery({
            selected_unit_file_names: ["Wave 1/units.csv", "Wave 2/units.csv"],
          }),
        })}
      />
    );

    expect(screen.getByText(/Unit Files Selected/)).toBeInTheDocument();
    expect(screen.getByText(/2 files selected/)).toBeInTheDocument();
    expect(screen.getAllByText("units.csv")).toHaveLength(2);
    expect(screen.queryByText(/Wave 1\//)).not.toBeInTheDocument();
  });

  it("only offers Cancel on the checkbox picker when it was reopened over an existing selection, and it calls onSelectionConfirmed to close the reopened picker", async () => {
    const user = userEvent.setup();
    const onSelectionConfirmed = vi.fn();

    const { rerender } = render(
      <UnitFileSelectionSection
        {...baseProps({
          showSelectionSection: true,
          forceShowSelection: false,
        })}
      />
    );

    expect(
      screen.queryByRole("button", { name: "Cancel" })
    ).not.toBeInTheDocument();

    rerender(
      <UnitFileSelectionSection
        {...baseProps({
          showSelectionSection: true,
          forceShowSelection: true,
          discovery: baseDiscovery({
            selected_unit_file_names: ["Wave 1/units.csv"],
          }),
          onSelectionConfirmed,
        })}
      />
    );

    const cancelButton = screen.getByRole("button", { name: "Cancel" });
    await user.click(cancelButton);
    expect(onSelectionConfirmed).toHaveBeenCalledTimes(1);
  });
});
