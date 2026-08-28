import { API_URL, describeFetchError, errorMessageFrom } from "@/lib/api";

/**
 * Dropbox-folder-browsing API calls (`/dropbox/*`) -- kept in its own
 * module rather than folded into `lib/clientOps.ts`, mirroring the
 * backend's own split of `src/dropbox` from `client_ops` (see that
 * module's doc comment). Same small per-domain fetch-helper shape as
 * `clientOps.ts` -- GET only, so no method parameter needed here.
 */
async function tryDropboxFetch<T>(
  path: string
): Promise<DropboxResult<T>> {
  try {
    const response = await fetch(`${API_URL}${path}`, {
      credentials: "include",
    });

    if (response.status === 401) {
      return { kind: "unauthorized", message: await errorMessageFrom(response) };
    }

    if (!response.ok) {
      return { kind: "error", message: await errorMessageFrom(response) };
    }

    return { kind: "ok", data: (await response.json()) as T };
  } catch (err) {
    return { kind: "error", message: describeFetchError(err) };
  }
}

/** Same shape/reasoning as `lib/clientOps.ts`'s `ClientOpsResult`. */
export type DropboxResult<T> =
  | { kind: "ok"; data: T }
  | { kind: "unauthorized"; message: string }
  | { kind: "error"; message: string };

/** Mirrors `FolderEntry` in `unitprep-api`'s `api::dropbox_browse`. */
export interface DropboxEntry {
  name: string;
  path_display: string;
  is_folder: boolean;
}

/** Mirrors `ListFolderResponse` in the same file. */
export interface DropboxListFolderResult {
  path: string;
  entries: DropboxEntry[];
}

/**
 * Lists one Dropbox folder. Omit `path` for the configured root (the
 * QMS Onboarding folder) -- what a folder picker's first render wants.
 * The backend enforces every path stays under that root; this never
 * needs to duplicate that check client-side.
 *
 * `includeFiles` defaults to folders-only (the client-setup picker's
 * need) -- pass `true` for a file-picker use case like Dedup's "Import
 * from Dropbox", which needs to see and select files too.
 */
export async function listDropboxFolder(
  path?: string,
  includeFiles?: boolean
): Promise<DropboxResult<DropboxListFolderResult>> {
  const params = new URLSearchParams();
  if (path) params.set("path", path);
  if (includeFiles) params.set("include_files", "true");

  const query = params.toString();

  return tryDropboxFetch(`/dropbox/list${query ? `?${query}` : ""}`);
}

/** Mirrors `SearchFoldersResponse` in `unitprep-api`'s `api::dropbox_browse`. */
export interface DropboxSearchResult {
  entries: DropboxEntry[];
}

/**
 * Searches folder names recursively under the configured root -- e.g. a
 * facility name alone finds it even without knowing which client it
 * belongs to. Backend-filtered to folders only; a query under 2
 * characters always comes back empty rather than erroring (matches the
 * backend's own guard, kept here too so a caller doesn't need to
 * duplicate the length check to avoid firing it needlessly).
 */
export async function searchDropboxFolders(
  query: string
): Promise<DropboxResult<DropboxSearchResult>> {
  if (query.trim().length < 2) {
    return { kind: "ok", data: { entries: [] } };
  }

  return tryDropboxFetch(`/dropbox/search?q=${encodeURIComponent(query.trim())}`);
}
