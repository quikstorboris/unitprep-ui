"use client";

import { useState } from "react";

import { DropboxFolderPicker } from "@/components/clients/DropboxFolderPicker";
import { DropboxLogo } from "@/components/icons/DropboxLogo";
import { updateFacilityDropboxFolder } from "@/lib/clientsDetail";
import { dropboxFolderWebUrl } from "@/lib/dropbox";

/**
 * DropBox tab -- Phase 4 item 6, the last placeholder. Lets a manager
 * change (or link, for the first time) which Dropbox folder this
 * facility points to -- reuses the same `DropboxFolderPicker` every
 * other Dropbox-import flow in the app already uses. The Company
 * page's own "Go to DropBox" launchpad links stay put (Boris's own
 * call, 2026-09-04) -- this tab is only about changing the link, not
 * displaying it a second place.
 */
export function DropboxTab({
  companyId,
  facilityId,
  dropboxFolderUrl,
  onSaved,
}: {
  companyId: string;
  facilityId: string;
  dropboxFolderUrl: string | null;
  onSaved: () => Promise<void>;
}) {
  const [changing, setChanging] = useState(false);
  const [pickedPath, setPickedPath] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startChange() {
    setPickedPath("");
    setError(null);
    setChanging(true);
  }

  async function save() {
    if (pickedPath.trim() === "") return;

    setSaving(true);
    setError(null);

    const result = await updateFacilityDropboxFolder(companyId, facilityId, dropboxFolderWebUrl(pickedPath));

    setSaving(false);

    if (result.kind !== "ok") {
      setError(result.message);
      return;
    }

    setChanging(false);
    await onSaved();
  }

  return (
    <div className="rounded border border-slate-800 p-5">
      <h2 className="mb-4 text-lg font-semibold">DropBox</h2>

      {!changing ? (
        <div className="flex flex-col gap-4">
          {dropboxFolderUrl ? (
            <div className="flex flex-wrap items-center gap-3">
              <a
                href={dropboxFolderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-2 rounded bg-[#0061FF] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0050d1]"
              >
                <DropboxLogo className="h-4 w-4" />
                Go to DropBox
              </a>
              <button
                type="button"
                onClick={startChange}
                className="rounded border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
              >
                Change Folder
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-slate-500">No Dropbox folder linked for this facility yet.</p>
              <button
                type="button"
                onClick={startChange}
                className="w-fit rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
              >
                Link a Folder
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <DropboxFolderPicker value={pickedPath} mode="select-folder" onChange={setPickedPath} />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving || pickedPath.trim() === ""}
              className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setChanging(false)}
              disabled={saving}
              className="rounded border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
