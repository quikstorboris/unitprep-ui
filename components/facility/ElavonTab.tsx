"use client";

import { useEffect, useState } from "react";

import { useCompanyDetail } from "@/components/clients/CompanyDetailContext";
import DetailSection from "@/components/clients/DetailSection";
import PartyCard from "@/components/clients/PartyCard";
import {
  getFacilityElavon,
  linkFacilityElavon,
  resyncElavonData,
  unlinkFacilityElavon,
  type ElavonStatus,
} from "@/lib/clientsDetail";
import { formatDateOnly } from "@/lib/format";

/** Fixed-width placeholder for a masked credential -- deliberately not
 * shaped to the real value's length (unlike `PartyCard`'s SSN mask,
 * which has one fixed real-world shape), so the masked state never
 * hints at how long the underlying PIN/Password actually is. */
const MASKED_CREDENTIAL = "••••••••••••";

/**
 * One QMS/pinpad credential row, with the same "revealable on demand"
 * Show/Hide toggle `PartyCard`'s own SSN field uses -- for the two
 * genuine secrets (PIN/Password, QSS API Pin). `revealable={false}`
 * (Account ID, User ID, Pinpad User ID) skips the toggle entirely and
 * just shows the value plainly, same as any other `DetailSection` field.
 */
function CredentialField({
  label,
  value,
  revealable = true,
}: {
  label: string;
  value: string | null;
  revealable?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="flex flex-col gap-1">
      <dt className="text-slate-400">{label}</dt>
      <dd className="flex items-center gap-2 break-all">
        {!value ? (
          "—"
        ) : !revealable ? (
          <span>{value}</span>
        ) : (
          <>
            <span>{revealed ? value : MASKED_CREDENTIAL}</span>
            <button
              type="button"
              onClick={() => setRevealed((prev) => !prev)}
              className="shrink-0 text-xs text-blue-400 hover:underline"
            >
              {revealed ? "Hide" : "Show"}
            </button>
          </>
        )}
      </dd>
    </div>
  );
}

/**
 * Elavon tab -- Phase 4 item 5. Fetched on its own, lazily, only once
 * this tab is actually selected (not alongside General/Facility
 * Policies on every facility switch) -- it's the least-visited tab day
 * to day, and eagerly fetching it on every click would work against
 * the same pool-exhaustion latency fix this page just got (see
 * `unitprep-api`'s `db.rs` doc comment).
 */
