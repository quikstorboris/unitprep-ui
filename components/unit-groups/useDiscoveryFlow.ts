"use client";

import { useReducer, useRef } from "react";

import {
  API_URL,
  describeFetchError,
  errorMessageFrom,
} from "@/lib/api";
import type {
  DiscoverResponse,
  UploadResponse,
  UploadSummary,
} from "@/types/api";

// Extensions the backend can actually parse — keep in sync with
// `parse_document`'s dispatch in
// unitprep-api/src/application/session_service.rs. Filtering here isn't
// just a UX nicety: uploading hundreds of files the backend will just
// reject is what caused the original multipart/XLSX upload failure this
// filter was first added to work around (see project history) — so
// files outside this list are still dropped before upload, only now the
// list matches what the backend actually supports instead of being
// stuck at CSV-only from that workaround.
const SUPPORTED_EXTENSIONS = [
  ".csv",
  ".xlsx",
  ".xls",
];

function isSupportedFile(
  file: File
): boolean {
  const name =
    file.name.toLowerCase();

  return SUPPORTED_EXTENSIONS.some(
    (ext) => name.endsWith(ext)
  );
}

type State = {
  selectedFiles: FileList | null;
  sessionId: string;
  discovery: DiscoverResponse | null;
  uploadSummary: UploadSummary | null;
  loading: boolean;
  apiError: string | null;
};

const initialState: State = {
  selectedFiles: null,
  sessionId: "",
  discovery: null,
  uploadSummary: null,
  loading: false,
  apiError: null,
};

type Action =
  | { type: "files_selected"; files: FileList | null }
  | { type: "discover_started" }
  | {
      type: "upload_succeeded";
      sessionId: string;
      uploadSummary: UploadSummary;
    }
  | {
      type: "discovery_succeeded";
      discovery: DiscoverResponse;
    }
  | { type: "discover_failed"; message: string }
  | { type: "discover_finished" };

// One reducer instead of six independently-updated useState calls — the
// handful of transitions below (pick files, start discovering, upload
// lands, discovery lands, something failed, done) is what handleDiscover
// was already doing by chaining setX calls together; naming the
// transitions makes that state machine explicit instead of implicit.
function reducer(
  state: State,
  action: Action
): State {
  switch (action.type) {
    case "files_selected":
      return {
        ...state,
        selectedFiles: action.files,
        uploadSummary: null,
        discovery: null,
        apiError: null,
      };

    case "discover_started":
      return {
        ...state,
        loading: true,
        apiError: null,
        // Clear the previous attempt's uploadSummary/discovery too --
        // otherwise a retry after a failure can briefly render a stale
        // summary/discovery panel from the run before this one while the
        // new upload/discover pair is still in flight.
        uploadSummary: null,
        discovery: null,
      };

    case "upload_succeeded":
      return {
        ...state,
        sessionId: action.sessionId,
        uploadSummary:
          action.uploadSummary,
      };

    case "discovery_succeeded":
      return {
        ...state,
        discovery: action.discovery,
      };

    case "discover_failed":
      return {
        ...state,
        discovery: null,
        apiError: action.message,
      };

    case "discover_finished":
      return {
        ...state,
        loading: false,
      };

    default:
      return state;
  }
}

export interface UseDiscoveryFlowResult {
  selectedFiles: FileList | null;
  sessionId: string;
  discovery: DiscoverResponse | null;
  uploadSummary: UploadSummary | null;
  loading: boolean;
  apiError: string | null;
  handleFileSelection: (
    files: FileList | null
  ) => void;
  handleDiscover: () => Promise<void>;
  handleDiscoveryUpdated: (
    discovery: DiscoverResponse
  ) => void;
}

/**
 * Owns the upload -> discover pipeline's state machine and the actual
 * fetch orchestration, independent of routing/navigation concerns
 * (those stay in the page component, which calls `useRouter`/
 * `useParams` and passes its own `onScan`/`onBack`/`onSessionExpired`
 * callbacks directly to `DiscoveryPage`). Matches the convention every
 * other async flow in this app already follows (useAnalysis,
 * useDedupReport, useExportDownload, useDedupExport) — this page was
 * the one holdout inlining its own reducer + fetch logic instead.
 */
export function useDiscoveryFlow(): UseDiscoveryFlowResult {
  const [state, dispatch] = useReducer(
    reducer,
    initialState
  );

  const {
    selectedFiles,
    sessionId,
    discovery,
    uploadSummary,
    loading,
    apiError,
  } = state;

  const handleFileSelection = (
    files: FileList | null
  ) => {
    dispatch({
      type: "files_selected",
      files,
    });
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
    if (
      !selectedFiles ||
      selectedFiles.length === 0
    ) {
      dispatch({
        type: "discover_failed",
        message:
          "Please select a folder before continuing.",
      });

      return;
    }

    if (discoverInFlight.current) return;
    discoverInFlight.current = true;

    try {
      dispatch({
        type: "discover_started",
      });

      const formData =
        new FormData();

      const supportedFiles =
        Array.from(
          selectedFiles
        ).filter(isSupportedFile);

      supportedFiles.forEach((file) => {
        formData.append(
          "files",
          file,
          file.webkitRelativePath ||
            file.name
        );
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
            file.webkitRelativePath ||
              file.name,
            file.lastModified,
          ])
        )
      );

      const uploadResponse =
        await fetch(
          `${API_URL}/upload`,
          {
            method: "POST",
            // The API is a different origin (different port), so cookies
            // are withheld unless this is explicit -- without it, every
            // request looks signed-out regardless of a valid session.
            credentials: "include",
            body: formData,
          }
        );

      if (!uploadResponse.ok) {
        throw new Error(
          await errorMessageFrom(uploadResponse)
        );
      }

      const uploadData: UploadResponse =
        await uploadResponse.json();

      const integrityVerified =
        uploadData.files_failed === 0 &&
        uploadData.multipart_errors === 0 &&
        uploadData.files_uploaded ===
          supportedFiles.length;

      dispatch({
        type: "upload_succeeded",
        sessionId:
          uploadData.session_id,
        uploadSummary: {
          files_selected:
            supportedFiles.length,
          files_uploaded:
            uploadData.files_uploaded,
          files_failed:
            uploadData.files_failed,
          multipart_errors:
            uploadData.multipart_errors,
          integrity_verified:
            integrityVerified,
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

      const discoverResponse =
        await fetch(
          `${API_URL}/discover`,
          {
            method: "POST",
            // The API is a different origin (different port), so cookies
            // are withheld unless this is explicit -- without it, every
            // request looks signed-out regardless of a valid session.
            credentials: "include",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              session_id:
                uploadData.session_id,
            }),
          }
        );

      if (!discoverResponse.ok) {
        throw new Error(
          await errorMessageFrom(discoverResponse)
        );
      }

      const discoveryData: DiscoverResponse =
        await discoverResponse.json();

      dispatch({
        type: "discovery_succeeded",
        discovery: discoveryData,
      });
    } catch (error) {
      dispatch({
        type: "discover_failed",
        message:
          describeFetchError(error),
      });
    } finally {
      dispatch({
        type: "discover_finished",
      });
      discoverInFlight.current = false;
    }
  };

  const handleDiscoveryUpdated = (
    discovery: DiscoverResponse
  ) => {
    dispatch({
      type: "discovery_succeeded",
      discovery,
    });
  };

  return {
    selectedFiles,
    sessionId,
    discovery,
    uploadSummary,
    loading,
    apiError,
    handleFileSelection,
    handleDiscover,
    handleDiscoveryUpdated,
  };
}
