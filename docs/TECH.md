# TECH

Status: Read-only. Edit only with explicit user authorisation.

---

## File Structure

```text
bank-me/
|-- app/                         # Next.js App Router
|   |-- layout.tsx               # Root layout - queries DB for connected banks, balances, and archived count, passes to Sidebar
|   |-- page.tsx                 # Main transactions page (?bank=<id>)
|   |-- actions.ts               # Server Actions: syncTransactions(bankId), syncAllTransactions(bankIds), toggleTransactionArchive(transactionId), unarchiveAllTransactions(), importCategories(formData), transaction edit-mode/category updates
|   |-- globals.css
|   |-- favicon.ico
|   |-- components/
|   |   |-- BulkCategoryEditor.tsx # Client component - bulk category apply for all visible transaction rows
|   |   |-- Sidebar.tsx          # Client component - bank list, collapse toggle, balance display, navigation, and bulk unarchive action
|   |   |-- CategoryEditor.tsx   # Client component - inline category dropdown with auto-save in transaction edit mode
|   |   |-- TransactionFilters.tsx # Client component - auto-applies transaction filters/search to the main page
|   |   `-- ExportWorkspace.tsx  # Client component - export/taxonomy/import workspace
|   |-- overview/
|   |   `-- page.tsx             # Overview page - all banks, balances, total per currency
|   |-- graphics/
|   |   `-- page.tsx             # Graphics page - spending analytics by category, month, and counterpart
|   |-- graphics-actionable/
|   |   `-- page.tsx             # Actionable graphics page - leak-focused analytics with budget threshold
|   |-- settings/
|   |   |-- page.tsx             # Settings - horizontal tabs for connections, categories, provider config, maintenance, and guide
|   |   |-- CategoriesTab.tsx    # Server component - category CRUD workspace inside Settings
|   |   |-- DisconnectButton.tsx # Client component - confirm dialog before disconnecting bank
|   |   `-- MaintenancePromptBox.tsx # Client component - copy-ready maintenance prompt for future bank reconnection sessions
|   |-- export/
|   |   `-- page.tsx             # Export workflow page - CSV export, taxonomy prompt, category import
|   |-- add-bank/
|   |   `-- page.tsx             # Bank selection UI - shows unconnected banks, links to OAuth
|   |-- api/
|   |   |-- connect/
|   |   |   `-- route.ts         # GET /api/connect?bank=<id> - initiates OAuth redirect
|   |   |-- debug/
|   |   |   `-- accounts/
|   |   |       `-- route.ts     # GET /api/debug/accounts - dev only, dumps Enable Banking session data
|   |   `-- export/
|   |       `-- route.ts         # GET /api/export?banks=id1,id2 - returns export CSV
|   `-- callback/
|       `-- route.ts             # GET /callback?code=&state= - OAuth callback handler
|
|-- lib/
|   |-- banks.config.ts          # Central bank registry (id, name, aspspName, country, color, initial)
|   |-- category-import.ts       # CSV parsing + category-only import logic
|   |-- db.ts                    # SQLite init, schema, migrations
|   |-- graphics-periods.ts      # Shared graphics period options/helpers for /graphics and /graphics-actionable
|   |-- taxonomy.ts              # Shared editable category taxonomy + metadata derivation helpers
|   |-- transaction-edit-mode.ts # Cookie name/parser for transaction edit mode
|   `-- providers/
|       |-- types.ts             # IProvider interface, Transaction type, Balance type
|       |-- index.ts             # getProvider() factory
|       |-- enablebanking.ts     # Production provider - Enable Banking PSD2 API
|       `-- mock.ts              # Mock provider for local dev without credentials
|
|-- data.db                      # SQLite database (gitignored)
|-- .env.local                   # Secrets (gitignored) - see .env.local.example
|-- next.config.ts
|-- AGENTS.md                    # Canonical agent protocol (all routers point here)
|-- CLAUDE.md                    # Claude Code router → @AGENTS.md
|-- GEMINI.md                    # Gemini CLI router → @AGENTS.md
|-- STATE.md                     # Current session state (replaced each session)
|-- docs/
|   |-- PRODUCT.md               # Product scope and features (read-only)
|   |-- TECH.md                  # This file
|   |-- BACKLOG.md               # Task backlog (living document)
|   |-- DECISIONS.md             # Architecture decisions log (append-only)
|   `-- RUNBOOK.md               # Commands for run/build/test/deploy/migrate
|-- .cursor/
|   `-- rules/
|       `-- 000-router.mdc       # Cursor always-on router → @AGENTS.md
|-- scripts/
|   |-- import_ing_history.py        # Imports historical ING CSV exports into data.db
|   |-- import_boursorama_history.py # Imports historical Boursorama CSV exports into data.db
|   |-- import_revolut_history.py    # Imports historical Revolut CSV exports into data.db
|   |-- import_amex_history.py       # Imports historical American Express CSV exports into data.db
|   |-- propagate_categories.py      # 4-pass category propagation; exports uncategorized_remaining.csv
|   |-- import_reviewed_batches.py   # Imports reviewed taxonomy batch CSVs back into data.db
|   |-- export_unknown_batches.py    # Exports uncategorized transactions and splits into review batches
|   `-- split_uncategorized.py       # Splits uncategorized_remaining.csv into review batches
|-- taxonomy_prompt.md           # Markdown source for the taxonomy prompt shown in /export
|-- SPEC_FONCTIONNELLE.md
`-- SPEC_TECHNIQUE.md
```

---

## Key Flows

### Connect a bank
1. User clicks bank in `/add-bank` → `GET /api/connect?bank=<id>`
2. `EnableBankingProvider.connect()` → POST /auth → stores `state` UUID + `authorization_id` in DB → redirects user to bank consent page
3. User authenticates at bank → bank redirects to `/callback?code=&state=`
4. `EnableBankingProvider.handleCallback()` → POST /sessions (exchange code) → stores `session_id` + `account_uids` (state cleared to NULL)
5. Redirect to `/?bank=<id>`

### Sync transactions + balances
1. User clicks "Synchronize" → `syncTransactions(bankId)` Server Action
2. Fetches `lastTx.date` from DB (excluding null dates)
3. `fetchTransactions(since, bankId)` → paginates `GET /accounts/{uid}/transactions`
4. `fetchBalances(bankId)` → `GET /accounts/{uid}/balances`
5. Upserts everything into DB → `revalidatePath("/")`

### Export taxonomy workflow
1. User clicks `Export` in the sidebar → `/export`
2. `/export` downloads a CSV through `GET /api/export` (exports `category_path` column)
3. User runs the taxonomy prompt outside the app and gets back a CSV with `category_path`
4. `importCategories(formData)` parses the CSV and updates `transactions.category_path` + governance columns by `id`
5. Revalidates `/`, `/overview`, and `/export`

### Manual category editing workflow
1. User enables `Edit mode` in the sidebar
2. `/` or `/?bank=<id>` switches category cells to inline single-path dropdowns (CategoryEditor)
3. Each selection auto-saves through `updateTransactionCategory()`
4. The DB row is updated immediately; `category_is_manual = 1` + governance columns written
5. Bulk apply via BulkCategoryEditor in the table header applies to all visible rows

### isConnected logic
- Returns `true` if: state IS NULL (OAuth completed) AND not expired
- Returns `false` if: no row, OR expired, OR state is not NULL (OAuth in progress)
- Note: ING NL may be connected (state NULL) but have empty account_uids — shown as "No accounts" state

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16.2.6 App Router |
| DB | better-sqlite3 (sync, local file `data.db`) |
| Styling | Tailwind CSS v4 (no component libraries) |
| Auth | Enable Banking PSD2 OAuth (RS256 JWT) |
| Language | TypeScript 5, React 19 |

No shadcn, no MUI, no Prisma, no ORM.

---

## Enable Banking API

**Base URL:** `https://api.enablebanking.com`

