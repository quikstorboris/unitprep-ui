import type { DiscoverResponse, UploadSummary } from "@/types/api";

export type State = {
  selectedFiles: FileList | null;
  // Mutually exclusive with selectedFiles -- a whole Dropbox folder
  // picked instead of a local `webkitdirectory` selection. Same
  // convention DedupUploadPage already uses for its own two sources.
  dropboxPath: string | null;
  sessionId: string;
  discovery: DiscoverResponse | null;
  uploadSummary: UploadSummary | null;
  loading: boolean;
  apiError: string | null;
  /** True once cancel() has fired for the upload/discover pipeline
   * currently (or most recently) in flight -- distinct from apiError,
   * since the user asking to stop isn't a failure. */
  cancelled: boolean;
};

export const initialState: State = {
  selectedFiles: null,
  dropboxPath: null,
  sessionId: "",
  discovery: null,
  uploadSummary: null,
  loading: false,
  apiError: null,
  cancelled: false,
};

export type Action =
  | { type: "files_selected"; files: FileList | null }
  | { type: "dropbox_path_selected"; path: string | null }
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
  | { type: "discover_cancelled" }
  | { type: "discover_finished" };

// One reducer instead of six independently-updated useState calls — the
// handful of transitions below (pick files, start discovering, upload
// lands, discovery lands, something failed, done) is what handleDiscover
// was already doing by chaining setX calls together; naming the
// transitions makes that state machine explicit instead of implicit.
export function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "files_selected":
      return {
        ...state,
        selectedFiles: action.files,
        dropboxPath: null,
        uploadSummary: null,
        discovery: null,
        apiError: null,
      };

    case "dropbox_path_selected":
      return {
        ...state,
        dropboxPath: action.path,
        selectedFiles: null,
        uploadSummary: null,
        discovery: null,
        apiError: null,
      };

    case "discover_started":
      return {
        ...state,
        loading: true,
        apiError: null,
        cancelled: false,
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
        uploadSummary: action.uploadSummary,
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

    case "discover_cancelled":
      return {
        ...state,
        discovery: null,
        cancelled: true,
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
