"use client";

import { useState } from "react";

import { DropboxFolderPicker } from "@/components/clients/DropboxFolderPicker";
import { DropboxLogo } from "@/components/icons/DropboxLogo";
import type { Client } from "@/lib/clients";
import { getFacilityDropboxFolder } from "@/lib/dropbox";

interface SourceFolderSectionProps {
  clientId: string;
  client: Client | undefined;
  selectedFiles: FileList | null;
  dropboxPath: string | null;
  sessionId: string;
  loading: boolean;
  onFileSelection: (files: FileList | null) => void;
  onDropboxPathSelected: (path: string) => void;
  onDiscover: () => void;
}

/**
 * DiscoveryPage's own "Select Source Folder" box -- either a native
 * folder picker or a Dropbox folder browse, per-facility. Owns its own
 * "which facility, and what's its Dropbox folder" lookup state, since
 * nothing outside this section needs it -- `dropboxPath` itself (the
 * actual selection) is still controlled by the parent, same as before.
 */
export function SourceFolderSection({
  clientId,
  client,
  selectedFiles,
  dropboxPath,
  sessionId,
  loading,
  onFileSelection,
  onDropboxPathSelected,
  onDiscover,
}: SourceFolderSectionProps) {
  // Which of this client's own facilities to browse from -- same
  // reasoning as DedupUploadPage's own facility dropdown: a company can
  // have several facilities, each with its own real Dropbox folder.
  const [selectedFacility, setSelectedFacility] = useState<string | null>(null);
  const [facilityDropboxPath, setFacilityDropboxPath] = useState<string | null | undefined>(undefined);

  const handleFacilitySelected = async (facilityName: string) => {
    setSelectedFacility(facilityName || null);
    setFacilityDropboxPath(undefined);

    if (!facilityName || !clientId) return;

    const result = await getFacilityDropboxFolder(clientId, facilityName);
    setFacilityDropboxPath(result.kind === "ok" ? result.data.path : null);
  };

  return (
    <div className="rounded border border-slate-700 p-6">
      <input
        id="unitprep-folder-picker"
        type="file"
        multiple
        webkitdirectory=""
        className="hidden"
        onChange={(e) => onFileSelection(e.target.files)}
      />

      <label
        htmlFor="unitprep-folder-picker"
        className="inline-block cursor-pointer rounded bg-slate-700 px-4 py-2 transition-colors hover:bg-slate-600"
      >
        Select Folder
      </label>

      <div className="mt-4 text-sm text-slate-300">
        {/* Raw folder-picker count, before filtering to supported
            extensions — deliberately labeled differently from the
            "Files Selected" stat below (which is the filtered,
            actually-uploaded count), so a folder with lots of
            non-data files doesn't read as files going missing. */}
        Files Found in Folder: <strong>{selectedFiles ? selectedFiles.length : 0}</strong>
      </div>

      {selectedFiles && selectedFiles.length > 0 && (
        <div className="mt-2 text-sm text-slate-400">Folder contents loaded and ready for upload.</div>
      )}

      {sessionId && <div className="mt-2 text-sm text-green-400">Session Created</div>}

      <div className="mt-6 border-t border-slate-800 pt-4">
        <div className="mb-2 flex items-center gap-2 text-sm text-slate-400">
          <DropboxLogo className="h-4 w-4 text-blue-400" />
          Or import a folder from Dropbox
        </div>

        {client && client.facilityNames.length > 0 && (
          <div className="mb-3">
            <label className="mb-1 block text-xs text-slate-400">Which facility?</label>
            <select
              value={selectedFacility ?? ""}
              onChange={(e) => void handleFacilitySelected(e.target.value)}
              className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            >
              <option value="">Select a facility…</option>
              {client.facilityNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedFacility && facilityDropboxPath === undefined ? (
          // Waiting on the facility's own Dropbox folder to resolve --
          // rendering the picker already would open it at the root
          // for a moment (a real, visible flash confirmed live
          // 2026-09-04) before the real default arrives and corrects
          // it. Not rendering the picker at all until the answer is
          // in hand avoids that instead of just shortening it.
          <div className="text-sm text-slate-400">Locating this facility&apos;s Dropbox folder…</div>
        ) : (
          <DropboxFolderPicker
            value={dropboxPath ?? ""}
            mode="select-folder"
            // A folder-mode picker never lists files by default (the
            // client-setup picker's own need) -- but a manager
            // importing a whole folder's worth of files needs to
            // actually see them to confirm they're in the right
            // place, not just navigate blind past folders.
            showFiles
            initialPath={facilityDropboxPath ?? client?.dropboxPath}
            onChange={onDropboxPathSelected}
          />
        )}
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          onClick={onDiscover}
          disabled={loading || (!dropboxPath && (!selectedFiles || selectedFiles.length === 0))}
          className="rounded bg-blue-600 px-4 py-2 disabled:opacity-50"
        >
          {loading ? "Uploading & Discovering..." : "Discover"}
        </button>
      </div>
    </div>
  );
}
