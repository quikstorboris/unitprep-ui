"use client";

import DetailSection from "@/components/clients/DetailSection";
import PartyCard from "@/components/clients/PartyCard";
import type { ElavonStatus } from "@/lib/clientsDetail";

import { CredentialField } from "./CredentialField";

export type LinkedElavonStatus = Extract<ElavonStatus, { status: "linked" }>;

export interface LinkedElavonViewProps {
  status: LinkedElavonStatus;
  resyncing: boolean;
  resyncError: string | null;
  onResync: () => void;
  confirmingUnlink: boolean;
  setConfirmingUnlink: (value: boolean) => void;
  unlinking: boolean;
  unlinkError: string | null;
  onUnlink: () => void;
}

/** The Elavon tab once a New Merchant Account run is linked. */
export function LinkedElavonView({
  status,
  resyncing,
  resyncError,
  onResync,
  confirmingUnlink,
  setConfirmingUnlink,
  unlinking,
  unlinkError,
  onUnlink,
}: LinkedElavonViewProps) {
  return (
      <div className="flex flex-col gap-6">
        <DetailSection
          title="Elavon"
          action={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onResync}
                disabled={resyncing}
                className="rounded border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-100 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {resyncing ? "Resyncing…" : "Resync Elavon Data"}
              </button>
              {confirmingUnlink ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-amber-400">Remove this link and its owner/financial data?</span>
                  <button
                    type="button"
                    onClick={onUnlink}
                    disabled={unlinking}
                    className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-slate-700"
                  >
                    {unlinking ? "Unlinking…" : "Yes, unlink"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingUnlink(false)}
                    disabled={unlinking}
                    className="rounded border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-100 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingUnlink(true)}
                  className="rounded border border-red-900 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-950/30"
                >
                  Unlink
                </button>
              )}
            </div>
          }
          fields={[
            { label: "Rate Provided", value: status.rate_provided },
            { label: "Application Status", value: status.application_status },
            { label: "Credentials Added to QMS", value: status.credentials_added_to_qms ? "Yes" : "No" },
            { label: "Process Street Run ID", value: status.ps_new_merchant_run_id },
          ]}
        />
        {resyncError && (
          <p role="alert" className="text-sm text-red-400">
            {resyncError}
          </p>
        )}
        {unlinkError && (
          <p role="alert" className="text-sm text-red-400">
            {unlinkError}
          </p>
        )}

        {/* QMS Credentials / Pin Pad Credentials -- the "Add Credentials
            to QMS" checklist step's own values (2026-09-09), not
            previously captured anywhere in Orchestrator. Refreshed by
            the tab's own "Resync Elavon Data" button above, same as
            everything else on this tab. */}
        <section className="rounded border border-slate-800 p-5">
          <h2 className="mb-4 text-lg font-semibold">QMS &amp; Pin Pad Credentials</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">QMS Credentials</h3>
              <dl className="flex flex-col gap-3 text-sm">
                <CredentialField label="Account ID" value={status.qms_credentials.account_id} revealable={false} />
                <CredentialField label="User ID" value={status.qms_credentials.user_id} revealable={false} />
                <CredentialField label="PIN/Password" value={status.qms_credentials.pin_password} />
              </dl>
            </div>
            <div>
              <h3 className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                Pin Pad Credentials
              </h3>
              <dl className="flex flex-col gap-3 text-sm">
                <CredentialField
                  label="Pinpad User ID"
                  value={status.pinpad_credentials.pinpad_user_id}
                  revealable={false}
                />
                <CredentialField label="QSS API Pin" value={status.pinpad_credentials.qss_api_pin} />
              </dl>
            </div>
          </div>
        </section>

        {/* Confirmed per-facility, not per-company (2026-09-03) -- Prairie
            Enterprises' 3 real facilities each answered these differently
            on their own separate New Merchant Account runs, so there is no
            single company-wide figure to show on the Company page instead. */}
        <DetailSection
          title="Financials"
          fields={[
            { label: "EIN", value: status.financials.ein },
            { label: "Bank Routing Number", value: status.financials.bank_routing_number_masked },
            { label: "Bank Account Number", value: status.financials.bank_account_number_masked },
            { label: "Total Annual Business Revenue", value: status.financials.total_annual_business_revenue_raw },
            { label: "Total Monthly Sales", value: status.financials.total_monthly_sales_raw },
            { label: "Offers ACH", value: status.financials.offers_ach_raw },
            {
              label: "Annual Electronic Check (ACH) Volume",
              value: status.financials.annual_electronic_check_volume_raw,
            },
            {
              label: "Average Electronic Check Amount",
              value: status.financials.average_electronic_check_amount_raw,
            },
            {
              label: "Maximum Electronic Check Amount",
              value: status.financials.maximum_electronic_check_amount_raw,
            },
            {
              label: "Average Credit Card Payment Amount",
              value: status.financials.average_credit_card_payment_amount_raw,
            },
            {
              label: "Highest Credit Card Payment Amount",
              value: status.financials.highest_credit_card_payment_amount_raw,
            },
            {
              label: "# Times Per Year for the High CC Payment",
              value: status.financials.high_cc_payment_times_per_year_raw,
            },
          ]}
        />

        <section className="rounded border border-slate-800 p-5">
          <h2 className="mb-4 text-lg font-semibold">Owner(s) / Signer</h2>
          {status.parties.length === 0 ? (
            <p className="text-sm text-slate-500">None on file.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {status.parties.map((party, index) => (
                <PartyCard key={index} party={party} badge={party.party_role} />
              ))}
            </div>
          )}
        </section>
      </div>
  );
}
