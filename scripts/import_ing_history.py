"""
Import historical ING CSV exports into the bank-me SQLite database.

Usage:
    python scripts/import_ing_history.py

Scans: historical_data/ing/*.csv
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
ING_DIR = os.path.join(PROJECT_ROOT, "historical_data", "ing")

INSERT_SQL = """
INSERT OR IGNORE INTO transactions (
    id, date, value_date, amount, currency, description, counterpart,
    tx_type, card_last4, card_network, bank_id, category_path, review_status,
    categorization_source, confidence_level, applied_rule_id,
    archived_at, source, is_deleted, counterparty_iban, resulting_balance
) VALUES (
    :id, :date, NULL, :amount, :currency, :description, :counterpart,
    :tx_type, NULL, NULL, :bank_id, 'uncategorized', 'needs_review',
    'ingestion_raw', 'low', 'bulk_import_raw',
    NULL, :source, :is_deleted, :counterparty_iban, :resulting_balance
)
"""


def make_id(row: dict) -> str:
    raw = (
        row["Date"]
        + "_"
        + row["Amount (EUR)"]
        + "_"
        + row["Name / Description"]
        + "_"
        + row["Counterparty"]
        + "_"
        + row["Resulting balance"]
    )
    return hashlib.md5(raw.encode("utf-8")).hexdigest()


def parse_date(yyyymmdd: str) -> str:
    """Convert '20260227' -> '2026-02-27'."""
    s = yyyymmdd.strip().strip('"')
    return f"{s[0:4]}-{s[4:6]}-{s[6:8]}"


def parse_amount(raw: str, debit_credit: str) -> float:
    value = float(raw.strip().strip('"').replace(",", "."))
    if debit_credit.strip().strip('"').lower() == "debit":
        value = -abs(value)
    else:
        value = abs(value)
    return value


def parse_balance(raw: str) -> float | None:
    cleaned = raw.strip().strip('"').replace(",", ".")
    if not cleaned:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def process_file(conn: sqlite3.Connection, filepath: str) -> tuple[int, int]:
    filename = os.path.basename(filepath)
    inserted = 0
    ignored = 0

    with open(filepath, encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f, delimiter=";", quotechar='"')
        for row in reader:
            row_id = make_id(row)
            date = parse_date(row["Date"])
            amount = parse_amount(row["Amount (EUR)"], row["Debit/credit"])

            name_desc = row["Name / Description"].strip()
            notifications = row["Notifications"].strip()
            full_description = (
                f"{name_desc} | {notifications}" if notifications else name_desc
            )

            counterparty_raw = row["Counterparty"].strip()
            counterparty_iban = counterparty_raw if counterparty_raw else None

            tx_type = row["Transaction type"].strip() or None
            resulting_balance = parse_balance(row["Resulting balance"])

            params = {
                "id": row_id,
                "date": f"{date}T00:00:00.000Z",
                "amount": amount,
                "currency": "EUR",
                "description": full_description,
                "counterpart": row["Name / Description"].strip() or None,
                "tx_type": tx_type,
                "bank_id": "ing-nl",
                "source": "csv_ing_historical",
                "is_deleted": 0,
                "counterparty_iban": counterparty_iban,
                "resulting_balance": resulting_balance,
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

    csv_files = glob.glob(os.path.join(ING_DIR, "*.csv"))
    if not csv_files:
        print(f"No CSV files found in {ING_DIR}")
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
