# MAGNUM.md - Technical Knowledge Base

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
- GET `/accounts` (no session filter - returns 404)
- GET `/sessions/{id}/accounts`
- GET `/accounts?session_id={id}`
- GET `/v2/sessions/{id}`
- POST `/sessions/{id}/refresh`

### Balance types priority
`ITAV` > `CLBD` > `XPCD` > `OTHR`

### Known bank quirks
| Bank | Issue | Status |
|---|---|---|
| ING NL | POST `/sessions` returns `accounts: []` | Unresolved - needs Enable Banking portal config |
| ING NL | `remittance_information` can include Dutch field label `Naam:` in descriptions | Strip the label during provider normalization |
| Boursorama | `aspspName` must be `"Boursorama Banque"` | Fixed |
| All | Some transactions have null `booking_date` | Skip them in `fetchTransactions` |

### OAuth flow state machine
```text
connect() -> state = UUID, session_id = authorization_id
handleCallback() -> state = NULL, session_id = real session_id, account_uids = [...]
```

`state IS NULL` means OAuth completed. `isConnected()` and layout-connected bank logic depend on it.

## SQLite / better-sqlite3

- Synchronous API - no async/await needed
- `INSERT OR IGNORE` for transactions (idempotent sync)
- Transaction sync/import must never overwrite existing transaction fields other than `category` and `subcategory` on `id` conflict
- `INSERT ... ON CONFLICT DO UPDATE` for balances and provider tokens
- Migrations live at the bottom of `lib/db.ts` using `try/catch ALTER TABLE`
- Never use `INSERT OR REPLACE` on `provider_tokens`; it wipes `account_uids`
- Taxonomy CSV import must update only `transactions.category` and `transactions.subcategory`

## Next.js 16 App Router specifics

- Server Actions must live in files with `"use server"` at the top
- `searchParams` in `page.tsx` is a `Promise` and must be awaited
- `useSearchParams()` in Client Components requires a `<Suspense>` boundary in layout
- `revalidatePath()` can be called in Server Functions and Route Handlers
- `redirect()` throws and should run outside `try/catch` in Server Actions
- `serverExternalPackages: ["better-sqlite3"]` is required in `next.config.ts`

## Provider Key Format

`enablebanking_{bankId}` - for example `enablebanking_revolut`

## Mock Provider

- Mock transactions must include the full canonical `Transaction` shape from `lib/providers/types.ts`

## Taxonomy Workflow

- Sidebar `Export` navigates to `/export`
- `/export` centralizes CSV export, taxonomy prompt copy, and category import
- The taxonomy prompt lives in the repo root at `taxonomy_prompt.md` and is loaded server-side by `app/export/page.tsx`
- The current taxonomy splits food into its own `Food` category; `Lifestyle` no longer includes food-related subcategories
- `GET /api/export` can include `category` and `subcategory` columns for round-trip taxonomy work
- Category import is handled by `importCategories(formData)` + `lib/category-import.ts`
- Import rows are matched by transaction `id`
- Blank imported category/subcategory cells preserve existing DB values

## Transaction Filters

- `app/page.tsx` supports GET filters for `from`, `to`, `category`, `subcategory`, `query`, and `amount`
- Name search matches `description` and `counterpart` with case-insensitive partial search
- Amount search compares `ABS(amount)` so `12.50` matches both `12.50` and `-12.50`
- Amount search also supports `>`, `<`, `>=`, and `<=` against `ABS(amount)` such as `> 10` or `<= 25,50`
- Category and subcategory dropdown options are derived from the currently scoped dataset (single bank or all banks)
- The filters UI lives in `app/components/TransactionFilters.tsx` and auto-applies changes with client-side navigation

## American Express Handling

- Recommended method: connect `American Express` as its own bank feed through Enable Banking
- Treat actual Amex card purchases as the canonical spending events
- Categorize the repayment movement between the checking account and Amex exactly as `Internal Transfer`
- This keeps repayment debits out of visible totals and spending analytics, even when one side of the transfer syncs before the other

## Transaction Archiving

- `transactions.archived_at` stores the archive state; `NULL` means active
- Archiving is a reversible toggle handled by `toggleTransactionArchive(transactionId)` in `app/actions.ts`
- `unarchiveAllTransactions()` restores every archived transaction from the sidebar in one action
- Archived transactions stay visible in the transaction lists so they can be restored, but they are visually muted
- Archived transactions are excluded from dashboard counts, graphics analytics, settings transaction counters, and CSV export

## Graphics Page

- `/graphics` is a read-only spending analytics page driven directly from `transactions`
- `/graphics-actionable` is a standalone companion page for expense-cutting analysis; it reuses the same DB scope and filters but changes the ranking logic
- It uses outgoing transactions only (`amount < 0`) and excludes rows where `category = "Internal Transfer"` so transfers and card repayments do not count as spend
- Supported query params:
  - `bank=<id>` to scope analytics to one bank
  - `period=30d|90d|180d|365d|all` to control the date window
- Visuals are dependency-free:
  - category split via CSS/SVG-style cards and a conic-gradient donut
  - monthly trend via simple bar columns
  - top counterparts ranked by total outgoing amount
- Categories combine `category` and `subcategory` when both are present; empty category stays `Uncategorized`
- On `/graphics-actionable`, categories under `Lifestyle` and `Subscriptions` are grouped directly by `subcategory` in the donut/list
- On `/graphics-actionable`, top counterparts exclude `Travel`, ignore transactions where `ABS(amount) > 150`, and rank recurring counterparts by frequency first
- On `/graphics-actionable`, the monthly chart includes a dependency-free visual budget threshold line at `1200` units of the current currency
- `Visible total` metrics on `/` and `/?bank=all` also exclude `category = "Internal Transfer"` rows to avoid temporary sync skew in operational cash-flow totals
- When `from` / `to` are absent from the URL, the filter inputs default to the global earliest and latest transaction dates across all banks

## Tunnel (dev OAuth only)

Cloudflare tunnel is required for HTTPS callback during initial OAuth.
`NEXT_PUBLIC_APP_URL` must be set to the tunnel URL in `.env.local`.
After initial connection, localhost works for browsing and syncing.
Add the tunnel domain to `allowedDevOrigins` in `next.config.ts` to suppress HMR warnings.

## Bugs fixed (do not reintroduce)

1. Reconnect upserts must not wipe `account_uids`
2. `date_from` must never become `"nullT00:00"`
3. GET `/sessions` account lists can be `string[]`, not `{ uid: string }[]`
4. `handleCallback()` must return `bankId`
5. `syncTransactions()` must catch sync errors and redirect with `sync_error`
6. Boursorama pending card authorizations must not be ingested alongside booked transactions
