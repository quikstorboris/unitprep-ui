"use client";

import { useReducer, useRef } from "react";

import { describeFetchError } from "@/lib/api";
import { isAbortError, useAbortableOperation } from "@/lib/useAbortableOperation";
import type { DiscoverResponse, UploadSummary } from "@/types/api";

import { initialState, reducer } from "./discoveryFlowState";
import {
  discoverSession,
  uploadDropboxFolder,
  uploadLocalFiles,
} from "./discoveryRequests";

export interface UseDiscoveryFlowResult {
  selectedFiles: FileList | null;
  dropboxPath: string | null;
  sessionId: string;
  discovery: DiscoverResponse | null;
  uploadSummary: UploadSummary | null;
  loading: boolean;
  apiError: string | null;
  /** True once cancel() has fired for the upload/discover pipeline
   * currently (or most recently) in flight -- see useAbortableOperation. */
  cancelled: boolean;
  /** Milliseconds elapsed since the current/last handleDiscover() call
   * started -- covers both the upload and discover legs under one
   * timer, since the user sees them as a single "Uploading &
   * Discovering..." step. */
  elapsedMs: number;
  /** Aborts whichever request (upload or discover) is currently in
   * flight. A no-op if nothing is in flight. */
  cancel: () => void;
  handleFileSelection: (files: FileList | null) => void;
  handleDropboxPathSelected: (path: string) => void;
  handleDiscover: () => Promise<void>;
  handleDiscoveryUpdated: (discovery: DiscoverResponse) => void;
}

/**
 * Owns the upload -> discover pipeline's orchestration, independent of
 * routing/navigation concerns (those stay in the page component, which
 * calls `useRouter`/`useParams` and passes its own `onScan`/`onBack`/
 * `onSessionExpired` callbacks directly to `DiscoveryPage`). The state
 * machine lives in `discoveryFlowState.ts` and the requests in
 * `discoveryRequests.ts`. Matches the convention every other async flow
 * in this app already follows (useAnalysis, useDedupReport,
 * useExportDownload, useDedupExport) — this page was the one holdout
 * inlining its own reducer + fetch logic instead.
 */
export function useDiscoveryFlow(): UseDiscoveryFlowResult {
  const [state, dispatch] = useReducer(reducer, initialState);

  const {
    selectedFiles,
    dropboxPath,
    sessionId,
    discovery,
    uploadSummary,
    loading,
    apiError,
    cancelled,
  } = state;

  const { elapsedMs, start, finish, cancel } = useAbortableOperation();

  const handleFileSelection = (files: FileList | null) => {
    dispatch({ type: "files_selected", files });
  };

  const handleDropboxPathSelected = (path: string) => {
    dispatch({ type: "dropbox_path_selected", path });
  };

  // Guards a rapid double-invocation of handleDiscover (e.g. a second
  // click landing before React commits `loading: true` and the button's
  // own `disabled` prop actually takes effect) from firing two concurrent
  // upload/discover pipelines. A ref, not `loading` itself, because
  // `loading` is state -- it isn't updated synchronously within the same
  // tick a second call could arrive in, so checking it here wouldn't
  // reliably catch one. Mirrors useExportDownload's exportInFlight guard.
  const discoverInFlight = useRef(false);

  const handleDiscover = async () => {
    const hasLocalFiles = !!selectedFiles && selectedFiles.length > 0;

    if (!hasLocalFiles && !dropboxPath) {
      dispatch({
        type: "discover_failed",
        message: "Please select a folder before continuing.",
      });

      return;
    }

    if (discoverInFlight.current) return;
    discoverInFlight.current = true;

    // One AbortController for the whole pipeline -- upload, then
    // discover -- so a single cancel() (and a single elapsed-time
    // reading) covers both legs, matching how the UI presents them as
    // one "Uploading & Discovering..." step rather than two.
    const controller = start();

    try {
      dispatch({ type: "discover_started" });

      const { uploadData, filesSelectedCount } = dropboxPath
        ? await uploadDropboxFolder(dropboxPath, controller.signal)
        : await uploadLocalFiles(selectedFiles!, controller.signal);

      const integrityVerified =
        uploadData.files_failed === 0 &&
        uploadData.multipart_errors === 0 &&
        uploadData.files_uploaded === filesSelectedCount;

      dispatch({
        type: "upload_succeeded",
        sessionId: uploadData.session_id,
        uploadSummary: {
          files_selected: filesSelectedCount,
          files_uploaded: uploadData.files_uploaded,
          files_failed: uploadData.files_failed,
          multipart_errors: uploadData.multipart_errors,
          integrity_verified: integrityVerified,
        },
      });

      if (!integrityVerified) {
        // The uploadSummary panel just dispatched above already shows
        // the individual counts and a clear "Integrity Check Failed"
        // banner — throwing a second, redundant error here would just
        // duplicate that same fact as a wall of text. Halt the pipeline
        // (don't call /discover on a bad upload) without piling on.
        return;
      }

      const discoveryData = await discoverSession(
        uploadData.session_id,
        controller.signal
      );

      dispatch({ type: "discovery_succeeded", discovery: discoveryData });
    } catch (error) {
      if (isAbortError(error)) {
        dispatch({ type: "discover_cancelled" });
      } else {
        dispatch({
          type: "discover_failed",
          message: describeFetchError(error),
        });
      }
    } finally {
      dispatch({ type: "discover_finished" });
      discoverInFlight.current = false;
      finish();
    }
  };

  const handleDiscoveryUpdated = (discovery: DiscoverResponse) => {
    dispatch({ type: "discovery_succeeded", discovery });
  };

  return {
    selectedFiles,
    dropboxPath,
    sessionId,
    discovery,
    uploadSummary,
    loading,
    apiError,
    cancelled,
    elapsedMs,
    cancel,
    handleFileSelection,
    handleDropboxPathSelected,
    handleDiscover,
    handleDiscoveryUpdated,
  };
}
