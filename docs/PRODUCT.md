# PRODUCT

Status: Read-only. Edit only with explicit user authorisation.

---

Project_Name: bank-me
Objective: Personal finance tracker with direct bank connections via PSD2 open banking.
Problem: Manual reconciliation of transactions across multiple banks is slow and error-prone; no single view of spending patterns.

Target_Users:
- Single user (the developer), managing personal finances across multiple bank accounts.

Connected_Banks:
- ING NL (PSD2 + historical CSV)
- Boursorama (PSD2 + historical CSV)
- Revolut (PSD2 + historical CSV)
- American Express France (PSD2 + historical CSV)

Core_Features:
- PSD2 bank connection via Enable Banking OAuth flow
- Transaction sync with automatic deduplication
- Flat dot-notation taxonomy (29 paths) for transaction categorization
- Manual inline category editing with governance tracking
- Bulk category assignment across filtered transactions
- Category propagation scripts (IBAN, merchant, description, keyword passes)
- LLM-assisted batch review workflow for uncategorized transactions
- Spending analytics: category split, monthly trend, top counterparts (/graphics)
- Actionable leak analysis with budget threshold (/graphics-actionable)
- CSV export for taxonomy round-trip; category import from reviewed CSVs
- Settings: bank management, SQL workspace, category CRUD, maintenance tools
- Transaction archiving (soft, reversible)
- Historical CSV import scripts for all 4 banks

Non_Goals:
- Multi-user or shared access
- Cloud hosting or SaaS
- Budget goal-setting UI
- Push notifications
- Mobile app

User_Roles:
- Single owner/operator (no role separation needed)

Success_Criteria:
- All transactions across all banks visible in one view
- >90% of transactions categorized with meaningful taxonomy paths
- Spending analytics accurately reflect actual outgoing cash (transfers excluded)
- Category assignments survive bank reconnects and new syncs without regression

Constraints:
- Local-only deployment (localhost or personal tunnel for OAuth)
- No external database — SQLite file only
- No paid dependencies beyond Enable Banking API access

Open_Questions:
- None blocking.
