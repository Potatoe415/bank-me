# 0005 — 5-dimensional governance architecture

Date: 2026-05-xx
Status: Accepted
Decision: Add five columns to `transactions` (`categorization_source`, `confidence_level`, `review_status`, `applied_rule_id`, `applied_rule_detail`) to track how each category was assigned and how trustworthy it is.
Context: After propagation passes, many transactions have automatically assigned categories with varying reliability. Need a way to distinguish high-confidence automated assignments from low-confidence guesses.
Rationale: Enables a review queue sorted by confidence ascending. Protects manual edits via `category_is_manual = 1`. Provides full audit trail for any category assignment.
Consequences: All category writes (scripts, UI, imports) must populate all 5 governance columns. PSP downgrade rule applies automatically in propagation passes.
Alternatives_Rejected: Single `is_reviewed` boolean — too coarse, no confidence gradient. External review table — over-engineered for single-user tool.
