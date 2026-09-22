"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Transaction } from "@/lib/providers/types";
import type { EditableTaxonomy } from "@/lib/taxonomy";
import { formatCategoryPath } from "@/lib/taxonomy";
import { getBankById } from "@/lib/banks.config";
import type { ColumnId } from "@/lib/column-prefs";
import { toggleTransactionArchive } from "@/app/actions";
import BulkCategoryEditor from "./BulkCategoryEditor";
import CategoryEditor from "./CategoryEditor";

// ─── Constants ───────────────────────────────────────────────────────────────

const TX_TYPE_LABELS: Record<string, string> = {
  CARD_PAYMENT: "Card",
  TRANSFER: "Transfer",
  DIRECT_DEBIT: "Direct debit",
  CASH: "Cash",
  FEE: "Fees",
  INTEREST: "Interest",
  DIVIDEND: "Dividend",
  REFUND: "Refund",
  LOAN: "Loan",
  EXCHANGE: "Exchange",
};

const SOURCE_LABELS: Record<string, string> = {
  ingestion_raw:           "raw",
  llm:                     "llm",
  manual:                  "manual",
  hardcoded_rule:          "rule",
  deterministic_cache:     "cache",
  propagation_iban:        "iban",
  propagation_merchant:    "merch",
  propagation_description: "desc",
  propagation_keyword:     "kw",
};

const CONFIDENCE_STYLES: Record<string, string> = {
  high:   "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-700",
  low:    "bg-red-50 text-red-600",
};

const REVIEW_STATUS_STYLES: Record<string, string> = {
  confirmed:    "bg-emerald-50 text-emerald-700",
  needs_review: "bg-amber-50 text-amber-700",
  ignored:      "bg-gray-100 text-gray-500",
};

const REVIEW_STATUS_LABELS: Record<string, string> = {
  confirmed:    "confirmed",
  needs_review: "review",
  ignored:      "ignored",
};

// Logical default widths (px). "category" maps to 2 colgroup cols (width/2 each).
const DEFAULT_WIDTHS: Record<string, number> = {
  date:          88,
  bank:          44,
  type:          96,
  description:  220,
  counterpart:  148,
  card:         108,
  value_date:    88,
  category:     180,
  source:        64,
  confidence:    68,
  review_status: 68,
  amount:        96,
  actions:       44,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amount);
}

