"""
Propagate existing category/subcategory labels to uncategorized transactions.

Usage:
    python scripts/propagate_categories.py

DB: data.db (relative to project root)

Standard library only: sqlite3, re
"""

import re
import sqlite3

NORMALIZED_FILE = __file__.replace("\\", "/")
PROJECT_ROOT = NORMALIZED_FILE.rsplit("/", 2)[0]
DB_PATH = f"{PROJECT_ROOT}/data.db"

UNCATEGORIZED_WHERE = """
(
    category IS NULL
    OR TRIM(category) = ''
    OR category = 'Non catégorisé'
)
"""

KEYWORDS = (
    "UBER",
    "LIDL",
    "NETFLIX",
    "SNCF",
    "FREE MOBILE",
    "GLOVO",
    "AMAZON",
)


def normalize_description(text: str | None) -> str:
    if not text:
        return ""

    normalized = text.upper()
    normalized = re.sub(r"\b\d{1,2}[/-]\d{1,2}[/-](?:\d{2}|\d{4})\b", " ", normalized)
    normalized = re.sub(r"\bCB\*[A-Z0-9]+\b", " ", normalized)
    normalized = re.sub(
        r"(?:\s|[|:/#-])+(?:REF|REFERENCE|ID|AUT|NUM|NO)?[:#\s-]*[A-Z0-9]{6,}\s*$",
        " ",
        normalized,
    )
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized.strip(" -|:/#")


def count_uncategorized(conn: sqlite3.Connection) -> int:
    row = conn.execute(
        f"SELECT COUNT(*) AS count FROM transactions WHERE {UNCATEGORIZED_WHERE}"
    ).fetchone()
    return int(row["count"])


def build_unambiguous_mapping(rows, key_getter):
    mapping = {}
    ambiguous = set()

    for row in rows:
        key = key_getter(row)
        if not key or key in ambiguous:
            continue

        pair = (row["category"], row["subcategory"])
        previous = mapping.get(key)
        if previous is None:
            mapping[key] = pair
            continue

        if previous != pair:
            ambiguous.add(key)
            mapping.pop(key, None)

    return mapping


def apply_updates(conn: sqlite3.Connection, updates) -> int:
    if not updates:
        return 0

    conn.execute("DELETE FROM temp_category_updates")
    conn.executemany(
        """
        INSERT INTO temp_category_updates (id, category, subcategory)
        VALUES (?, ?, ?)
        """,
        updates,
    )

    before_changes = conn.total_changes
    conn.execute(
        f"""
        UPDATE transactions
        SET
            category = (
                SELECT category
                FROM temp_category_updates
                WHERE temp_category_updates.id = transactions.id
            ),
            subcategory = (
                SELECT subcategory
                FROM temp_category_updates
                WHERE temp_category_updates.id = transactions.id
            )
        WHERE id IN (SELECT id FROM temp_category_updates)
          AND {UNCATEGORIZED_WHERE}
        """
    )
    return conn.total_changes - before_changes


def fetch_categorized_rows(conn: sqlite3.Connection):
    return conn.execute(
        f"""
        SELECT id, description, counterparty_iban, category, subcategory
        FROM transactions
        WHERE NOT {UNCATEGORIZED_WHERE}
          AND is_deleted = 0
        """
    ).fetchall()


def run_pass_1(conn: sqlite3.Connection) -> int:
    categorized_rows = fetch_categorized_rows(conn)
    iban_mapping = build_unambiguous_mapping(
        categorized_rows,
        lambda row: (row["counterparty_iban"] or "").strip().upper(),
    )

    candidates = conn.execute(
        f"""
        SELECT id, counterparty_iban
        FROM transactions
        WHERE {UNCATEGORIZED_WHERE}
          AND is_deleted = 0
          AND counterparty_iban IS NOT NULL
          AND TRIM(counterparty_iban) != ''
        """
    ).fetchall()

    updates = []
    for row in candidates:
        iban = row["counterparty_iban"].strip().upper()
        pair = iban_mapping.get(iban)
        if pair is None:
            continue
        updates.append((row["id"], pair[0], pair[1]))

    return apply_updates(conn, updates)


def run_pass_2(conn: sqlite3.Connection) -> int:
    categorized_rows = fetch_categorized_rows(conn)
    description_mapping = build_unambiguous_mapping(
        categorized_rows,
        lambda row: normalize_description(row["description"]),
    )

    candidates = conn.execute(
        f"""
        SELECT id, description
        FROM transactions
        WHERE {UNCATEGORIZED_WHERE}
          AND is_deleted = 0
          AND description IS NOT NULL
          AND TRIM(description) != ''
        """
    ).fetchall()

    updates = []
    for row in candidates:
        cleaned_root = normalize_description(row["description"])
        pair = description_mapping.get(cleaned_root)
        if pair is None or not cleaned_root:
            continue
        updates.append((row["id"], pair[0], pair[1]))

    return apply_updates(conn, updates)


def build_keyword_mapping(conn: sqlite3.Connection):
    categorized_rows = fetch_categorized_rows(conn)
    keyword_mapping = {}

    for keyword in KEYWORDS:
        matching_rows = []
        for row in categorized_rows:
            description = (row["description"] or "").upper()
            if keyword in description:
                matching_rows.append(row)

        pair_mapping = build_unambiguous_mapping(matching_rows, lambda _: keyword)
        pair = pair_mapping.get(keyword)
        if pair is not None:
            keyword_mapping[keyword] = pair

    return keyword_mapping


def run_pass_3(conn: sqlite3.Connection) -> int:
    keyword_mapping = build_keyword_mapping(conn)
    if not keyword_mapping:
        return 0

    candidates = conn.execute(
        f"""
        SELECT id, description
        FROM transactions
        WHERE {UNCATEGORIZED_WHERE}
          AND is_deleted = 0
          AND description IS NOT NULL
          AND TRIM(description) != ''
        """
    ).fetchall()

    updates = []
    for row in candidates:
        description = row["description"].upper()
        for keyword in KEYWORDS:
            pair = keyword_mapping.get(keyword)
            if pair is None:
                continue
            if keyword in description:
                updates.append((row["id"], pair[0], pair[1]))
                break

    return apply_updates(conn, updates)


def main() -> None:
    try:
        conn = sqlite3.connect(f"file:{DB_PATH}?mode=rw", uri=True)
    except sqlite3.OperationalError:
        print(f"ERROR: Database not found at {DB_PATH}")
        print("Run the app once to initialize the schema before using this script.")
        raise SystemExit(1)

    conn.row_factory = sqlite3.Row

    try:
        conn.execute(
            """
            CREATE TEMP TABLE IF NOT EXISTS temp_category_updates (
                id TEXT PRIMARY KEY,
                category TEXT NOT NULL,
                subcategory TEXT
            )
            """
        )

        before_count = count_uncategorized(conn)

        conn.execute("BEGIN")
        pass_1_count = run_pass_1(conn)
        pass_2_count = run_pass_2(conn)
        pass_3_count = run_pass_3(conn)
        conn.commit()

        remaining_count = count_uncategorized(conn)

        print(f"Total uncategorized rows before script: {before_count}")
        print(f"Rows categorized via Pass 1 (IBAN): {pass_1_count}")
        print(f"Rows categorized via Pass 2 (Clean Description): {pass_2_count}")
        print(f"Rows categorized via Pass 3 (Keyword Fallback): {pass_3_count}")
        print(f"Remaining uncategorized rows: {remaining_count}")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
