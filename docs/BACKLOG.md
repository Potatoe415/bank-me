# BACKLOG

Status: Living document. Always reflects current state. Completed work lives in git history, not here.

---

## Now
- [ ] Review and triage `needs_review` transactions remaining after propagation passes.

## Next
- [ ] Explore automatic re-categorization triggers on new synced transactions (apply propagation rules incrementally).
- [ ] Add a "review queue" view filtered to `review_status = 'needs_review'` sorted by confidence ascending.
- [ ] Investigate Enable Banking session refresh / reconnect flow for long-lived sessions.
- [ ] Consider adding a "counterpart detail" drilldown in `/graphics` (click a counterpart → all its transactions).
- [ ] Export improvements: allow filtering by date range in the UI before downloading CSV.
- [ ] Add a single `check` command (typecheck + lint + tests + dependency audit) — see `docs/ARCHITECTURE.md`.
- [ ] Add secret-scanning tool to pre-commit/CI — see `docs/SECURITY.md` known gaps.
- [ ] Add a stable error-code catalog + shared logger + `trace_id` propagation, and a first test runner/tests — see `docs/DEBUGGING.md` known gaps.
- [ ] Decide: delete `docs/DECISIONS.md` now that `docs/decisions/` exists, or keep both — needs user confirmation.
- [ ] Decide: retire `CLAUDE.md`, `GEMINI.md`, `.cursor/rules/000-router.mdc` (routers only; `AGENTS.md` is read natively) — needs user confirmation.
- [ ] Consider gating `/settings` admin SQL mode (arbitrary multi-statement SQL) if the app is ever exposed beyond localhost — see `docs/SECURITY.md`.
- [ ] Avoid leaking raw `Error.message` to the UI via `sync_error`/`import_error` query params — see `docs/SECURITY.md`.

## Blocked
- [ ] ING NL `accounts: []` issue — unresolved, needs Enable Banking portal configuration.