### JWT Auth
- Algorithm: RS256
- `iss`: `"enablebanking.com"` (fixed string)
- `aud`: `"api.enablebanking.com"`
- `kid`: APP_ID (UUID)
- `expiresIn`: 3600

### Critical field names
- POST `/auth` returns `authorization_id` (not `session_id`)
- POST `/sessions` returns `session_id` + `accounts: [{ uid }]` (one-time only)
- GET `/sessions/{id}` returns `accounts` as `string[]` (UIDs directly, not objects)
- `credit_debit_indicator`: `"DBIT"` = negative, `"CRDT"` = positive
- `status`: `"BOOK"` = finalized/booked transaction; skip non-`BOOK` rows to avoid storing pending card authorizations before settlement
- `remittance_information` is `string[]` (join with space for description)
- `creditor` / `debtor` are objects with `.name`
- `debtor_account_additional_identification`: array; use `scheme_name === "CPAN"` or `"PAN"` for card last4

### Endpoints used
| Method | Path | Purpose |
|---|---|---|
| POST | `/auth` | Initiate OAuth, returns authorization_id + consent URL |
| POST | `/sessions` | Exchange code for session_id + account UIDs |
| GET | `/sessions/{session_id}` | Get session status + account UIDs |
| GET | `/accounts/{uid}/transactions` | Paginated transactions (`date_from`, `date_to`, `continuation_key`) |
| GET | `/accounts/{uid}/balances` | Account balances |

