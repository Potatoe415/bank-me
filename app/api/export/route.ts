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
  category: string | null;
  subcategory: string | null;
};

function buildFullDescription(tx: TxRow): string {
  const parts = [tx.description, tx.counterpart, tx.tx_type].filter(
    (v): v is string => typeof v === "string" && v.length > 0
  );
  const joined = parts.join(" | ");
  // Wrap in double quotes; escape any internal double quotes per RFC 4180
  return `"${joined.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const param          = request.nextUrl.searchParams.get("banks") ?? "all";
  const withCategories = request.nextUrl.searchParams.get("categories") === "1";

  const COLS = "id, date, bank_id, amount, description, counterpart, tx_type, category, subcategory";

  let rows: TxRow[];

  if (param === "all") {
    rows = db
      .prepare(`SELECT ${COLS} FROM transactions WHERE date NOT LIKE 'null%' AND archived_at IS NULL ORDER BY date DESC`)
      .all() as TxRow[];
  } else {
    const bankIds = param.split(",").map((s) => s.trim()).filter(Boolean);
    const placeholders = bankIds.map(() => "?").join(",");
    rows = db
      .prepare(
        `SELECT ${COLS} FROM transactions
         WHERE bank_id IN (${placeholders}) AND date NOT LIKE 'null%' AND archived_at IS NULL
         ORDER BY bank_id, date DESC`
      )
      .all(...bankIds) as TxRow[];
  }

  const header = withCategories
    ? "id,date,bank_id,amount,full_description,category,subcategory"
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
    return `${base},${quoteField(tx.category)},${quoteField(tx.subcategory)}`;
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
