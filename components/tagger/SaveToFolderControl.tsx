"use client";

import { DropboxLogo } from "../icons/DropboxLogo";
import { dropboxFolderWebUrl, dropboxParentFolder } from "@/lib/dropbox";

/**
 * "Save to Facility Folder" before a save, "Open Destination Folder"
 * after one; nothing when the facility has no default folder. Shown in
 * two places (the action bar and the downloaded state) that differ only
 * in `sizeClassName`.
 */
export default function SaveToFolderControl({
  savedPath,
  defaultFolderPath,
  saving,
  disabled,
  onSave,
  sizeClassName,
}: {
  savedPath: string | null;
  defaultFolderPath: string | null | undefined;
  saving: boolean;
  disabled: boolean;
  onSave: () => void;
  sizeClassName: string;
}) {
  if (savedPath) {
    return (
      <a
        href={dropboxFolderWebUrl(dropboxParentFolder(savedPath))}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-2 rounded bg-[#0061FF] ${sizeClassName} text-sm font-medium text-white transition-colors hover:bg-[#0050d1]`}
      >
        <DropboxLogo className="h-4 w-4" />
        Open Destination Folder
      </a>
    );
  }

  if (!defaultFolderPath) return null;

  return (
    <button
      type="button"
      onClick={onSave}
      disabled={saving || disabled}
      className={`inline-flex items-center gap-2 rounded bg-blue-600 ${sizeClassName} text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50`}
    >
      <DropboxLogo className="h-4 w-4" />
      {saving ? "Saving…" : "Save to Facility Folder"}
    </button>
  );
}