### Endpoints that do not exist
- GET `/accounts` (no session filter — returns 404)
- GET `/sessions/{id}/accounts`
- GET `/accounts?session_id={id}`
- GET `/v2/sessions/{id}`
- POST `/sessions/{id}/refresh`

### Balance types priority
`ITAV` > `CLBD` > `XPCD` > `OTHR`

### Known bank quirks
| Bank | Issue | Status |
|---|---|---|
| ING NL | POST `/sessions` returns `accounts: []` | Unresolved — needs Enable Banking portal config |
| ING NL | `remittance_information` can include Dutch field label `Naam:` in descriptions | Strip the label during provider normalization |
| Boursorama | `aspspName` must be `"Boursorama Banque"` | Fixed |
| All | Some transactions have null `booking_date` | Skip them in `fetchTransactions` |

### OAuth flow state machine
```
connect()        → state = UUID, session_id = authorization_id
handleCallback() → state = NULL, session_id = real session_id, account_uids = [...]
```

`state IS NULL` means OAuth completed. `isConnected()` and layout-connected bank logic depend on it.

---

## DB Schema

SQLite file: `data.db` — managed via `better-sqlite3` (synchronous API).
Migrations live at the bottom of `lib/db.ts` using `try/catch ALTER TABLE`.

### Table: `transactions`

Primary key: `id`
Indexes: `idx_transactions_governance (review_status, confidence_level)`

| # | Column | Type | NOT NULL | Default | Notes |
|---|---|---|---|---|---|
| 0 | `id` | TEXT | — | — | PK — `transaction_id`, `entry_reference`, or generated |
| 1 | `date` | TEXT | ✓ | — | ISO 8601 booking date |
| 2 | `amount` | REAL | ✓ | — | Negative = debit |
| 3 | `currency` | TEXT | ✓ | — | EUR, GBP, USD… |
| 4 | `description` | TEXT | ✓ | — | `remittance_information` joined, or counterpart name |
| 5 | `bank_id` | TEXT | ✓ | — | FK → `BankConfig.id` |
| 6 | `value_date` | TEXT | — | NULL | Nullable |
| 7 | `tx_type` | TEXT | — | NULL | CARD_PAYMENT, TRANSFER, DIRECT_DEBIT… |
| 8 | `counterpart` | TEXT | — | NULL | Creditor/debtor name |
| 9 | `card_last4` | TEXT | — | NULL | Last 4 digits of card |
| 10 | `card_network` | TEXT | — | NULL | VISA, MC… |
| 11 | `archived_at` | TEXT | — | NULL | ISO datetime; NULL = active |
| 12 | `source` | TEXT | ✓ | `'api_enablebanking'` | Data lineage — see values below |
| 13 | `is_deleted` | INTEGER | ✓ | `0` | Soft delete: 0 = active, 1 = deleted |
| 14 | `counterparty_iban` | TEXT | — | NULL | Populated by CSV imports |
| 15 | `resulting_balance` | REAL | — | NULL | Balance after transaction; CSV imports only |
| 16 | `category_is_manual` | INTEGER | ✓ | `0` | 1 = human-locked, blocks automated overwrites |
| 17 | `category_path` | TEXT | ✓ | `'uncategorized'` | Flat dot-notation taxonomy path |
| 18 | `cashflow_type` | TEXT | ✓ | `'expense'` | Derived from `category_path` |
| 19 | `behavior_bucket` | TEXT | ✓ | `'variable'` | Derived from `category_path` |
| 20 | `is_subscription` | INTEGER | ✓ | `0` | 1 for subscription-type paths |
| 21 | `is_excluded_from_spending` | INTEGER | ✓ | `0` | 1 for transfers, income, assets |
| 22 | `reimbursement_of_transaction_id` | TEXT | — | NULL | Links a reimbursement to its original expense |
| 23 | `review_status` | TEXT | ✓ | `'needs_review'` | `confirmed`, `needs_review`, `ignored` |
| 24 | `categorization_source` | TEXT | ✓ | `'ingestion_raw'` | See governance values below |
| 25 | `confidence_level` | TEXT | ✓ | `'low'` | `high`, `medium`, `low` |
| 26 | `applied_rule_id` | TEXT | — | NULL | Rule identifier (e.g. `prop_iban_v1`) |
| 27 | `applied_rule_detail` | TEXT | — | NULL | Human-readable audit detail |

