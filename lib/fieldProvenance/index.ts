import { COMPANY_FIELDS } from "./company";
import { FINANCIAL_FIELDS } from "./financial";
import { OWNER_FIELDS } from "./owners";
import { FACILITY_GENERAL_FIELDS } from "./facility";
import { FACILITY_POLICY_FIELDS } from "./policies";
import { ELAVON_FIELDS } from "./elavon";
import type { FieldProvenanceEntry } from "./types";

export type { FieldProvenanceEntry, MappingStatus, PsWorkflow } from "./types";

/** Every field, in the order the Field Reference table shows them. */
export const FIELD_PROVENANCE: FieldProvenanceEntry[] = [
  ...COMPANY_FIELDS,
  ...FINANCIAL_FIELDS,
  ...OWNER_FIELDS,
  ...FACILITY_GENERAL_FIELDS,
  ...FACILITY_POLICY_FIELDS,
  ...ELAVON_FIELDS,
];
