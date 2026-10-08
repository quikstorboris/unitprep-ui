import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ElavonStatus } from "@/lib/clientsDetail";

const { getFacilityElavon, linkFacilityElavon, unlinkFacilityElavon, resyncElavonData, refetch } = vi.hoisted(() => ({
  getFacilityElavon: vi.fn(),
  linkFacilityElavon: vi.fn(),
  unlinkFacilityElavon: vi.fn(),
  resyncElavonData: vi.fn(),
  refetch: vi.fn(),
}));

vi.mock("@/lib/clientsDetail", async () => {
  const actual = await vi.importActual<typeof import("@/lib/clientsDetail")>("@/lib/clientsDetail");
  return { ...actual, getFacilityElavon, linkFacilityElavon, unlinkFacilityElavon, resyncElavonData };
});

vi.mock("@/components/clients/CompanyDetailContext", () => ({
  useCompanyDetail: () => ({ refetch }),
}));

import { ElavonTab } from "./ElavonTab";

const unlinked: ElavonStatus = {
  status: "unlinked",
  candidate: { merchant_account_run_id: "run-1", run_name: "Acme Storage", updated_at: "2026-10-01T00:00:00Z" },
  ambiguous_candidates: [],
} as ElavonStatus;

const linked = {
  status: "linked",
  rate_provided: "2.5%",
  application_status: "Approved",
  credentials_added_to_qms: true,
  ps_new_merchant_run_id: "run-1",
  last_synced_at: null,
  parties: [],
  financials: {},
  qms_credentials: { account_id: "A-1", user_id: "U-1", pin_password: "s3cret-pin" },
  pinpad_credentials: { pinpad_user_id: "P-1", qss_api_pin: "9999" },
} as unknown as ElavonStatus;

beforeEach(() => {
  vi.resetAllMocks();
});

describe("ElavonTab", () => {
  it("shows the load error", async () => {
    getFacilityElavon.mockResolvedValue({ kind: "error", message: "boom" });
    render(<ElavonTab companyId="c1" facilityId="f1" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  });

  it("links the suggested candidate, then reloads and refetches the company", async () => {
    getFacilityElavon.mockResolvedValueOnce({ kind: "ok", data: unlinked }).mockResolvedValueOnce({ kind: "ok", data: linked });
    linkFacilityElavon.mockResolvedValue({ kind: "ok", data: undefined });
    render(<ElavonTab companyId="c1" facilityId="f1" />);

    await userEvent.click(await screen.findByRole("button", { name: "Confirm this link" }));

    expect(linkFacilityElavon).toHaveBeenCalledWith("c1", "f1", "run-1");
    expect(await screen.findByText("Resync Elavon Data")).toBeInTheDocument();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("ignores a blank manual run id and shows a link error", async () => {
    getFacilityElavon.mockResolvedValue({ kind: "ok", data: { ...unlinked, candidate: null } });
    linkFacilityElavon.mockResolvedValue({ kind: "error", message: "no such run" });
    render(<ElavonTab companyId="c1" facilityId="f1" />);

    const link = await screen.findByRole("button", { name: "Link" });
    expect(link).toBeDisabled();
    await userEvent.type(screen.getByPlaceholderText("Process Street run ID"), " run-9 ");
    await userEvent.click(link);

    expect(linkFacilityElavon).toHaveBeenCalledWith("c1", "f1", "run-9");
    expect(await screen.findByRole("alert")).toHaveTextContent("no such run");
    expect(refetch).not.toHaveBeenCalled();
  });

  it("masks PIN/Password until Show is clicked", async () => {
    getFacilityElavon.mockResolvedValue({ kind: "ok", data: linked });
    render(<ElavonTab companyId="c1" facilityId="f1" />);

    await screen.findByText("A-1");
    expect(screen.queryByText("s3cret-pin")).not.toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Show" })[0]);
    expect(screen.getByText("s3cret-pin")).toBeInTheDocument();
  });

  it("asks for confirmation before unlinking, and Cancel backs out", async () => {
    getFacilityElavon.mockResolvedValue({ kind: "ok", data: linked });
    render(<ElavonTab companyId="c1" facilityId="f1" />);

    await userEvent.click(await screen.findByRole("button", { name: "Unlink" }));
    expect(unlinkFacilityElavon).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Unlink" })).toBeInTheDocument();
  });

  it("unlinks after confirmation and reloads", async () => {
    getFacilityElavon.mockResolvedValueOnce({ kind: "ok", data: linked }).mockResolvedValueOnce({ kind: "ok", data: unlinked });
    unlinkFacilityElavon.mockResolvedValue({ kind: "ok", data: undefined });
    render(<ElavonTab companyId="c1" facilityId="f1" />);

    await userEvent.click(await screen.findByRole("button", { name: "Unlink" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, unlink" }));

    await waitFor(() => expect(unlinkFacilityElavon).toHaveBeenCalledWith("c1", "f1"));
    expect(await screen.findByText("New Merchant Account Flow Found")).toBeInTheDocument();
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("shows a resync error and does not refetch the company", async () => {
    getFacilityElavon.mockResolvedValue({ kind: "ok", data: linked });
    resyncElavonData.mockResolvedValue({ kind: "error", message: "PS down" });
    render(<ElavonTab companyId="c1" facilityId="f1" />);

    await userEvent.click(await screen.findByRole("button", { name: "Resync Elavon Data" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("PS down");
    expect(refetch).not.toHaveBeenCalled();
  });
});
