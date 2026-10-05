import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FacilityDetail, FacilitySummary } from "@/lib/clientsDetail";

const { useCurrentUser, useCompanyDetail, refetch, unlinkCompanyClickUp, unlinkFacilityClickUp } = vi.hoisted(
  () => ({
    useCurrentUser: vi.fn(),
    useCompanyDetail: vi.fn(),
    refetch: vi.fn(),
    unlinkCompanyClickUp: vi.fn(),
    unlinkFacilityClickUp: vi.fn(),
  })
);

vi.mock("@/lib/currentUser", () => ({ useCurrentUser }));
vi.mock("@/components/clients/CompanyDetailContext", () => ({ useCompanyDetail }));
vi.mock("@/lib/clickupLinks", () => ({
  unlinkCompanyClickUp,
  unlinkFacilityClickUp,
  // The dialog is exercised in its own test file.
  getClickUpSuggestions: vi.fn().mockReturnValue(new Promise(() => {})),
  listClickUpLists: vi.fn().mockReturnValue(new Promise(() => {})),
  resolveClickUpUrl: vi.fn(),
  prefetchClickUpHierarchy: vi.fn().mockResolvedValue(undefined),
  saveClickUpLinks: vi.fn(),
}));

import ClickUpCompanySection from "./ClickUpCompanySection";
import ClickUpFacilitySection from "./ClickUpFacilitySection";

const URL = "https://app.clickup.com/8413555/v/li/100";

function summary(overrides: Partial<FacilitySummary> = {}): FacilitySummary {
  return {
    id: "f1",
    name: "Affordable Storage Synott",
    dropbox_folder_url: null,
    clickup_list_id: null,
    clickup_list_name: null,
    clickup_folder_name: null,
    clickup_list_url: null,
    ...overrides,
  };
}

const linkedSummary = (id: string, name: string) =>
  summary({
    id,
    name,
    clickup_list_id: `L-${id}`,
    clickup_list_name: `${name} list`,
    clickup_folder_name: "Folder",
    clickup_list_url: URL,
  });

function facilityDetail(overrides: Partial<FacilityDetail> = {}): FacilityDetail {
  return {
    id: "f1",
    company_id: "c1",
    name: "Affordable Storage Synott",
    clickup_list_id: null,
    clickup_list_name: null,
    clickup_folder_name: null,
    clickup_list_url: null,
    ...overrides,
  } as FacilityDetail;
}

function signedInWith(permissions: string[]) {
  useCurrentUser.mockReturnValue({ user: { user_id: "u1", permissions, roles: [] } });
}

beforeEach(() => {
  for (const fn of [refetch, unlinkCompanyClickUp, unlinkFacilityClickUp]) fn.mockReset();
});

