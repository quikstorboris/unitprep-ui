@AGENTS.md

# Vault (om MCP)

`unitprep-ui` is the Next.js frontend of UnitPrep, tracked in Boris's personal Obsidian vault. This repo reaches that vault through the `om` MCP server registered in `.mcp.json`.

- **Before proposing or implementing any non-trivial design, architecture, or process decision, call `recall` (and `search` if `recall` returns nothing) on the topic first.** Do not proceed on a topic the vault has already decided, rejected, or recorded a gotcha for without surfacing that note to the user. This is a hard rule, not a courtesy check.
- **After finishing a unit of work** — a decision, a bug fix, a shipped feature, a rejected approach, a discovered gotcha — **call `record_work` or `remember` before the session ends**, scoped correctly (`project: unitprep-ui`, `platform`, or `general`).
- Do not call the raw `qmd` MCP server directly if it is ever present here — only `om`, which applies per-memory scope on top of it.

## Design principle: prefer data over hardcoding

Default to treating facts that can change without a deploy — which vendor/format is recognized, lookup tables, anything a non-engineer might reasonably need to add — as data fetched from the API, not as a TS constant baked into a component. `unitprep-api`'s own `client_ops.vendor_format` registry is the backing precedent: vendor recognition is DB-backed there, not hardcoded per tool. Reserve hardcoding here for genuine UI/business logic (form validation, which routes exist, `SUPPORTED_EXTENSIONS` — a real client-side capability check, not vendor data). When it's ambiguous which side of that line something falls on, ask before hardcoding it.