#### `source` values
| Value | Origin |
|---|---|
| `api_enablebanking` | Live sync via Enable Banking PSD2 |
| `csv_ing_historical` | `scripts/import_ing_history.py` |
| `csv_boursorama_historical` | `scripts/import_boursorama_history.py` |
| `csv_revolut_historical` | `scripts/import_revolut_history.py` |
| `csv_amex_historical` | `scripts/import_amex_history.py` |

#### `categorization_source` values
| Value | Trigger |
|---|---|
| `ingestion_raw` | API sync or raw CSV import (no categorization applied) |
| `hardcoded_rule` | Rule coded in importer (e.g. Amex repayment detection) |
| `deterministic_cache` | Exact-match cache lookup |
| `propagation_iban` | Pass 1: IBAN-based propagation |
| `propagation_merchant` | Pass 2: merchant-name propagation |
| `propagation_description` | Pass 3: description-based propagation |
| `propagation_keyword` | Pass 4: keyword fallback propagation |
| `llm` | LLM-assisted CSV import (`importCategories`) |
| `manual` | Manual UI edit or batch review import |

### Table: `provider_tokens`

Primary key: `provider`

| # | Column | Type | NOT NULL | Default | Notes |
|---|---|---|---|---|---|
| 0 | `provider` | TEXT | — | — | PK — format: `enablebanking_<bankId>` |
| 1 | `session_id` | TEXT | ✓ | — | `authorization_id` during OAuth; real `session_id` after callback |
| 2 | `account_uids` | TEXT | ✓ | `'[]'` | JSON array of account UIDs |
| 3 | `expires_at` | TEXT | — | NULL | ISO 8601 |
| 4 | `created_at` | TEXT | ✓ | `datetime('now')` | |
| 5 | `state` | TEXT | — | NULL | UUID during OAuth; NULL after callback — `state IS NULL` means connected |

### Table: `account_balances`

Composite primary key: `(bank_id, account_uid, balance_type)`

| # | Column | Type | NOT NULL | Default | Notes |
|---|---|---|---|---|---|
| 0 | `bank_id` | TEXT | ✓ | — | PK part |
| 1 | `account_uid` | TEXT | ✓ | — | PK part |
| 2 | `balance_type` | TEXT | ✓ | — | PK part — CLBD, ITAV, XPCD, OTHR |
| 3 | `amount` | REAL | ✓ | — | |
| 4 | `currency` | TEXT | ✓ | — | |
| 5 | `updated_at` | TEXT | ✓ | `datetime('now')` | Updated on each sync |

### Table: `taxonomy_entries`

Composite primary key: `(category, subcategory)`

| # | Column | Type | NOT NULL | Default | Notes |
|---|---|---|---|---|---|
| 0 | `category` | TEXT | ✓ | — | PK part — flat dot-notation path (e.g. `variable.groceries`) |
| 1 | `subcategory` | TEXT | ✓ | `''` | PK part — always empty string (subcategory concept removed) |

Seeded at startup with all 29 `category_path` values via `INSERT OR IGNORE` in `lib/db.ts`.

---

## SQLite / better-sqlite3

- Synchronous API — no async/await needed
- `INSERT OR IGNORE` for transactions (idempotent sync)
- Transaction sync/import must never overwrite existing transaction fields other than category and governance columns on `id` conflict
- `INSERT ... ON CONFLICT DO UPDATE` for balances and provider tokens
- Migrations live at the bottom of `lib/db.ts` using `try/catch ALTER TABLE`
- Never use `INSERT OR REPLACE` on `provider_tokens`; it wipes `account_uids`
- Category import updates only `category_path` and all 5 governance columns

---

## Next.js 16 App Router specifics

