import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  params: { clientId: "c1", facilityId: "f1" },
  search: new URLSearchParams(),
  company: { facilities: [{ id: "f1" }, { id: "f2" }] } as unknown,
  companyLoadError: null as string | null,
  getFacilityDetail: vi.fn(),
  getFacilityPolicies: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => m.params,
  useSearchParams: () => m.search,
}));
vi.mock("@/components/clients/CompanyDetailContext", () => ({
  useCompanyDetail: () => ({ company: m.company, loadError: m.companyLoadError }),
}));
vi.mock("@/lib/clientsDetail", async () => {
  const actual = await vi.importActual<typeof import("@/lib/clientsDetail")>("@/lib/clientsDetail");
  return { ...actual, getFacilityDetail: m.getFacilityDetail, getFacilityPolicies: m.getFacilityPolicies };
});
vi.mock("@/components/clients/FacilityRail", () => ({ default: () => <div>rail</div> }));
vi.mock("@/components/clients/FieldReferenceHelp", () => ({ default: () => <div>field-help</div> }));
vi.mock("@/components/facility/GeneralTab", () => ({
  GeneralTab: (p: { onChanged: () => void }) => <button onClick={p.onChanged}>general-tab</button>,
}));
vi.mock("@/components/facility/FeesTab", () => ({
  FeesTab: (p: { onSaved: () => void; policies: { id?: string } }) => (
    <button onClick={p.onSaved}>fees-tab {String(p.policies.id)}</button>
  ),
}));
vi.mock("@/components/facility/ElavonTab", () => ({
  ElavonTab: (p: { facilityId: string }) => <div>elavon-tab {p.facilityId}</div>,
}));
vi.mock("@/components/facility/DropboxTab", () => ({
  DropboxTab: (p: { dropboxFolderUrl: string | null; onSaved: () => void }) => (
    <button onClick={p.onSaved}>dropbox-tab {String(p.dropboxFolderUrl)}</button>
  ),
}));

import FacilityDetailPage from "./page";

const ok = (data: unknown) => ({ kind: "ok", data });

beforeEach(() => {
  vi.resetAllMocks();
  m.params = { clientId: "c1", facilityId: "f1" };
  m.search = new URLSearchParams();
  m.company = { facilities: [{ id: "f1" }, { id: "f2" }] };
  m.companyLoadError = null;
  m.getFacilityDetail.mockResolvedValue(ok({ name: "Highway 20", dropbox_folder_url: "https://dbx/x" }));
  m.getFacilityPolicies.mockResolvedValue(ok({ id: "p1" }));
});

describe("FacilityDetailPage", () => {
  it("loads the facility and policies and lands on General", async () => {
    render(<FacilityDetailPage />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Highway 20" })).toBeInTheDocument();
    expect(screen.getByText("general-tab")).toBeInTheDocument();
    expect(m.getFacilityDetail).toHaveBeenCalledWith("c1", "f1");
    expect(m.getFacilityPolicies).toHaveBeenCalledWith("c1", "f1");
  });

  it("waits for the company before showing anything", () => {
    m.company = null;
    render(<FacilityDetailPage />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByText("rail")).not.toBeInTheDocument();
  });

  it("shows the company load error ahead of the facility's", async () => {
    m.companyLoadError = "company down";
    m.getFacilityDetail.mockResolvedValue({ kind: "error", message: "facility down" });
    render(<FacilityDetailPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("company down");
  });

  it("shows a facility error, and a policies error", async () => {
    m.getFacilityDetail.mockResolvedValue({ kind: "error", message: "facility down" });
    const { unmount } = render(<FacilityDetailPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("facility down");
    unmount();

    m.getFacilityDetail.mockResolvedValue(ok({ name: "X", dropbox_folder_url: null }));
    m.getFacilityPolicies.mockResolvedValue({ kind: "error", message: "policies down" });
    render(<FacilityDetailPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("policies down");
  });

  it("opens the tab named in ?tab= and switches with the tab buttons", async () => {
    m.search = new URLSearchParams("tab=fees");
    render(<FacilityDetailPage />);
    expect(await screen.findByText("fees-tab p1")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Elavon" }));
    expect(screen.getByText("elavon-tab f1")).toBeInTheDocument();
    expect(screen.queryByText("fees-tab p1")).not.toBeInTheDocument();
  });

  it("ignores an unknown ?tab= value", async () => {
    m.search = new URLSearchParams("tab=bogus");
    render(<FacilityDetailPage />);
    expect(await screen.findByText("general-tab")).toBeInTheDocument();
  });

  it("a policies save refetches only the policies, without blanking the page", async () => {
    m.search = new URLSearchParams("tab=fees");
    render(<FacilityDetailPage />);
    await userEvent.click(await screen.findByText("fees-tab p1"));

    await waitFor(() => expect(m.getFacilityPolicies).toHaveBeenCalledTimes(2));
    expect(m.getFacilityDetail).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { name: "Highway 20" })).toBeInTheDocument();
  });

  it("a facility save (General or DropBox tab) refetches only the facility", async () => {
    render(<FacilityDetailPage />);
    await userEvent.click(await screen.findByText("general-tab"));

    await waitFor(() => expect(m.getFacilityDetail).toHaveBeenCalledTimes(2));
    expect(m.getFacilityPolicies).toHaveBeenCalledTimes(1);
  });

  it("a failed refresh shows the error", async () => {
    render(<FacilityDetailPage />);
    await screen.findByText("general-tab");
    m.getFacilityDetail.mockResolvedValue({ kind: "error", message: "refresh failed" });
    await userEvent.click(screen.getByText("general-tab"));
    expect(await screen.findByRole("alert")).toHaveTextContent("refresh failed");
  });

  it("reloads when the facility changes, going back to Loading in between", async () => {
    const { rerender } = render(<FacilityDetailPage />);
    await screen.findByRole("heading", { name: "Highway 20" });

    m.params = { clientId: "c1", facilityId: "f2" };
    m.getFacilityDetail.mockResolvedValue(ok({ name: "Main St", dropbox_folder_url: null }));
    rerender(<FacilityDetailPage />);

    expect(await screen.findByRole("heading", { name: "Main St" })).toBeInTheDocument();
    expect(m.getFacilityDetail).toHaveBeenLastCalledWith("c1", "f2");
  });
});
