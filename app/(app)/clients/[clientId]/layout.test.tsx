import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createQueryWrapper } from "@/lib/testUtils/queryWrapper";

const { getCompanyDetail, listCompanies } = vi.hoisted(() => ({
  getCompanyDetail: vi.fn(),
  listCompanies: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useParams: () => ({ clientId: "c1", facilityId: "f1" }),
}));
vi.mock("@/lib/clientsDetail", () => ({ getCompanyDetail }));
// The full client list must stay off this layout's path (see layout.tsx).
vi.mock("@/lib/clientsCompanies", () => ({ listCompanies }));
vi.mock("@/components/nav/CompanyTabs", () => ({
  default: ({ clientId, facilityId }: { clientId: string; facilityId?: string }) => (
    <nav aria-label="company tabs">{`${clientId}/${facilityId}`}</nav>
  ),
}));
vi.mock("@/components/nav/ClientTabs", () => ({
  default: () => <nav aria-label="client tabs" />,
}));

import ClientLayout from "./layout";

beforeEach(() => {
  getCompanyDetail.mockReset();
  listCompanies.mockReset();
});

describe("ClientLayout", () => {
  it("renders the tabs and the page at once, while the company is still loading", () => {
    getCompanyDetail.mockReturnValue(new Promise(() => {}));

    render(
      <ClientLayout>
        <p>page body</p>
      </ClientLayout>,
      { wrapper: createQueryWrapper() },
    );

    expect(screen.getByText("page body")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "company tabs" })).toHaveTextContent("c1/f1");
    expect(screen.getByRole("navigation", { name: "client tabs" })).toBeInTheDocument();
  });

  it("shows the company's own name from its detail, without loading the client list", async () => {
    getCompanyDetail.mockResolvedValue({ kind: "ok", data: { id: "c1", legal_name: "Affordable Storage" } });

    render(
      <ClientLayout>
        <p>page body</p>
      </ClientLayout>,
      { wrapper: createQueryWrapper() },
    );

    expect(await screen.findByRole("heading", { name: "Affordable Storage" })).toBeInTheDocument();
    expect(getCompanyDetail).toHaveBeenCalledTimes(1);
    expect(getCompanyDetail).toHaveBeenCalledWith("c1");
    expect(listCompanies).not.toHaveBeenCalled();
  });

  it("shows the failure with a way back, and not the page, when the company cannot be loaded", async () => {
    getCompanyDetail.mockResolvedValue({ kind: "error", message: "Company not found" });

    render(
      <ClientLayout>
        <p>page body</p>
      </ClientLayout>,
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Company not found"));
    expect(screen.getByRole("link", { name: "Back to Clients" })).toHaveAttribute("href", "/clients");
    expect(screen.queryByText("page body")).not.toBeInTheDocument();
  });
});
