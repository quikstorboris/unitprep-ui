import { DropboxLogo } from "../icons/DropboxLogo";
import { dropboxFolderWebUrl, dropboxParentFolder } from "@/lib/dropbox";

interface DropboxSaveActionProps {
  /** `null`/`undefined` once saved -- there's nothing left to click,
   * `DedupSaveAction` renders the "Open Destination Folder" link
   * instead. `null` before a save location is even known (e.g. a
   * locally-uploaded session) hides the whole action. */
  defaultFolderPath: string | null | undefined;
  savedPath: string | null;
  saving: boolean;
  onSave: () => void;
  /** Padding classes only -- lets each call site match its own sibling
   * buttons' size (the Export Format panel's own buttons are bigger
   * than Download Again/Home's). */
  sizeClassName: string;
}

/**
 * One-click "Save to Facility Folder" -> "Open Destination Folder" pair,
 * shared between the pre- and post-local-download panels below (saving
 * to Dropbox is independent of downloading locally -- a user may want
 * both, so this must stay available in either state, not disappear once
 * `downloadComplete`).
 */
export default function DropboxSaveAction({
  defaultFolderPath,
  savedPath,
  saving,
  onSave,
  sizeClassName,
}: DropboxSaveActionProps) {
  if (savedPath) {
    return (
      <a
        href={dropboxFolderWebUrl(dropboxParentFolder(savedPath))}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-2 rounded bg-[#0061FF] text-sm font-medium text-white transition-colors hover:bg-[#0050d1] ${sizeClassName}`}
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
      disabled={saving}
      className={`inline-flex items-center gap-2 rounded bg-blue-600 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50 ${sizeClassName}`}
    >
      <DropboxLogo className="h-4 w-4" />
      {saving ? "Saving…" : "Save to Facility Folder"}
    </button>
  );
}