function fmtDate(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function ArchiveButton({ isArchived, transactionId }: { isArchived: boolean; transactionId: string }) {
  return (
    <form action={toggleTransactionArchive.bind(null, transactionId)}>
      <button
        type="submit"
        title={isArchived ? "Restore transaction" : "Archive transaction"}
        aria-label={isArchived ? "Restore transaction" : "Archive transaction"}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
          isArchived
            ? "border-gray-300 bg-white text-gray-600 hover:bg-gray-100"
            : "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
        }`}
      >
        {isArchived ? (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M2.75 5.75h10.5v7a1 1 0 0 1-1 1h-8.5a1 1 0 0 1-1-1v-7Z" stroke="currentColor" strokeWidth="1.25" />
            <path d="M1.75 3.25h12.5v2.5H1.75v-2.5Z" stroke="currentColor" strokeWidth="1.25" />
            <path d="M8 11V7.5m0 0-1.75 1.75M8 7.5l1.75 1.75" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M2.75 5.75h10.5v7a1 1 0 0 1-1 1h-8.5a1 1 0 0 1-1-1v-7Z" stroke="currentColor" strokeWidth="1.25" />
            <path d="M1.75 3.25h12.5v2.5H1.75v-2.5Z" stroke="currentColor" strokeWidth="1.25" />
            <path d="M5.5 8h5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
          </svg>
        )}
      </button>
    </form>
  );
}

// ─── Column filter ────────────────────────────────────────────────────────────

type ColumnFilterOption = { value: string; label: string; badge?: React.ReactNode };

function ColumnFilter({
  paramName,
  options,
  activeFilters,
}: {
  paramName: string;
  options: ColumnFilterOption[];
  activeFilters: Record<string, string>;
}) {
  const router   = useRouter();
  const pathname = usePathname();
  const [open, setOpen]     = useState(false);
  const [pos, setPos]       = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const currentValue = activeFilters[paramName] ?? "";
  const isActive     = !!currentValue;

  function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
    setOpen((v) => !v);
  }

  function select(value: string) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(activeFilters)) {
      if (v) params.set(k, v);
    }
    if (value) params.set(paramName, value);
    else       params.delete(paramName);
    router.replace(`${pathname}?${params.toString()}`);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      const target = e.target as Node;
      if (
        btnRef.current?.contains(target) ||
        dropRef.current?.contains(target)
      ) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        title={isActive ? `Filtered: ${currentValue}` : "Filter"}
        className={`ml-1 inline-flex items-center rounded p-0.5 transition-colors ${
          isActive
            ? "text-indigo-500"
            : "text-gray-300 opacity-0 group-hover:opacity-100 hover:text-gray-500"
        }`}
      >
        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
          <path d="M1.5 2.5h13l-5 6.5V14l-3-1.5V9L1.5 2.5z" />
        </svg>
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div
          ref={dropRef}
          style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999 }}
          className="min-w-[150px] rounded-lg border border-gray-200 bg-white py-1 shadow-xl"
        >
          <button
            onClick={() => select("")}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-gray-50 ${
              !currentValue ? "font-semibold text-gray-800" : "text-gray-500"
            }`}
          >
            <span className="w-3 shrink-0 text-indigo-500">{!currentValue ? "✓" : ""}</span>
            All
          </button>
          <div className="my-1 border-t border-gray-100" />
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => select(opt.value)}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-gray-50 ${
                currentValue === opt.value ? "bg-indigo-50 font-semibold text-indigo-700" : "text-gray-700"
              }`}
            >
              <span className="w-3 shrink-0 text-indigo-500">
                {currentValue === opt.value ? "✓" : ""}
              </span>
              {opt.badge}
              {opt.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TransactionsTable({
  transactions,
  showBankColumn,
  isEditMode,
  taxonomy,
  hiddenColumns,
  activeFilters = {},
}: {
  transactions: Transaction[];
  showBankColumn: boolean;
  isEditMode: boolean;
  taxonomy: EditableTaxonomy;
  hiddenColumns: Set<ColumnId>;
  activeFilters?: Record<string, string>;
}) {
  const [colWidths, setColWidths] = useState<Partial<Record<string, number>>>({});
  const tableRef = useRef<HTMLTableElement>(null);

  const show = (col: ColumnId) => !hiddenColumns.has(col);
  const visibleTransactionIds = transactions.map((tx) => tx.id);

  function getWidth(key: string) {
    return colWidths[key] ?? DEFAULT_WIDTHS[key] ?? 100;
  }

  // Sum of all visible column widths to drive table-layout: fixed
  function getTotalWidth() {
    let total = getWidth("date") + getWidth("amount") + getWidth("actions");
    if (showBankColumn && show("bank")) total += getWidth("bank");
    if (show("type")) total += getWidth("type");
    if (show("description")) total += getWidth("description");
    if (show("counterpart")) total += getWidth("counterpart");
    if (show("card")) total += getWidth("card");
    if (show("value_date")) total += getWidth("value_date");
    if (show("category")) total += getWidth("category");
    if (show("source")) total += getWidth("source");
    if (show("confidence")) total += getWidth("confidence");
    if (show("review_status")) total += getWidth("review_status");
    return total;
  }

  function handleResizeStart(key: string, e: React.MouseEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startWidth = getWidth(key);

    function onMouseMove(ev: MouseEvent) {
      const newWidth = Math.max(32, startWidth + ev.clientX - startX);
      if (!tableRef.current) return;
      if (key === "category") {
        tableRef.current.querySelectorAll<HTMLElement>(`col[data-colkey="category"]`).forEach((col) => {
          col.style.width = `${newWidth / 2}px`;
        });
      } else {
        const col = tableRef.current.querySelector<HTMLElement>(`col[data-colkey="${key}"]`);
        if (col) col.style.width = `${newWidth}px`;
      }
    }

    function onMouseUp(ev: MouseEvent) {
      const newWidth = Math.max(32, startWidth + ev.clientX - startX);
      setColWidths((prev) => ({ ...prev, [key]: newWidth }));
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  const handle = (key: string) => (
    <div
      className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none opacity-0 transition-opacity hover:opacity-100 group-hover:opacity-60 active:opacity-100"
      style={{ background: "linear-gradient(to right, transparent 30%, #6366f1 100%)" }}
      onMouseDown={(e) => handleResizeStart(key, e)}
    />
  );

  const thCls = "group relative px-3 py-2.5 text-left font-semibold";

  // ── Distinct values for column filters ──────────────────────────
  const bankOptions: ColumnFilterOption[] = [...new Set(transactions.map((t) => t.bank_id))]
    .map((id) => {
      const cfg = getBankById(id);
      return {
        value: id,
        label: cfg?.name ?? id,
        badge: cfg ? (
          <span
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-[8px] font-bold text-white"
            style={{ backgroundColor: cfg.color }}
          >
            {cfg.initial}
          </span>
        ) : undefined,
      };
    });

  const categoryFilterOptions: ColumnFilterOption[] = [
    ...new Set(
      transactions
        .map((t) => t.category_path)
        .filter((p): p is string => !!p && p !== "uncategorized")
    ),
  ]
    .sort()
    .map((p) => ({ value: p, label: formatCategoryPath(p) }));

  const sourceOptions: ColumnFilterOption[] = [
    ...new Set(transactions.map((t) => t.categorization_source).filter(Boolean)),
  ].map((s) => ({ value: s, label: SOURCE_LABELS[s] ?? s }));

  const confidenceOptions: ColumnFilterOption[] = [
    ...new Set(transactions.map((t) => t.confidence_level).filter(Boolean)),
  ]
    .sort((a, b) => ["low", "medium", "high"].indexOf(a) - ["low", "medium", "high"].indexOf(b))
    .map((l) => ({ value: l, label: l }));

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table
        ref={tableRef}
        className="whitespace-nowrap text-sm"
        style={{ tableLayout: "fixed", width: "100%", minWidth: getTotalWidth() }}
      >
        <colgroup>
          <col data-colkey="date" style={{ width: getWidth("date") }} />
          {showBankColumn && show("bank") && <col data-colkey="bank" style={{ width: getWidth("bank") }} />}
          {show("type") && <col data-colkey="type" style={{ width: getWidth("type") }} />}
          {show("description") && <col data-colkey="description" style={{ width: getWidth("description") }} />}
          {show("counterpart") && <col data-colkey="counterpart" style={{ width: getWidth("counterpart") }} />}
          {show("card") && <col data-colkey="card" style={{ width: getWidth("card") }} />}
          {show("value_date") && <col data-colkey="value_date" style={{ width: getWidth("value_date") }} />}
          {show("category") && (
            <>
              <col data-colkey="category" style={{ width: getWidth("category") / 2 }} />
              <col data-colkey="category" style={{ width: getWidth("category") / 2 }} />
            </>
          )}
          {show("source") && <col data-colkey="source" style={{ width: getWidth("source") }} />}
          {show("confidence") && <col data-colkey="confidence" style={{ width: getWidth("confidence") }} />}
          {show("review_status") && <col data-colkey="review_status" style={{ width: getWidth("review_status") }} />}
          <col data-colkey="amount" style={{ width: getWidth("amount") }} />
          <col data-colkey="actions" style={{ width: getWidth("actions") }} />
        </colgroup>

        <thead className="border-b border-gray-200 bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
          <tr>
            <th className={thCls}>Date{handle("date")}</th>
            {showBankColumn && show("bank") && (
              <th className={thCls}>
                <span className="flex items-center">
                  Bank
                  <ColumnFilter paramName="bank" options={bankOptions} activeFilters={activeFilters} />
                </span>
                {handle("bank")}
              </th>
            )}
            {show("type") && <th className={thCls}>Type{handle("type")}</th>}
            {show("description") && <th className={thCls}>Description{handle("description")}</th>}
            {show("counterpart") && <th className={thCls}>Counterpart{handle("counterpart")}</th>}
            {show("card") && <th className={thCls}>Card{handle("card")}</th>}
            {show("value_date") && <th className={thCls}>Value date{handle("value_date")}</th>}
            {show("category") && (
              <th className={thCls} colSpan={2}>
                {isEditMode ? (
                  <BulkCategoryEditor
                    taxonomy={taxonomy}
                    transactionIds={visibleTransactionIds}
                    disabled={visibleTransactionIds.length === 0}
                  />
                ) : (
                  <span className="flex items-center">
                    Category
                    <ColumnFilter paramName="category" options={categoryFilterOptions} activeFilters={activeFilters} />
                  </span>
                )}
                {handle("category")}
              </th>
            )}
            {show("source") && (
              <th className={thCls}>
                <span className="flex items-center">
                  Source
                  <ColumnFilter paramName="source" options={sourceOptions} activeFilters={activeFilters} />
                </span>
                {handle("source")}
              </th>
            )}
            {show("confidence") && (
              <th className={thCls}>
                <span className="flex items-center">
                  Conf.
                  <ColumnFilter paramName="confidence_level" options={confidenceOptions} activeFilters={activeFilters} />
                </span>
                {handle("confidence")}
              </th>
            )}
            {show("review_status") && <th className={thCls}>Status{handle("review_status")}</th>}
            <th className={`${thCls} text-right`}>Amount{handle("amount")}</th>
            <th className="w-11 px-2 py-2.5" />
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-100">
          {transactions.map((tx) => {
            const cfg = getBankById(tx.bank_id);
            const isArchived = tx.archived_at !== null;

            return (
              <tr
                key={tx.id}
                className={`transition-colors ${isArchived ? "bg-gray-50 text-gray-400" : "hover:bg-gray-50"}`}
              >
                <td className={`px-3 py-2 ${isArchived ? "text-gray-400" : "text-gray-500"}`}>
                  {fmtDate(tx.date)}
                </td>

                {showBankColumn && show("bank") && (
                  <td className="px-3 py-2">
                    <Link href={`/?bank=${tx.bank_id}`} title={cfg?.name ?? tx.bank_id}>
                      <span
                        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[9px] font-bold text-white"
                        style={{ backgroundColor: cfg?.color ?? "#888" }}
                      >
                        {cfg?.initial ?? tx.bank_id.slice(0, 2).toUpperCase()}
                      </span>
                    </Link>
                  </td>
                )}

                {show("type") && (
                  <td className="px-3 py-2">
                    {tx.tx_type ? (
                      <span className={`rounded px-1.5 py-0.5 text-xs ${isArchived ? "bg-gray-200 text-gray-500" : "bg-gray-100 text-gray-600"}`}>
                        {TX_TYPE_LABELS[tx.tx_type] ?? tx.tx_type}
                      </span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                )}

                {show("description") && (
                  <td className={`truncate px-3 py-2 ${isArchived ? "text-gray-400" : "text-gray-800"}`} title={tx.description}>
                    <span>{tx.description}</span>
                    {isArchived && (
                      <span className="ml-2 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                        Archived
                      </span>
                    )}
                  </td>
                )}

                {show("counterpart") && (
                  <td className={`truncate px-3 py-2 ${isArchived ? "text-gray-400" : "text-gray-500"}`} title={tx.counterpart ?? ""}>
                    {tx.counterpart && tx.counterpart !== tx.description
                      ? tx.counterpart
                      : <span className="text-gray-300">-</span>}
                  </td>
                )}

                {show("card") && (
                  <td className={`px-3 py-2 font-mono text-xs ${isArchived ? "text-gray-400" : "text-gray-500"}`}>
                    {tx.card_last4 ? (
                      <span>
                        **** {tx.card_last4}
                        {tx.card_network && (
                          <span className="ml-1 font-sans text-gray-400">{tx.card_network}</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                )}

                {show("value_date") && (
                  <td className={`px-3 py-2 ${isArchived ? "text-gray-400" : "text-gray-500"}`}>
                    {fmtDate(tx.value_date)}
                  </td>
                )}

                {show("category") && (
                  <CategoryEditor
                    transactionId={tx.id}
                    initialCategoryPath={tx.category_path}
                    taxonomy={taxonomy}
                    isArchived={isArchived}
                    isEditMode={isEditMode}
                  />
                )}

                {show("source") && (
                  <td className="px-3 py-2">
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
                      {SOURCE_LABELS[tx.categorization_source] ?? tx.categorization_source}
                    </span>
                  </td>
                )}

                {show("confidence") && (
                  <td className="px-3 py-2">
                    {tx.confidence_level ? (
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${CONFIDENCE_STYLES[tx.confidence_level] ?? "bg-gray-100 text-gray-500"}`}>
                        {tx.confidence_level}
                      </span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                )}

                {show("review_status") && (
                  <td className="px-3 py-2">
                    {tx.review_status ? (
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${REVIEW_STATUS_STYLES[tx.review_status] ?? "bg-gray-100 text-gray-500"}`}>
                        {REVIEW_STATUS_LABELS[tx.review_status] ?? tx.review_status}
                      </span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                )}

                <td className={`px-3 py-2 text-right font-mono font-medium ${isArchived ? "text-gray-400" : tx.amount < 0 ? "text-red-600" : "text-emerald-600"}`}>
                  {fmt(tx.amount, tx.currency)}
                </td>

                <td className="px-2 py-2 text-right">
                  <ArchiveButton isArchived={isArchived} transactionId={tx.id} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
