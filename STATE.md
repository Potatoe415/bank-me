# STATE

Replace on every update. Never append history here beyond the 5-line Recent_Changes list. Max 60 lines.
History lives in git and `docs/decisions/`.

---

Status: Active — Ready.
Focus: Codebase maintenance & bank connections.
Level: L1

Context:
- Working_On: none (idle between tasks)
- Relevant_Files: `AGENTS.md`, `docs/TECH.md`, `docs/PRODUCT.md`
- Do_Not_Touch: `docs/TECH.md`, `docs/PRODUCT.md` (read-only, need explicit authorisation)
- Relevant_Decisions: 0006

Next:
- Connect bank accounts or resume feature development.
- Decide: delete `docs/DECISIONS.md` (superseded by `docs/decisions/`) — needs user confirmation.
- Decide: merge/retire `CLAUDE.md`, `GEMINI.md`, `.cursor/rules/000-router.mdc` (routers only, `AGENTS.md` is read natively) — needs user confirmation.

Open_Questions:
- None blocking.

Blockers:
- None.

Important_Files:
- `AGENTS.md` — canonical protocol
- `docs/PRODUCT.md` — scope (read-only)
- `docs/TECH.md` — file structure, stack, API, schema reference (read-only)
- `docs/ARCHITECTURE.md` — stack table, module-map summary (read-only)
- `docs/SECURITY.md` — security posture (read-only)
- `docs/DEBUGGING.md` — error/logging conventions (living)
- `docs/BACKLOG.md` — current tasks
- `docs/decisions/INDEX.md` — decision log (new, per-file format)

Recent_Changes:
- 2026-09-22 Aligned context architecture with bootstrap v10.1 (docs/ARCHITECTURE.md, docs/SECURITY.md, docs/DEBUGGING.md, docs/_templates/, docs/decisions/, .env.example, .claude/settings.json, .gemini/settings.json).
- 2026-09-22 Created start-local.js + run-local.bat (port 3004, no Cloudflare tunnel).
- 2026-09-22 Committed and pushed updates (graphics-name, category-stats, rule-propagation, PayPal US, cleanup).
- 2026-09-22 Project cleanup: removed ~380 obsolete categorization batch CSVs, scratch scripts, and logs.
- 2026-09-22 Added PayPal US to lib/banks.config.ts.
