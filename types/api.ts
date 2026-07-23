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
  discovered_group_names: string[];
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

/**
 * A discovered unit file that couldn't be validated at all, due to an
 * internal inconsistency between discovery and validation's own column
 * lookup — not a data-quality problem found in the file's contents.
 * Distinct from `ValidationIssue`, which describes a real problem in a
 * file that was otherwise successfully checked.
 */
export type FileValidationError = {
  file_name: string;
  message: string;
};

export type ValidateResponse = {
  files_checked: number;
  issue_count: number;
  error_count: number;
  warning_count: number;
  issues: ValidationIssue[];
  files_errored: FileValidationError[];
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

// Dedup (duplicate tenant check) contracts — mirror unitprep-api's
// enriched view types 1:1 (not unitprep-dedup's own raw domain types,
// which stay pure and never carry column-layout/cell-ref concepts):
//   DedupCheckResponse, DedupReportView, FlaggedGroupView, BulletView,
//   TypoVariantView, RelatedTenantView, RelatedTenantMemberView
//     -> unitprep-api/src/api/dedup.rs, dedup_view.rs
//   FieldCategory, FieldName -> unitprep-dedup/src/types/fields.rs

export type FieldCategory =
  | "Phone"
  | "Email"
  | "Address"
  | "AltContact"
  | "Company"
  | "Name";

export type FieldName =
  | "PhoneNumber"
  | "PhoneNumberPrefix"
  | "Email"
  | "AddressStreet1"
  | "AddressStreet2"
  | "AddressCity"
  | "AddressState"
  | "AddressPostalCode"
  | "AltContactFirstName"
  | "AltContactLastName"
  | "AltContactEmail"
  | "AltContactPhoneNumber"
  | "AltContactPhoneNumberPrefix"
  | "AltContactAddressStreet1"
  | "AltContactAddressStreet2"
  | "AltContactAddressCity"
  | "AltContactAddressState"
  | "AltContactAddressPostalCode"
  | "CompanyName"
  | "FirstName"
  | "LastName";

/** One plain-English sentence for a single differing field. */
export type BulletView = {
  field: FieldName;
  label: string;
  sentence: string;
  /** Cell references in the *exported* CSV/xlsx (e.g. "N22") — empty if
   * none apply. */
  cell_refs: string[];
};

export type FlaggedGroupView = {
  key: string;
  display_name: string;
  units: string[];
  /** In priority order — the order to show them in a "Mismatches: ..."
   * summary line. */
  categories: FieldCategory[];
  bullets: BulletView[];
};

export type TypoVariantView = {
  display_name_a: string;
  units_a: string[];
  display_name_b: string;
  units_b: string[];
  contact_info_matches: boolean;
  note: string;
};

export type RelatednessSignal =
  | "SharedPhone"
  | "SharedEmail"
  | "SharedAlternateContact"
  | "SharedHomeAddress";

export type RelatedTenantMemberView = {
  display_name: string;
  units: string[];
};

/**
 * Two or more tenants (different name keys) sharing a specific,
 * non-blank value — evidence of a real relationship (business + owner,
 * family, subdivided unit) that neither exact-name grouping nor
 * typo-variant similarity could catch, since both hinge on name
 * similarity. Always advisory, same as `TypoVariantView`.
 */
export type RelatedTenantView = {
  members: RelatedTenantMemberView[];
  signal: RelatednessSignal;
  shared_value: string;
  note: string;
};

export type DedupReportView = {
  total_rows: number;
  unique_tenants: number;
  multi_unit_tenants: number;
  flagged_groups: FlaggedGroupView[];
  typo_variant_candidates: TypoVariantView[];
  related_tenant_candidates: RelatedTenantView[];
};

export type DedupCheckResponse = {
  session_id: string;
  report: DedupReportView;
};

/** `"both"` returns a ZIP containing both files in one download. */
export type DedupExportFormat = "csv" | "xlsx" | "both";
