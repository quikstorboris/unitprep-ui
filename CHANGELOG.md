# Changelog

All notable changes to `unitprep-ui` are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning
follows [Semantic Versioning](https://semver.org/). Versioned
independently from `unitprep-api` — the two release on their own
cadences and are not required to share a version number.

## [Unreleased]

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
