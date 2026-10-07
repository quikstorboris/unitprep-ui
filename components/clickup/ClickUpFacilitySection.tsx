"use client";

import { useState } from "react";

import { useCompanyDetail } from "@/components/clients/CompanyDetailContext";
import type { FacilityDetail } from "@/lib/clientsDetail";
import { unlinkFacilityClickUp } from "@/lib/clickupLinks";
import ClickUpLinkDot from "./ClickUpLinkDot";
import CopyCommentsDialog from "./copy/CopyCommentsDialog";
import LinkClickUpDialog from "./LinkClickUpDialog";
import { useClickUpAccess } from "./useClickUpAccess";

const buttonClass =
  "rounded border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50";
const dangerButtonClass =
  "rounded bg-red-900 px-3 py-1.5 text-sm font-medium text-red-100 transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50";
const linkButtonClass = "text-sm text-slate-400 transition-colors hover:text-slate-200 hover:underline";

/**
 * The facility General tab's ClickUp block: a button that opens the
 * facility's ClickUp list, the red/green dot ("linked and usable by me"),
 * and -- for users with ClickUp -- **Change link** and **Unlink**.
 * Changing a link reuses the Company page's dialog scoped to this one
 * facility, so matching, the dropdown and "Link manually" behave the
 * same in both places.
 */
export default function ClickUpFacilitySection({
  facility,
  onChanged,
}: {
  facility: FacilityDetail;
  /** Called after a link is saved or removed, so the page reloads it. */
  onChanged: () => void;
}) {
  const { company, refetch } = useCompanyDetail();
  const access = useClickUpAccess();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [confirmingUnlink, setConfirmingUnlink] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const linked = Boolean(facility.clickup_list_id && facility.clickup_list_url);

  // Comments can be copied from any *other* facility with a list linked;
  // the company's designated parent is the default.
  const parentId = company?.clickup_parent_facility_id ?? null;
  const copySources = (company?.facilities ?? [])
    .filter((other) => other.id !== facility.id && other.clickup_list_id)
    .map((other) => ({ id: other.id, name: other.name }));

  // Nothing to show or do for a viewer without ClickUp on an unlinked
  // facility.
  if (!access.allowed && !linked) return null;

  function changed() {
    refetch();
    onChanged();
  }

  async function handleUnlink() {
    setError(null);
    setUnlinking(true);
    const result = await unlinkFacilityClickUp(facility.company_id, facility.id);
    setUnlinking(false);
    setConfirmingUnlink(false);

    if (result.kind !== "ok") {
      setError(result.message);
      return;
    }

    changed();
  }

  return (
    <section className="rounded border border-slate-800 p-5">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
        ClickUp
        <ClickUpLinkDot linked={linked} />
      </h2>

      {linked ? (
        <div className="flex flex-wrap items-center gap-3">
          <a
            href={facility.clickup_list_url ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-2 rounded bg-[#7B68EE] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#6a58d6]"
          >
            ClickUp
          </a>
          <span className="min-w-0 truncate text-sm text-slate-400">
            {facility.clickup_list_name}
            {facility.clickup_folder_name && ` · ${facility.clickup_folder_name}`}
          </span>
        </div>
      ) : (
        <p className="text-sm text-slate-500">Not linked to a ClickUp list.</p>
      )}

      {access.allowed && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setDialogOpen(true)} className={buttonClass}>
            {linked ? "Change link" : "Link ClickUp"}
          </button>

          {linked && copySources.length > 0 && (
            <button type="button" onClick={() => setCopyOpen(true)} className={buttonClass}>
              Copy comments…
            </button>
          )}

          {linked && !confirmingUnlink && (
            <button type="button" onClick={() => setConfirmingUnlink(true)} className={buttonClass}>
              Unlink
            </button>
          )}

          {linked && confirmingUnlink && (
            <span className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Remove this facility&apos;s ClickUp link — sure?</span>
              <button
                type="button"
                disabled={unlinking}
                onClick={handleUnlink}
                className={dangerButtonClass}
              >
                {unlinking ? "Unlinking…" : "Yes, unlink"}
              </button>
              <button type="button" onClick={() => setConfirmingUnlink(false)} className={linkButtonClass}>
                Cancel
              </button>
            </span>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}

      {copyOpen && (
        <CopyCommentsDialog
          companyId={facility.company_id}
          facilityId={facility.id}
          facilityName={facility.name}
          sources={copySources}
          defaultSourceId={
            copySources.some((source) => source.id === parentId) ? parentId : (copySources[0]?.id ?? null)
          }
          onClose={() => setCopyOpen(false)}
        />
      )}

      {dialogOpen && (
        <LinkClickUpDialog
          companyId={facility.company_id}
          companyName={company?.legal_name ?? facility.name}
          facilityIds={[facility.id]}
          onClose={() => setDialogOpen(false)}
          onSaved={() => {
            setDialogOpen(false);
            changed();
          }}
        />
      )}
    </section>
  );
}
