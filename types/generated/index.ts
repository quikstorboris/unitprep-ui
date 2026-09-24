// Barrel re-export for the generated types below -- this file is the one
// hand-maintained piece of this directory (everything else here is
// overwritten wholesale by `npm run generate-types`, see README.md). Add a
// line here when a new Rust struct gets `#[ts(export)]`'d; forgetting to is
// a plain TypeScript "no exported member" error at the `types/api.ts`
// import site, not a silent mismatch.
export type { UploadResponse } from "./UploadResponse";
export type { DiscoverResponse } from "./DiscoverResponse";
export type { ValidateResponse } from "./ValidateResponse";
export type { AnalyzeResponse } from "./AnalyzeResponse";
export type { UnitFileCandidate } from "./UnitFileCandidate";
export type { FieldMappingEntry } from "./FieldMappingEntry";
export type { Severity } from "./Severity";
export type { ValidationIssue } from "./ValidationIssue";
export type { FileValidationError } from "./FileValidationError";
export type { SimilarityMatch } from "./SimilarityMatch";
export type { AdvisoryIssue } from "./AdvisoryIssue";
