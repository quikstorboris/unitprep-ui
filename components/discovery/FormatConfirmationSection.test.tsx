import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FormatConfirmationSection } from "./FormatConfirmationSection";
import type { DiscoverResponse } from "@/types/api";

function baseDiscovery(
  overrides: Partial<DiscoverResponse> = {}
): DiscoverResponse {
  return {
    unit_files_found: 1,
    group_files_found: 0,
    group_file_names: [],
    selected_group_file_name: null,
    group_file_format_valid: null,
    group_file_confirmed: false,
    ready: false,
    discovered_group_names: [],
    uncommon_group_names: [],
    unit_file_candidates: [],
    selected_unit_file_names: ["units.csv"],
    requires_unit_file_selection: false,
    requires_format_resolution: true,
    current_unit_file_name: "units.csv",
    pending_unit_file_names: ["units.csv"],
    mismatched_header_files: [],
    detected_vendor_name: "QSX",
    confirmed_vendor_name: null,
    source_headers: ["Unit"],
    suggested_mapping: [],
    canonical_target_fields: ["unit_number"],
    required_target_fields: ["unit_number"],
    ...overrides,
  };
}

function baseProps(
  overrides: Partial<
    React.ComponentProps<typeof FormatConfirmationSection>
  > = {}
) {
  return {
    sessionId: "session-1",
    discovery: baseDiscovery(),
    onDiscoveryUpdated: vi.fn(),
    onSessionExpired: vi.fn(),
    onReturnToSelection: vi.fn(),
    forceShowFormatConfirmation: false,
    onFormatConfirmationAcknowledged: vi.fn(),
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

describe("FormatConfirmationSection", () => {
  it("renders the active resolution view while format resolution is required", () => {
    render(
      <FormatConfirmationSection
        {...baseProps({
          discovery: baseDiscovery({ requires_format_resolution: true }),
        })}
      />
    );

    expect(screen.getByText("Confirm Unit File Format")).toBeInTheDocument();
  });

  it("renders the confirmed summary once format resolution is done", () => {
    render(
      <FormatConfirmationSection
        {...baseProps({
          discovery: baseDiscovery({
            requires_format_resolution: false,
            confirmed_vendor_name: "QSX",
          }),
        })}
      />
    );

    expect(
      screen.getByText(/Unit File Format Confirmed/)
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Confirm Unit File Format")
    ).not.toBeInTheDocument();
  });

  it("posts a confirm action and forwards the updated discovery on Confirm", async () => {
    const user = userEvent.setup();
    const onDiscoveryUpdated = vi.fn();
    const updatedDiscovery = baseDiscovery({
      requires_format_resolution: false,
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => updatedDiscovery,
    });

    render(
      <FormatConfirmationSection {...baseProps({ onDiscoveryUpdated })} />
    );

    await user.click(screen.getByRole("button", { name: "Confirm QSX" }));

    await waitFor(() =>
      expect(onDiscoveryUpdated).toHaveBeenCalledWith(updatedDiscovery)
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/unit-file/resolve-format");
    expect(JSON.parse(init.body)).toEqual({
      session_id: "session-1",
      action: "confirm",
    });
  });

  it("treats a 404 as a session expiry and does not forward a discovery update", async () => {
    const user = userEvent.setup();
    const onSessionExpired = vi.fn();
    const onDiscoveryUpdated = vi.fn();

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: async () => "",
    });

    render(
      <FormatConfirmationSection
        {...baseProps({ onSessionExpired, onDiscoveryUpdated })}
      />
    );

    await user.click(screen.getByRole("button", { name: "Confirm QSX" }));

    await waitFor(() =>
      expect(onSessionExpired).toHaveBeenCalledTimes(1)
    );
    expect(onDiscoveryUpdated).not.toHaveBeenCalled();
  });

  it("shows the server error message and does not forward an update on failure", async () => {
    const user = userEvent.setup();
    const onDiscoveryUpdated = vi.fn();

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ message: "Mapping is invalid" }),
    });

    render(
      <FormatConfirmationSection {...baseProps({ onDiscoveryUpdated })} />
    );

    await user.click(screen.getByRole("button", { name: "Confirm QSX" }));

    await waitFor(() =>
      expect(screen.getByText("Mapping is invalid")).toBeInTheDocument()
    );
    expect(onDiscoveryUpdated).not.toHaveBeenCalled();
  });

  it("posts a reset action when Change Vendor is clicked from the confirmed summary", async () => {
    const user = userEvent.setup();
    const onDiscoveryUpdated = vi.fn();
    const reopenedDiscovery = baseDiscovery({
      requires_format_resolution: true,
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => reopenedDiscovery,
    });

    render(
      <FormatConfirmationSection
        {...baseProps({
          discovery: baseDiscovery({
            requires_format_resolution: false,
            confirmed_vendor_name: "QSX",
          }),
          onDiscoveryUpdated,
        })}
      />
    );

    await user.click(screen.getByRole("button", { name: "Change Vendor" }));

    await waitFor(() =>
      expect(onDiscoveryUpdated).toHaveBeenCalledWith(reopenedDiscovery)
    );

    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({
      session_id: "session-1",
      action: "reset",
    });
  });

  it("calls onReturnToSelection from the active resolution view without any fetch", async () => {
    const user = userEvent.setup();
    const onReturnToSelection = vi.fn();

    render(
      <FormatConfirmationSection
        {...baseProps({ onReturnToSelection })}
      />
    );

    await user.click(
      screen.getByRole("button", { name: "Return to Unit Files Selection" })
    );

    expect(onReturnToSelection).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
