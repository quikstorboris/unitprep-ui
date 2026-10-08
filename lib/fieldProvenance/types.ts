/**
 * Static reference data for the Company/Facility pages' "Field Reference"
 * help table -- every OO field sourced from Process Street, which
 * workflow/step/field it comes from, plus every real Pre-App field this
 * session's 2026-09-03 audit found that OO doesn't capture yet. This is
 * hand-maintained (like `client_ops.qms_tag`), not generated -- verified
 * against Prairie Enterprises' real Highway 20 Intake and New Merchant
 * Account runs (live PS API field/task dumps), not guessed. Update this
 * file whenever a mapping in `unitprep-api`'s `clients::intake_mapping` /
 * `clients::merchant_account_mapping` changes.
 */

export type PsWorkflow = "Intake" | "New Merchant Account";
export type MappingStatus = "mapped" | "not_yet_mapped";

export interface FieldProvenanceEntry {
  ooSection: string;
  ooField: string;
  psWorkflow: PsWorkflow;
  /** The PS checklist task/step this field (or task, for a
   * task-completion-derived field) lives under. */
  psStep: string;
  /** PS's own field key, or `null` when this OO field comes from a
   * checklist task's completion status rather than a form field. */
  psFieldKey: string | null;
  psFieldLabel: string;
  status: MappingStatus;
  notes?: string;
}
