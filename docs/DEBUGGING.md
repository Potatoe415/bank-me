# DEBUGGING

How errors, logs, and tests currently work in this repo (evidence-based, as-is — not the aspirational bootstrap contract). Gaps are listed at the end and tracked in `docs/BACKLOG.md`.

## Current error handling (as observed)

- No stable error-code system. Errors are plain `Error` instances or caught `unknown`, normalized inline with `e instanceof Error ? e.message : String(e)` (pattern repeated in `app/actions.ts`).
- No `trace_id` concept anywhere in the codebase.
- User-facing error surfacing: failed Server Actions `redirect()` back to the calling page with a query param carrying the raw message, e.g.:
  - `syncTransactions` → `/?bank=<id>&sync_error=<message>`
  - `importCategories` → `/export?import_error=<message>`
- Non-fatal errors (e.g. balance fetch failure during sync, propagation failure) are caught, logged with `console.warn`, and swallowed — sync continues for the rest of the flow. This is intentional (see `docs/TECH.md` → "Bugs Fixed" #5) but means partial failures are not surfaced to the user beyond the console.

## Logging (as observed)

- No shared logger. Ad hoc `console.log` / `console.warn` / `console.error` calls, each with a hand-written `[tag]` prefix (e.g. `[sync]`, `[syncAll]`, `[wave1]`, `[custom]`).
- Not structured (no JSON, no consistent fields). Not leveled beyond the `console.*` method used.
- No `trace_id` propagation.
- Files with `console.*` calls observed: `app/actions.ts`, `app/callback/route.ts`, `lib/providers/enablebanking.ts`, `scripts/categorize.js`, `scripts/sim-unknown.js`, `start.js`, `start-local.js`.

## Tests

- No test files, no test runner configured in `package.json`. `npm run` has only `dev`, `build`, `start`.
- No `check` command exists yet (see `docs/BACKLOG.md`).

## Bug workflow (recommended going forward, not yet enforced by tooling)

1. Reproduce. Note the console output (tag + message) and the page/action involved.
2. Locate the file (`app/actions.ts`, a provider in `lib/providers/`, or a script in `scripts/`).
3. Fix the root cause, not the symptom (see `docs/TECH.md` → "Bugs Fixed" for prior examples — do not reintroduce those).
4. Manually verify in the running app (no automated test suite to run yet).

## Known gaps (tracked in `docs/BACKLOG.md`, not fixed by this alignment pass)

- No stable error-code catalog (`E_<SCOPE>_<NNN>`) — errors are ungrouped strings.
- No shared logger, no structured (JSON) logs, no `trace_id`.
- No test runner or test files — bug fixes cannot yet "add a regression test" as the bootstrap contract expects.
- No single `check` command (typecheck + lint + tests).
