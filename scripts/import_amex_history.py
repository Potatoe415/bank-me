"""
Import historical American Express CSV exports into the bank-me SQLite database.

Usage:
    python scripts/import_amex_history.py

Scans: historical_data/amex/*.csv
DB:    data.db (relative to project root)

Standard library only — no external dependencies.
Amex represents charges as positive and repayments as negative; sign is
inverted on import so the schema convention (charges negative) is respected.
The 'Adresse' field contains embedded newlines inside quoted fields —
csv.DictReader handles this correctly without any workaround needed.
"""

import os
import glob
import csv
import sqlite3
import hashlib

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
DB_PATH = os.path.join(PROJECT_ROOT, "data.db")
AMEX_DIR = os.path.join(PROJECT_ROOT, "historical_data", "amex")

INSERT_SQL = """
INSERT OR IGNORE INTO transactions (
    id, date, value_date, amount, currency, description, counterpart,
    tx_type, card_last4, card_network, bank_id, category, subcategory,
    archived_at, source, is_deleted, counterparty_iban, resulting_balance
) VALUES (
    :id, :date, NULL, :amount, :currency, :description, NULL,
    :tx_type, NULL, NULL, :bank_id, NULL, NULL,
    NULL, :source, :is_deleted, NULL, NULL
)
"""


def make_id(filename: str, row_index: int, row: dict) -> str:
    cleaned_reference = row["Référence"].strip().strip("'")
    raw = f"{filename}_{row_index}_{cleaned_reference}"
    return hashlib.md5(raw.encode("utf-8")).hexdigest()


def parse_date(raw: str) -> str:
    """Convert 'MM/DD/YYYY' -> 'YYYY-MM-DD'."""
    parts = raw.strip().split("/")
    return f"{parts[2]}-{parts[0]}-{parts[1]}"


def parse_amount(raw: str) -> float:
    """Strip spaces (thousand sep), swap comma decimal, cast, then invert sign."""
    value = float(raw.strip().replace(" ", "").replace(",", "."))
    return -value


def deduce_tx_type(description: str) -> str:
    if "PRELEVEMENT" in description.upper():
        return "CREDIT_CARD_REPAYMENT"
    return "CARD_PAYMENT"


def process_file(conn: sqlite3.Connection, filepath: str) -> tuple[int, int]:
    filename = os.path.basename(filepath)
    inserted = 0
    ignored = 0

    with open(filepath, encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f, delimiter=",")
        for row_index, row in enumerate(reader):
            description = row["Description"].strip()

            params = {
                "id": make_id(filename, row_index, row),
                "date": f"{parse_date(row['Date'])}T00:00:00.000Z",
                "amount": parse_amount(row["Montant"]),
                "currency": "EUR",
                "description": description,
                "tx_type": deduce_tx_type(description),
                "bank_id": "americanex",
                "source": "csv_amex_historical",
                "is_deleted": 0,
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

    csv_files = glob.glob(os.path.join(AMEX_DIR, "*.csv"))
    if not csv_files:
        print(f"No CSV files found in {AMEX_DIR}")
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
