"""
Propagate existing category/subcategory labels to uncategorized transactions.

Usage:
    python scripts/propagate_categories.py

DB: data.db (relative to project root)
Exports unresolved rows to: uncategorized_remaining.csv (project root)

Standard library only: sqlite3, re
"""

import re
import sqlite3

NORMALIZED_FILE = __file__.replace("\\", "/")
PROJECT_ROOT = NORMALIZED_FILE.rsplit("/", 2)[0]
DB_PATH = f"{PROJECT_ROOT}/data.db"
UNRESOLVED_EXPORT_PATH = f"{PROJECT_ROOT}/uncategorized_remaining.csv"

UNCATEGORIZED_WHERE = """
(
    category_path IS NULL
    OR category_path = 'uncategorized'
    OR TRIM(category_path) = ''
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
    "PAYPAL",
    "AMERICAN EXPRESS",
    "AIR FRANCE",
    "THUISBEZORGD",
    "MCDONALD",
    "ALBERT HEIJN",
    "MARQT",
    "GREENCHOICE",
    "ING HYPOTHEKEN",
    "BOUYGUES",
    "PRAXIS",
    "ACTION",
    "TIKKIE",
    "REVOLUT",
)

PSP_MARKERS = (
    "PAYPAL",
    "STRIPE",
    "ADYEN",
    "MOLLIE",
    "WISE",
    "REVOLUT",
    "SUMUP",
    "SQUARE",
)


def is_psp_transaction(description: str | None, counterpart: str | None) -> bool:
    text = " ".join(
        (
            normalize_counterpart(description),
            normalize_counterpart(counterpart),
        )
    ).strip()
    return any(marker in text for marker in PSP_MARKERS)

EXPORT_COLUMNS = (
    "id",
    "date",
    "amount",
    "currency",
    "description",
    "counterpart",
    "tx_type",
    "counterparty_iban",
    "bank_id",
    "source",
    "category_path",
    "normalized_description",
    "normalized_counterpart",
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
    normalized = re.sub(r"\*CION\s+CB\s+OP(?:ERAT)?\.?\s*ETRANGER?\s+EN\s+DEV", " ", normalized)
    normalized = re.sub(r"\*CION\s+CB\s+OP\.?\s*ETR", " ", normalized)
    normalized = re.sub(r"\b\d{4}\*{2,}\b", " ", normalized)
    normalized = re.sub(r"[^A-Z0-9]+", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized.strip(" -|:/#")


def normalize_counterpart(text: str | None) -> str:
    normalized = normalize_description(text)
    if not normalized:
        return ""

    normalized = re.sub(r"\b\d{3,5}\b", " ", normalized)
    normalized = re.sub(r"\b(?:NLD|FRA|LUX|LUXEMBOURG|AMSTERDAM|SCHIPHOL|ENSCHEDE)\b", " ", normalized)
    normalized = re.sub(r"\b(?:SA|SARL|BV|NV|ET|CIE)\b", " ", normalized)
    normalized = re.sub(r"\s+", " ", normalized)
    return normalized.strip()


def count_uncategorized(conn: sqlite3.Connection) -> int:
    row = conn.execute(
        f"""
        SELECT COUNT(*) AS count
        FROM transactions
        WHERE {UNCATEGORIZED_WHERE}
          AND is_deleted = 0
          AND COALESCE(category_is_manual, 0) = 0
        """
    ).fetchone()
    return int(row["count"])


def quote_csv(value) -> str:
    if value is None:
        return ""
    text = str(value)
    if '"' in text:
        text = text.replace('"', '""')
    if "," in text or "\n" in text or "\r" in text or '"' in text:
        return f'"{text}"'
    return text


def build_unambiguous_mapping(rows, key_getter):
    mapping = {}
    ambiguous = set()

    for row in rows:
        key = key_getter(row)
        if not key or key in ambiguous:
            continue

        path = row["category_path"]
        previous = mapping.get(key)
        if previous is None:
            mapping[key] = path
            continue

        if previous != path:
            ambiguous.add(key)
            mapping.pop(key, None)

    return mapping


def build_majority_mapping(rows, key_getter, minimum_matches: int, minimum_share: float):
    counts_by_key = {}

    for row in rows:
        key = key_getter(row)
        if not key:
            continue

        path = row["category_path"]
        path_counts = counts_by_key.setdefault(key, {})
        path_counts[path] = path_counts.get(path, 0) + 1

    mapping = {}
    for key, path_counts in counts_by_key.items():
        total = sum(path_counts.values())
        top_path, top_count = max(path_counts.items(), key=lambda item: item[1])
        if total >= minimum_matches and (top_count / total) >= minimum_share:
            mapping[key] = top_path

    return mapping


def apply_updates(conn: sqlite3.Connection, updates) -> int:
    """updates: list of (id, category_path, categorization_source, confidence_level, review_status, applied_rule_id)"""
    if not updates:
        return 0

    conn.execute("DELETE FROM temp_category_updates")
    conn.executemany(
        """
        INSERT INTO temp_category_updates (id, category_path, categorization_source, confidence_level, review_status, applied_rule_id)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        updates,
    )

    before_changes = conn.total_changes
    conn.execute(
        f"""
        UPDATE transactions
        SET
            category_path = (
                SELECT category_path FROM temp_category_updates
                WHERE temp_category_updates.id = transactions.id
            ),
            categorization_source = (
                SELECT categorization_source FROM temp_category_updates
                WHERE temp_category_updates.id = transactions.id
            ),
            confidence_level = (
                SELECT confidence_level FROM temp_category_updates
                WHERE temp_category_updates.id = transactions.id
            ),
            review_status = (
                SELECT review_status FROM temp_category_updates
                WHERE temp_category_updates.id = transactions.id
            ),
            applied_rule_id = (
                SELECT applied_rule_id FROM temp_category_updates
                WHERE temp_category_updates.id = transactions.id
            )
        WHERE id IN (SELECT id FROM temp_category_updates)
          AND {UNCATEGORIZED_WHERE}
          AND COALESCE(category_is_manual, 0) = 0
        """
    )
    return conn.total_changes - before_changes


