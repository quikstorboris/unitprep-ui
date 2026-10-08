/**
 * Client-record API calls and shapes (Phase 4's Client record UI) -- the
 * Company page and a facility's own General / Facility Policies / Elavon /
 * Users / Onboarding Work tabs. Mirrors `unitprep-api`'s
 * `api::clients_detail` module (plus `clients_elavon`, `clients_facility_people`,
 * `tool_runs`). One file per area; this index keeps the old
 * `@/lib/clientsDetail` import path working for every caller.
 */
export * from "./company";
export * from "./elavon";
export * from "./facility";
export * from "./people";
export * from "./policies";
export * from "./toolRuns";
