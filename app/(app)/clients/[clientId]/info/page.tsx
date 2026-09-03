"use client";

import { useParams } from "next/navigation";

import { useCompanyDetail } from "@/components/clients/CompanyDetailContext";
import DetailSection from "@/components/clients/DetailSection";
import FacilityRail from "@/components/clients/FacilityRail";
import FieldReferenceHelp from "@/components/clients/FieldReferenceHelp";
import PartyCard from "@/components/clients/PartyCard";
import ResyncButton from "@/components/clients/ResyncButton";
import { DropboxLogo } from "@/components/icons/DropboxLogo";

/**
 * Company page -- Phase 4's real Client record UI, sections 1-3 per the
 * vault's own design note: Company Information, Financial Information,
 * Owner(s) Information, plus the facility-selector rail. Display only
 * for now; the "global edit convention" (per-section Edit button,
 * everything editable except Elavon credentials) is real future work,
 * sequenced after read access exists to build against.
 *
 * **Two known gaps, both from the same root cause**: `ownership_type`
 * and the Elavon application's own richer financial fields aren't shown
 * here -- `clients.companies` has no persisted link to which Merchant
 * Account run informs a company (only its Intake source run is
 * tracked), so there's nothing to read those from yet at the company
 * level. Same limitation already noted on the sync engine's own
 * Intake-only refresh scope.
 */
export default function ClientInfoPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const { company, loadError } = useCompanyDetail();

  if (loadError) {
    return (
      <main className="p-8">
        <p role="alert" className="text-sm text-red-400">
          {loadError}
        </p>
      </main>
    );
  }

  if (!company) {
    return (
      <main className="p-8">
        <p className="text-sm text-slate-400">Loading…</p>
      </main>
    );
  }

  return (
    <main className="p-8">
      <div className="mx-auto flex max-w-5xl gap-8">
        <FacilityRail companyId={clientId} facilities={company.facilities} activeFacilityId={null} />

        <div className="flex flex-1 flex-col gap-6">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-2xl font-bold">{company.legal_name}</h1>
            <div className="flex items-center gap-2">
              <FieldReferenceHelp />
              <ResyncButton companyId={clientId} />
            </div>
          </div>

          {company.archived_at && (
            <p className="text-sm text-amber-400">
              Archived — unarchive from the Clients list to restore it there.
            </p>
          )}

          <DetailSection
            title="Company Information"
            fields={[
              { label: "Legal Name", value: company.legal_name },
              { label: "Email", value: company.corporate_email },
              { label: "Phone", value: company.corporate_phone },
              { label: "Street Address", value: company.corporate_address_street },
              { label: "City", value: company.corporate_address_city },
              { label: "State", value: company.corporate_address_state },
              { label: "ZIP", value: company.corporate_address_zip },
              { label: "Subdomain", value: company.subdomain },
            ]}
          />

          <DetailSection
            title="Financial Information"
            fields={[
              { label: "Elavon (Merchant Account)", value: company.elavon_active ? "Yes" : "No" },
              { label: "Accepted Payment Methods", value: company.accepted_payment_methods },
              { label: "Accounting Basis", value: company.accounting_basis },
              { label: "Payment Scheme", value: company.payment_scheme },
              { label: "Offers Tenant Insurance", value: company.offers_tenant_insurance_raw },
              { label: "Insurance Provider", value: company.insurance_provider },
            ]}
          />

          <section className="rounded border border-slate-800 p-5">
            <h2 className="mb-4 text-lg font-semibold">Dropbox</h2>
            {/* No company-level Dropbox field exists in the schema --
                Intake only ever captures this per facility -- so this is
                a list of each facility's own link, same pattern as
                Owner(s) Information below. */}
            {company.facilities.filter((f) => f.dropbox_folder_url).length === 0 ? (
              <p className="text-sm text-slate-500">No Dropbox folders on file for this company&apos;s facilities.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {company.facilities
                  .filter((f): f is typeof f & { dropbox_folder_url: string } => Boolean(f.dropbox_folder_url))
                  .map((facility) => (
                    <div key={facility.id} className="flex items-center gap-3">
                      <span className="w-40 shrink-0 truncate text-sm text-slate-400">{facility.name}</span>
                      <a
                        href={facility.dropbox_folder_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex w-fit items-center gap-2 rounded bg-[#0061FF] px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-[#0050d1]"
                      >
                        <DropboxLogo className="h-4 w-4" />
                        Go to DropBox
                      </a>
                    </div>
                  ))}
              </div>
            )}
          </section>

          <section className="rounded border border-slate-800 p-5">
            <h2 className="mb-4 text-lg font-semibold">Owner(s) Information</h2>
            {company.owners.length === 0 ? (
              <p className="text-sm text-slate-500">None on file.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {company.owners.map((owner, index) => (
                  <PartyCard
                    key={`${owner.facility_id}-${owner.party_role}-${index}`}
                    party={owner}
                    badge={`${owner.party_role} — ${owner.facility_name}`}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
