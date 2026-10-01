"use client";

import { DropboxFolderPicker } from "@/components/clients/DropboxFolderPicker";
import type { DedupSource } from "@/components/dedup/useDedupFolderScan";
import { useFacilityDropboxFolder } from "@/components/dedup/useFacilityDropboxFolder";
import { DropboxLogo } from "@/components/icons/DropboxLogo";

interface DedupSourcePickerProps {
  clientId: string;
  facilityId: string;
  source: DedupSource | null;
  localFileCount: number;
  dropboxFolder: string | null;
  disabled: boolean;
  onLocalPick: (files: FileList | null) => void;
  onDropboxFolderPick: (path: string) => void;
}

const BUTTON_CLASS =
  "inline-block cursor-pointer rounded bg-slate-700 px-4 py-2 transition-colors hover:bg-slate-600";

/**
 * "Where are the export files?" -- a local folder, individual local
 * files, or a Dropbox folder (per-facility). The pick itself is
 * controlled by the parent; this owns only the facility/Dropbox-default
 * lookup state nothing else needs.
 */
export function DedupSourcePicker({
  clientId,
  facilityId,
  source,
  localFileCount,
  dropboxFolder,
  disabled,
  onLocalPick,
  onDropboxFolderPick,
}: DedupSourcePickerProps) {
  const { client, facilityNames, selectedFacility, facilityDropboxPath, selectFacility } =
    useFacilityDropboxFolder(clientId, facilityId);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          id="dedup-folder-picker"
          type="file"
          multiple
          webkitdirectory=""
          className="hidden"
          disabled={disabled}
          onChange={(e) => onLocalPick(e.target.files)}
        />
        <label htmlFor="dedup-folder-picker" className={BUTTON_CLASS}>
          Select Folder
        </label>

        <input
          id="dedup-files-picker"
          type="file"
          multiple
          accept=".csv,.xlsx,.xls"
          className="hidden"
          disabled={disabled}
          onChange={(e) => onLocalPick(e.target.files)}
        />
        <label htmlFor="dedup-files-picker" className={BUTTON_CLASS}>
          Select Files
        </label>
      </div>

      <div className="mt-4 text-sm text-slate-300">
        Source:{" "}
        <strong>
          {source === "local" && `${localFileCount} local file(s)`}
          {source === "dropbox" && `Dropbox folder ${dropboxFolder}`}
          {source === null && "None"}
        </strong>
      </div>

      <div className="mt-6 border-t border-slate-800 pt-4">
        <div className="mb-2 flex items-center gap-2 text-sm text-slate-400">
          <DropboxLogo className="h-4 w-4 text-blue-400" />
          Or import a folder from Dropbox
        </div>

        {facilityNames.length > 0 && (
          <div className="mb-3">
            <label htmlFor="dedup-facility" className="mb-1 block text-xs text-slate-400">
              Which facility?
            </label>
            <select
              id="dedup-facility"
              value={selectedFacility ?? ""}
              onChange={(e) => void selectFacility(e.target.value)}
              className="rounded border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            >
              <option value="">Select a facility…</option>
              {facilityNames.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        )}

        {selectedFacility && facilityDropboxPath === undefined ? (
          // Not rendering the picker until the facility's own folder
          // resolves avoids a visible flash at the Dropbox root before
          // the real default arrives and corrects it.
          <div className="text-sm text-slate-400">
            Locating this facility&apos;s Dropbox folder…
          </div>
        ) : (
          <DropboxFolderPicker
            value={dropboxFolder ?? ""}
            mode="select-folder"
            // Folder mode lists no files by default -- but picking a
            // whole folder blind is error-prone; show its files so the
            // user can confirm it's the right place.
            showFiles
            initialPath={facilityDropboxPath ?? client?.dropboxPath}
            onChange={onDropboxFolderPick}
          />
        )}
      </div>
    </div>
  );
}
