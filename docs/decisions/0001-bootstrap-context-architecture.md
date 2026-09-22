# 0001 — Bootstrap context architecture

Date: 2026-05-29
Status: Accepted
Decision: Adopted bootstrap protocol with single canonical `AGENTS.md` and thin routers per tool (CLAUDE.md, GEMINI.md, .cursor).
Context: Project already in progress; context architecture was flat (AGENTS.md + MAGNUM.md + tree.md all loaded unconditionally).
Rationale: Conditional loading reduces context bloat per session; separation into docs/PRODUCT.md, docs/TECH.md, docs/BACKLOG.md, docs/DECISIONS.md, docs/RUNBOOK.md mirrors standard project management and makes each file independently loadable.
Consequences: MAGNUM.md and DB_SCHEMA.md retired; their content lives in docs/TECH.md. CLAUDE.md now loads only AGENTS.md (no direct @tree.md or @MAGNUM.md). All agents must read AGENTS.md before acting.
Alternatives_Rejected: Keep flat structure — causes context bloat and forces every agent to load all technical detail regardless of task.
