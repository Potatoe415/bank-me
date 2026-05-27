import db from "@/lib/db";

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
    category = COALESCE(@category, category),
    subcategory = COALESCE(@subcategory, subcategory)
  WHERE id = @id
    AND (
      (@category IS NOT NULL AND COALESCE(category, '') <> @category)
      OR
      (@subcategory IS NOT NULL AND COALESCE(subcategory, '') <> @subcategory)
    )
`);

const importCategoriesInTransaction = db.transaction((rows: string[][]): ImportResult => {
  const [header, ...dataRows] = rows;
  const headerMap = new Map(
    header.map((name, index) => [name.trim().toLowerCase(), index] as const)
  );

  const idIndex = headerMap.get("id");
  const categoryIndex = headerMap.get("category");
  const subcategoryIndex = headerMap.get("subcategory");

  if (
    idIndex === undefined ||
    categoryIndex === undefined ||
    subcategoryIndex === undefined
  ) {
    throw new Error("CSV must contain id, category, and subcategory columns.");
  }

  let updated = 0;
  let skipped = 0;

  for (const row of dataRows) {
    const id = normalizeNullable(row[idIndex]);
    const category = normalizeNullable(row[categoryIndex]);
    const subcategory = normalizeNullable(row[subcategoryIndex]);

    if (!id || (!category && !subcategory)) {
      skipped += 1;
      continue;
    }

    const result = applyCategoryUpdate.run({ id, category, subcategory });
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
