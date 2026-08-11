import type { TaggerCheckResponse } from "@/types/api";

/**
 * Bridges a tagger check response from TaggerUploadPage (which already
 * has it, as part of POST /tagger/check's response) across the client-
 * side navigation to /clients/[clientId]/template-tagger/[sessionId],
 * whose page mounts fresh and would otherwise re-fetch the identical
 * candidate list via POST /tagger/report a moment later. Mirrors
 * dedupReportCache.ts exactly, including its single-slot, single-use
 * (read-and-clear) shape and the reasoning for it.
 */
let pending: {
  sessionId: string;
  response: TaggerCheckResponse;
} | null = null;

export function stashTaggerCheck(
  response: TaggerCheckResponse
): void {
  pending = { sessionId: response.session_id, response };
}

/**
 * Read-and-clear. Returns `undefined` on a miss — no response staged,
 * or staged for a different sessionId (e.g. a direct navigation/refresh
 * that never went through TaggerUploadPage at all).
 */
export function takeTaggerCheck(
  sessionId: string
): TaggerCheckResponse | undefined {
  if (pending?.sessionId !== sessionId) {
    return undefined;
  }

  const { response } = pending;
  pending = null;
  return response;
}
