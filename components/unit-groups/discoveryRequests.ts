import { API_URL, errorMessageFrom } from "@/lib/api";
import type { DiscoverResponse, UploadResponse } from "@/types/api";

// Extensions the backend can actually parse — keep in sync with
// `parse_document`'s dispatch in
// unitprep-api/src/application/session_service.rs. Filtering here isn't
// just a UX nicety: uploading hundreds of files the backend will just
// reject is what caused the original multipart/XLSX upload failure this
// filter was first added to work around (see project history) — so
// files outside this list are still dropped before upload, only now the
// list matches what the backend actually supports instead of being
// stuck at CSV-only from that workaround.
const SUPPORTED_EXTENSIONS = [".csv", ".xlsx", ".xls"];

function isSupportedFile(file: File): boolean {
  const name = file.name.toLowerCase();

  return SUPPORTED_EXTENSIONS.some((ext) => name.endsWith(ext));
}

/** An upload's server answer plus how many files this attempt offered
 * up, for the integrity-check comparison. */
export interface UploadResult {
  uploadData: UploadResponse;
  filesSelectedCount: number;
}

/** Imports a whole Dropbox folder. A Dropbox import only learns how
 * many files it offered from the response itself (the folder's own
 * contents aren't known client-side beforehand). */
export async function uploadDropboxFolder(
  path: string,
  signal: AbortSignal
): Promise<UploadResult> {
  const response = await fetch(`${API_URL}/upload-dropbox`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
    signal,
  });

  if (!response.ok) {
    throw new Error(await errorMessageFrom(response));
  }

  const uploadData: UploadResponse = await response.json();
  return {
    uploadData,
    filesSelectedCount: uploadData.files_uploaded + uploadData.files_failed,
  };
}

/** Uploads a local folder selection, dropping files the backend can't
 * parse. A local upload knows its count before the request goes out
 * (the filtered file list). */
export async function uploadLocalFiles(
  files: FileList,
  signal: AbortSignal
): Promise<UploadResult> {
  const formData = new FormData();

  const supportedFiles = Array.from(files).filter(isSupportedFile);

  supportedFiles.forEach((file) => {
    formData.append("files", file, file.webkitRelativePath || file.name);
  });

  // A sidecar field carrying each file's `lastModified` alongside the
  // upload — standard multipart file parts have no metadata slot
  // beyond filename/content-type, so this rides as one extra JSON
  // field instead. Matched back to each file server-side by the same
  // name used as its part's filename above. Used to help a user pick
  // the right file when a folder contains more than one candidate
  // unit list (e.g. several dated re-pulls of the same facility).
  formData.append(
    "file_modified_times",
    JSON.stringify(
      supportedFiles.map((file) => [
        file.webkitRelativePath || file.name,
        file.lastModified,
      ])
    )
  );

  const response = await fetch(`${API_URL}/upload`, {
    method: "POST",
    // The API is a different origin (different port), so cookies
    // are withheld unless this is explicit -- without it, every
    // request looks signed-out regardless of a valid session.
    credentials: "include",
    body: formData,
    signal,
  });

  if (!response.ok) {
    throw new Error(await errorMessageFrom(response));
  }

  const uploadData: UploadResponse = await response.json();
  return { uploadData, filesSelectedCount: supportedFiles.length };
}

export async function discoverSession(
  sessionId: string,
  signal: AbortSignal
): Promise<DiscoverResponse> {
  const response = await fetch(`${API_URL}/discover`, {
    method: "POST",
    // Same cross-origin cookie requirement as the upload above.
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
    signal,
  });

  if (!response.ok) {
    throw new Error(await errorMessageFrom(response));
  }

  return response.json();
}
