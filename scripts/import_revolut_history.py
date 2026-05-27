"""
Import historical Revolut CSV exports into the bank-me SQLite database.

Usage:
    python scripts/import_revolut_history.py

Scans: historical_data/revolut/*.csv
DB:    data.db (relative to project root)

Standard library only — no external dependencies.
REVERTED rows are inserted with is_deleted=1 (soft-deleted) to retain the
historical trace while excluding them from dashboard computations.
"""

import os
import glob
import csv
import sqlite3
import hashlib

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DB_PATH = os.path.join(PROJECT_ROOT, "data.db")
REVOLUT_DIR = os.path.join(PROJECT_ROOT, "historical_data", "revolut")

INSERT_SQL = """
INSERT OR IGNORE INTO transactions (
    id, date, value_date, amount, currency, description, counterpart,
    tx_type, card_last4, card_network, bank_id, category, subcategory,
    archived_at, source, is_deleted, counterparty_iban, resulting_balance
) VALUES (
    :id, :date, NULL, :amount, :currency, :description, NULL,
    :tx_type, NULL, NULL, :bank_id, NULL, NULL,
    NULL, :source, :is_deleted, NULL, :resulting_balance
)
"""

TX_TYPE_MAP = {
    "Card Payment": "CARD_PAYMENT",
    "Transfer": "TRANSFER",
    "Deposit": "DEPOSIT",
}


def make_id(filename: str, row_index: int, row: dict) -> str:
    raw = f"{filename}_{row_index}_{row['Started Date']}_{row['Amount']}_{row['Description']}"
    return hashlib.md5(raw.encode("utf-8")).hexdigest()


def parse_balance(raw: str) -> float | None:
    cleaned = raw.strip()
    if not cleaned or cleaned.lower() == "nan":
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def normalize_tx_type(raw: str) -> str | None:
    stripped = raw.strip()
    if not stripped:
        return None
    return TX_TYPE_MAP.get(stripped, stripped.upper())


def process_file(conn: sqlite3.Connection, filepath: str) -> tuple[int, int]:
    filename = os.path.basename(filepath)
    inserted = 0
    ignored = 0

    with open(filepath, encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f, delimiter=",")
        for row_index, row in enumerate(reader):
            row_id = make_id(filename, row_index, row)
            is_reverted = row["State"].strip().upper() == "REVERTED"

            params = {
                "id": row_id,
                "date": f"{row['Started Date'].strip()[:10]}T00:00:00.000Z",
                "amount": float(row["Amount"].strip()),
                "currency": row["Currency"].strip(),
                "description": row["Description"].strip(),
                "tx_type": normalize_tx_type(row["Type"]),
                "bank_id": "revolut",
                "source": "csv_revolut_historical",
                "is_deleted": 1 if is_reverted else 0,
                "resulting_balance": parse_balance(row["Balance"]),
            }

            cursor = conn.execute(INSERT_SQL, params)
            if cursor.rowcount == 1:
                inserted += 1
            else:
                ignored += 1

    conn.commit()
    print(f"[{filename}] -> Inserted: {inserted} rows, Ignored (Duplicates/Soft-deleted): {ignored} rows")
    return inserted, ignored


def main() -> None:
    if not os.path.exists(DB_PATH):
        print(f"ERROR: Database not found at {DB_PATH}")
        print("Start the Next.js app at least once to initialise the schema.")
        raise SystemExit(1)

    csv_files = glob.glob(os.path.join(REVOLUT_DIR, "*.csv"))
    if not csv_files:
        print(f"No CSV files found in {REVOLUT_DIR}")
        raise SystemExit(0)

    conn = sqlite3.connect(DB_PATH)
    try:
        total_inserted = 0
        total_ignored = 0
        for filepath in sorted(csv_files):
            ins, ign = process_file(conn, filepath)
            total_inserted += ins
            total_ignored += ign

        print(f"\nTotal -> Inserted: {total_inserted}, Ignored: {total_ignored}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
