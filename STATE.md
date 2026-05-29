# STATE

Rule: Replace content on every update. Never append history here. Max 60 lines.
History lives in `docs/DECISIONS.md` (decisions) and `docs/BACKLOG.md` (tasks).

---

Status: Active — taxonomy v2 live, all historical data imported.
Current_Goal: Ongoing maintenance and incremental improvements.
Last_Action: Export/import consolidation — kept only the web flow; deleted Python batch scripts (export_unknown_batches, import_reviewed_batches, split_uncategorized); added "Uncategorized only" mode to /export (all banks, all dates, no category_path column); API route supports uncategorized_only=1 param.
Next_Actions:
- Identify next feature or improvement to work on.
- Keep `docs/BACKLOG.md` current as tasks emerge.

Open_Questions:
- No blocking questions at this time.

Important_Files:
- `AGENTS.md` — canonical protocol
- `docs/PRODUCT.md` — scope (read-only)
- `docs/TECH.md` — file structure, stack, API, schema reference (read-only)
- `docs/BACKLOG.md` — current tasks

Recent_Changes:
- 2026-05-29 Bootstrap: restructured context architecture; created docs/, STATE.md, GEMINI.md, .cursor/rules/; retired MAGNUM.md, DB_SCHEMA.md, tree.md into docs/TECH.md.
- 2026-05-29 Column visibility: lib/column-prefs.ts + setColumnPreferences action + Settings > Columns tab; Card+ValueDate hidden by default.
- 2026-05-29 PayPal dedup: 274 Boursorama PayPal pull/push transactions excluded from spending (transfers.internal).
- 2026-05-29 Export consolidation: deleted Python batch scripts; added "Uncategorized only" mode to /export + API.
