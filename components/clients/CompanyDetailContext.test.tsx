import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CompanyDetail } from "@/lib/clientsDetail";
import type {
  CompanyDetailProvider as CompanyDetailProviderType,
  useCompanyDetail as useCompanyDetailType,
} from "./CompanyDetailContext";

const { getCompanyDetail } = vi.hoisted(() => ({
  getCompanyDetail: vi.fn(),
}));

vi.mock("@/lib/clientsDetail", () => ({
  getCompanyDetail,
}));

async function freshModule() {
  vi.resetModules();
  const mod = await import("./CompanyDetailContext");
  return mod as {
    CompanyDetailProvider: typeof CompanyDetailProviderType;
    useCompanyDetail: typeof useCompanyDetailType;
  };
}

function company(overrides: Partial<CompanyDetail> = {}): CompanyDetail {
  return {
    id: "company-1",
    legal_name: "Prairie Enterprises LLC",
    corporate_email: null,
    corporate_phone: null,
    corporate_address_street: null,
    corporate_address_city: null,
    corporate_address_state: null,
    corporate_address_zip: null,
    subdomain: null,
    accepted_payment_methods: null,
    accounting_basis: null,
    payment_scheme: null,
    offers_tenant_insurance_raw: null,
    insurance_provider: null,
    website_url: null,
    archived_at: null,
    elavon_active: false,
    facilities: [],
    owners: [],
    ...overrides,
  };
}

/** Renders `company`/`loadError` from the context as plain text, so
 * assertions can just read the DOM instead of poking at hook internals.
 * Takes `useCompanyDetail` as a prop rather than importing it statically,
 * since each test gets its own fresh module instance (and therefore its
 * own Context object) via `freshModule()`. */
function Consumer({ useCompanyDetail }: { useCompanyDetail: typeof useCompanyDetailType }) {
  const { company, loadError } = useCompanyDetail();
  if (loadError) return <p>error: {loadError}</p>;
  if (!company) return <p>loading</p>;
  return <p>loaded: {company.legal_name}</p>;
}

describe("CompanyDetailProvider / useCompanyDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches once for a given companyId and provides the result to consumers", async () => {
    getCompanyDetail.mockResolvedValue({ kind: "ok", data: company() });
    const { CompanyDetailProvider, useCompanyDetail } = await freshModule();

    render(
      <CompanyDetailProvider companyId="company-1">
        <Consumer useCompanyDetail={useCompanyDetail} />
      </CompanyDetailProvider>
    );

    expect(screen.getByText("loading")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("loaded: Prairie Enterprises LLC")).toBeInTheDocument());
    expect(getCompanyDetail).toHaveBeenCalledTimes(1);
    expect(getCompanyDetail).toHaveBeenCalledWith("company-1");
  });

  it("does not refetch when the provider re-renders with the same companyId", async () => {
    getCompanyDetail.mockResolvedValue({ kind: "ok", data: company() });
    const { CompanyDetailProvider, useCompanyDetail } = await freshModule();

    const { rerender } = render(
      <CompanyDetailProvider companyId="company-1">
        <Consumer useCompanyDetail={useCompanyDetail} />
      </CompanyDetailProvider>
    );
    await waitFor(() => expect(getCompanyDetail).toHaveBeenCalledTimes(1));

    // Mirrors switching between facilities within the same company --
    // the whole point of this provider (2026-09-03 fix) is that this
    // does NOT trigger a second fetch.
    rerender(
      <CompanyDetailProvider companyId="company-1">
        <Consumer useCompanyDetail={useCompanyDetail} />
        <span>extra render</span>
      </CompanyDetailProvider>
    );

    expect(screen.getByText("extra render")).toBeInTheDocument();
    expect(getCompanyDetail).toHaveBeenCalledTimes(1);
  });

  it("refetches when companyId changes", async () => {
    getCompanyDetail.mockResolvedValueOnce({ kind: "ok", data: company({ legal_name: "Prairie Enterprises LLC" }) });
    const { CompanyDetailProvider, useCompanyDetail } = await freshModule();

    const { rerender } = render(
      <CompanyDetailProvider companyId="company-1">
        <Consumer useCompanyDetail={useCompanyDetail} />
      </CompanyDetailProvider>
    );
    await waitFor(() => expect(screen.getByText("loaded: Prairie Enterprises LLC")).toBeInTheDocument());

    getCompanyDetail.mockResolvedValueOnce({
      kind: "ok",
      data: company({ id: "company-2", legal_name: "Westpark Storage" }),
    });
    rerender(
      <CompanyDetailProvider companyId="company-2">
        <Consumer useCompanyDetail={useCompanyDetail} />
      </CompanyDetailProvider>
    );

    await waitFor(() => expect(screen.getByText("loaded: Westpark Storage")).toBeInTheDocument());
    expect(getCompanyDetail).toHaveBeenCalledTimes(2);
    expect(getCompanyDetail).toHaveBeenNthCalledWith(2, "company-2");
  });

  it("surfaces a failed fetch as loadError rather than hanging on loading", async () => {
    getCompanyDetail.mockResolvedValue({ kind: "error", message: "Could not load this company" });
    const { CompanyDetailProvider, useCompanyDetail } = await freshModule();

    render(
      <CompanyDetailProvider companyId="company-1">
        <Consumer useCompanyDetail={useCompanyDetail} />
      </CompanyDetailProvider>
    );

    await waitFor(() => expect(screen.getByText("error: Could not load this company")).toBeInTheDocument());
  });

  it("throws when useCompanyDetail is used outside a CompanyDetailProvider", async () => {
    const { useCompanyDetail } = await freshModule();

    function BareConsumer() {
      useCompanyDetail();
      return null;
    }

    // Suppress the expected React error-boundary console noise for this
    // one intentionally-throwing render.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<BareConsumer />)).toThrow(
      "useCompanyDetail must be used within a CompanyDetailProvider"
    );
    consoleError.mockRestore();
  });
});
