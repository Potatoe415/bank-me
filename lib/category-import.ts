import db from "@/lib/db";
import { deriveCategoryMetadata } from "@/lib/taxonomy";

type ImportResult = {
  updated: number;
  skipped: number;
  totalRows: number;
};

function unwrapCodeFence(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:csv)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1] : text;
}

function detectDelimiter(headerLine: string): "," | ";" {
  const commaCount = (headerLine.match(/,/g) ?? []).length;
  const semicolonCount = (headerLine.match(/;/g) ?? []).length;
  return semicolonCount > commaCount ? ";" : ",";
}

function parseCsv(text: string, delimiter: "," | ";"): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (char === '"') {
      if (inQuotes && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      row.push(field);
      field = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && text[i + 1] === "\n") {
        i += 1;
      }
      row.push(field);
      field = "";
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      continue;
    }

    field += char;
  }

  row.push(field);
  if (row.some((value) => value.length > 0)) {
    rows.push(row);
  }

  return rows;
}

function normalizeNullable(value: string | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

const applyCategoryUpdate = db.prepare(`
  UPDATE transactions
  SET
    category_path = COALESCE(@category_path, category_path),
    cashflow_type = COALESCE(@cashflow_type, cashflow_type),
    behavior_bucket = COALESCE(@behavior_bucket, behavior_bucket),
    is_subscription = COALESCE(@is_subscription, is_subscription),
    is_excluded_from_spending = COALESCE(@is_excluded_from_spending, is_excluded_from_spending),
    review_status = CASE WHEN @category_path IS NOT NULL THEN 'needs_review' ELSE review_status END,
    categorization_source = CASE WHEN @category_path IS NOT NULL THEN 'llm' ELSE categorization_source END,
    confidence_level = CASE WHEN @category_path IS NOT NULL THEN 'medium' ELSE confidence_level END,
    applied_rule_id = CASE WHEN @category_path IS NOT NULL THEN 'csv_llm_import' ELSE applied_rule_id END,
    applied_rule_detail = CASE WHEN @category_path IS NOT NULL THEN NULL ELSE applied_rule_detail END
  WHERE id = @id
    AND COALESCE(category_is_manual, 0) = 0
    AND @category_path IS NOT NULL
    AND category_path <> @category_path
`);

const importCategoriesInTransaction = db.transaction((rows: string[][]): ImportResult => {
  const [header, ...dataRows] = rows;
  const headerMap = new Map(
    header.map((name, index) => [name.trim().toLowerCase(), index] as const)
  );

  const idIndex = headerMap.get("id");
  const pathIndex = headerMap.get("category_path");

  if (idIndex === undefined || pathIndex === undefined) {
    throw new Error("CSV must contain id and category_path columns.");
  }

  let updated = 0;
  let skipped = 0;

  for (const row of dataRows) {
    const id = normalizeNullable(row[idIndex]);
    const categoryPath = normalizeNullable(row[pathIndex]);

    if (!id || !categoryPath) {
      skipped += 1;
      continue;
    }

    const meta = deriveCategoryMetadata(categoryPath);
    const result = applyCategoryUpdate.run({
      id,
      category_path: categoryPath,
      cashflow_type: meta.cashflow_type,
      behavior_bucket: meta.behavior_bucket,
      is_subscription: meta.is_subscription,
      is_excluded_from_spending: meta.is_excluded_from_spending,
    });
    if (result.changes > 0) {
      updated += 1;
    } else {
      skipped += 1;
    }
  }

  return {
    updated,
    skipped,
    totalRows: dataRows.length,
  };
});

export function importCategoriesCsv(csvText: string): ImportResult {
  const normalized = unwrapCodeFence(csvText).replace(/^\uFEFF/, "").trim();
  if (!normalized) {
    throw new Error("CSV file is empty.");
  }

  const firstLine = normalized.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = detectDelimiter(firstLine);
  const rows = parseCsv(normalized, delimiter);

  if (rows.length < 2) {
    throw new Error("CSV must include a header row and at least one data row.");
  }

  return importCategoriesInTransaction(rows);
}
