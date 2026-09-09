# unitprep-ui

UnitPrep's frontend: a Next.js UI over [`unitprep-api`](../unitprep-api).
It carries no independent business logic — every page drives one of the
backend's session or CRUD flows and renders whatever the API returns;
request/response shapes in `types/api.ts` are mirrored 1:1 from the
Rust structs behind them.

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

```bash
npm run test
```

414 tests via Vitest, plus a Playwright end-to-end suite (`npm run
test:e2e`).

## What's here

Sign-in is real: passkey (WebAuthn) with a TOTP fallback, no
passwords, no self-signup — an admin issues an invite. See
`unitprep-api`'s [AUTHENTICATION.md](../unitprep-api/AUTHENTICATION.md)
for the full architecture; `RequirePermission` gates every admin
surface below against the signed-in user's actual permission set, not
a hardcoded role name.

Once signed in, the left nav is grouped into:

- **Tools** — Clients (search, import from Process Street, and manage
  each facility's own data — General/Users/DropBox/Elavon/Fees/Taxes/
  Delinquency/Coverage/Specials), QMS Tags (the template-tag reference
  catalog), and Activity Logs (the client-ops operations trail —
  imports, dedup/Group Prep runs, Process Street syncs).
- **Integrations** (admin-only) — Process Street and Dropbox
  credentials/settings.
- **Administration** (admin-only) — Users, Roles, Security Policies,
  and Security Logs (the auth audit trail — kept separate from
  Activity Logs on purpose, see `LeftNav.tsx`'s own comment).
- **Account** — the signed-in user's own passkey/TOTP settings.

Three standalone data-prep tools live under a client's own page, each
its own upload → process → export session: Group Prep (unit-group
comparison), duplicate tenant check (dedup), and Template Tagger. Every
page that depends on an existing session treats an HTTP 404 from the
API as an expired/invalid session and renders an explicit
"session expired" screen rather than a confusing empty result —
sessions are in-memory on the API side with a 10-minute idle timeout.

## Project layout

- `app/` — routes, grouped under `(app)` for everything behind sign-in
  (clients, admin, integrations, account) plus the standalone
  `login`/`invites/[token]`/`onboarding` pages.
- `components/` — page-level components, grouped by area
  (`clients/`, `facility/`, `dedup/`, `tagger/`, `export/`,
  `scan-results/`, `admin/`, `integrations/`, `nav/`).
- `lib/` — typed API clients (one module per backend area), shared
  hooks (`useSessionAction`, `useSaveStatus`, `useInfiniteLogFeed`),
  and `api.ts` (`API_URL` + fetch plumbing).
- `types/api.ts` — request/response shapes mirrored 1:1 from the Rust
  structs they correspond to — a backend field rename should show up
  here as a TypeScript error, not a silent runtime mismatch.
