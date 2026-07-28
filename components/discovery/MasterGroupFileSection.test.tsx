import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MasterGroupFileSection } from "./MasterGroupFileSection";
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
  overrides: Partial<React.ComponentProps<typeof MasterGroupFileSection>> = {}
) {
  return {
    sessionId: "session-1",
    discovery: baseDiscovery(),
    onDiscoveryUpdated: vi.fn(),
    onSessionExpired: vi.fn(),
    onReturnToFormat: vi.fn(),
    netNewAcknowledged: false,
    onNetNewAcknowledged: vi.fn(),
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

describe("MasterGroupFileSection", () => {
  it("warns about a net-new client when no group file was found and nothing is acknowledged yet", () => {
    render(<MasterGroupFileSection {...baseProps()} />);

    expect(
      screen.getByText(/No master group file found/)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Net New Client" })
    ).toBeInTheDocument();
  });

  it("calls onNetNewAcknowledged when Net New Client is clicked", async () => {
    const user = userEvent.setup();
    const onNetNewAcknowledged = vi.fn();

    render(
      <MasterGroupFileSection
        {...baseProps({ onNetNewAcknowledged })}
      />
    );

    await user.click(
      screen.getByRole("button", { name: "Net New Client" })
    );
    expect(onNetNewAcknowledged).toHaveBeenCalledTimes(1);
  });

  it("shows a confirmed net-new message once acknowledged, hiding the warning and the Net New button", () => {
    render(
      <MasterGroupFileSection
        {...baseProps({ netNewAcknowledged: true })}
      />
    );

    expect(
      screen.getByText(/Confirmed net-new client/)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/No master group file found/)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Net New Client" })
    ).not.toBeInTheDocument();
  });

  it("shows the candidate picker when more than one group file candidate was found and none is selected yet", () => {
    render(
      <MasterGroupFileSection
        {...baseProps({
          discovery: baseDiscovery({
            group_files_found: 2,
            group_file_names: ["Wave 1/groups.csv", "Wave 2/groups.csv"],
          }),
        })}
      />
    );

    expect(
      screen.getByText(/candidate master group files found/)
    ).toBeInTheDocument();
  });

  it("posts the chosen candidate and forwards the updated discovery", async () => {
    const user = userEvent.setup();
    const onDiscoveryUpdated = vi.fn();
    const updatedDiscovery = baseDiscovery({
      selected_group_file_name: "Wave 1/groups.csv",
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => updatedDiscovery,
    });

    render(
      <MasterGroupFileSection
        {...baseProps({
          discovery: baseDiscovery({
            group_files_found: 2,
            group_file_names: ["Wave 1/groups.csv", "Wave 2/groups.csv"],
          }),
          onDiscoveryUpdated,
        })}
      />
    );

    await user.click(screen.getByText("Wave 1/groups.csv"));
    await user.click(screen.getByRole("button", { name: "Select" }));

    await waitFor(() =>
      expect(onDiscoveryUpdated).toHaveBeenCalledWith(updatedDiscovery)
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/group-file/select");
    expect(JSON.parse(init.body)).toEqual({
      session_id: "session-1",
      group_file_name: "Wave 1/groups.csv",
    });
  });

  it("shows the summary and posts a confirm when a group file is already selected", async () => {
    const user = userEvent.setup();
    const onDiscoveryUpdated = vi.fn();
    const updatedDiscovery = baseDiscovery({
      selected_group_file_name: "groups.csv",
      group_file_confirmed: true,
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => updatedDiscovery,
    });

    render(
      <MasterGroupFileSection
        {...baseProps({
          discovery: baseDiscovery({
            selected_group_file_name: "groups.csv",
            group_file_format_valid: true,
          }),
          onDiscoveryUpdated,
        })}
      />
    );

    expect(screen.getByText(/Master file is good/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() =>
      expect(onDiscoveryUpdated).toHaveBeenCalledWith(updatedDiscovery)
    );

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("/group-file/confirm");
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
      <MasterGroupFileSection
        {...baseProps({
          discovery: baseDiscovery({
            selected_group_file_name: "groups.csv",
            group_file_format_valid: true,
          }),
          onSessionExpired,
        })}
      />
    );

    await user.click(screen.getByRole("button", { name: "Confirm" }));

    await waitFor(() =>
      expect(onSessionExpired).toHaveBeenCalledTimes(1)
    );
  });

  it("uploads a manually chosen file and forwards the updated discovery", async () => {
    const onDiscoveryUpdated = vi.fn();
    const updatedDiscovery = baseDiscovery({
      selected_group_file_name: "manual.csv",
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => updatedDiscovery,
    });

    const { container } = render(
      <MasterGroupFileSection
        {...baseProps({ onDiscoveryUpdated })}
      />
    );

    const fileInput = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(["a,b,c"], "manual.csv", { type: "text/csv" });

    const user = userEvent.setup();
    await user.upload(fileInput, file);

    await waitFor(() =>
      expect(onDiscoveryUpdated).toHaveBeenCalledWith(updatedDiscovery)
    );

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/group-file/upload");
    expect(init.method).toBe("POST");
  });

  it("calls onReturnToFormat when its button is clicked", async () => {
    const user = userEvent.setup();
    const onReturnToFormat = vi.fn();

    render(
      <MasterGroupFileSection
        {...baseProps({ onReturnToFormat })}
      />
    );

    await user.click(
      screen.getByRole("button", { name: "Return to Unit File Format" })
    );
    expect(onReturnToFormat).toHaveBeenCalledTimes(1);
  });
});
