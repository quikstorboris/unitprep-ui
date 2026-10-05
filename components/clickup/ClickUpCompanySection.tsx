"use client";

import { useEffect, useState } from "react";

import { useCompanyDetail } from "@/components/clients/CompanyDetailContext";
import { prefetchClickUpHierarchy, unlinkCompanyClickUp } from "@/lib/clickupLinks";
import ClickUpLinkDot from "./ClickUpLinkDot";
import LinkClickUpDialog from "./LinkClickUpDialog";
import { useClickUpAccess } from "./useClickUpAccess";

const buttonClass =
  "rounded border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50";
const dangerButtonClass =
  "rounded bg-red-900 px-3 py-1.5 text-sm font-medium text-red-100 transition-colors hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50";
const linkButtonClass = "text-sm text-slate-400 transition-colors hover:text-slate-200 hover:underline";

/**
 * The Company page's ClickUp card: each facility's ClickUp list (opens
 * in ClickUp), plus the **Link ClickUp** button that matches the
 * company's facilities to their lists and **Unlink All Facilities**.
 *
 * The buttons need the per-user ClickUp permission; the list of links is
 * shown to anyone while at least one exists (it is just a navigation
 * aid). A company with nothing linked and a viewer without ClickUp shows
 * nothing at all rather than a card they can do nothing with.
 */
export default function ClickUpCompanySection({
  companyId,
  companyName,
}: {
  companyId: string;
  companyName: string;
}) {
  const { company, refetch } = useCompanyDetail();
  const access = useClickUpAccess();

  // Start loading ClickUp's folder/list hierarchy now, so the Link ClickUp
  // dialog opens without waiting for it.
  const clickUpAllowed = access.allowed;
  useEffect(() => {
    if (clickUpAllowed) void prefetchClickUpHierarchy();
  }, [clickUpAllowed]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmingUnlink, setConfirmingUnlink] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const facilities = company?.facilities ?? [];
  const linked = facilities.filter((facility) => facility.clickup_list_id);

  if (!access.allowed && linked.length === 0) return null;

  async function handleUnlinkAll() {
    setError(null);
    setNotice(null);
    setUnlinking(true);
    const result = await unlinkCompanyClickUp(companyId);
    setUnlinking(false);
    setConfirmingUnlink(false);

    if (result.kind !== "ok") {
      setError(result.message);
      return;
    }

    setNotice(
      result.data.unlinked === 1
        ? "Unlinked 1 facility."
        : `Unlinked ${result.data.unlinked} facilities.`
    );
    refetch();
  }

  return (
    <section className="rounded border border-slate-800 p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">ClickUp</h2>

        {access.allowed && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setNotice(null);
                setDialogOpen(true);
              }}
              disabled={facilities.length === 0}
              className={buttonClass}
            >
              Link ClickUp
            </button>

            {linked.length > 0 && !confirmingUnlink && (
              <button type="button" onClick={() => setConfirmingUnlink(true)} className={buttonClass}>
                Unlink All Facilities
              </button>
            )}

            {linked.length > 0 && confirmingUnlink && (
              <span className="flex items-center gap-2">
                <span className="text-xs text-slate-400">
                  Removes the link from all {linked.length}{" "}
                  {linked.length === 1 ? "facility" : "facilities"} — sure?
                </span>
                <button
                  type="button"
                  disabled={unlinking}
                  onClick={handleUnlinkAll}
                  className={dangerButtonClass}
                >
                  {unlinking ? "Unlinking…" : "Yes, unlink all"}
                </button>
                <button type="button" onClick={() => setConfirmingUnlink(false)} className={linkButtonClass}>
                  Cancel
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="mb-3 text-sm text-red-400">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mb-3 text-sm text-green-400">
          {notice}
        </p>
      )}

      {linked.length === 0 ? (
        <p className="text-sm text-slate-500">
          None of this company&apos;s facilities are linked to a ClickUp list yet.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {facilities.map((facility) => (
            <div key={facility.id} className="flex items-center justify-between gap-3">
              <span className="min-w-0 flex-1 truncate text-sm text-slate-400">{facility.name}</span>
              {facility.clickup_list_id && facility.clickup_list_url ? (
                <span className="flex min-w-0 items-center gap-2">
                  <ClickUpLinkDot linked />
                  <a
                    href={facility.clickup_list_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-sm text-[#9c8cff] hover:underline"
                  >
                    {facility.clickup_list_name ?? "Open in ClickUp"}
                  </a>
                </span>
              ) : (
                <span className="flex items-center gap-2 text-sm text-slate-500">
                  <ClickUpLinkDot linked={false} />
                  Not linked
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {dialogOpen && (
        <LinkClickUpDialog
          companyId={companyId}
          companyName={companyName}
          onClose={() => setDialogOpen(false)}
          onSaved={() => {
            setDialogOpen(false);
            refetch();
          }}
        />
      )}
    </section>
  );
}
