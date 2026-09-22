# 0004 — Flat dot-notation taxonomy (29 paths)

Date: 2026-05-xx
Status: Accepted
Decision: Replace multi-level category/subcategory with a flat list of 29 dot-notation `category_path` values in `lib/taxonomy.ts`.
Context: Previous two-column (category + subcategory) approach created inconsistencies and made analytics queries more complex.
Rationale: Single `category_path` column with derived metadata (`cashflow_type`, `behavior_bucket`, `is_subscription`, `is_excluded_from_spending`) via `deriveCategoryMetadata()` is deterministic and queryable. Propagation scripts and LLM prompts are simpler with a flat list.
Consequences: Legacy `category` and `subcategory` columns are no longer the source of truth. All analytics filter on `category_path`. UI shows single path dropdown, not two separate selectors.
Alternatives_Rejected: Hierarchical tree taxonomy — more flexible but harder to query, harder to propagate, harder to give to LLMs.