- Server Actions must live in files with `"use server"` at the top
- `searchParams` in `page.tsx` is a `Promise` and must be awaited
- `useSearchParams()` in Client Components requires a `<Suspense>` boundary in layout
- `revalidatePath()` can be called in Server Functions and Route Handlers
- `redirect()` throws and should run outside `try/catch` in Server Actions
- `serverExternalPackages: ["better-sqlite3"]` is required in `next.config.ts`

---

## Taxonomy

### Flat path taxonomy (29 paths)

```
income.regular          income.extra            income.reimbursement
fixed.housing           fixed.utilities         fixed.insurance
fixed.subscriptions.work  fixed.subscriptions.leisure
fixed.obligations       fixed.fees
variable.groceries      variable.restaurant     variable.food_delivery
variable.leisure        variable.transport      variable.shopping
irregular.travel        irregular.maintenance   irregular.medical
irregular.events        irregular.admin
assets.savings          assets.investments.core assets.investments.speculative
transfers.internal      transfers.credit_card
transfers.cash.withdrawal  transfers.cash.deposit
uncategorized
```

| Path | Meaning |
|---|---|
| `variable.restaurant` | Repas assis, cafés, bars-restos (sit-down dining) |
| `variable.food_delivery` | Commande en ligne, pickup, à emporter (delivery/takeaway) |

- `formatCategoryPath('variable.groceries')` → `"Variable / Groceries"` (utility in `lib/taxonomy.ts`)
- `deriveCategoryMetadata(path)` → deterministic `{ cashflow_type, behavior_bucket, is_subscription, is_excluded_from_spending }` from `METADATA` map in `lib/taxonomy.ts`

### Category DB columns
- `category_path` TEXT NOT NULL DEFAULT `'uncategorized'` — the canonical taxonomy path
- `cashflow_type` TEXT — `income`, `expense`, `reimbursement`, `transfer`, `allocation`
- `behavior_bucket` TEXT — `fixed`, `variable`, `irregular`, `asset`, `neutral`
- `is_subscription` INTEGER — 1 for subscription-type paths
- `is_excluded_from_spending` INTEGER — 1 for transfers, income, assets; excludes row from spend analytics
- `reimbursement_of_transaction_id` TEXT nullable — links a reimbursement to the original expense
- `review_status` TEXT — `auto`, `manual`, `needs_review`

### Category actions
- `updateTransactionCategory(transactionId, categoryPath)` — derives metadata from path, writes all 6 columns + `category_is_manual = 1`, revalidates
- `bulkUpdateTransactionCategories(transactionIds, categoryPath)` — same derivation in a single SQLite transaction
- `addTaxonomyCategory(path)` — adds flat path to `taxonomy_entries`
- `renameTaxonomyCategory(old, new)` — renames path in `taxonomy_entries`, updates `category_path` in transactions, re-derives metadata
- `deleteTaxonomyCategory(path)` — clears `category_path` to `'uncategorized'` for matching transactions, removes from `taxonomy_entries`

---

## 5-Dimensional Governance Architecture

Five columns jointly describe how a `category_path` was assigned and how trustworthy it is:

| Column | Type | Values |
|---|---|---|
| `categorization_source` | TEXT NOT NULL DEFAULT `'ingestion_raw'` | `manual`, `hardcoded_rule`, `deterministic_cache`, `propagation_iban`, `propagation_merchant`, `propagation_description`, `propagation_keyword`, `llm`, `ingestion_raw` |
| `confidence_level` | TEXT NOT NULL DEFAULT `'low'` | `high`, `medium`, `low` |
| `review_status` | TEXT NOT NULL DEFAULT `'needs_review'` | `confirmed`, `needs_review`, `ignored` |
| `applied_rule_id` | TEXT nullable | Identifier of the rule that set the category |
| `applied_rule_detail` | TEXT nullable | Human-readable detail string for audit |

**Composite index:** `idx_transactions_governance ON transactions(review_status, confidence_level)`

### Protection rule
`category_is_manual = 1` is the immutable lock. All automated writes must include `WHERE COALESCE(category_is_manual, 0) = 0`.

Manual UI actions write: `category_is_manual = 1`, `categorization_source = 'manual'`, `confidence_level = 'high'`, `review_status = 'confirmed'`, `applied_rule_id = 'ui_manual_action'`.

