import Database from "better-sqlite3";
import path from "path";
import { CATEGORY_PATHS, deriveCategoryMetadata } from "@/lib/taxonomy";

const db = new Database(path.join(process.cwd(), "data.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id          TEXT PRIMARY KEY,
    date        TEXT NOT NULL,
    amount      REAL NOT NULL,
    currency    TEXT NOT NULL,
    description TEXT NOT NULL,
    bank_id     TEXT NOT NULL DEFAULT 'revolut',
    category_is_manual INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS provider_tokens (
    provider       TEXT PRIMARY KEY,
    session_id     TEXT NOT NULL,
    account_uids   TEXT NOT NULL DEFAULT '[]',
    expires_at     TEXT,
    state          TEXT,
    created_at     TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS account_balances (
    bank_id      TEXT NOT NULL,
    account_uid  TEXT NOT NULL,
    balance_type TEXT NOT NULL,
    amount       REAL NOT NULL,
    currency     TEXT NOT NULL,
    updated_at   TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (bank_id, account_uid, balance_type)
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS taxonomy_entries (
    category    TEXT NOT NULL COLLATE NOCASE,
    subcategory TEXT NOT NULL DEFAULT '' COLLATE NOCASE,
    PRIMARY KEY (category, subcategory)
  );
`);

// Legacy column migrations
try { db.exec("ALTER TABLE transactions ADD COLUMN bank_id TEXT NOT NULL DEFAULT 'revolut'"); } catch {}
try { db.exec("ALTER TABLE provider_tokens ADD COLUMN state TEXT"); } catch {}
try { db.exec("ALTER TABLE transactions ADD COLUMN value_date TEXT"); } catch {}
try { db.exec("ALTER TABLE transactions ADD COLUMN tx_type TEXT"); } catch {}
try { db.exec("ALTER TABLE transactions ADD COLUMN counterpart TEXT"); } catch {}
try { db.exec("ALTER TABLE transactions ADD COLUMN card_last4 TEXT"); } catch {}
try { db.exec("ALTER TABLE transactions ADD COLUMN card_network TEXT"); } catch {}
try { db.exec("ALTER TABLE transactions ADD COLUMN category_is_manual INTEGER NOT NULL DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE transactions ADD COLUMN archived_at TEXT"); } catch {}
try { db.exec("ALTER TABLE transactions ADD COLUMN source TEXT NOT NULL DEFAULT 'api_enablebanking'"); } catch {}
try { db.exec("ALTER TABLE transactions ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE transactions ADD COLUMN counterparty_iban TEXT"); } catch {}
try { db.exec("ALTER TABLE transactions ADD COLUMN resulting_balance REAL"); } catch {}
try { db.exec("ALTER TABLE transactions DROP COLUMN category"); } catch {}
try { db.exec("ALTER TABLE transactions DROP COLUMN subcategory"); } catch {}

// New taxonomy metadata columns
try { db.exec("ALTER TABLE transactions ADD COLUMN category_path TEXT NOT NULL DEFAULT 'uncategorized'"); } catch {}
try { db.exec("ALTER TABLE transactions ADD COLUMN cashflow_type TEXT NOT NULL DEFAULT 'expense'"); } catch {}
try { db.exec("ALTER TABLE transactions ADD COLUMN behavior_bucket TEXT NOT NULL DEFAULT 'variable'"); } catch {}
try { db.exec("ALTER TABLE transactions ADD COLUMN is_subscription INTEGER NOT NULL DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE transactions ADD COLUMN is_excluded_from_spending INTEGER NOT NULL DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE transactions ADD COLUMN reimbursement_of_transaction_id TEXT"); } catch {}
try { db.exec("ALTER TABLE transactions ADD COLUMN review_status TEXT NOT NULL DEFAULT 'needs_review'"); } catch {}

// Phase 2 — governance columns
try { db.exec("ALTER TABLE transactions ADD COLUMN categorization_source TEXT NOT NULL DEFAULT 'ingestion_raw'"); } catch {}
try { db.exec("ALTER TABLE transactions ADD COLUMN confidence_level TEXT NOT NULL DEFAULT 'low'"); } catch {}
try { db.exec("ALTER TABLE transactions ADD COLUMN applied_rule_id TEXT"); } catch {}
try { db.exec("ALTER TABLE transactions ADD COLUMN applied_rule_detail TEXT"); } catch {}

// Governance composite index
db.exec("CREATE INDEX IF NOT EXISTS idx_transactions_governance ON transactions(review_status, confidence_level)");

// Backfill NOT NULL constraints on older rows
db.exec("UPDATE transactions SET source = 'api_enablebanking' WHERE source IS NULL OR source = ''");
db.exec("UPDATE transactions SET is_deleted = 0 WHERE is_deleted IS NULL");
db.exec("UPDATE transactions SET category_is_manual = 0 WHERE category_is_manual IS NULL");

// Phase 2 governance migration
// Map old review_status values ('auto'/'manual') to new schema ('confirmed'/'needs_review')
db.exec(`
  UPDATE transactions SET review_status = 'confirmed'
  WHERE review_status IN ('auto', 'manual')
`);

// Backfill governance columns for manually edited rows
db.exec(`
  UPDATE transactions
  SET categorization_source = 'manual',
      confidence_level = 'high',
      review_status = 'confirmed',
      applied_rule_id = 'migration_manual_v1'
  WHERE category_is_manual = 1
    AND (categorization_source = 'ingestion_raw' OR applied_rule_id IS NULL)
`);

// Backfill cashflow_type / behavior_bucket / is_subscription / is_excluded_from_spending
// from category_path for any rows that still carry default values
db.transaction(() => {
  const rows = db
    .prepare("SELECT DISTINCT category_path FROM transactions WHERE cashflow_type = 'expense' AND behavior_bucket = 'variable'")
    .all() as Array<{ category_path: string }>;

  const update = db.prepare(
    `UPDATE transactions
     SET cashflow_type = ?, behavior_bucket = ?, is_subscription = ?, is_excluded_from_spending = ?
     WHERE category_path = ?`
  );

  for (const { category_path } of rows) {
    const meta = deriveCategoryMetadata(category_path);
    update.run(meta.cashflow_type, meta.behavior_bucket, meta.is_subscription, meta.is_excluded_from_spending, category_path);
  }
})();

// Seed taxonomy_entries with the canonical flat paths
// Existing custom entries are preserved via INSERT OR IGNORE
db.exec("DELETE FROM taxonomy_entries WHERE subcategory != ''");

const insertPath = db.prepare("INSERT OR IGNORE INTO taxonomy_entries (category, subcategory) VALUES (?, '')");
for (const p of CATEGORY_PATHS) {
  insertPath.run(p);
}

export default db;