export function ElavonTab({ companyId, facilityId }: { companyId: string; facilityId: string }) {
  // So a newly-linked facility's Elavon/Owner data shows up on the
  // Company page too without a full reload -- that page's own
  // `elavon_active`/`owners` are computed across the company's
  // facilities, and its data only comes from `CompanyDetailProvider`
  // (fetched once per company, see that module's own doc comment).
  const { refetch: refetchCompany } = useCompanyDetail();

  const [status, setStatus] = useState<ElavonStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [manualRunId, setManualRunId] = useState("");
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [confirmingUnlink, setConfirmingUnlink] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [unlinkError, setUnlinkError] = useState<string | null>(null);
  const [resyncing, setResyncing] = useState(false);
  const [resyncError, setResyncError] = useState<string | null>(null);

  async function load() {
    const result = await getFacilityElavon(companyId, facilityId);
    if (result.kind !== "ok") {
      setLoadError(result.message);
      return;
    }
    setLoadError(null);
    setStatus(result.data);
  }

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(async () => {
      if (cancelled) return;
      setStatus(null);
      setLoadError(null);
      setLinkError(null);
      setManualRunId("");
      setConfirmingUnlink(false);
      setUnlinkError(null);
      setResyncError(null);
      await load();
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `load` is stable in shape; only re-run on facility change
  }, [companyId, facilityId]);

  async function handleLink(runId: string) {
    const trimmed = runId.trim();
    if (!trimmed) return;

    setLinking(true);
    setLinkError(null);

    const result = await linkFacilityElavon(companyId, facilityId, trimmed);

    setLinking(false);

    if (result.kind !== "ok") {
      setLinkError(result.message);
      return;
    }

    await load();
    refetchCompany();
  }

  async function handleUnlink() {
    setUnlinking(true);
    setUnlinkError(null);

    const result = await unlinkFacilityElavon(companyId, facilityId);

    setUnlinking(false);

    if (result.kind !== "ok") {
      setUnlinkError(result.message);
      return;
    }

    setConfirmingUnlink(false);
    await load();
    refetchCompany();
  }

  async function handleResync() {
    setResyncing(true);
    setResyncError(null);

    const result = await resyncElavonData(companyId, facilityId);

    setResyncing(false);

    if (result.kind !== "ok") {
      setResyncError(result.message);
      return;
    }

    await load();
    refetchCompany();
  }

  if (loadError) {
    return (
      <p role="alert" className="text-sm text-red-400">
        {loadError}
      </p>
    );
  }

  if (!status) {
    return <p className="text-sm text-slate-400">Loading…</p>;
  }

  if (status.status === "linked") {
    return (
      <div className="flex flex-col gap-6">
        <DetailSection
          title="Elavon"
          action={
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResync}
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
                    onClick={handleUnlink}
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

  // Unlinked -- a single suggested candidate, several ambiguous ones
  // (a real duplicate submission on the PS side -- see the backend's
  // own module doc), or nothing; any of the three still ends with
  // manual entry below.
  return (
    <div className="flex flex-col gap-6">
      {status.candidate ? (
        <section className="rounded border border-amber-800 bg-amber-950/10 p-5">
          <h2 className="mb-2 text-lg font-semibold">New Merchant Account Flow Found</h2>
          <p className="mb-4 text-sm text-slate-300">
            <a
              href={`https://app.process.st/runs/${status.candidate.merchant_account_run_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-400 hover:underline"
            >
              {status.candidate.run_name}
            </a>
            <br />
            <span className="text-slate-500">Process Street run ID: {status.candidate.merchant_account_run_id}</span>
          </p>
          <p className="mb-4 text-sm text-slate-400">
            Click through and confirm it&apos;s the right one before linking -- this isn&apos;t confirmed
            automatically.
          </p>
          <button
            type="button"
            onClick={() => handleLink(status.candidate!.merchant_account_run_id)}
            disabled={linking}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700"
          >
            {linking ? "Linking…" : "Confirm this link"}
          </button>
        </section>
      ) : status.ambiguous_candidates.length > 0 ? (
        <section className="rounded border border-amber-800 bg-amber-950/10 p-5">
          <h2 className="mb-2 text-lg font-semibold">Multiple Possible Matches Found</h2>
          <p className="mb-4 text-sm text-slate-400">
            More than one Merchant Account run&apos;s name matches this facility -- likely a duplicate submission in
            Process Street. Click through each to confirm which is the right one before linking.
          </p>
          <div className="flex flex-col gap-3">
            {status.ambiguous_candidates.map((candidate) => (
              <div
                key={candidate.merchant_account_run_id}
                className="flex items-center justify-between gap-3 rounded border border-slate-800 p-3"
              >
                <div className="text-sm">
                  <a
                    href={`https://app.process.st/runs/${candidate.merchant_account_run_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-400 hover:underline"
                  >
                    {candidate.run_name}
                  </a>
                  <div className="text-slate-500">
                    {candidate.merchant_account_run_id} · updated {formatDateOnly(candidate.updated_at)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleLink(candidate.merchant_account_run_id)}
                  disabled={linking}
                  className="shrink-0 rounded border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-100 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {linking ? "Linking…" : "Link this one"}
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <p className="text-sm text-slate-500">
          No Merchant Account run automatically matched to this facility. If you know its Process Street run ID,
          enter it below to link it manually.
        </p>
      )}

      <section className="rounded border border-slate-800 p-5">
        <h2 className="mb-4 text-lg font-semibold">Link Manually</h2>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={manualRunId}
            onChange={(e) => setManualRunId(e.target.value)}
            placeholder="Process Street run ID"
            className="flex-1 rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          />
          <button
            type="button"
            onClick={() => handleLink(manualRunId)}
            disabled={linking || !manualRunId.trim()}
            className="rounded border border-slate-700 px-4 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {linking ? "Linking…" : "Link"}
          </button>
        </div>
        {linkError && (
          <p role="alert" className="mt-2 text-sm text-red-400">
            {linkError}
          </p>
        )}
      </section>
    </div>
  );
}
