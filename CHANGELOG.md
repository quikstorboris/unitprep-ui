# Changelog

All notable changes to `unitprep-ui` are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning
follows [Semantic Versioning](https://semver.org/). Versioned
independently from `unitprep-api` — the two release on their own
cadences and are not required to share a version number.

## [Unreleased]

## [1.6.39] - 2026-09-24

Frontend coverage-audit follow-through, paired with the backend's ts-rs
codegen work (`unitprep-api` v1.9.37).

### Added
- Test coverage across four priority tiers from a coverage audit:
  auth/session infrastructure (`RequirePermission`, `sessionExpiry`,
  `currentUser`, `auth-session`, `auth-shared`), admin/destructive flows
  (`useUsersAdmin`, `UserRow`, `SecretField`, `useAuditLogFilterData`),
  the API-client lib layer (`auth-users`, `auth-audit`, `auth-config`,
  `clientsDetail`, `dropbox`, `processStreetSettings`, plus their shared
  plumbing), and the two edit/save-heavy facility policy tabs (`FeesTab`,
  `DelinquencyTab`, plus their shared `PolicyTabShared`) -- suite grew
  from 442 to 633 tests (63 to 83 files).

### Changed
- The core tool-session response types (`UploadResponse`,
  `DiscoverResponse`, `ValidateResponse`, `AnalyzeResponse`, and their
  transitive dependencies -- 11 types spanning the main crate and the
  `unit-group` library crate) are now consumed from files generated
  directly off the Rust structs via `ts-rs`, instead of hand-mirrored in
  `types/api.ts` -- closes a drift risk that had already broken once at
  runtime (an `output_path` field removal that `types/api.ts`'s own
  header comment claimed would show up as a TypeScript error, but
  nothing actually enforced). `npm run generate-types` regenerates them;
  see `types/generated/README.md` for exactly which types are covered --
  the dedup/tagger types further down `types/api.ts` are still
  hand-mirrored, not yet migrated.

## [1.6.38] - 2026-09-23

### Added
- **Onboarding Summary tab** on the Company page -- one row per
  facility, two columns: Elavon Status (the next outstanding step in
  that facility's Merchant Account Process Street workflow, walked up to
  and capped at "Add Credentials to QMS" -- everything after that step
  is PS-internal/per-vendor follow-up an onboarding coordinator doesn't
  track here; shows a reminder note under both the pending step and
  Complete, since "Complete" only means PS's own checklist is checked,
  not that OO has independently verified QMS itself), and a Duplicate
  Checks count linking straight to that facility's Onboarding Work tab.
- **Delete** action on an Onboarding Work tool-run card, for a mistaken
  run (e.g. a Dedup check accidentally run against another facility's
  uploaded data) -- the underlying table is otherwise append-only.
- **Manual Link** action on the Company page (next to Field Reference/
  Re-sync) -- relinks a facility's Intake or Merchant Account record to
  a specific Process Street run id by hand, including relinking *over*
  an already-linked run, to correct a wrong correlation in place without
  deleting and recreating the client record.
- Merchant Account search matches now show EIN (last 4, masked) and
  business address, with fuzzy address comparison (tolerant of "Ave"/
  "Avenue"/"Av." formatting noise) and a "⚠ Similar name to..." warning
  when a standalone match shares real vocabulary with a facility match
  in the same search without being an outright substring match either
  way -- decision-support only, nothing auto-resolves a correlation.

### Changed
- The Dedup tab's facility picker now auto-selects the facility the tab
  is already scoped to (and its Dropbox folder), instead of defaulting
  to blank before every check.

## [1.6.37] - 2026-09-22

### Changed
- Re-sync response types mirror the backend's new
  `merchant_accounts_to_refresh`/`merchant_accounts_refreshed` counts,
  now that the general per-client Re-sync also refreshes a linked
  facility's Elavon/Merchant Account data (task checklist,
  `credentials_added_to_qms`) instead of that only ever happening via
  the Elavon tab's own dedicated Resync button.

## [1.6.36] - 2026-09-22

### Added
- A daily-time scheduling mode for the Process Street background sync
  (alongside the existing hourly-interval mode), with timezone
  selection -- reviewed and folded into this release from an
  already-in-progress feature found sitting uncommitted in the working
  tree.

### Fixed
- Signing back in via passkey after a tab had sat idle a long time
  looked like it worked (prompted, submitted, no visible error) but the
  UI stayed on `/login`, recoverable only with a hard reload. Traced to
  the post-login redirect using a client-side soft navigation
  (`router.replace`) that depends on Turbopack dev mode's HMR/router
  connection, which can go stale after a long idle period. Now uses a
  hard `window.location.assign("/clients")` navigation instead,
  structurally immune to stale client-router state.

## [1.6.35] - 2026-09-18

### Added
- **"Force Full Resync..."** button next to Sync Now on the Process
  Street search page -- bypasses the normal delta check and re-fetches
  every workflow run instead of just what Process Street says changed,
  behind a `window.confirm` warning about the real, shared PS API cost
  so it can't be triggered by accident next to the cheap default.

## [1.6.34] - 2026-09-15

### Changed
- Dedup export and Save-to-Dropbox filenames are now computed
  server-side (a real, facility-scoped, versioned name) instead of
  assembled client-side -- `useDedupExport`/`useDedupSaveToDropbox` now
  thread `facilityId` through instead of building a filename/timestamp
  themselves, and "Save to Dropbox" sends only the destination folder,
  reading the real saved path back from the response.

## [1.6.33] - 2026-09-15

### Added
- Merchant Account (Elavon) matches now show on the Process Street
  search page as their own section below Facilities, each row flagged
  if already linked -- explicitly visibility-only, since importing a
  facility still requires a matching Intake run.

## [1.6.32] - 2026-09-15

### Changed
- **Clients page reworked into a searchable, filterable grid** -- a
  5-column button grid (company name only) grouped by Implementation
  Manager (the internal name for what Process Street itself calls
  "conductor"), with live substring search (3-character minimum) over
  facility-side data and checkbox filters for Implementation Manager,
  Sales Rep, State, and Previous PMS -- replaces the plain
  company-name-and-facilities list.

## [1.6.31] - 2026-09-11

