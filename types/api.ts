// Shared request/response contracts with unitprep-api.
//
// These shapes must track the Rust structs they mirror 1:1:
//   UploadResponse   -> unitprep-api/src/api/upload.rs
//   DiscoverResponse -> unitprep-api/src/api/discover.rs
//   ValidateResponse -> unitprep-api/src/api/validate.rs
//     (also the response shape for /correct and /exempt-dimensions,
//     which both just re-run validation and return the fresh result)
//   AnalyzeResponse  -> unitprep-api/src/api/analyze.rs
//
// Importing from here instead of re-declaring these per-component is what
// makes a backend field rename (like the `output_path` removal this
// project already went through once) show up as a TypeScript error
// instead of a silent runtime mismatch.

export type UploadResponse = {
  session_id: string;
  files_uploaded: number;
  files_failed: number;
  multipart_errors: number;
};

/** Frontend-derived summary of an upload — not a backend response shape. */
export type UploadSummary = {
  files_selected: number;
  files_uploaded: number;
  files_failed: number;
  multipart_errors: number;
  integrity_verified: boolean;
};

export type DiscoverResponse = {
  unit_files_found: number;
  group_files_found: number;
  group_file_names: string[];
  selected_group_file_name: string | null;
  requires_group_selection: boolean;
  ready: boolean;
};

export type Severity = "Info" | "Warning" | "Error";

export type ValidationIssue = {
  file_name: string;
  severity: Severity;
  description: string;
  affected_units: number;
  affected_unit_ids: string[];
  detail: string;
  correctable_fields: string[];
  exemptable: boolean;
};

export type ValidateResponse = {
  files_checked: number;
  issue_count: number;
  error_count: number;
  warning_count: number;
  issues: ValidationIssue[];
  ready: boolean;
};

export type SimilarityMatch = {
  facility_group: string;
  reference_group: string;
  similarity: number;
  difference: string;
};

export type AdvisoryIssue = {
  source: string;
  issue: string;
  severity: Severity;
};

export type AnalyzeResponse = {
  facilities: number;
  global_groups: number;
  net_new_groups: number;
  similar_groups: number;
  advisory_issues: number;
  net_new_group_details: string[];
  similar_group_details: SimilarityMatch[];
  advisory_issue_details: AdvisoryIssue[];
};
