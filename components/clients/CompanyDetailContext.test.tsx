import { act, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CompanyDetail } from "@/lib/clientsDetail";
import { createQueryWrapper, createTestQueryClient } from "@/lib/testUtils/queryWrapper";

const { getCompanyDetail } = vi.hoisted(() => ({
  getCompanyDetail: vi.fn(),
}));

vi.mock("@/lib/clientsDetail", () => ({
  getCompanyDetail,
}));

import { CompanyDetailProvider, useCompanyDetail } from "./CompanyDetailContext";

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
    implementation_completed_at: null,
    clickup_parent_facility_id: null,
    implementation_manager: null,
    clickup_waived_at: null,
    clickup_parent_history: [],
    elavon_active: false,
    facilities: [],
    owners: [],
    ...overrides,
  };
}

/** Renders `company`/`loadError` from the context as plain text, so
 * assertions can just read the DOM instead of poking at hook internals. */
function Consumer() {
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

    render(
      <CompanyDetailProvider companyId="company-1">
        <Consumer />
      </CompanyDetailProvider>,
      { wrapper: createQueryWrapper() },
    );

    expect(screen.getByText("loading")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("loaded: Prairie Enterprises LLC")).toBeInTheDocument());
    expect(getCompanyDetail).toHaveBeenCalledTimes(1);
    expect(getCompanyDetail).toHaveBeenCalledWith("company-1");
  });

  it("does not refetch when the provider re-renders with the same companyId", async () => {
    getCompanyDetail.mockResolvedValue({ kind: "ok", data: company() });

    const { rerender } = render(
      <CompanyDetailProvider companyId="company-1">
        <Consumer />
      </CompanyDetailProvider>,
      { wrapper: createQueryWrapper() },
    );
    await waitFor(() => expect(getCompanyDetail).toHaveBeenCalledTimes(1));

    // Mirrors switching between facilities within the same company --
    // the whole point of this provider (2026-09-03 fix) is that this
    // does NOT trigger a second fetch.
    rerender(
      <CompanyDetailProvider companyId="company-1">
        <Consumer />
        <span>extra render</span>
      </CompanyDetailProvider>,
    );

    expect(screen.getByText("extra render")).toBeInTheDocument();
    expect(getCompanyDetail).toHaveBeenCalledTimes(1);
  });

  it("hands consumers the same context value across a re-render that changes nothing", async () => {
    getCompanyDetail.mockResolvedValue({ kind: "ok", data: company() });
    const seen: unknown[] = [];
    function Probe() {
      seen.push(useCompanyDetail());
      return null;
    }

    const { rerender } = render(
      <CompanyDetailProvider companyId="company-1">
        <Probe />
      </CompanyDetailProvider>,
      { wrapper: createQueryWrapper() },
    );
    await waitFor(() => expect(getCompanyDetail).toHaveBeenCalledTimes(1));
    await waitFor(() => expect((seen.at(-1) as { company: unknown }).company).not.toBeNull());
    const settled = seen.at(-1);

    // A parent re-render with identical props: the memoized value (and its
    // `refetch`) must be the very same objects, so consumers do not re-render.
    rerender(
      <CompanyDetailProvider companyId="company-1">
        <Probe />
      </CompanyDetailProvider>,
    );

    expect(seen.at(-1)).toBe(settled);
  });

  it("refetches when companyId changes", async () => {
    getCompanyDetail.mockResolvedValueOnce({ kind: "ok", data: company({ legal_name: "Prairie Enterprises LLC" }) });

    const { rerender } = render(
      <CompanyDetailProvider companyId="company-1">
        <Consumer />
      </CompanyDetailProvider>,
      { wrapper: createQueryWrapper() },
    );
    await waitFor(() => expect(screen.getByText("loaded: Prairie Enterprises LLC")).toBeInTheDocument());

    getCompanyDetail.mockResolvedValueOnce({
      kind: "ok",
      data: company({ id: "company-2", legal_name: "Westpark Storage" }),
    });
    rerender(
      <CompanyDetailProvider companyId="company-2">
        <Consumer />
      </CompanyDetailProvider>,
    );

    // The previous company's data must not show under the new id.
    expect(screen.queryByText("loaded: Prairie Enterprises LLC")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("loaded: Westpark Storage")).toBeInTheDocument());
    expect(getCompanyDetail).toHaveBeenCalledTimes(2);
    expect(getCompanyDetail).toHaveBeenNthCalledWith(2, "company-2");
  });

  it("surfaces a failed fetch as loadError rather than hanging on loading", async () => {
    getCompanyDetail.mockResolvedValue({ kind: "error", message: "Could not load this company" });

    render(
      <CompanyDetailProvider companyId="company-1">
        <Consumer />
      </CompanyDetailProvider>,
      { wrapper: createQueryWrapper() },
    );

    await waitFor(() => expect(screen.getByText("error: Could not load this company")).toBeInTheDocument());
  });

  it("shows a company seen moments ago at once, without asking the API again", async () => {
    getCompanyDetail.mockResolvedValue({ kind: "ok", data: company() });
    const client = createTestQueryClient();

    const first = render(
      <CompanyDetailProvider companyId="company-1">
        <Consumer />
      </CompanyDetailProvider>,
      { wrapper: createQueryWrapper(client) },
    );
    await waitFor(() => expect(screen.getByText("loaded: Prairie Enterprises LLC")).toBeInTheDocument());
    first.unmount();

    // Coming back to the company inside the freshness window.
    render(
      <CompanyDetailProvider companyId="company-1">
        <Consumer />
      </CompanyDetailProvider>,
      { wrapper: createQueryWrapper(client) },
    );

    expect(screen.getByText("loaded: Prairie Enterprises LLC")).toBeInTheDocument();
    expect(getCompanyDetail).toHaveBeenCalledTimes(1);
  });

  it("refetch() refreshes in place: the old data stays until the new arrives", async () => {
    getCompanyDetail.mockResolvedValueOnce({ kind: "ok", data: company({ legal_name: "Old Name" }) });
    let refetch: () => void = () => {};
    function Capture() {
      const current = useCompanyDetail().refetch;
      useEffect(() => {
        refetch = current;
      }, [current]);
      return <Consumer />;
    }

    render(
      <CompanyDetailProvider companyId="company-1">
        <Capture />
      </CompanyDetailProvider>,
      { wrapper: createQueryWrapper() },
    );
    await waitFor(() => expect(screen.getByText("loaded: Old Name")).toBeInTheDocument());

    let release: (value: unknown) => void = () => {};
    getCompanyDetail.mockReturnValueOnce(new Promise((resolve) => (release = resolve)));
    act(() => refetch());

    // Mid-refresh: never back to "loading".
    await waitFor(() => expect(getCompanyDetail).toHaveBeenCalledTimes(2));
    expect(screen.getByText("loaded: Old Name")).toBeInTheDocument();

    await act(async () => release({ kind: "ok", data: company({ legal_name: "New Name" }) }));
    await waitFor(() => expect(screen.getByText("loaded: New Name")).toBeInTheDocument());
  });

  it("keeps the page when only a background refresh fails", async () => {
    getCompanyDetail.mockResolvedValueOnce({ kind: "ok", data: company() });
    let refetch: () => void = () => {};
    function Capture() {
      const current = useCompanyDetail().refetch;
      useEffect(() => {
        refetch = current;
      }, [current]);
      return <Consumer />;
    }

    render(
      <CompanyDetailProvider companyId="company-1">
        <Capture />
      </CompanyDetailProvider>,
      { wrapper: createQueryWrapper() },
    );
    await waitFor(() => expect(screen.getByText("loaded: Prairie Enterprises LLC")).toBeInTheDocument());

    getCompanyDetail.mockResolvedValueOnce({ kind: "error", message: "boom" });
    act(() => refetch());
    await waitFor(() => expect(getCompanyDetail).toHaveBeenCalledTimes(2));

    expect(screen.getByText("loaded: Prairie Enterprises LLC")).toBeInTheDocument();
    expect(screen.queryByText("error: boom")).not.toBeInTheDocument();
  });

  it("throws when useCompanyDetail is used outside a CompanyDetailProvider", () => {
    function BareConsumer() {
      useCompanyDetail();
      return null;
    }

    // Suppress the expected React error-boundary console noise for this
    // one intentionally-throwing render.
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<BareConsumer />)).toThrow(
      "useCompanyDetail must be used within a CompanyDetailProvider",
    );
    consoleError.mockRestore();
  });
});
