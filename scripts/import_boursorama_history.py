"""
Import historical Boursorama CSV exports into the bank-me SQLite database.

Usage:
    python scripts/import_boursorama_history.py

Scans: historical_data/boursorama/*.csv
DB:    data.db (relative to project root)

Standard library only — no external dependencies.
"""

import os
import glob
import csv
import sqlite3
import hashlib

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DB_PATH = os.path.join(PROJECT_ROOT, "data.db")
BOURSORAMA_DIR = os.path.join(PROJECT_ROOT, "historical_data", "boursorama")

INSERT_SQL = """
INSERT OR IGNORE INTO transactions (
    id, date, value_date, amount, currency, description, counterpart,
    tx_type, card_last4, card_network, bank_id, category_path, review_status,
    categorization_source, confidence_level, applied_rule_id,
    archived_at, source, is_deleted, counterparty_iban, resulting_balance
) VALUES (
    :id, :date, NULL, :amount, :currency, :description, NULL,
    :tx_type, NULL, NULL, :bank_id, 'uncategorized', 'needs_review',
    'ingestion_raw', 'low', 'bulk_import_raw',
    NULL, :source, :is_deleted, NULL, :resulting_balance
)
"""


def make_id(filename: str, row_index: int, row: dict) -> str:
    raw = f"{filename}_{row_index}_{row['dateOp']}_{row['amount']}_{row['label']}"
    return hashlib.md5(raw.encode("utf-8")).hexdigest()


def parse_amount(raw: str) -> float:
    """Remove space thousand-separators, swap comma decimal, cast to float."""
    return float(raw.strip().strip('"').replace(" ", "").replace(",", "."))


def parse_balance(raw: str) -> float | None:
    cleaned = raw.strip().strip('"').replace(" ", "").replace(",", ".")
    if not cleaned:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def deduce_tx_type(label: str) -> str | None:
    upper = label.strip().upper()
    if upper.startswith("CARTE"):
        return "CARD_PAYMENT"
    if upper.startswith("PRLV"):
        return "DIRECT_DEBIT"
    if upper.startswith("VIREMENT"):
        return "TRANSFER"
    return None


def process_file(conn: sqlite3.Connection, filepath: str) -> tuple[int, int]:
    filename = os.path.basename(filepath)
    inserted = 0
    ignored = 0

    with open(filepath, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter=";", quotechar='"')
        for row_index, row in enumerate(reader):
            row_id = make_id(filename, row_index, row)
            label = row["label"].strip()

            params = {
                "id": row_id,
                "date": f"{row['dateOp'].strip()}T00:00:00.000Z",
                "amount": parse_amount(row["amount"]),
                "currency": "EUR",
                "description": label,
                "tx_type": deduce_tx_type(label),
                "bank_id": "boursorama",
                "source": "csv_boursorama_historical",
                "is_deleted": 0,
                "resulting_balance": parse_balance(row["accountbalance"]),
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

    csv_files = glob.glob(os.path.join(BOURSORAMA_DIR, "*.csv"))
    if not csv_files:
        print(f"No CSV files found in {BOURSORAMA_DIR}")
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
