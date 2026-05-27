# tree.md - bank-me architecture map

## Project Root

```text
bank-me/
|-- app/                         # Next.js App Router
|   |-- layout.tsx               # Root layout - queries DB for connected banks, balances, and archived count, passes to Sidebar
|   |-- page.tsx                 # Main transactions page (?bank=<id>)
|   |-- actions.ts               # Server Actions: syncTransactions(bankId), syncAllTransactions(bankIds), toggleTransactionArchive(transactionId), unarchiveAllTransactions(), importCategories(formData)
|   |-- globals.css
|   |-- favicon.ico
|   |-- components/
|   |   |-- Sidebar.tsx          # Client component - bank list, collapse toggle, balance display, navigation, and bulk unarchive action
|   |   |-- TransactionFilters.tsx # Client component - auto-applies transaction filters/search to the main page
|   |   `-- ExportWorkspace.tsx  # Client component - export/taxonomy/import workspace
|   |-- overview/
|   |   `-- page.tsx             # Overview page - all banks, balances, total per currency
|   |-- graphics/
|   |   `-- page.tsx             # Graphics page - spending analytics by category, month, and counterpart
|   |-- graphics-actionable/
|   |   `-- page.tsx             # Actionable graphics page - leak-focused analytics with subcategory drilldown and budget threshold
|   |-- settings/
|   |   |-- page.tsx             # Settings - sessions status, EB config, guide tunnel/reauth
|   |   `-- DisconnectButton.tsx # Client component - confirm dialog before disconnecting bank
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
|   |-- category-import.ts       # CSV parsing + category/subcategory-only import logic
|   |-- db.ts                    # SQLite init, schema, migrations
|   `-- providers/
|       |-- types.ts             # IProvider interface, Transaction type, Balance type
|       |-- index.ts             # getProvider() factory
|       |-- enablebanking.ts     # Production provider - Enable Banking PSD2 API
|       `-- mock.ts              # Mock provider for local dev without credentials
|
|-- data.db                      # SQLite database (gitignored)
|-- .env.local                   # Secrets (gitignored) - see .env.local.example
|-- next.config.ts
|-- AGENTS.md                    # AI agent rules for this project
|-- tree.md                      # This file
|-- MAGNUM.md                    # Technical knowledge base
|-- taxonomy_prompt.md           # Markdown source for the taxonomy prompt shown in /export
|-- SPEC_FONCTIONNELLE.md
`-- SPEC_TECHNIQUE.md
```

## DB Schema

### transactions
| Column | Type | Notes |
|---|---|---|
| id | TEXT PK | transaction_id or entry_reference or generated |
| date | TEXT | ISO8601 booking date, never null |
| value_date | TEXT | nullable |
| amount | REAL | negative = debit |
| currency | TEXT | EUR, GBP, USD... |
| description | TEXT | remittance_information or counterpart name |
| counterpart | TEXT | nullable - creditor/debtor name |
| tx_type | TEXT | nullable - CARD_PAYMENT, TRANSFER, DIRECT_DEBIT... |
| card_last4 | TEXT | nullable |
| card_network | TEXT | nullable - VISA, MC... |
| bank_id | TEXT | FK -> BankConfig.id |
| category | TEXT | nullable - taxonomy import/export use |
| subcategory | TEXT | nullable - taxonomy import/export use |
| archived_at | TEXT | nullable - ISO datetime when the transaction is archived |

### provider_tokens
| Column | Type | Notes |
|---|---|---|
| provider | TEXT PK | format: `enablebanking_<bankId>` |
| session_id | TEXT | authorization_id during OAuth, real session_id after callback |
| account_uids | TEXT | JSON array of account UIDs |
| expires_at | TEXT | ISO8601 |
| state | TEXT | UUID during OAuth, NULL after callback completes |
| created_at | TEXT | |

### account_balances
| Column | Type | Notes |
|---|---|---|
| bank_id | TEXT PK part | |
| account_uid | TEXT PK part | |
| balance_type | TEXT PK part | CLBD, ITAV, XPCD, OTHR |
| amount | REAL | |
| currency | TEXT | |
| updated_at | TEXT | updated on each sync |

## Key Flows

### Connect a bank
1. User clicks bank in `/add-bank` -> `GET /api/connect?bank=<id>`
2. `EnableBankingProvider.connect()` -> POST /auth -> stores `state` UUID + `authorization_id` in DB -> redirects user to bank consent page
3. User authenticates at bank -> bank redirects to `/callback?code=&state=`
4. `EnableBankingProvider.handleCallback()` -> POST /sessions (exchange code) -> stores `session_id` + `account_uids` (state cleared to NULL)
5. Redirect to `/?bank=<id>`

### Sync transactions + balances
1. User clicks "Synchronize" -> `syncTransactions(bankId)` Server Action
2. Fetches `lastTx.date` from DB (excluding null dates)
3. `fetchTransactions(since, bankId)` -> paginates `GET /accounts/{uid}/transactions`
4. `fetchBalances(bankId)` -> `GET /accounts/{uid}/balances`
5. Upserts everything into DB -> `revalidatePath("/")`

### Export taxonomy workflow
1. User clicks `Export` in the sidebar -> `/export`
2. `/export` downloads a CSV through `GET /api/export`
3. User runs the taxonomy prompt outside the app and gets back a CSV with `category` + `subcategory`
4. `importCategories(formData)` parses the CSV and updates only `transactions.category` / `transactions.subcategory` by `id`
5. Revalidates `/`, `/overview`, and `/export`

### isConnected logic
- Returns `true` if: state IS NULL (OAuth completed) AND not expired
- Returns `false` if: no row, OR expired, OR state is not NULL (OAuth in progress)
- Note: ING NL may be connected (state NULL) but have empty account_uids - shown as "No accounts" state

## Environment Variables

| Variable | Description |
|---|---|
| ENABLE_BANKING_APP_ID | UUID of the Enable Banking application |
| ENABLE_BANKING_PRIVATE_KEY | RS256 private key (PEM, `\n` escaped) |
| NEXT_PUBLIC_APP_URL | Public HTTPS URL (tunnel or production) - used for OAuth redirect |
