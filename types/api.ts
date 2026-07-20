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

// Dedup (duplicate tenant check) contracts — mirror unitprep-dedup's own
// result types 1:1:
//   DedupCheckResponse -> unitprep-api/src/api/dedup.rs
//   DedupReport        -> unitprep-dedup/src/report.rs
//   FlaggedGroup, TenantGroup, TenantRecord, FieldMismatch,
//   FieldValueMismatch, TypoVariantCandidate, FieldCategory, FieldName
//                      -> unitprep-dedup/src/types.rs, types/fields.rs

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

export type TenantRecord = {
  cust_numb: string;
  unit_number: string;
  first_last: string;
  first_name: string;
  last_name: string;
  company_name: string;
  phone_number: string;
  phone_number_prefix: string;
  email: string;
  address_street1: string;
  address_street2: string;
  address_city: string;
  address_state: string;
  address_postal_code: string;
  alt_contact_first_name: string;
  alt_contact_last_name: string;
  alt_contact_email: string;
  alt_contact_phone_number: string;
  alt_contact_phone_number_prefix: string;
  alt_contact_address_street1: string;
  alt_contact_address_street2: string;
  alt_contact_address_city: string;
  alt_contact_address_state: string;
  alt_contact_address_postal_code: string;
};

/** Blank values arrive as the literal string "(blank)", sorted last. */
export type FieldValueMismatch = {
  field: FieldName;
  values: string[];
};

export type FieldMismatch = {
  category: FieldCategory;
  fields: FieldValueMismatch[];
};

export type TenantGroup = {
  key: string;
  records: TenantRecord[];
};

export type FlaggedGroup = {
  group: TenantGroup;
  mismatches: FieldMismatch[];
  note: string;
};

export type TypoVariantCandidate = {
  key_a: string;
  key_b: string;
  ratio: number;
  contact_info_matches: boolean;
  note: string;
};

export type RelatednessSignal =
  | "SharedPhone"
  | "SharedEmail"
  | "SharedAlternateContact"
  | "SharedHomeAddress";

/**
 * Two or more tenants (different name keys) sharing a specific,
 * non-blank value — evidence of a real relationship (business + owner,
 * family, subdivided unit) that neither exact-name grouping nor
 * typo-variant similarity could catch, since both hinge on name
 * similarity. Always advisory, same as `TypoVariantCandidate`.
 */
export type RelatedTenantCandidate = {
  group_keys: string[];
  signal: RelatednessSignal;
  shared_value: string;
  note: string;
};

export type DedupReport = {
  total_rows: number;
  unique_tenants: number;
  multi_unit_tenants: number;
  flagged_groups: FlaggedGroup[];
  typo_variant_candidates: TypoVariantCandidate[];
  related_tenant_candidates: RelatedTenantCandidate[];
};

export type DedupCheckResponse = {
  session_id: string;
  report: DedupReport;
};

/** `"both"` returns a ZIP containing both files in one download. */
export type DedupExportFormat = "csv" | "xlsx" | "both";
