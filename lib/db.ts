import Database from "better-sqlite3";
import path from "path";

const db = new Database(path.join(process.cwd(), "data.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS transactions (
    id          TEXT PRIMARY KEY,
    date        TEXT NOT NULL,
    amount      REAL NOT NULL,
    currency    TEXT NOT NULL,
    description TEXT NOT NULL,
    bank_id     TEXT NOT NULL DEFAULT 'revolut'
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

// Migrations for existing installs
try { db.exec("ALTER TABLE transactions ADD COLUMN bank_id TEXT NOT NULL DEFAULT 'revolut'"); } catch {}
try { db.exec("ALTER TABLE provider_tokens ADD COLUMN state TEXT"); } catch {}
try { db.exec("ALTER TABLE transactions ADD COLUMN value_date TEXT"); } catch {}
try { db.exec("ALTER TABLE transactions ADD COLUMN tx_type TEXT"); } catch {}
try { db.exec("ALTER TABLE transactions ADD COLUMN counterpart TEXT"); } catch {}
try { db.exec("ALTER TABLE transactions ADD COLUMN card_last4 TEXT"); } catch {}
try { db.exec("ALTER TABLE transactions ADD COLUMN card_network TEXT"); } catch {}
try { db.exec("ALTER TABLE transactions ADD COLUMN category TEXT"); } catch {}
try { db.exec("ALTER TABLE transactions ADD COLUMN subcategory TEXT"); } catch {}
try { db.exec("ALTER TABLE transactions ADD COLUMN archived_at TEXT"); } catch {}

export default db;
