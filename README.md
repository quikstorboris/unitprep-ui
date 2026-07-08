# unitprep-ui

UnitPrep's frontend: a thin Next.js UI over [`unitprep-api`](../unitprep-api).
It has no business logic of its own — it drives a browser folder upload
through the backend's session pipeline (upload → discover → validate →
analyze → export) and renders whatever the API returns.

## Running

```bash
npm install
npm run dev
```

Starts the UI on `http://localhost:3000`. It talks to the API at
`NEXT_PUBLIC_API_URL` (defaults to `http://127.0.0.1:8080` — see
`lib/api.ts`); point it at a deployed API URL via `.env.local` when not
running both locally.

For a production build: `npm run build && npm run start`.

## Page flow

- `app/page.tsx` — folder picker, upload + discover. On success, routes
  to `/results/[sessionId]`.
- `app/results/[sessionId]/page.tsx` → `components/ScanResultsPage.tsx` —
  runs `/validate`, shows Error/Warning issues with inline correction
  (`/correct`), dimension exemption (`/exempt-dimensions`), and an
  explicit "acknowledge and export anyway" override for unresolved
  errors. Routes to `/export/[sessionId]` on confirm.
- `app/export/[sessionId]/page.tsx` → `components/ExportCompletePage.tsx`
  — runs `/analyze`, shows net-new/similar-group/advisory findings, then
  `/export` streams back a ZIP built entirely in memory.

Every page that depends on an existing session (results, export) treats
an HTTP 404 from the API as an expired/invalid session and renders
`components/SessionExpiredPage.tsx` instead of a confusing empty result
— sessions are in-memory on the API side with a 10-minute idle timeout.

## Current security posture

**No authentication or authorization exists anywhere in this app or the
API today.** Any client that can reach the API can create, read, correct,
and export any session if it has (or guesses) the session id. Session
ids are random UUIDs, so this isn't trivially exploitable, but it is not
a security boundary — anyone on the network path to the API has the same
access as the intended user. This is an accepted, deliberate gap for the
current internal, single-operator usage pattern, not an oversight — but
it needs to be closed before this is exposed beyond that (e.g. once
"deliver output to client" means client-facing access rather than a
ZIP handed over out of band).

## Project layout

- `app/` — routes (upload/discover, results/validation, export).
- `components/` — page-level components and the `export/` subfolder's
  hooks (`useAnalysis`, `useExportDownload`) and result tables.
- `lib/api.ts` — `API_URL` and the fire-and-forget session-cancel call.
- `types/api.ts` — request/response shapes mirrored 1:1 from the Rust
  structs they correspond to (see the file's own header comment for the
  mapping) — a backend field rename should show up here as a TypeScript
  error, not a silent runtime mismatch.