def fetch_categorized_rows(conn: sqlite3.Connection):
    return conn.execute(
        f"""
        SELECT id, description, counterpart, counterparty_iban, category_path
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
        SELECT id, description, counterpart, counterparty_iban
        FROM transactions
        WHERE {UNCATEGORIZED_WHERE}
          AND is_deleted = 0
          AND COALESCE(category_is_manual, 0) = 0
          AND counterparty_iban IS NOT NULL
          AND TRIM(counterparty_iban) != ''
        """
    ).fetchall()

    updates = []
    for row in candidates:
        iban = row["counterparty_iban"].strip().upper()
        path = iban_mapping.get(iban)
        if path is None:
            continue
        if is_psp_transaction(row["description"], row["counterpart"]):
            updates.append((row["id"], path, "propagation_iban", "low", "needs_review", "prop_iban_psp_override"))
        else:
            updates.append((row["id"], path, "propagation_iban", "high", "confirmed", "prop_iban_v1"))

    return apply_updates(conn, updates)


def run_pass_2(conn: sqlite3.Connection) -> int:
    categorized_rows = fetch_categorized_rows(conn)
    counterpart_mapping = build_unambiguous_mapping(
        categorized_rows,
        lambda row: normalize_counterpart(row["counterpart"]),
    )

    candidates = conn.execute(
        f"""
        SELECT id, counterpart
        FROM transactions
        WHERE {UNCATEGORIZED_WHERE}
          AND is_deleted = 0
          AND COALESCE(category_is_manual, 0) = 0
          AND counterpart IS NOT NULL
          AND TRIM(counterpart) != ''
        """
    ).fetchall()

    updates = []
    for row in candidates:
        counterpart_key = normalize_counterpart(row["counterpart"])
        path = counterpart_mapping.get(counterpart_key)
        if path is None or not counterpart_key:
            continue
        updates.append((row["id"], path, "propagation_merchant", "medium", "needs_review", "prop_merchant_v1"))

    return apply_updates(conn, updates)


def run_pass_3(conn: sqlite3.Connection) -> int:
    categorized_rows = fetch_categorized_rows(conn)
    description_mapping = build_unambiguous_mapping(
        categorized_rows,
        lambda row: normalize_counterpart(row["description"]),
    )

    candidates = conn.execute(
        f"""
        SELECT id, description
        FROM transactions
        WHERE {UNCATEGORIZED_WHERE}
          AND is_deleted = 0
          AND COALESCE(category_is_manual, 0) = 0
          AND description IS NOT NULL
          AND TRIM(description) != ''
        """
    ).fetchall()

    updates = []
    for row in candidates:
        cleaned_root = normalize_description(row["description"])
        path = description_mapping.get(cleaned_root)
        if path is None or not cleaned_root:
            continue
        updates.append((row["id"], path, "propagation_description", "medium", "needs_review", "prop_description_v1"))

    return apply_updates(conn, updates)


