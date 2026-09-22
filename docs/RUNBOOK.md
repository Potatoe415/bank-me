# RUNBOOK

Load this file only if the task contains: run / test / build / deploy / migrate / install.

---

## Setup

```bash
npm install
cp .env.example .env.local
# Fill in ENABLE_BANKING_APP_ID, ENABLE_BANKING_PRIVATE_KEY, NEXT_PUBLIC_APP_URL
```

Requirements: Node.js 20+, Python 3.x (standard library only for scripts).

---

## Development

```bash
npm run dev       # starts Next.js on http://localhost:3000
```

For OAuth (initial bank connection only): a public HTTPS URL is required.
Use a Cloudflare tunnel and set `NEXT_PUBLIC_APP_URL` to the tunnel URL.
After first connection, localhost works for all browsing and syncing.

---

## Build

```bash
npm run build     # production build
npm run start     # serve production build
```

---

## Database

File: `data.db` (SQLite, local, not committed to git).
Schema migrations: `lib/db.ts` — `try/catch ALTER TABLE` blocks at the bottom.
No migration runner needed. Migrations run automatically on app startup.

Ad hoc queries: use `/settings` → SQL tab in the running app.

---

## Scripts (Python, standard library only)

### Historical CSV import

```bash
python scripts/import_ing_history.py          # ING NL — reads historical_data/ing/*.csv
python scripts/import_boursorama_history.py   # Boursorama — reads historical_data/boursorama/*.csv
python scripts/import_revolut_history.py      # Revolut — reads historical_data/revolut/*.csv
python scripts/import_amex_history.py         # Amex FR — reads historical_data/amex/*.csv
```

### Categorization propagation

```bash
python scripts/propagate_categories.py        # 4-pass propagation; outputs uncategorized_remaining.csv
```

### Batch review workflow

```bash
python scripts/split_uncategorized.py         # splits uncategorized_remaining.csv into batches of 50
python scripts/split_uncategorized.py 100     # custom batch size
python scripts/export_unknown_batches.py      # exports category_path='uncategorized' rows + splits
python scripts/import_reviewed_batches.py     # imports *_reviewed.csv batch files back into DB
```

---

## Troubleshooting

**OAuth callback fails:** Ensure `NEXT_PUBLIC_APP_URL` is set to the active tunnel URL and the tunnel is running.

**ING NL shows "No accounts":** Known issue — `POST /sessions` returns empty `accounts: []`. Requires Enable Banking portal configuration. Not fixable in app code.

**better-sqlite3 module not found:** Ensure `serverExternalPackages: ["better-sqlite3"]` is in `next.config.ts` and run `npm install`.

**`date_from` becomes `"nullT00:00"`:** Check that `lastTx.date` is never null before constructing the sync date range. See MAGNUM bugs section.
