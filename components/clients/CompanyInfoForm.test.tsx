import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CompanyInfoForm from "./CompanyInfoForm";
import type { CompanyInfoFields } from "@/types/generated/CompanyInfoFields";

const updateCompanyInfo = vi.fn();

vi.mock("@/lib/clientsCompanies", () => ({
  updateCompanyInfo: (...args: unknown[]) => updateCompanyInfo(...args),
}));

const initial: CompanyInfoFields = {
  legal_name: "KH Moss, LLC",
  corporate_email: null,
  corporate_phone: null,
  corporate_address_street: null,
  corporate_address_city: null,
  corporate_address_state: null,
  corporate_address_zip: null,
  subdomain: null,
  website_url: null,
  accepted_payment_methods: null,
  accounting_basis: null,
  payment_scheme: null,
  offers_tenant_insurance_raw: null,
  insurance_provider: null,
};

describe("CompanyInfoForm", () => {
  beforeEach(() => updateCompanyInfo.mockReset());

  it("saves the edited fields and reports success", async () => {
    updateCompanyInfo.mockResolvedValue({ kind: "ok", data: undefined });
    const onSaved = vi.fn();
    render(
      <CompanyInfoForm
        companyId="c1"
        initial={initial}
        onSaved={onSaved}
        onCancel={() => {}}
      />,
    );

    const name = screen.getByLabelText("Legal Name");
    await userEvent.clear(name);
    await userEvent.type(name, "KH Moss");
    await userEvent.type(screen.getByLabelText("Phone"), "5551234567");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(updateCompanyInfo).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({
        legal_name: "KH Moss",
        corporate_phone: "5551234567",
      }),
    );
  });

  it("refuses a blank name without calling the server", async () => {
    render(
      <CompanyInfoForm
        companyId="c1"
        initial={initial}
        onSaved={() => {}}
        onCancel={() => {}}
      />,
    );

    await userEvent.clear(screen.getByLabelText("Legal Name"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A company needs a name.",
    );
    expect(updateCompanyInfo).not.toHaveBeenCalled();
  });

  it("shows a server error and does not report success", async () => {
    updateCompanyInfo.mockResolvedValue({
      kind: "error",
      message: "Could not update this client",
    });
    const onSaved = vi.fn();
    render(
      <CompanyInfoForm
        companyId="c1"
        initial={initial}
        onSaved={onSaved}
        onCancel={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not update this client",
    );
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("cancels without saving", async () => {
    const onCancel = vi.fn();
    render(
      <CompanyInfoForm
        companyId="c1"
        initial={initial}
        onSaved={() => {}}
        onCancel={onCancel}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(updateCompanyInfo).not.toHaveBeenCalled();
  });
});