describe("ClickUpCompanySection", () => {
  function renderCompany(facilities: FacilitySummary[]) {
    useCompanyDetail.mockReturnValue({ company: { facilities, legal_name: "Affordable Storage" }, refetch });
    render(<ClickUpCompanySection companyId="c1" companyName="Affordable Storage" />);
  }

  it("shows nothing to a viewer without ClickUp when no facility is linked", () => {
    signedInWith([]);
    renderCompany([summary()]);

    expect(screen.queryByText("ClickUp")).not.toBeInTheDocument();
  });

  it("shows a viewer without ClickUp the links that exist, but no buttons", () => {
    signedInWith([]);
    renderCompany([linkedSummary("f1", "Synott")]);

    expect(screen.getByRole("link", { name: "Synott list" })).toHaveAttribute("href", URL);
    expect(screen.queryByRole("button", { name: "Link ClickUp" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Unlink All Facilities" })).not.toBeInTheDocument();
  });

  it("offers Link ClickUp to a user with ClickUp, and no Unlink All when nothing is linked", () => {
    signedInWith(["integrations.clickup"]);
    renderCompany([summary()]);

    expect(screen.getByRole("button", { name: "Link ClickUp" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Unlink All Facilities" })).not.toBeInTheDocument();
    expect(screen.getByText(/None of this company/)).toBeInTheDocument();
  });

  it("opens the Link ClickUp dialog", async () => {
    const user = userEvent.setup();
    signedInWith(["integrations.clickup"]);
    renderCompany([summary()]);

    await user.click(screen.getByRole("button", { name: "Link ClickUp" }));

    expect(screen.getByRole("dialog", { name: "Link ClickUp" })).toBeInTheDocument();
  });

  it("disables Link ClickUp for a company with no facilities", () => {
    signedInWith(["integrations.clickup"]);
    renderCompany([]);

    expect(screen.getByRole("button", { name: "Link ClickUp" })).toBeDisabled();
  });

  it("Unlink All Facilities needs a confirmation, then unlinks and reloads", async () => {
    const user = userEvent.setup();
    signedInWith(["integrations.clickup"]);
    unlinkCompanyClickUp.mockResolvedValue({ kind: "ok", data: { unlinked: 2 } });
    renderCompany([linkedSummary("f1", "A"), linkedSummary("f2", "B")]);

    await user.click(screen.getByRole("button", { name: "Unlink All Facilities" }));
    expect(unlinkCompanyClickUp).not.toHaveBeenCalled();
    expect(screen.getByText(/all 2 facilities/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Yes, unlink all" }));

    expect(unlinkCompanyClickUp).toHaveBeenCalledWith("c1");
    expect(await screen.findByRole("status")).toHaveTextContent("Unlinked 2 facilities.");
    expect(refetch).toHaveBeenCalled();
  });

  it("cancelling the Unlink All confirmation changes nothing", async () => {
    const user = userEvent.setup();
    signedInWith(["integrations.clickup"]);
    renderCompany([linkedSummary("f1", "A")]);

    await user.click(screen.getByRole("button", { name: "Unlink All Facilities" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(unlinkCompanyClickUp).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Unlink All Facilities" })).toBeInTheDocument();
  });

  it("shows an unlink failure", async () => {
    const user = userEvent.setup();
    signedInWith(["integrations.clickup"]);
    unlinkCompanyClickUp.mockResolvedValue({ kind: "error", message: "Your role cannot change a facility's ClickUp link." });
    renderCompany([linkedSummary("f1", "A")]);

    await user.click(screen.getByRole("button", { name: "Unlink All Facilities" }));
    await user.click(screen.getByRole("button", { name: "Yes, unlink all" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Your role cannot change");
    expect(refetch).not.toHaveBeenCalled();
  });

  it("marks each facility's row green when linked and red when not", () => {
    signedInWith(["integrations.clickup"]);
    renderCompany([linkedSummary("f1", "A"), summary({ id: "f2", name: "B" })]);

    expect(screen.getByRole("img", { name: "Facility linked to ClickUp" }).className).toContain("bg-green-500");
    expect(screen.getByRole("img", { name: "Facility not linked to ClickUp" }).className).toContain("bg-red-500");
  });
});

describe("ClickUpFacilitySection", () => {
  function renderFacility(facility: FacilityDetail, onChanged = vi.fn()) {
    useCompanyDetail.mockReturnValue({ company: { legal_name: "Affordable Storage" }, refetch });
    render(<ClickUpFacilitySection facility={facility} onChanged={onChanged} />);
    return onChanged;
  }

  const linked = () =>
    facilityDetail({
      clickup_list_id: "100",
      clickup_list_name: "Affordable Storage Synott",
      clickup_folder_name: "Affordable Storage - Beau Ryan",
      clickup_list_url: URL,
    });

  it("links the ClickUp button to the list, in a new tab", () => {
    signedInWith(["integrations.clickup"]);
    renderFacility(linked());

    const button = screen.getByRole("link", { name: /ClickUp/ });
    expect(button).toHaveAttribute("href", URL);
    expect(button).toHaveAttribute("target", "_blank");
    expect(button).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(screen.getByText(/Affordable Storage Synott · Affordable Storage - Beau Ryan/)).toBeInTheDocument();
  });

  it("puts the dot next to the ClickUp heading, not on the button", () => {
    signedInWith(["integrations.clickup"]);
    renderFacility(linked());

    const heading = screen.getByRole("heading", { name: /ClickUp/ });
    expect(heading).toContainElement(screen.getByRole("img", { name: "Facility linked to ClickUp" }));
    expect(screen.getByRole("link", { name: /ClickUp/ })).not.toContainElement(
      screen.getByRole("img", { name: "Facility linked to ClickUp" })
    );
  });

  it("dot is green when the facility is linked, whoever is looking", () => {
    signedInWith([]);
    renderFacility(linked());

    expect(screen.getByRole("img", { name: "Facility linked to ClickUp" }).className).toContain("bg-green-500");
  });

  it("dot is red when the facility is not linked (never linked, or unlinked)", () => {
    signedInWith(["integrations.clickup"]);
    renderFacility(facilityDetail());

    expect(screen.getByRole("img", { name: "Facility not linked to ClickUp" }).className).toContain("bg-red-500");
    expect(screen.getByRole("button", { name: "Link ClickUp" })).toBeInTheDocument();
  });

  it("hovering the dot shows a bubble saying whether the facility is linked", async () => {
    const user = userEvent.setup();
    signedInWith(["integrations.clickup"]);
    renderFacility(facilityDetail());

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    await user.hover(screen.getByRole("img", { name: "Facility not linked to ClickUp" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("Facility not linked to ClickUp");

    await user.unhover(screen.getByRole("img", { name: "Facility not linked to ClickUp" }));
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("the bubble also opens from the keyboard", async () => {
    const user = userEvent.setup();
    signedInWith(["integrations.clickup"]);
    renderFacility(linked());

    await user.tab();
    // Focus lands on the dot (the first focusable element).
    expect(screen.getByRole("tooltip")).toHaveTextContent("Facility linked to ClickUp");
  });

  it("for a viewer without ClickUp, the button still opens the list but no actions are offered", () => {
    signedInWith([]);
    renderFacility(linked());

    expect(screen.getByRole("link", { name: /ClickUp/ })).toHaveAttribute("href", URL);
    expect(screen.queryByRole("button", { name: "Change link" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Unlink" })).not.toBeInTheDocument();
  });

  it("renders nothing for a viewer without ClickUp on an unlinked facility", () => {
    signedInWith([]);
    renderFacility(facilityDetail());

    expect(screen.queryByText("ClickUp")).not.toBeInTheDocument();
  });

  it("Change link opens the dialog scoped to this one facility", async () => {
    const user = userEvent.setup();
    signedInWith(["integrations.clickup"]);
    renderFacility(linked());

    await user.click(screen.getByRole("button", { name: "Change link" }));

    expect(screen.getByRole("dialog", { name: "ClickUp list" })).toBeInTheDocument();
  });

  it("Unlink needs a confirmation, then unlinks this facility and reloads", async () => {
    const user = userEvent.setup();
    signedInWith(["integrations.clickup"]);
    unlinkFacilityClickUp.mockResolvedValue({ kind: "ok", data: { unlinked: 1 } });
    const onChanged = renderFacility(linked());

    await user.click(screen.getByRole("button", { name: "Unlink" }));
    expect(unlinkFacilityClickUp).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Yes, unlink" }));

    expect(unlinkFacilityClickUp).toHaveBeenCalledWith("c1", "f1");
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(refetch).toHaveBeenCalled();
  });

  it("shows an unlink failure and does not reload", async () => {
    const user = userEvent.setup();
    signedInWith(["integrations.clickup"]);
    unlinkFacilityClickUp.mockResolvedValue({ kind: "error", message: "Your role cannot change this." });
    const onChanged = renderFacility(linked());

    await user.click(screen.getByRole("button", { name: "Unlink" }));
    await user.click(screen.getByRole("button", { name: "Yes, unlink" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Your role cannot change this.");
    expect(onChanged).not.toHaveBeenCalled();
  });
});
