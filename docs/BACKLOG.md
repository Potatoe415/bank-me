# BACKLOG

Status: Living document. Always reflects current state.

---

## Now
- [ ] Review and triage `needs_review` transactions remaining after propagation passes.

## Next
- [ ] Explore automatic re-categorization triggers on new synced transactions (apply propagation rules incrementally).
- [ ] Add a "review queue" view filtered to `review_status = 'needs_review'` sorted by confidence ascending.

## Later
- [ ] Investigate Enable Banking session refresh / reconnect flow for long-lived sessions.
- [ ] Consider adding a "counterpart detail" drilldown in `/graphics` (click a counterpart → all its transactions).
- [ ] Export improvements: allow filtering by date range in the UI before downloading CSV.

## Blocked
- [ ] ING NL `accounts: []` issue — unresolved, needs Enable Banking portal configuration.

## Done
- [x] Bootstrap project context architecture (AGENTS.md, docs/, STATE.md).
- [x] Flat taxonomy v2 implemented (29 dot-notation paths, `category_path` column).
- [x] 5-dimensional governance architecture (categorization_source, confidence_level, review_status, applied_rule_id, applied_rule_detail).
- [x] Historical CSV import for ING NL, Boursorama, Revolut, American Express.
- [x] Category propagation script (4 passes: IBAN, merchant, description, keyword).
- [x] Uncategorized batch review workflow (export batches → LLM review → import back).
- [x] Inline category editing with auto-save and `category_is_manual` lock.
- [x] Bulk category assignment across filtered visible rows.
- [x] Settings → Categories tab (add/rename/delete taxonomy paths).
- [x] Settings → SQL workspace (read-only + admin mode).
- [x] Transaction archiving (toggle + bulk unarchive).
- [x] Graphics analytics page (/graphics) — category, monthly, counterparts.
- [x] Actionable analytics page (/graphics-actionable) — leak analysis + budget line.
- [x] Transaction filters: date range, category, text search, amount operators.
- [x] Pagination (page size 100, URL-preserved filters).
- [x] Export workflow: CSV export + taxonomy prompt + category import.
- [x] Category Stats Dashboard page (/category-stats) and sidebar navigation menu.
