# DECISIONS

Status: Append-only. Never edit past entries.

---

## Decision threshold

Log a decision if any of the following is true:
- Locks in a technology, library, or vendor.
- Changes ownership or structure of a file or module.
- Cannot be reversed in under 30 minutes.
- Contradicts a previous entry in this file.

If unsure: log it.

---

## Template

## YYYY-MM-DD — Title

Decision: One sentence.
Context: Why this came up.
Rationale: Why this option over others.
Consequences: What this locks in or rules out.
Alternatives_Rejected: What was considered and why it lost.

---

## 2026-05-29 — Bootstrap context architecture

Decision: Adopted bootstrap protocol with single canonical `AGENTS.md` and thin routers per tool (CLAUDE.md, GEMINI.md, .cursor).
Context: Project already in progress; context architecture was flat (AGENTS.md + MAGNUM.md + tree.md all loaded unconditionally).
Rationale: Conditional loading reduces context bloat per session; separation into docs/PRODUCT.md, docs/TECH.md, docs/BACKLOG.md, docs/DECISIONS.md, docs/RUNBOOK.md mirrors standard project management and makes each file independently loadable.
Consequences: MAGNUM.md and DB_SCHEMA.md retired; their content lives in docs/TECH.md. CLAUDE.md now loads only AGENTS.md (no direct @tree.md or @MAGNUM.md). All agents must read AGENTS.md before acting.
Alternatives_Rejected: Keep flat structure — causes context bloat and forces every agent to load all technical detail regardless of task.

---

## 2026-05-xx — Enable Banking as PSD2 provider

Decision: Use Enable Banking as the sole PSD2 API provider via `IProvider` abstraction.
Context: Need to connect multiple European banks without maintaining direct integrations per bank.
Rationale: Enable Banking aggregates multiple ASPSPs; one integration covers all target banks. RS256 JWT auth is well-understood.
Consequences: All bank API calls go through `lib/providers/enablebanking.ts`. Adding a bank requires only a new entry in `lib/banks.config.ts`.
Alternatives_Rejected: Direct bank APIs — each bank has a different PSD2 implementation, maintenance cost too high for personal use.

---

## 2026-05-xx — better-sqlite3 (synchronous SQLite)

Decision: Use better-sqlite3 with a local `data.db` file. No ORM, no migration files.
Context: Personal single-user tool; no need for cloud DB, connection pooling, or schema migration tooling.
Rationale: Synchronous API fits Next.js Server Actions cleanly. No external dependencies. Migrations as `try/catch ALTER TABLE` in `lib/db.ts` are simple and transparent.
Consequences: DB is a local file only. No horizontal scaling possible. `serverExternalPackages: ["better-sqlite3"]` required in `next.config.ts`.
Alternatives_Rejected: Prisma — ORM overhead not justified for single-user tool. PostgreSQL — no cloud hosting needed.

---

## 2026-05-xx — Flat dot-notation taxonomy (29 paths)

Decision: Replace multi-level category/subcategory with a flat list of 29 dot-notation `category_path` values in `lib/taxonomy.ts`.
Context: Previous two-column (category + subcategory) approach created inconsistencies and made analytics queries more complex.
Rationale: Single `category_path` column with derived metadata (`cashflow_type`, `behavior_bucket`, `is_subscription`, `is_excluded_from_spending`) via `deriveCategoryMetadata()` is deterministic and queryable. Propagation scripts and LLM prompts are simpler with a flat list.
Consequences: Legacy `category` and `subcategory` columns are no longer the source of truth. All analytics filter on `category_path`. UI shows single path dropdown, not two separate selectors.
Alternatives_Rejected: Hierarchical tree taxonomy — more flexible but harder to query, harder to propagate, harder to give to LLMs.

---

## 2026-05-xx — 5-dimensional governance architecture

Decision: Add five columns to `transactions` (`categorization_source`, `confidence_level`, `review_status`, `applied_rule_id`, `applied_rule_detail`) to track how each category was assigned and how trustworthy it is.
Context: After propagation passes, many transactions have automatically assigned categories with varying reliability. Need a way to distinguish high-confidence automated assignments from low-confidence guesses.
Rationale: Enables a review queue sorted by confidence ascending. Protects manual edits via `category_is_manual = 1`. Provides full audit trail for any category assignment.
Consequences: All category writes (scripts, UI, imports) must populate all 5 governance columns. PSP downgrade rule applies automatically in propagation passes.
Alternatives_Rejected: Single `is_reviewed` boolean — too coarse, no confidence gradient. External review table — over-engineered for single-user tool.
