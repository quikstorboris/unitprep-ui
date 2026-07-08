# Changelog

All notable changes to `unitprep-ui` are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning
follows [Semantic Versioning](https://semver.org/). Versioned
independently from `unitprep-api` — the two release on their own
cadences and are not required to share a version number.

## [Unreleased]

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

[Unreleased]: https://github.com/quikstorboris/unitprep-ui/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/quikstorboris/unitprep-ui/releases/tag/v1.0.0
