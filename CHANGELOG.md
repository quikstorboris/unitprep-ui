# Changelog

All notable changes to `unitprep-ui` are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning
follows [Semantic Versioning](https://semver.org/). Versioned
independently from `unitprep-api` — the two release on their own
cadences and are not required to share a version number.

## [Unreleased]

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
