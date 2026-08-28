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
 */
export async function listDropboxFolder(
  path?: string
): Promise<DropboxResult<DropboxListFolderResult>> {
  const query = path ? `?path=${encodeURIComponent(path)}` : "";

  return tryDropboxFetch(`/dropbox/list${query}`);
}