def build_keyword_mapping(conn: sqlite3.Connection):
    categorized_rows = fetch_categorized_rows(conn)
    keyword_mapping = {}

    for keyword in KEYWORDS:
        matching_rows = []
        for row in categorized_rows:
            searchable_text = " ".join(
                (
                    normalize_counterpart(row["description"]),
                    normalize_counterpart(row["counterpart"]),
                )
            ).strip()
            if keyword in searchable_text:
                matching_rows.append(row)

        path_mapping = build_majority_mapping(
            matching_rows,
            lambda _: keyword,
            minimum_matches=2,
            minimum_share=0.75,
        )
        path = path_mapping.get(keyword)
        if path is not None:
            keyword_mapping[keyword] = path

    return keyword_mapping


def run_pass_4(conn: sqlite3.Connection) -> int:
    keyword_mapping = build_keyword_mapping(conn)
    if not keyword_mapping:
        return 0

    candidates = conn.execute(
        f"""
        SELECT id, description, counterpart
        FROM transactions
        WHERE {UNCATEGORIZED_WHERE}
          AND is_deleted = 0
          AND COALESCE(category_is_manual, 0) = 0
          AND (
            (description IS NOT NULL AND TRIM(description) != '')
            OR (counterpart IS NOT NULL AND TRIM(counterpart) != '')
          )
        """
    ).fetchall()

    updates = []
    for row in candidates:
        searchable_text = " ".join(
            (
                normalize_counterpart(row["description"]),
                normalize_counterpart(row["counterpart"]),
            )
        ).strip()
        for keyword in KEYWORDS:
            path = keyword_mapping.get(keyword)
            if path is None:
                continue
            if keyword in searchable_text:
                if is_psp_transaction(row["description"], row["counterpart"]):
                    updates.append((row["id"], path, "propagation_keyword", "low", "needs_review", "prop_keyword_psp_override"))
                else:
                    updates.append((row["id"], path, "propagation_keyword", "low", "needs_review", "prop_keyword_v1"))
                break

    return apply_updates(conn, updates)


def export_remaining_uncategorized(conn: sqlite3.Connection) -> int:
    rows = conn.execute(
        f"""
        SELECT
            id,
            date,
            amount,
            currency,
            description,
            counterpart,
            tx_type,
            counterparty_iban,
            bank_id,
            source,
            category_path
        FROM transactions
        WHERE {UNCATEGORIZED_WHERE}
          AND is_deleted = 0
          AND COALESCE(category_is_manual, 0) = 0
        ORDER BY date DESC, id
        """
    ).fetchall()

    with open(UNRESOLVED_EXPORT_PATH, "w", encoding="utf-8", newline="") as handle:
        handle.write(",".join(EXPORT_COLUMNS) + "\n")
        for row in rows:
            values = (
                row["id"],
                row["date"],
                row["amount"],
                row["currency"],
                row["description"],
                row["counterpart"],
                row["tx_type"],
                row["counterparty_iban"],
                row["bank_id"],
                row["source"],
                row["category_path"],
                normalize_description(row["description"]),
                normalize_counterpart(row["counterpart"]),
            )
            handle.write(",".join(quote_csv(value) for value in values) + "\n")

    return len(rows)


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
                category_path TEXT NOT NULL,
                categorization_source TEXT NOT NULL,
                confidence_level TEXT NOT NULL,
                review_status TEXT NOT NULL,
                applied_rule_id TEXT NOT NULL
            )
            """
        )

        before_count = count_uncategorized(conn)

        conn.execute("BEGIN")
        pass_1_count = run_pass_1(conn)
        pass_2_count = run_pass_2(conn)
        pass_3_count = run_pass_3(conn)
        pass_4_count = run_pass_4(conn)
        conn.commit()

        remaining_count = count_uncategorized(conn)
        exported_count = export_remaining_uncategorized(conn)

        print(f"Total uncategorized rows before script: {before_count}")
        print(f"Rows categorized via Pass 1 (IBAN): {pass_1_count}")
        print(f"Rows categorized via Pass 2 (Clean Counterpart): {pass_2_count}")
        print(f"Rows categorized via Pass 3 (Clean Description): {pass_3_count}")
        print(f"Rows categorized via Pass 4 (Keyword Fallback): {pass_4_count}")
        print(f"Remaining uncategorized rows: {remaining_count}")
        print(f"Unresolved rows exported to: {UNRESOLVED_EXPORT_PATH} ({exported_count} rows)")
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
