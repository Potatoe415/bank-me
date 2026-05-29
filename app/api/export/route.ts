import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";

type TxRow = {
  id: string;
  date: string;
  bank_id: string;
  amount: number;
  description: string;
  counterpart: string | null;
  tx_type: string | null;
  category_path: string;
};

function buildFullDescription(tx: TxRow): string {
  const parts = [tx.description, tx.counterpart, tx.tx_type].filter(
    (v): v is string => typeof v === "string" && v.length > 0
  );
  const joined = parts.join(" | ");
  // Wrap in double quotes; escape any internal double quotes per RFC 4180
  return `"${joined.replace(/"/g, '""')}"`;
}

function formatDateParam(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isValidDateParam(value: string | null): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getDateRange(request: NextRequest) {
  const today = new Date();
  const defaultFrom = new Date(today);
  defaultFrom.setDate(defaultFrom.getDate() - 29);

  const fromParam = request.nextUrl.searchParams.get("from");
  const toParam = request.nextUrl.searchParams.get("to");

  const from = isValidDateParam(fromParam) ? fromParam : formatDateParam(defaultFrom);
  const to = isValidDateParam(toParam) ? toParam : formatDateParam(today);

  if (from <= to) {
    return { from, to };
  }

  return { from: to, to: from };
}

export async function GET(request: NextRequest) {
  const param               = request.nextUrl.searchParams.get("banks") ?? "all";
  const withCategories      = request.nextUrl.searchParams.get("categories") === "1";
  const uncategorizedOnly   = request.nextUrl.searchParams.get("uncategorized_only") === "1";
  const excludeCategorized  = request.nextUrl.searchParams.get("exclude_categorized") === "1";
  const { from, to }        = getDateRange(request);

  const COLS = "id, date, bank_id, amount, description, counterpart, tx_type, category_path";

  const uncategorizedFilter = uncategorizedOnly
    ? `AND (category_path IS NULL OR category_path = 'uncategorized')
       AND COALESCE(category_is_manual, 0) = 0`
    : excludeCategorized
    ? `AND (category_path IS NULL OR category_path = '' OR category_path = 'uncategorized')`
    : "";

  const dateFilter = uncategorizedOnly
    ? ""
    : `AND substr(date, 1, 10) >= ?
           AND substr(date, 1, 10) <= ?`;

  let rows: TxRow[];

  if (param === "all") {
    rows = db
      .prepare(
        `SELECT ${COLS} FROM transactions
         WHERE date NOT LIKE 'null%'
           AND is_deleted = 0
           AND archived_at IS NULL
           ${uncategorizedFilter}
           ${dateFilter}
         ORDER BY date DESC`
      )
      .all(...(uncategorizedOnly ? [] : [from, to])) as TxRow[];
  } else {
    const bankIds = param.split(",").map((s) => s.trim()).filter(Boolean);
    const placeholders = bankIds.map(() => "?").join(",");
    rows = db
      .prepare(
        `SELECT ${COLS} FROM transactions
         WHERE bank_id IN (${placeholders})
           AND date NOT LIKE 'null%'
           AND is_deleted = 0
           AND archived_at IS NULL
           ${uncategorizedFilter}
           ${dateFilter}
         ORDER BY bank_id, date DESC`
      )
      .all(...bankIds, ...(uncategorizedOnly ? [] : [from, to])) as TxRow[];
  }

  const header = withCategories
    ? "id,date,bank_id,amount,full_description,category_path"
    : "id,date,bank_id,amount,full_description";

  function quoteField(v: string | null): string {
    if (!v) return '""';
    return `"${v.replace(/"/g, '""')}"`;
  }

  const lines = rows.map((tx) => {
    const date            = tx.date.slice(0, 10);
    const amount          = Number(tx.amount).toFixed(2);
    const fullDescription = buildFullDescription(tx);
    const base            = `${tx.id},${date},${tx.bank_id},${amount},${fullDescription}`;
    if (!withCategories) return base;
    return `${base},${quoteField(tx.category_path)}`;
  });

  const csv = [header, ...lines].join("\r\n");
  const filename = `transactions_${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