### Source→governance mapping
| Origin | `categorization_source` | `confidence_level` | `review_status` | `applied_rule_id` |
|---|---|---|---|---|
| API sync (Enable Banking) | `ingestion_raw` | `low` | `needs_review` | NULL |
| CSV imports (ING/Boursorama/Revolut) | `ingestion_raw` | `low` | `needs_review` | `bulk_import_raw` |
| Amex card payment CSV | `ingestion_raw` | `low` | `needs_review` | `bulk_import_raw` |
| Amex repayment CSV | `hardcoded_rule` | `high` | `confirmed` | `amex_repayment_rule` |
| Propagation Pass 1 (IBAN, non-PSP) | `propagation_iban` | `high` | `confirmed` | `prop_iban_v1` |
| Propagation Pass 1 (IBAN, PSP) | `propagation_iban` | `low` | `needs_review` | `prop_iban_psp_override` |
| Propagation Pass 2 (merchant) | `propagation_merchant` | `medium` | `needs_review` | `prop_merchant_v1` |
| Propagation Pass 3 (description) | `propagation_description` | `medium` | `needs_review` | `prop_description_v1` |
| Propagation Pass 4 (keyword, non-PSP) | `propagation_keyword` | `low` | `needs_review` | `prop_keyword_v1` |
| Propagation Pass 4 (keyword, PSP) | `propagation_keyword` | `low` | `needs_review` | `prop_keyword_psp_override` |
| LLM CSV import (`importCategories`) | `llm` | `medium` | `needs_review` | `csv_llm_import` |
| Batch review import | `manual` | `high` | `confirmed` | `csv_batch_review` |
| Manual UI edit | `manual` | `high` | `confirmed` | `ui_manual_action` |
| Migration (pre-existing manual) | `manual` | `high` | `confirmed` | `migration_manual_v1` |

### PSP / aggregator downgrade rule
If the cleaned description or counterpart contains a known PSP marker (PAYPAL, STRIPE, ADYEN, MOLLIE, WISE, REVOLUT, SUMUP, SQUARE), propagation confidence is force-downgraded to `low` + `needs_review` regardless of pass.

### Review queue ordering
```sql
ORDER BY CASE confidence_level WHEN 'low' THEN 1 WHEN 'medium' THEN 2 WHEN 'high' THEN 3 ELSE 4 END ASC, date DESC
```

---

## Transaction Filters

- `app/page.tsx` supports GET filters: `from`, `to`, `category` (maps to `category_path`), `query`, `amount`
- Name search: `description` and `counterpart` with case-insensitive partial search
- Amount search: compares `ABS(amount)`; supports `>`, `<`, `>=`, `<=` operators
- Category dropdown: derived from the currently scoped dataset
- Pagination: page size 100; preserves bank scope and filters via URL

---

## Graphics Pages

- `/graphics` — spending analytics by category, month, counterpart
- `/graphics-actionable` — leak-focused, subcategory drilldown, budget threshold
- Both use: `amount < 0`, `cashflow_type = 'expense'`, `is_excluded_from_spending = 0`
- Period options centralized in `lib/graphics-periods.ts`
- `period=1095d` = "3 last years" preset
- Budget threshold line at `1200` units on `/graphics-actionable`
- No external chart dependencies — CSS/SVG-style visuals only

---

## Settings Workspace

- `/settings` includes an SQL tab for ad hoc SQLite inspection
- Read-only mode: single `SELECT`, `WITH`, `PRAGMA`, or `EXPLAIN` statement; capped at 200 rows
- Admin mode: multiple statements, writes allowed (`INSERT`, `UPDATE`, `DELETE`, `ALTER`, etc.)
- Blocked always: `ATTACH`, `DETACH`, `VACUUM`, `REINDEX`, `ANALYZE`, transaction-control

---

## American Express Handling

- Recommended: connect Amex as its own bank feed through Enable Banking
- Amex card purchases = canonical spending events
- Repayment movement = `transfers.credit_card` (excluded from spending analytics)
- `scripts/import_amex_history.py` auto-assigns `transfers.credit_card` for rows where description contains "PRELEVEMENT"

---

## Transaction Archiving

- `transactions.archived_at` stores archive state; NULL = active
- `toggleTransactionArchive(transactionId)` — reversible toggle
- `unarchiveAllTransactions()` — bulk restore from sidebar
- Archived transactions: visible in lists (muted), excluded from counts/analytics/export

---

## Historical CSV Imports

