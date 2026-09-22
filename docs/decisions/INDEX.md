# DECISIONS INDEX

One line per decision. Read this file, then open only the relevant decision.
Decision files are append-only. To change a decision, add a new one that supersedes it.
Template: `docs/_templates/DECISION.md`.

| # | Date | Title | Status |
|---|---|---|---|
| 0001 | 2026-05-29 | Bootstrap context architecture | Accepted |
| 0002 | 2026-05-xx | Enable Banking as PSD2 provider | Accepted |
| 0003 | 2026-05-xx | better-sqlite3 (synchronous SQLite) | Accepted |
| 0004 | 2026-05-xx | Flat dot-notation taxonomy (29 paths) | Accepted |
| 0005 | 2026-05-xx | 5-dimensional governance architecture | Accepted |
| 0006 | 2026-09-22 | Align context architecture with bootstrap v10.1 | Accepted |

Original entries also remain, verbatim, in `docs/DECISIONS.md` pending user confirmation to delete that file.

## When to log a decision

Any of:
- Locks in a technology, library, or vendor.
- Changes the data model, data ownership, or access model.
- Changes module boundaries or dependency directions.
- Cannot be reversed in under 30 minutes.
- Contradicts or supersedes an earlier decision.

If unsure, add an Open_Question to `STATE.md` instead.