### Added
- **Onboarding Work tab** on the facility page -- a durable, queryable
  history of every tool run against that facility (Dedup first), listing
  each run's ordinal ("1st Duplicate Check"), who ran it and when, its
  source file (downloadable from the DB, independent of whether the
  original Dropbox path still exists), and its output (a download
  button, or an "Open in Dropbox" link, whichever was chosen at export
  time). Dedup/Unit Groups/Template Tagger routes moved from
  client-scoped (`/clients/{id}/dedup`) to facility-scoped
  (`/clients/{id}/facilities/{id}/dedup`) to match -- every run is now
  recorded against a specific facility.

### Fixed
- A Dropbox-only export (no local download ever clicked) previously left
  the user on the same Export Format panel with no completed state at
  all -- only the local-download path used to flip it.

## [1.6.30] - 2026-09-10

### Added
- **QMS Credentials / Pin Pad Credentials** sections on the Elavon tab
  (Account ID, PIN/Password, Pinpad User ID, QSS API Pin) -- these 4
  fields had already been fetched, mapped, and encrypted into the
  facility's Merchant Account secrets since the Elavon tab first
  shipped, just never decrypted back out for display. Covered by the
  same revealable Show/Hide convention as the existing SSN field.

### Changed
- The Elavon tab's credentials-only resync button was replaced entirely
  by one broader **"Resync Elavon Data"** button that refreshes rate,
  status, `credentials_added_to_qms`, financials, credentials, and
  parties together -- the narrow, credentials-only version deliberately
  never re-checked Process Street's own task list, so it had no path to
  ever flip `credentials_added_to_qms` to true after the "Add
  Credentials to QMS" step was actually completed in Process Street.
  Unlike Intake data, nothing in Merchant Account data has a manual-edit
  UI in OO, so a full overwrite from a fresh PS pull is exactly as safe
  as the narrow version was.

## [1.6.29] - 2026-09-09

A large session: a left-nav restructure, several DRY/file-split
refactors following an external code-quality review (independently
re-verified before acting on it -- two of its claims turned out
overstated), and a README rewrite.

### Added
- Shared `OrchestratorLoader` component, adopted on the client
  search/create pages.
- **Left nav rearranged into four groups** -- Tools, Integrations,
  Administration, Account -- with a new admin-only **Integrations**
  section (Process Street settings plus a new DropBox settings page)
  gated on a new `integrations.manage` permission, since `admin`
  deliberately never holds `client_ops.perform`, the permission
  Integrations pages were gated on before. Account's own page (the
  Authenticator App management UI) moved to `/account/security`, with a
  client-side redirect left at the old `/account` path.

### Changed
- Security Logs and Activity Logs now share one `useInfiniteLogFeed`
  pagination hook instead of two independent implementations.
- The three settings pages that share a saving/saved/error state machine
  (Dropbox settings, Process Street settings, Security Policies) now
  share one `useSaveStatus` hook -- an external review's claim of 8
  shared-pattern files was checked against the real code first and
  corrected down to the actual 3.
- **Facility detail page split** from one 2283-line file into 9
  per-tab components under `components/facility/`, plus a shared
  `PolicyTabShared.tsx` for the header chrome three of those tabs have
  in common.