### ING NL (`scripts/import_ing_history.py`)
- Input: `historical_data/ing/*.csv` (semicolon-delimited, UTF-8)
- Row ID: MD5 of `Date_Amount(EUR)_Name/Description_Counterparty_Resulting balance`
- `counterparty_iban` = `Counterparty` column; `counterpart` = `Name / Description`

### Boursorama (`scripts/import_boursorama_history.py`)
- Input: `historical_data/boursorama/*.csv` (semicolon-delimited, UTF-8 BOM)
- Row ID: MD5 of `{filename}_{row_index}_{dateOp}_{amount}_{label}`
- File encoding must be `utf-8-sig`

### Revolut (`scripts/import_revolut_history.py`)
- Input: `historical_data/revolut/*.csv` (comma-delimited, UTF-8)
- Row ID: MD5 of `{filename}_{row_index}_{Started Date}_{Amount}_{Description}`
- REVERTED rows: `is_deleted = 1` (soft-deleted)

### American Express (`scripts/import_amex_history.py`)
- Input: `historical_data/amex/*.csv` (comma-delimited, UTF-8)
- Row ID: MD5 of `{filename}_{row_index}_{Référence stripped of single quotes}`
- Signs inverted (Amex exports charges as positive; schema = negative)
- `bank_id = 'americanex'`

---

## Category Propagation (`scripts/propagate_categories.py`)

- Pass 1 (IBAN, non-PSP): `propagation_iban` / `high` / `confirmed` / `prop_iban_v1`
- Pass 1 (IBAN, PSP): downgraded to `low` / `needs_review` / `prop_iban_psp_override`
- Pass 2 (merchant): `propagation_merchant` / `medium` / `needs_review`
- Pass 3 (description): `propagation_description` / `medium` / `needs_review`
- Pass 4 (keyword): majority rule — at least 2 rows, at least 75% agreement
- Exports still-unresolved active rows to `uncategorized_remaining.csv`

---

## Uncategorized Review Batches

- `scripts/split_uncategorized.py` — splits `uncategorized_remaining.csv` into `uncategorized_batch_*.csv` (default 50 rows each)
- `scripts/export_unknown_batches.py` — exports all `category_path = 'uncategorized'` rows + splits
- `scripts/import_reviewed_batches.py` — imports `uncategorized_batch_*_reviewed.csv` and `unknown_batch_*_reviewed.csv` back into DB

---

## Export / Import Workflow

- Sidebar `Export` → `/export`
- `GET /api/export` — exports `category_path` column; accepts `from` and `to` params (default: last 30 days)
- `importCategories(formData)` — parses CSV, matches by `id`, updates `category_path` and governance columns
- Blank imported values preserve existing DB values
- `taxonomy_prompt.md` — loaded server-side by `app/export/page.tsx`

---

## Environment Variables

| Variable | Description |
|---|---|
| `ENABLE_BANKING_APP_ID` | UUID of the Enable Banking application |
| `ENABLE_BANKING_PRIVATE_KEY` | RS256 private key (PEM, `\n` escaped) |
| `NEXT_PUBLIC_APP_URL` | Public HTTPS URL (tunnel or production) — used for OAuth redirect |

---

## Tunnel (dev OAuth only)

Cloudflare tunnel required for HTTPS callback during initial OAuth.
`NEXT_PUBLIC_APP_URL` must be set to the tunnel URL in `.env.local`.
After initial connection, localhost works for browsing and syncing.
Add the tunnel domain to `allowedDevOrigins` in `next.config.ts` to suppress HMR warnings.

---

## Bugs Fixed (do not reintroduce)

1. Reconnect upserts must not wipe `account_uids`
2. `date_from` must never become `"nullT00:00"`
3. GET `/sessions` account lists can be `string[]`, not `{ uid: string }[]`
4. `handleCallback()` must return `bankId`
5. `syncTransactions()` must catch sync errors and redirect with `sync_error`
6. Boursorama pending card authorizations must not be ingested alongside booked transactions

---

## Provider Key Format

`enablebanking_{bankId}` — e.g. `enablebanking_revolut`

## Mock Provider

Mock transactions must include the full canonical `Transaction` shape from `lib/providers/types.ts`.

## TypeScript

- `lib/providers/types.ts` includes all 5 governance fields; all providers must populate them
- `category_is_manual = 0` — providers never set this to 1; only UI actions do
