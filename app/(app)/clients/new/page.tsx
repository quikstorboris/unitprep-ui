"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { OrchestratorLoader } from "@/components/OrchestratorLoader";
import { Spinner } from "@/components/Spinner";
import { CompanyFallbackBanner } from "@/components/clients-new/CompanyFallbackBanner";
import { CompanySection } from "@/components/clients-new/CompanySection";
import { FacilitySection } from "@/components/clients-new/FacilitySection";
import { hasAnyContactInfo } from "@/components/clients-new/clientsNewHelpers";
import { useClientsNewPreview } from "@/components/clients-new/useClientsNewPreview";
import type { PreviewRunSelection } from "@/lib/clientsImport";

export default function ClientsNewPage() {
  return (
    <Suspense
      fallback={
        <main className="p-8">
          <p className="text-sm text-slate-400">Loading…</p>
        </main>
      }
    >
      <ClientsNewPageInner />
    </Suspense>
  );
}

function ClientsNewPageInner() {
  const searchParams = useSearchParams();

  const selection: PreviewRunSelection[] = (() => {
    const raw = searchParams.get("selection");
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (entry): entry is PreviewRunSelection =>
          typeof entry?.run_id === "string" && typeof entry?.run_name === "string"
      );
    } catch {
      return [];
    }
  })();

  const {
    runs,
    loadError,
    editedCompany,
    editedFacilities,
    editing,
    setEditing,
    companyFallbackHandled,
    submitting,
    submitError,
    companySourceRun,
    peoplePool,
    updateCompanyField,
    updateFacilityField,
    togglePersonForFacility,
    addAllForRole,
    handleAcceptCompanyFallback,
    handleDismissCompanyFallback,
    handleCreate,
  } = useClientsNewPreview(selection);

  return (
    <main className="p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-2 flex items-center gap-3">
          <Link href="/clients/search" className="text-sm text-slate-400 hover:text-slate-200">
            ← Search
          </Link>
        </div>

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Review &amp; Create</h1>
            <p className="mt-2 text-sm text-slate-400">
              Every selected facility is imported as its own record under one Company below.
            </p>
          </div>

          {runs && runs.length > 0 && (
            <button
              type="button"
              onClick={() => setEditing((prev) => !prev)}
              className="rounded border border-slate-700 px-4 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-slate-800"
            >
              {editing ? "Done editing" : "Edit"}
            </button>
          )}
        </div>

        {selection.length === 0 && (
          <p className="text-sm text-slate-400">
            No facilities selected — go back to{" "}
            <Link href="/clients/search" className="text-blue-400 hover:underline">
              search
            </Link>{" "}
            and check at least one.
          </p>
        )}

        {selection.length > 0 && runs === null && !loadError && (
          <div className="mt-10">
            <OrchestratorLoader label="Fetching data from Process Street…" />
          </div>
        )}

        {loadError && (
          <p role="alert" className="text-sm text-red-400">
            {loadError}
          </p>
        )}

        {runs && editedCompany && (
          <div className="flex flex-col gap-6">
            {!companyFallbackHandled &&
              companySourceRun &&
              companySourceRun.is_first_time === true &&
              !hasAnyContactInfo(editedCompany) && (
                <CompanyFallbackBanner
                  companySourceRun={companySourceRun}
                  onAccept={handleAcceptCompanyFallback}
                  onDismiss={handleDismissCompanyFallback}
                />
              )}

            <CompanySection company={editedCompany} editing={editing} onFieldChange={updateCompanyField} />

            {runs.map((run) => (
              <FacilitySection
                key={run.run_id}
                run={run}
                editedFacility={editedFacilities[run.run_id]}
                editing={editing}
                peoplePool={peoplePool}
                onFieldChange={updateFacilityField}
                onTogglePerson={togglePersonForFacility}
                onAddAllForRole={addAllForRole}
              />
            ))}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCreate}
                disabled={submitting}
                className="flex items-center gap-2 rounded bg-blue-600 px-4 py-2 text-sm font-medium transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-700"
              >
                {submitting && <Spinner className="h-4 w-4" />}
                {submitting ? "Creating…" : "Create"}
              </button>
            </div>

            {submitError && (
              <p role="alert" className="text-sm text-red-400">
                {submitError}
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