- README rewritten to describe the real, current system -- it still
  described an early, no-auth, single-tool shape ("Authentication exists
  but is not yet enforced") when the real app has enforced passkey/TOTP
  auth, RBAC, a Process-Street-sourced client-management platform, and
  three tools.

## [1.6.28] - 2026-09-08

### Added
- **Remove** button on each Users-tab roster row -- unlinks directly by
  person/role, independent of a matching "already linked" candidate
  chip (needed once a roster row's name no longer matches any real
  candidate).
- **Permanent client Delete**, distinct from archive -- a confirmed
  (`window.confirm`), separate red "Delete" button on both active and
  archived client rows.

## [1.6.27] - 2026-09-08

### Fixed
- **Real person-identity bug**: the Users tab's "already linked"
  candidate matching was keyed on `(email, role)` alone, so several
  distinct real people sharing one family inbox (a genuine, observed
  pattern) showed as red "already linked" chips even though they'd
  never actually been added -- only the first person to resolve to that
  shared email ever made it onto the roster. Matching now includes full
  name too, mirroring the backend's own identity fix.

## [1.6.26] - 2026-09-08

### Fixed
- The "No Company Information Captured" fallback banner (offers to copy
  a first-time facility's own contact data onto a blank Company section)
  only fired when the whole Company section was completely blank -- a
  facility with a resolved legal name/subdomain but genuinely blank
  contact fields (email/phone/street/city/state/zip) never saw it. Now
  checks the contact fields specifically, still gated on the source run
  being the company's own first-time facility; the accept action no
  longer overwrites an already-resolved legal name/subdomain. Renamed
  to "No Company Contact Info Captured" to match what it actually does.

## [1.6.25] - 2026-09-08

### Changed
- A search match found only via a person-name match (which deliberately
  skips a live per-candidate status lookup to avoid N+1 Process Street
  calls) now shows "Unknown" status instead of a bare dash -- a blank
  cell next to real "Active" values read as a missing Intake form,
  which it wasn't.

## [1.6.24] - 2026-09-08

### Changed
- The Specials textarea auto-grows to fit its content and starts taller
  when blank.

## [1.6.23] - 2026-09-08

### Changed
- Facility page content area widened (`max-w-5xl` to `max-w-6xl`) -- the
  whole tab area was cramped.
- Taxes tab's edit row resized: Description gets more room (it's a name
  like "Parking Space County Tax", not a code); Flat Price/Attribute
  Payable shrink to fit a number.
- Copy All on the Users tab now groups the roster under Owner(s)/
  District Manager(s)/Manager(s) headings (skipping any role the
  facility has none of) instead of one flat list.

## [1.6.22] - 2026-09-08

### Added
- **DropBox tab** on the facility page, replacing its placeholder --
  link or change a facility's Dropbox folder, reusing the same
  `DropboxFolderPicker` every other Dropbox flow already uses.

## [1.6.21] - 2026-09-08

### Added
- **"+ Add Person Manually"** on the Users tab, and an Edit button on
  every roster row (name/email/phone/role) -- editing a Process
  Street-sourced person shows a "protect from resync" checkbox that, if
  checked, marks them manual so the edit survives the next auto-heal
  pass instead of silently reverting.
- A Source column (Process Street / Manual) on the roster table,
  excluded from Copy All.

## [1.6.20] - 2026-09-08

### Changed
- **Taxes and Delinquency tabs rebuilt with real structured fields**,
  replacing free text: Taxes is now one row per tax (name, description,
  flat dollar amount, attribute-payable percent, recurring flag);
  Delinquency is a required dollar amount, an optional days-after count,
  and a real trigger (either the facility's own Paid Through Date, or
  another entry on the same schedule referenced by category). A
  facility's pre-existing legacy free-text data, where it has any, is
  still shown read-only alongside the new structured entries rather
  than discarded.

## [1.6.19] - 2026-09-04

### Changed
- **Facility Policies split into 5 editable tabs** (Fees / Taxes /
  Delinquency / Coverage / Specials), replacing the single stacked
  page -- the first editable data anywhere in this app. Each tab gets
  its own Edit button revealing real input fields, a "manually
  maintained, never synced" note once a category is flagged
  QSX-exempt, and a banner on an empty category explaining why Process
  Street has nothing there for a QSX-legacy facility.

## [1.6.18] - 2026-09-04

### Changed
- The Users tab now explains why roster rows aren't directly editable
  there: the data always reflects Process Street's own Intake fields,
  and the auto-heal on load would silently overwrite a local edit
  anyway.

## [1.6.17] - 2026-09-04

### Added
- **Copy All** on the Users tab -- puts the roster on the clipboard as
  one paragraph per person (name, phone, email, each only if present).

### Changed
- The roster now renders as a real table so email/phone line up across
  rows instead of a loose inline string. An already-linked candidate's
  chip renders red and unlinks on click instead of re-adding it; the
  self-heal that click used to trigger moved to the backend's own read
  path, so no click is needed for that anymore.

## [1.6.16] - 2026-09-04

### Added
- **Facility Users tab** -- the saved roster (name/email/phone/role)
  plus pill-chip candidates pulled from the facility's own Process
  Street Intake sync, with no search box. Clicking a chip always
  upserts (the backend does the actual overwrite), shown with a
  checkmark style when that email is already on the roster so
  re-clicking to refresh a stale entry reads as intentional.

## [1.6.15] - 2026-09-04

### Changed
- A bold red hint now explains that a folder, not a file, is what gets
  selected when Unit Groups' folder-mode Dropbox picker lists files for
  reference -- the plain grey file listing previously read as broken
  rather than intentional.

## [1.6.14] - 2026-09-04

### Fixed
- `DropboxFolderPicker` tied file visibility to its mode (select-folder
  vs. select-file), so Unit Groups (folder mode) never showed file
  entries even though the backend already returned them -- visibility
  is now controlled by its own `showFiles` prop.
- The picker no longer renders at all while a facility's Dropbox folder
  is still resolving asynchronously, instead of mounting at the QMS
  Onboarding root and correcting a moment later -- eliminates a visible
  flash of the wrong folder's contents before the real one loads, across
  all three tools' upload pages (Dedup, Tagger, Unit Groups).

## [1.6.13] - 2026-09-04

### Added
- Group Prep's discovery and export pages gained the same Dropbox
  import/save pattern Dedup and the Template Tagger already had, in
  folder-select mode (`mode="select-folder"`, posting to
  `/upload-dropbox`) since a Group Prep session's source is a whole
  folder of files, not one file -- no format choice on export, since
  Unit Groups always produces one ZIP.

## [1.6.12] - 2026-09-04

### Added
- The Template Tagger's upload and results pages gained the same
  facility-select + Dropbox import/save pattern Dedup already had.

## [1.6.11] - 2026-09-04

### Fixed
- `DropboxFolderPicker`'s load effect only ran once per open/close
  transition, so a facility's default Dropbox folder resolving a moment
  *after* the picker had already opened (e.g. right after picking a
  facility from Dedup's dropdown) was silently missed -- browsing stayed
  at the root even though the backend had already resolved the right
  folder. Now re-runs whenever the initial path itself changes.

## [1.6.10] - 2026-09-04

### Changed
- Removed the separate "Save to Dropbox" section and its own picker --
  "Save to Facility Folder" / "Open Destination Folder" now sit next to
  Download Export (and again next to Download Again post-download, so
  saving to Dropbox stays available independent of downloading locally).

### Fixed
- `DropboxFolderPicker` in select-file mode re-listed the previously
  selected *file's* own path when reopened (a genuine Dropbox 409
  `not_folder` error) instead of its containing folder.

## [1.6.9] - 2026-09-04

### Added
- A one-click "Save to Facility Folder" action next to Browse, using the
  already-computed default destination path instead of requiring the
  picker to be opened and navigated manually -- once saved, the picker
  is replaced by an "Open Destination Folder" link that opens the
  destination in the Dropbox web app.

### Fixed
- `DropboxFolderPicker`'s closed-state "No file/folder selected" text
  was styled as a pill matching the Browse button, reading as its own
  (non-functional) button -- now plain text above the button row.

## [1.6.8] - 2026-09-04

### Changed
- Dedup's "Import from Dropbox" picker now seeds its starting path from
  the selected facility's real Dropbox folder instead of browsing from
  scratch every time (a company can have several facilities, each with
  its own folder); "Save to Dropbox" seeds from the backend's own
  Duplicate Check subfolder suggestion next to wherever the source file
  was actually imported from.

## [1.6.7] - 2026-09-04

### Added
- A People section on the Add-to-OO confirmation screen's facility
  cards.

## [1.6.6] - 2026-09-03

### Added
- When a facility answered "yes" to Process Street's own "is your
  Corporate Name/Address/Phone/Email the same as this Facility?"
  question, PS skips the dedicated Corporate questions entirely,
  leaving the confirmation screen's Company section with nothing to
  show -- a new amber banner now offers to copy the facility's own
  name/address/phone/website into it ("Use Facility Info"); email is
  deliberately excluded from the offer.

## [1.6.5] - 2026-09-03

### Fixed
- The Company page's Dropbox button crowded a long facility name
  instead of letting it truncate -- the name span was missing
  `min-w-0`, which flexbox needs for `truncate` to actually take effect
  under a squeezed row.

## [1.6.4] - 2026-09-03

### Changed
- Phone numbers are formatted (`xxx-xxx-xxxx`) everywhere they're
  displayed -- the Company page, Facility General tab, the confirmation
  screen's own Company/Facility sections, and the search page's
  person-match table previously showed the raw digit string Process
  Street stores.

## [1.6.3] - 2026-09-03

### Added
- **Unlink** action on the Elavon tab -- deletes the linked owner/
  financial data for a facility, behind an inline confirm step,
  refetching Elavon status and the Company page's own data afterward so
  a corrected link shows up immediately in both places.

### Fixed
- A 100+ character Dropbox URL overflowed the confirmation screen's
  2-column facility grid and overlapped neighboring fields -- now
  rendered as the same compact "Go to DropBox" button the real Facility
  page already uses (`break-words` also added defensively to every
  other read-only facility field).
- The Field Reference table's horizontal scrollbar and cramped layout.

## [1.6.2] - 2026-09-03

### Fixed
- `pickCompanySourceRun` (chooses which selected run seeds the Company
  section on the confirmation screen) picked whichever run had *any*
  resolved legal name, first match wins -- a stray answer on an
  unrelated run could win over the real "first time" facility with the
  actual full Corporate Info section. Now prefers a run Process Street
  itself marked authoritative (`is_first_time === true`), falling back
  to whichever run has the most complete company data among ties.

## [1.6.1] - 2026-09-03

### Added
- Elavon tab financials section.

### Changed
- Bank account/routing numbers are masked, and SSN is now fully masked
  (previously shown in plaintext) behind a Show/Hide toggle -- via a new
  shared `PartyCard` component used by both the Company page's Owner(s)
  Information and the Facility page's Elavon tab, so phone
  (`xxx-xxx-xxxx`) and date-of-birth (`mm-dd-yyyy`, read directly off
  the ISO date prefix rather than through a timezone-sensitive `Date`
  parse) formatting apply consistently in both places too.

## [1.6.0] - 2026-09-03

Phases 3-5 of the Process Street integration: the client goes from a
search result to a real, editable OO record with re-sync and an
Activity Logs trail.

### Added
- **Add-to-OO confirmation screen** (`/clients/new`) -- selecting
  facility matches lands on a review screen before anything is written
  to Postgres: a Company section plus one section per selected facility
  (every selected run becomes its own facility, even the one that seeds
  Company), every field starting as read-only text with a pencil icon
  that reveals an editable input on click, before a Create button posts
  to `POST /clients`.
- **Re-sync** -- a manual "Re-sync" button on the Company page, plus a
  configurable background sync interval, both feeding a two-phase
  preview/apply flow that flags any field a re-sync would overwrite if
  it's already been manually edited in OO, letting the caller choose
  per field whether to keep the OO edit or take the fresh PS value.
- **Activity Logs** (`/admin/activity-logs`) -- a new trail for user
  actions and sync runs (including sync failures), distinct from the
  existing audit trail, which is renamed **Security Logs**
  (`/admin/security-logs`) to disambiguate. Exportable to PDF and
  searchable, matching Security Logs' existing UX.
- **Client record UI (read-only pass)**: a Company page (Company
  Information, Financial Information, Owner(s) Information with
  gracefully-degrading per-party PII decryption, a facility-selector
  rail) and a Facility page with General / Users / DropBox / Elavon /
  Facility Policies tabs -- only General and Facility Policies are
  actually built this pass, the other three render as placeholders so
  the tab structure exists rather than arriving piecemeal.
- **Elavon tab** -- shows a linked Merchant Account run's summary and
  owner/signer parties, or, when unlinked, an auto-suggested candidate
  via the same title-correlation search already used (shown as a real,
  clickable link the caller must open before a "Confirm this link"
  action becomes available -- deliberate friction, never silently
  auto-accepted), with every candidate listed when correlation is
  genuinely ambiguous, and a manual run-id paste field as the last
  resort.
- A searchable **Field Reference** help modal on the Company/Facility
  pages (same UX as the QMS Tag Catalog admin page), naming which
  Process Street run/step/field every OO field on those pages actually
  comes from, compiled from a real 163-field live audit of an actual
  Merchant Account run.
- `PartyCard` shared formatting: phone as `xxx-xxx-xxxx`, DOB as
  `mm-dd-yyyy`.
- A "Go to DropBox" button (replacing a plain-text link that didn't wrap
  well) opening a facility's Dropbox folder in a new tab.

### Fixed
- Client creation from the confirmation screen took up to 18 seconds,
  traced to sequential Process Street API calls during Create --
  including one genuinely duplicate fetch of the same run. Every run id
  needed for a batch (Intake plus any correlated Merchant Account run)
  is now deduped into one set and fetched concurrently.
- Switching between facilities on a client's page re-fetched the whole
  company/rail data on every click and blanked the entire page to
  "Loading...", even though company/rail data doesn't change between
  facilities in the same company -- a new `CompanyDetailContext` fetches
  company detail once per company id, and the facility page's own
  loading state now only covers the tab content area.

## [1.5.10] - 2026-08-31

### Changed
- The quick-create client form no longer asks for a Zoho placeholder or
  a Dropbox folder at creation time -- Dropbox is instead connected once
  on the Company page, with each facility picking its own subfolder
  afterward, ahead of the Client record UI's Dropbox redesign.

## [1.5.9] - 2026-08-31

### Added
- **Process Street search page** -- search PS facilities by name (or a
  company's own name), with a live sync-progress bar.
- **Process Street settings page**, under a new Integrations left-nav
  group -- configures the background sync interval.

## [1.5.8] - 2026-08-28

Real onboarding-file support for a new vendor (Easy Storage Solutions),
a colleague cross-check's wording fix, and the first Dropbox integration
pass -- folder browsing, search, and read/write wiring into Dedup.

### Added
- **Dropbox folder picker** (`DropboxFolderPicker`) for client creation
  and the client info page -- browses from the QMS Onboarding root
  (landing there specifically on creation, to reduce selection ambiguity
  given real, inconsistently-named folder trees), click to descend,
  "Select this folder" to commit; wired with debounced search
  ("Client ▸ Facility" breadcrumbs) once Dropbox's own `search_v2` API
  was confirmed to solve cross-client facility-name search natively.
- Dropbox import/export wired into Dedup -- a session's source file can
  be pulled from a client's Dropbox folder instead of a local upload,
  and results can be saved back to Dropbox.
- A Dropbox icon on the client Source Files section.
- Manual unit-file upload, for a file format the shared vendor-format
  registry doesn't recognize at all.
- QMS Tag Catalog shows each tag's `{{tag_key}}` with a copy button.
- The signed-in user's name in the left nav footer (previously roles
  only, since `WhoAmI` never surfaced the name/email columns that
  already existed).
- Dedup's upload page detects and shows the recognized vendor format
  before Run Check is enabled, requiring an explicit confirmation --
  mirrors Group Prep's own recognize-then-confirm flow, part of
  generalizing vendor recognition (previously QSX-only in dedup) into
  the shared, DB-backed `client_ops.vendor_format` registry that also
  onboarded a real Easy Storage Solutions tenant export this same
  effort.

### Changed
- The typo-variant table now names which categories actually differ
  ("Contact info differs: Phone, Address") instead of a bare "Contact
  info differs" -- found by an independent colleague cross-check against
  a real Westpark facility file.
- A Dropbox folder row can now be selected without entering it first.
- Any API call reporting a real 401 now redirects to `/login`
  immediately, instead of only the tool routes that already checked for
  it individually.
- Frontend logging/observability: a silently-swallowed audit-log-filter
  fetch failure now surfaces to the user; added global error boundaries
  (`app/error.tsx`, `global-error.tsx`) and a `window.onerror`/
  `unhandledrejection` safety net; the backend's new `x-request-id`
  header is now appended to every error message via the shared
  `errorMessageFrom` choke point.

### Fixed
- `GroupFileSummary`'s format-valid guard tightened to an explicit
  `=== true` check.

## [1.5.7] - 2026-08-17

### Changed
- **Preserve underscores** is now a confirmation dialog shown only when
  the tags actually being applied contain underscores, replacing an
  always-visible checkbox.

## [1.5.6] - 2026-08-14

Milestone 8 of the third CTO-grade audit's fix plan: remaining
low-severity polish.

### Fixed
- A literally duplicated "Confirm {vendor}" button in
  `FormatResolutionActiveView` (identical onClick/disabled/label logic,
  rendered once above the manual-mapping table and once beside it)
  collapsed into a shared `ConfirmVendorButton`.
- `useDiscoveryFlow`'s upload/discover failures showed a bare
  "Upload failed (500)"-style message instead of the backend's actual
  error body, unlike every sibling upload page -- now routed through
  `errorMessageFrom` like the rest.

### Changed
- Renamed the internal `preserveBlanks` state/prop to
  `preserveUnderscores` to match the "Preserve underscores" checkbox
  copy the user actually sees (the wire field sent to `/tagger/apply`
  stays `preserve_blanks`, the backend's own contract, translated at the
  call site).
- A code comment (not a fix) flags that the signed-in shell shows roles
  instead of a name, since `WhoAmI` didn't yet surface `first_name`/
  `last_name`/`email` -- addressed in 1.5.8.

## [1.5.5] - 2026-08-14

Milestone 6 of the third CTO-grade audit's fix plan: file splits along
genuine seams, matching an existing sibling precedent already in this
codebase (`admin/client-ops/qms-tags/`).

### Changed
- `lib/auth.ts` (694 lines) deleted and replaced by five focused
  modules -- `auth-shared.ts` (the shared fetch/parse plumbing),
  `auth-session.ts`, `auth-users.ts`, `auth-audit.ts`, `auth-config.ts`
  -- with all 13 importing files updated to the correct new module(s).
- `app/(app)/admin/users/page.tsx` (805 lines) split into `page.tsx`
  (composition only), `InviteUserForm.tsx`, `UserRow.tsx` (now owns its
  own confirm/role-picker state per row), `useUsersAdmin.ts` (all
  data-fetching/mutations), and a shared `styles.ts`.
- `MasterGroupFileSection.tsx`'s manual-upload flow extracted into
  `useManualGroupFileUpload.ts` (355 -> 208 lines).
- `WarningsSection.tsx`'s per-reason-card JSX extracted into
  `WarningReasonCard.tsx` (378 -> 75 lines).

## [1.5.4] - 2026-08-14

Milestone 5 of the third CTO-grade audit's fix plan: DRY consolidation.

### Added
- `useFileUploadAction`, a shared multipart-upload hook (mirrors
  `useSessionAction`'s result shape) adopted by the Template Tagger,
  Dedup, and Group Prep upload pages -- the latter two previously had no
  session-expiry handling at all on manual upload, now fixed as a side
  effect of sharing the hook.
- `useAuditLogFilterData`, a shared event-type/user-list fetch and
  selection hook, adopted by both the audit-log listing page and its
  PDF-export page.

### Fixed
- A QMS tag catalog fetch failure on `TaggerResultsPage` was silently
  swallowed by an `if(ok)`-only branch -- now surfaced as an inline
  banner.

## [1.5.3] - 2026-08-14

### Security
- `npm audit fix` resolved all 6 previously-High-severity advisories --
  `next` itself resolved to a genuinely new 16.3.1 patch release past
  the vulnerable range, taking its bundled `postcss`/`sharp` with it.
  Verified with a real dev-server boot, not just the test suite.

## [1.5.2] - 2026-08-14

### Added
- Test coverage for the Template Tagger UI (`useTaggerReport`,
  `useTaggerApply`, `TagPicker`) -- previously untested, flagged as a
  real gap by the third CTO-grade audit.

## [1.5.1] - 2026-08-13

Milestone 2 of the third CTO-grade audit's fix plan.

### Added
- Passkey step-up (`passkeyReverify`) now gates self-service TOTP
  re-enrollment on the account page -- a WebAuthn ceremony must succeed
  before the "replace my authenticator app" form appears, closing a real
  gap the audit found: self-service TOTP re-registration previously
  required no re-authentication of any kind. Admin-driven onboarding
  TOTP setup was never the gap and is unaffected.

### Fixed
- Manual group-file upload's hand-rolled fetch now treats a 401 the same
  as a 404 (session expired) -- previously showed a raw error message
  instead of the sign-in prompt every other upload path already gave.

## [1.5.0] - 2026-08-13

Catches up several weeks of already-pushed-but-unversioned feature work
(the QMS Tag Catalog admin UI, the Template Tagger UI, related-tenant
household rendering) alongside Milestone 1 of the third CTO-grade
audit's fix plan.

### Added
- **QMS Tag Catalog admin UI** (`/admin/client-ops/qms-tags`) --
  create/filter/list tags, split into `CreateTagForm`/`TagFilters`/
  `TagRow`.
- **Template Tagger upload/review UI**, its own tab next to Unit Groups,
  with a "Preserve underscores" toggle on the apply flow.
- The orchestrator logo asset and a favicon -- the logo had been
  referenced by `LeftNav` since the Orchestrator rename but was never
  actually committed, a real broken-image bug caught while triaging
  uncommitted files.

### Changed
- Related-tenant candidates render as households (a grouped Evidence
  column naming which specific members each piece of evidence connects)
  instead of one row per signal -- matches the backend's household
  restructuring from a colleague cross-check against real Rowley Self
  Storage data.

### Fixed
- **`AppLayout`'s loading guard was missing a `!checked` branch**, so
  `RequirePermission` could mount with `user=null` on every fresh page
  load and silently bounce a legitimate admin hitting an admin URL
  directly back to `/clients` -- found by the third CTO-grade audit; a
  new regression test suite (`layout.test.tsx`) covers the
  loading/ready/signed-out states.
- Stale "Preserve underscores" checkbox copy.
- The E2E suite now seeds a real auth session and matches the actual API
  origin -- broke once the backend started requiring a session on every
  tool route.

## [1.4.0] - 2026-08-07

Frontend half of `unitprep-api`'s multi-role authorization work
(v1.6.0): a user can hold more than one role, and every admin-gated page
checks a real permission instead of a hardcoded role name.

### Added
- **Administration nav group.** `LeftNav` groups Users, Roles, Audit
  Logs, and Security Policies under an "Administration" heading, each
  individually gated by its own permission rather than one blanket
  admin-only flag -- a caller only sees the sub-items their permissions
  actually cover.
- **Roles page** (`/admin/roles`) -- read-only view of the role/
  permission catalog. No editor: creating custom roles isn't built yet.
- **Security Policies page** (`/admin/security-policies`) -- step-up
  requirement toggles, backed by the new `auth.auth_configuration`
  endpoints. `allowed_factors` has no control here on purpose (see
  `unitprep-api`'s v1.6.0 changelog entry).
- **Audit Logs category tabs** -- All/Authentication/Permissions &
  Roles/Users & Access presets layered on top of the existing event-type
  multi-select, so the filter doesn't stay one long flat list as the
  event catalog keeps growing.
- Users page: the single role dropdown is replaced by per-user role
  chips, each individually removable (except on your own row, where
  self-role-edit is refused server-side and the controls are hidden
  rather than shown disabled), plus a per-row "add role" picker sourced
  live from `GET /auth/roles` instead of a hardcoded role list.

### Changed
- `RequireAdmin` replaced by `RequirePermission`, which checks a
  permission prop against the signed-in user's resolved permissions
  instead of comparing a role string.
- `WhoAmI`/`UserSummary` carry `roles: string[]` and (on `WhoAmI`)
  `permissions: string[]` instead of a single `role` field.

### Fixed
- **`<li>` nested inside `<li>` in `LeftNav`**, a real hydration error
  Next.js flagged live -- the Account link was wrapped in an extra `<li>`
  around a component that already renders its own. `NavItem` now takes
  an optional `className` for spacing instead.

## [1.3.1] - 2026-08-04

### Fixed
- **Every tool route (dedup, upload, discover, group-file upload,
  session cancellation) rejected a signed-in user with "Sign in
  required."** These are the app's original `fetch()` call sites,
  written before any session/cookie concept existed, and none of them
  were updated when the backend started requiring a session on every
  tool route (`unitprep-api` v1.4.0) — `useSessionPost`/`useSessionAction`
  already sent `credentials: "include"` (added ahead of time for exactly
  this reason, per their own comments), but `DedupUploadPage.tsx`,
  `useDiscoveryFlow.ts` (`/upload`, `/discover`), 
  `MasterGroupFileSection.tsx` (`/group-file/upload`), and
  `cancelSession` in `lib/api.ts` did not. Since the API is a different
  origin (port 8080 vs. the app's 3000), a `fetch()` without
  `credentials: "include"` silently withholds cookies regardless of
  browser default — every one of these requests looked signed-out no
  matter how recently the user had actually signed in.

  Found from a live report (dedup refusing to run immediately after a
  successful sign-in) and confirmed directly: the identical request
  against the real dev server returned `401 Sign in required` without
  `credentials: "include"` and succeeded (reaching real validation logic)
  with it.

## [1.3.0] - 2026-08-04

Phase 1 item 8: the admin Users tab.

### Added
- **Users tab** (`/admin/users`) — lists every account (email, name,
  company, role, status, passkey count, TOTP status) via the new
  `GET /auth/users`. Invite a new user, reissue a lost/expired invite for
  one still `invited` with no passkey, or recover an `active` account
  that has lost its only passkey — each shows the resulting one-time
  setup link once, with a copy button, since the backend only returns it
  the one time.
- Listed in the left nav unconditionally for now — `Role` has exactly one
  variant (`admin`) in v1, so every signed-in caller already qualifies;
  worth revisiting once a second role exists.

### Fixed
- **An admin could accidentally trigger recovery on their own account.**
  Recovering an account revokes every one of its live sessions, including
  — for a caller acting on themselves — the very session used to click
  the button, which then breaks the page mid-action with no clear reason
  why. Caught live while testing: recovering a second account while
  signed in as it succeeded server-side but immediately 401'd the same
  page's next request. The "Recover account" action now never renders on
  the signed-in caller's own row (shown as "You" instead) — it also made
  no sense on its own terms, since reaching this page at all means you
  aren't locked out.


The auth frontend, built from nothing: sign-in, invite redemption /
account recovery, mandatory TOTP step-up enrollment, an account page,
and route gating. Closes out Phase 1 alongside `unitprep-api` 1.4.0 --
this app is now an enforced product rather than a UI sitting in front
of an API nothing required a session to reach.

### Added
- **Passkey sign-in** (`/login`) — email, then a native
  `navigator.credentials.get()` ceremony via
  `PublicKeyCredential.parseRequestOptionsFromJSON`. No password field
  exists anywhere in this app.
- **Invite redemption / account recovery** (`/invites/[token]`) — the
  same page serves both, since the backend doesn't distinguish a first
  invite from a recovery reissue at the registration layer. Guards
  against redeeming an invite while already signed in as someone else:
  shows an explicit "sign out and continue" step rather than silently
  adding the new passkey to the wrong account.
- **Mandatory TOTP step-up enrollment** (`/onboarding/totp`) — every
  signed-in account without a confirmed TOTP credential is redirected
  here before reaching anything else, enforced in the signed-in shell's
  own layout rather than per-page. Explicitly framed as NOT a second
  way to sign in: required later to confirm sensitive actions (starting
  with replacing a passkey), which is also the framing on the account
  page's own copy. Renders the `otpauth://` URI as a real QR code (new
  `qrcode` dependency) alongside the base32 secret for a camera-less
  device.
- **Account page** (`/account`) — enroll/remove the authenticator app
  credential; reachable once TOTP is already set up, or after the
  mandatory onboarding step completes.
- **Sign-out**, in the left nav, visible whenever signed in.
- **Route gating** (`proxy.ts`) — redirects to `/login` when there's no
  session cookie at all, for every page except `/login` and
  `/invites/*`. Checks cookie presence only; actual session validity
  stays where it already lived, server-side per request -- this exists
  so a signed-out visitor never sees a flash of protected UI, not to
  duplicate authorization.
- `CurrentUserProvider`/`useCurrentUser` — the one source of truth for
  "who, if anyone, is signed in", including `totp_enrolled` status,
  read once via `/health/whoami` and refreshed after any auth action.

### Changed
- Every existing `/clients/*` route moved under a new `(app)` route
  group, which now owns the left nav and client registry — the auth
  pages above deliberately sit outside it, rendering with no shell
  chrome.


A fresh adversarial review pass (5 parallel reviewers) after 1.1.4
shipped, run to close out the refactor before a code-quality
conclusion. No new functionality.

### Fixed
- The "Cancel" button in `UnitFileSelectionSection` was wired to the
  same callback that *opens* the reopened-selection view, making it a
  no-op once you were already in it -- now correctly returns to the
  confirmed summary.
- `UndoImportAsIsButton` showed the wrong label ("Edit Groups (N)",
  copy-pasted from the unrelated `EditGroupsButton`) -- now says "Undo
  Import As Is (N)".
- `useDedupExport` was missing both of 1.1.4's `useExportDownload`
  fixes -- stale `downloadComplete` state and a missing reentrancy
  guard, same bug class, unfixed sibling.
- `useDiscoveryFlow.handleDiscover` had no reentrancy guard (the same
  gap `useExportDownload` had before 1.1.4), and a retry didn't clear
  stale `uploadSummary`/`discovery` from a previous attempt.
- `extendedFilenameFrom`'s RFC 5987 regex (added in 1.1.4) only matched
  an empty language tag (`UTF-8''...`) -- a non-empty tag
  (`UTF-8'en'...`) silently fell through to the plain form/default.
- `useSessionPost` never reset `data` to `null` on a new fetch --
  previously masked everywhere by the app's `key={sessionId}` remount
  convention, not defended in the hook itself.

### Added
- `describeFetchError` (previously used in only 2 hand-rolled fetch
  call sites) is now wired into `useSessionAction`/`useSessionPost`'s
  catch blocks, so a network failure shows an actionable message
  instead of the raw browser error across most of the app.
- An E2E flow for the Group Prep discovery path (upload -> discover ->
  confirm unit files -> confirm format -> reach scan results, plus
  reopening unit-file selection and clicking Cancel) -- the coverage
  gap that let the Cancel-button bug above go undetected.

### Changed
- Split `WarningsSection.tsx` (464 -> 378 lines): extracted
  `ExcludedGroupsList.tsx` and `AcknowledgedGroupsList.tsx`.
- Extracted `ScanResultsPage.tsx`'s inline "Errors"/"File Errors"
  blocks into `ErrorsSection.tsx`/`FileErrorsSection.tsx`.

## [1.1.4] - 2026-07-28

Bug fixes surfaced during the backend's pre-auth hardening review, plus
the frontend half of the same dead code-path removal. No new
functionality.

### Fixed
- Removed the `acknowledge_errors` export-override pathway (`?ack=1`,
  the `acknowledgeErrors` prop chain) -- dead code with no reachable UI
  trigger; the backend's own override was removed in the same pass.
- `useExportDownload`'s success state no longer persists across a new
  export attempt -- a failed retry no longer shows stale success
  alongside its own error.
- Added a reentrancy guard to `useExportDownload` so a rapid
  double-invocation (e.g. a second click landing before `disabled`
  takes effect) can't fire two concurrent `/export` requests.
- `sessionExpired` in `useSessionAction` now resets at the start of
  each action, matching `useSessionPost`'s existing behavior --
  previously sticky once tripped, with no way back to `false`.

### Added
- `aria-current="page"` on the active link in `ClientTabs` and
  `LeftNav`.
- `downloadBlob` now prefers the RFC 6266 extended `filename*=` form
  over the plain form when parsing `Content-Disposition`, falling back
  through plain -> a default name. Currently dormant -- the backend
  only ever sends the plain ASCII form today.

## [1.1.3] - 2026-07-28

Test coverage expansion; no new functionality.

### Added
- Unit/component test coverage across `lib/` and the `dedup`, `export`,
  `discovery`, `scan-results`, `nav`, and `unit-groups` component tiers
  -- 3 test files / 18 tests to 40 files / 262 tests, ~9% to ~73%
  overall statement coverage. Deliberately stops short of the 6
  page-orchestration components (`DedupResultsPage`, `DedupUploadPage`,
  `DiscoveryPage`, `ExportCompletePage`, `ScanResultsPage`,
  `SessionExpiredPage`) and `page.tsx`/`layout.tsx` routing glue,
  already excluded from the coverage config -- these are thin
  composition over already-tested pieces and are exercised end-to-end
  instead (see below).
- 3 new Playwright E2E flows: reviewing analysis and downloading the
  export ZIP (plus an analysis-failure path), reviewing flagged
  groups/typo variants/related tenants and downloading a dedup export
  (plus the all-clear no-issues-found path), and a session-expired
  redirect landing back on the client's info page. Shares a new
  `e2e/helpers.ts` (CORS-preflight mocking, sessionStorage client
  seeding) with the existing `session-remount` spec's pattern.

### Fixed
- Local Playwright runs now retry once (`retries: 1`, previously `0`
  outside CI) -- Next dev's on-demand route compile can race the very
  first request to a not-yet-compiled dynamic route and transiently
  return Next's own 404 instead of waiting, especially with
  `fullyParallel` workers hitting several different fresh routes at
  once. Not a routing bug; the retry absorbs it the same way CI's
  existing retries already did.

## [1.1.2] - 2026-07-28

Test tooling; no new functionality.

### Added
- Vitest + React Testing Library -- this repo had zero automated tests
  before this. First coverage: `useSessionPost`/`useSessionAction`
  (including the `credentials: "include"` send, which had no test
  proving it since it was added) and `ScanResultsStatTiles`.
- Playwright, plus a regression test for the state-scoping bug class
  that's been fixed four separate times across different routes
  (`key={sessionId}`): mocks `/validate` per session and uses real
  browser back/forward -- a genuine client-side transition, not a
  reload -- between two sessions' results pages, asserting neither
  leaks into the other.
- `@vitest/coverage-v8` wired in (`npm run test:coverage`) -- current
  baseline is low (~9% overall) since only the files above have tests
  so far; establishes the tool and the honest starting point rather
  than a completed effort.

## [1.1.1] - 2026-07-28

No new functionality; a post-1.1.0 hygiene and correctness pass
mirroring `unitprep-api`'s 1.1.1.

### Changed
- `useSessionPost`/`useSessionAction` now send `credentials: "include"`
  and fold a 401 into the same `sessionExpired` state a 404 already
  produces -- inert until the backend's auth work actually issues a
  session cookie.
- The remaining hand-rolled fetches migrated onto the shared hooks:
  `ScanResultsPage.tsx`'s `/validate` effect and the fetches in all 3
  discovery components except the one genuine `FormData` file upload,
  which stays hand-rolled on purpose (the shared hooks are JSON-only by
  design). `deriveScanResults` is now memoized.
- Split two oversized components: `MasterGroupFileSection.tsx`
  (517 -> 381 lines, extracted `GroupFileCandidatePicker.tsx` and
  `GroupFileSummary.tsx`) and `FormatConfirmationSection.tsx`
  (521 -> 223 lines, extracted `FormatResolutionActiveView.tsx` and
  `FormatConfirmedSummary.tsx`). `ScanResultsPage.tsx`'s stat grid
  extracted to `components/scan-results/ScanResultsStatTiles.tsx`
  (687 -> 588 lines).
- Applied `npm audit fix` (7 packages updated). 4 High-severity
  advisories (`next`, its bundled `postcss`/`sharp`, and transitive
  `brace-expansion`) remain -- no non-breaking fix currently exists for
  either; tracked, not forced.

## [1.1.0] - 2026-07-20

### Added
- "Clients" left-nav entry and a per-client workspace
  (`/clients/[clientId]`) with horizontal tabs (Client Info, Dedup, Unit
  Groups) — the first cut of the "Client Prep" navigation model. Tabs
  are reachable in any order and none block the others.
- Client Info tab: editable placeholder fields (contact, signer, bank
  account, address, Dropbox folder path) and a QMS API placeholder
  section. Frontend-only — no backend persistence exists yet; state
  lives in the browser tab's `sessionStorage` and is lost on close.
- Duplicate Tenant Check (dedup) is now reachable through the main
  navigation instead of only a standalone `/dedup` URL.
- `DiscoveryPage` shows a conspicuous warning (bold, yellow, ⚠️) when
  zero master group files are found, explaining that every discovered
  group will be treated as net-new, plus a collapsible list of the
  actual distinct group names found — matching the corresponding
  `unitprep-api` change.

### Changed
- Group Prep and Dedup routes moved under `/clients/[clientId]/...`
  (e.g. `/clients/[clientId]/unit-groups`, `/clients/[clientId]/dedup`).
  The old top-level `/`, `/dedup`, `/results/[sessionId]`,
  `/export/[sessionId]` routes are retired; `/` now redirects to
  `/clients`.
- `DiscoveryPage`'s status message now distinguishes "no unit files
  found" from "awaiting master file selection" (previously the same
  generic message for both).

### Fixed
- `DiscoveryPage`'s session-expired redirect was hardcoded to `/`,
  which now lands on the Clients list instead of back to the client's
  own Unit Groups tab — a regression from the route move above. It now
  takes an `onSessionExpired` callback from its parent route, same
  pattern already used by `onBack`/`onHome` elsewhere.

## [1.0.0] - 2026-07-08

### Added
- Inline correction fields on the validation results page for
  single-value fixes (e.g. Width/Length) directly against the flagged
  unit, without re-uploading.
- "Not a dimensioned unit" action for catalog entries that legitimately
  have no dimensions (an office, an owner's apartment, etc.).
- "I've reviewed the errors above and want to export anyway"
  acknowledge-and-override control for unresolved validation errors.
- `SessionExpiredPage`, shown on the results, export, and discovery
  pages whenever the backend reports a session as no longer found,
  instead of a confusing empty/zero result.
- Error vs. Warning severity split in the validation issue list.
- `GET /api/health` — liveness/version check mirroring `unitprep-api`'s
  `GET /health`, reporting the version from `package.json` (kept in
  sync automatically via `next.config.ts`).

### Changed
- Validation issue detail now shows the specific affected unit ids
  instead of only a count.

[Unreleased]: https://github.com/quikstorboris/unitprep-ui/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/quikstorboris/unitprep-ui/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/quikstorboris/unitprep-ui/releases/tag/v1.0.0
