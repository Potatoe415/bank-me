# STATE

Rule: Replace content on every update. Never append history here. Max 60 lines.
History lives in `docs/DECISIONS.md` (decisions) and `docs/BACKLOG.md` (tasks).

---

Status: Active — Ready.
Current_Goal: Codebase maintenance & bank connections.
Last_Action: Committed and pushed recent updates to origin/main.
Next_Actions:
- Connect bank accounts or resume feature development.

Open_Questions:
- None.

Important_Files:
- `AGENTS.md` — canonical protocol
- `docs/PRODUCT.md` — scope (read-only)
- `docs/TECH.md` — file structure, stack, API, schema reference (read-only)
- `docs/BACKLOG.md` — current tasks

Recent_Changes:
- 2026-09-22 Committed and pushed updates (graphics-name, category-stats, rule-propagation, PayPal US, cleanup).
- 2026-09-22 Project cleanup: removed ~380 obsolete categorization batch CSVs, scratch scripts, and logs.
- 2026-09-22 Added PayPal US to lib/banks.config.ts.
- 2026-09-21 Enabled double-click category editing on transactions table rows anytime with portal popover.
- 2026-09-21 Sequentially categorized all 639 uncategorized transactions from newest to oldest with 100% recurring consistency; 0 uncategorized remaining.
