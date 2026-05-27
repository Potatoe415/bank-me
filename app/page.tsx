import Link from "next/link";
import db from "@/lib/db";
import { getBankById } from "@/lib/banks.config";
import { getProvider } from "@/lib/providers";
import type { Transaction } from "@/lib/providers/types";
import { syncTransactions, toggleTransactionArchive } from "./actions";
import TransactionFilters from "./components/TransactionFilters";

function getAccountUids(bankId: string): string[] {
  const row = db
    .prepare("SELECT account_uids FROM provider_tokens WHERE provider = ?")
    .get(`enablebanking_${bankId}`) as { account_uids: string } | undefined;
  return row ? JSON.parse(row.account_uids) : [];
}

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

const PAGE_SIZE = 100;
const EMPTY_FILTER_VALUE = "__empty__";
const INTERNAL_TRANSFER_CATEGORY = "Internal Transfer";

type SearchParamsInput = Record<string, string | string[] | undefined>;

type PageProps = {
  searchParams: Promise<SearchParamsInput>;
};

type QueryFilters = {
  from: string | null;
  to: string | null;
  category: string | null;
  subcategory: string | null;
  query: string | null;
  amountInput: string;
  amountOperator: "=" | ">" | "<" | ">=" | "<=" | null;
  amountAbs: number | null;
};

type FilterOption = {
  value: string;
  label: string;
};

type SqlFilterResult = {
  whereSql: string;
  params: Record<string, string | number | null>;
};

type SqlFilterOptions = {
  activeOnly?: boolean;
};

type DateBoundsRow = {
  first_date: string | null;
  last_date: string | null;
};

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function normalizeDate(value: string | undefined) {
  return value?.match(/^\d{4}-\d{2}-\d{2}$/) ? value : null;
}

function normalizeText(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeAmountInput(value: string | undefined) {
  return value?.trim() ?? "";
}

function parseAmountFilter(value: string): Pick<QueryFilters, "amountOperator" | "amountAbs"> {
  if (!value) {
    return { amountOperator: null, amountAbs: null };
  }

  const match = value.match(/^\s*(>=|<=|>|<)?\s*(-?\d+(?:[.,]\d+)?)\s*$/);
  if (!match) {
    return { amountOperator: null, amountAbs: null };
  }

  const rawOperator = match[1] ?? "=";
  const rawAmount = match[2].replace(",", ".");
  const parsed = Number(rawAmount);

  if (!Number.isFinite(parsed)) {
    return { amountOperator: null, amountAbs: null };
  }

  return {
    amountOperator: rawOperator as QueryFilters["amountOperator"],
    amountAbs: Math.abs(parsed),
  };
}

function buildSqlFilters(bankId: string | null, filters: QueryFilters, options: SqlFilterOptions = {}): SqlFilterResult {
  const clauses: string[] = [];
  const params: Record<string, string | number | null> = {};

  if (options.activeOnly) {
    clauses.push("archived_at IS NULL");
  }

  if (bankId) {
    clauses.push("bank_id = @bankId");
    params.bankId = bankId;
  }

  if (filters.from) {
    clauses.push("date >= @from");
    params.from = filters.from;
  }

  if (filters.to) {
    clauses.push("date <= @to || 'T23:59:59.999Z'");
    params.to = filters.to;
  }

  if (filters.query) {
    clauses.push("(LOWER(description) LIKE @query OR LOWER(COALESCE(counterpart, '')) LIKE @query)");
    params.query = `%${filters.query.toLowerCase()}%`;
  }

  if (filters.amountAbs !== null) {
    if (filters.amountOperator === "=") {
      clauses.push("ROUND(ABS(amount), 2) = ROUND(@amountAbs, 2)");
      params.amountAbs = filters.amountAbs;
    } else if (filters.amountOperator === ">") {
      clauses.push("ABS(amount) > @amountAbs");
      params.amountAbs = filters.amountAbs;
    } else if (filters.amountOperator === "<") {
      clauses.push("ABS(amount) < @amountAbs");
      params.amountAbs = filters.amountAbs;
    } else if (filters.amountOperator === ">=") {
      clauses.push("ABS(amount) >= @amountAbs");
      params.amountAbs = filters.amountAbs;
    } else if (filters.amountOperator === "<=") {
      clauses.push("ABS(amount) <= @amountAbs");
      params.amountAbs = filters.amountAbs;
    }
  }

  if (filters.category === EMPTY_FILTER_VALUE) {
    clauses.push("(category IS NULL OR TRIM(category) = '')");
  } else if (filters.category) {
    clauses.push("category = @category");
    params.category = filters.category;
  }

  if (filters.subcategory === EMPTY_FILTER_VALUE) {
    clauses.push("(subcategory IS NULL OR TRIM(subcategory) = '')");
  } else if (filters.subcategory) {
    clauses.push("subcategory = @subcategory");
    params.subcategory = filters.subcategory;
  }

  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  return { whereSql, params };
}

function getDistinctFilterOptions(
  column: "category" | "subcategory",
  bankId: string | null,
  filters: QueryFilters
) {
  const optionFilters: QueryFilters = { ...filters };

  if (column === "category") {
    optionFilters.category = null;
    optionFilters.subcategory = null;
  } else {
    optionFilters.subcategory = null;
  }

  const { whereSql, params } = buildSqlFilters(bankId, optionFilters, { activeOnly: true });
  const rows = db
    .prepare(`SELECT DISTINCT ${column} FROM transactions ${whereSql} ORDER BY ${column} COLLATE NOCASE ASC`)
    .all(params) as Array<{ [K in typeof column]: string | null }>;

  const options: FilterOption[] = [];
  let hasEmptyValue = false;

  for (const row of rows) {
    const rawValue = row[column];
    if (rawValue === null || rawValue.trim() === "") {
      hasEmptyValue = true;
      continue;
    }
    options.push({ value: rawValue, label: rawValue });
  }

  if (hasEmptyValue) {
    options.unshift({ value: EMPTY_FILTER_VALUE, label: "Uncategorized" });
  }

  return options;
}

function getVisibleTotals(transactions: Transaction[]) {
  const totals = new Map<string, number>();

  for (const tx of transactions) {
    if (tx.archived_at) continue;
    if (tx.category === INTERNAL_TRANSFER_CATEGORY) continue;
    totals.set(tx.currency, (totals.get(tx.currency) ?? 0) + tx.amount);
  }

  return [...totals.entries()].map(([currency, amount]) => fmt(amount, currency));
}

function countArchived(transactions: Transaction[]) {
  return transactions.filter((tx) => tx.archived_at !== null).length;
}

function resultLabel(activeCount: number, archivedCount: number, totalActive?: number) {
  const base = totalActive === undefined ? `${activeCount} active` : `Showing ${activeCount} / ${totalActive} active`;
  return archivedCount > 0 ? `${base} | ${archivedCount} archived shown` : base;
}

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

export default async function Home({ searchParams }: PageProps) {
  const rawParams = await searchParams;
  const error = firstString(rawParams.error);
  const syncError = firstString(rawParams.sync_error);
  const bankId = firstString(rawParams.bank) ?? "revolut";
  const rawPage = firstString(rawParams.page);
  const globalDateBounds = db
    .prepare(
      `SELECT
         MIN(SUBSTR(date, 1, 10)) as first_date,
         MAX(SUBSTR(date, 1, 10)) as last_date
       FROM transactions
       WHERE archived_at IS NULL`
    )
    .get() as DateBoundsRow;

  const defaultFrom = globalDateBounds.first_date ?? "";
  const defaultTo = globalDateBounds.last_date ?? "";

  const amountFilter = parseAmountFilter(normalizeAmountInput(firstString(rawParams.amount)));

  const filters: QueryFilters = {
    from: normalizeDate(firstString(rawParams.from)),
    to: normalizeDate(firstString(rawParams.to)),
    category: normalizeText(firstString(rawParams.category)),
    subcategory: normalizeText(firstString(rawParams.subcategory)),
    query: normalizeText(firstString(rawParams.query)),
    amountInput: normalizeAmountInput(firstString(rawParams.amount)),
    amountOperator: amountFilter.amountOperator,
    amountAbs: amountFilter.amountAbs,
  };

  const visibleBankId = bankId === "all" ? null : bankId;
  const categoryOptions = getDistinctFilterOptions("category", visibleBankId, filters);
  const subcategoryOptions = getDistinctFilterOptions("subcategory", visibleBankId, filters);
  const hasActiveFilters = Boolean(
    filters.from ||
      filters.to ||
      filters.category ||
      filters.subcategory ||
      filters.query ||
      filters.amountInput
  );

  const filterProps = {
    bankId,
    initialValues: {
      from: filters.from ?? defaultFrom,
      to: filters.to ?? defaultTo,
      category: filters.category ?? "",
      subcategory: filters.subcategory ?? "",
      query: filters.query ?? "",
      amount: filters.amountInput,
    },
    categoryOptions,
    subcategoryOptions,
    resetHref: `/?bank=${bankId}`,
    hasActiveFilters,
  };

  if (bankId === "all") {
    const safePage = Math.max(1, parseInt(rawPage ?? "1", 10) || 1);
    const { whereSql, params } = buildSqlFilters(null, filters);
    const { whereSql: activeWhereSql, params: activeParams } = buildSqlFilters(null, filters, { activeOnly: true });

    const { count: total } = db
      .prepare(`SELECT COUNT(*) as count FROM transactions ${activeWhereSql}`)
      .get(activeParams) as { count: number };
    const { count: displayTotal } = db
      .prepare(`SELECT COUNT(*) as count FROM transactions ${whereSql}`)
      .get(params) as { count: number };

    const totalPages = Math.max(1, Math.ceil(displayTotal / PAGE_SIZE));
    const currentPage = Math.min(safePage, totalPages);
    const offset = (currentPage - 1) * PAGE_SIZE;

    const transactions = db
      .prepare(
        `SELECT * FROM transactions
         ${whereSql}
         ORDER BY date DESC
         LIMIT @limit OFFSET @offset`
      )
      .all({ ...params, limit: PAGE_SIZE, offset }) as Transaction[];

    const visibleTotals = getVisibleTotals(transactions);
    const archivedShown = countArchived(transactions);
    const activeShown = transactions.length - archivedShown;

    function pageLink(page: number) {
      const nextParams = new URLSearchParams({ bank: "all", page: String(page) });
      if (filters.from) nextParams.set("from", filters.from);
      if (filters.to) nextParams.set("to", filters.to);
      if (filters.category) nextParams.set("category", filters.category);
      if (filters.subcategory) nextParams.set("subcategory", filters.subcategory);
      if (filters.query) nextParams.set("query", filters.query);
      if (filters.amountInput) nextParams.set("amount", filters.amountInput);
      return `/?${nextParams.toString()}`;
    }

    return (
      <main className="px-8 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold text-gray-900">All banks</h1>
          <span className="text-xs text-gray-400">
            {total} active transaction{total > 1 ? "s" : ""}
          </span>
        </div>

        <TransactionFilters
          {...filterProps}
          resultLabel={resultLabel(activeShown, archivedShown, total)}
          totalLabel={visibleTotals.length > 0 ? `Visible total: ${visibleTotals.join(" | ")}` : null}
        />

        {transactions.length === 0 ? (
          <p className="text-sm text-gray-500">No transactions found.</p>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
              <table className="w-full whitespace-nowrap text-sm">
                <thead className="border-b border-gray-200 bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-semibold">Date</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Bank</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Type</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Description</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Counterpart</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Card</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Category</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Subcategory</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
                    <th className="w-14 px-2 py-2.5 text-right font-semibold"> </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {transactions.map((tx) => {
                    const cfg = getBankById(tx.bank_id);
                    const isArchived = tx.archived_at !== null;
                    return (
                      <tr key={tx.id} className={`transition-colors ${isArchived ? "bg-gray-50 text-gray-400" : "hover:bg-gray-50"}`}>
                        <td className={`px-3 py-2 ${isArchived ? "text-gray-400" : "text-gray-500"}`}>{fmtDate(tx.date)}</td>
                        <td className="px-3 py-2">
                          <Link href={`/?bank=${tx.bank_id}`} className="group flex items-center gap-1.5">
                            <span
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[9px] font-bold text-white"
                              style={{ backgroundColor: cfg?.color ?? "#888" }}
                            >
                              {cfg?.initial ?? tx.bank_id.slice(0, 2).toUpperCase()}
                            </span>
                            <span className={`max-w-[80px] truncate transition-colors ${isArchived ? "text-gray-400" : "text-gray-600 group-hover:text-indigo-600"}`}>
                              {cfg?.name ?? tx.bank_id}
                            </span>
                          </Link>
                        </td>
                        <td className="px-3 py-2">
                          {tx.tx_type ? (
                            <span className={`rounded px-1.5 py-0.5 text-xs ${isArchived ? "bg-gray-200 text-gray-500" : "bg-gray-100 text-gray-600"}`}>
                              {TX_TYPE_LABELS[tx.tx_type] ?? tx.tx_type}
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className={`max-w-[220px] truncate px-3 py-2 ${isArchived ? "text-gray-400" : "text-gray-800"}`} title={tx.description}>
                          <span>{tx.description}</span>
                          {isArchived && (
                            <span className="ml-2 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                              Archived
                            </span>
                          )}
                        </td>
                        <td className={`max-w-[160px] truncate px-3 py-2 ${isArchived ? "text-gray-400" : "text-gray-500"}`} title={tx.counterpart ?? ""}>
                          {tx.counterpart && tx.counterpart !== tx.description ? tx.counterpart : <span className="text-gray-300">-</span>}
                        </td>
                        <td className={`px-3 py-2 font-mono text-xs ${isArchived ? "text-gray-400" : "text-gray-500"}`}>
                          {tx.card_last4 ? (
                            <span>
                              **** {tx.card_last4}
                              {tx.card_network ? <span className="ml-1 font-sans text-gray-400">{tx.card_network}</span> : null}
                            </span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {tx.category ? (
                            <span className={`rounded px-1.5 py-0.5 text-xs ${isArchived ? "bg-gray-200 text-gray-500" : "bg-indigo-50 text-indigo-600"}`}>{tx.category}</span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {tx.subcategory ? (
                            <span className={`rounded px-1.5 py-0.5 text-xs ${isArchived ? "bg-gray-200 text-gray-500" : "bg-indigo-50 text-indigo-500"}`}>{tx.subcategory}</span>
                          ) : (
                            <span className="text-gray-300">-</span>
                          )}
                        </td>
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

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  Page {currentPage} of {totalPages}
                </span>
                <div className="flex gap-1">
                  {currentPage > 1 && (
                    <Link
                      href={pageLink(currentPage - 1)}
                      className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50"
                    >
                      Previous
                    </Link>
                  )}
                  {currentPage < totalPages && (
                    <Link
                      href={pageLink(currentPage + 1)}
                      className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50"
                    >
                      Next
                    </Link>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    );
  }

  const bankCfg = getBankById(bankId);
  const bankLabel = bankCfg?.name ?? bankId;
  const isConnected = getProvider().isConnected(bankId);
  const accountUids = isConnected ? getAccountUids(bankId) : [];
  const hasAccounts = accountUids.length > 0;

  const { whereSql, params } = buildSqlFilters(bankId, filters);
  const transactions = db
    .prepare(`SELECT * FROM transactions ${whereSql} ORDER BY date DESC`)
    .all(params) as Transaction[];

  const visibleTotals = getVisibleTotals(transactions);
  const archivedShown = countArchived(transactions);
  const activeShown = transactions.length - archivedShown;
  const syncWithBank = syncTransactions.bind(null, bankId);

  return (
    <main className="px-8 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {bankCfg && (
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white"
              style={{ backgroundColor: bankCfg.color }}
            >
              {bankCfg.initial}
            </span>
          )}
          <h1 className="text-xl font-semibold text-gray-900">{bankLabel}</h1>
          {isConnected && hasAccounts && (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-600">
              Connected
            </span>
          )}
          {isConnected && !hasAccounts && (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-600">
              No account
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {!isConnected ? (
            <a
              href={`/api/connect?bank=${bankId}`}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
            >
              Connect {bankLabel}
            </a>
          ) : hasAccounts ? (
            <form action={syncWithBank}>
              <button
                type="submit"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                Synchronize
              </button>
            </form>
          ) : (
            <a
              href={`/api/connect?bank=${bankId}`}
              className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600"
            >
              Reconnect
            </a>
          )}
        </div>
      </div>

      {isConnected && hasAccounts && (
        <TransactionFilters
          {...filterProps}
          resultLabel={resultLabel(activeShown, archivedShown)}
          totalLabel={visibleTotals.length > 0 ? `Visible total: ${visibleTotals.join(" | ")}` : null}
        />
      )}

      {error === "connection_failed" && (
        <p className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          Connection to {bankLabel} failed. Please try again.
        </p>
      )}

      {syncError && (
        <p className="mb-5 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          Synchronization error: {syncError}
        </p>
      )}

      {!isConnected ? (
        <p className="text-sm text-gray-500">Connect your {bankLabel} account to view transactions.</p>
      ) : !hasAccounts ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800">
          <p className="mb-1 font-medium">No accessible account</p>
          <p className="text-amber-700">
            {bankLabel} was authorized but returned no account identifier. This can happen with ING NL.
            Reconnect and explicitly select the account on the consent screen.
          </p>
        </div>
      ) : transactions.length === 0 ? (
        <p className="text-sm text-gray-500">No transactions found for the current filters.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full whitespace-nowrap text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-3 py-2.5 text-left font-semibold">Date</th>
                <th className="px-3 py-2.5 text-left font-semibold">Type</th>
                <th className="px-3 py-2.5 text-left font-semibold">Description</th>
                <th className="px-3 py-2.5 text-left font-semibold">Counterpart</th>
                <th className="px-3 py-2.5 text-left font-semibold">Card</th>
                <th className="px-3 py-2.5 text-left font-semibold">Value date</th>
                <th className="px-3 py-2.5 text-left font-semibold">Category</th>
                <th className="px-3 py-2.5 text-left font-semibold">Subcategory</th>
                <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
                <th className="w-14 px-2 py-2.5 text-right font-semibold"> </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transactions.map((tx) => {
                const isArchived = tx.archived_at !== null;
                return (
                <tr key={tx.id} className={`transition-colors ${isArchived ? "bg-gray-50 text-gray-400" : "hover:bg-gray-50"}`}>
                  <td className={`px-3 py-2 ${isArchived ? "text-gray-400" : "text-gray-500"}`}>{fmtDate(tx.date)}</td>
                  <td className="px-3 py-2">
                    {tx.tx_type ? (
                      <span className={`rounded px-1.5 py-0.5 text-xs ${isArchived ? "bg-gray-200 text-gray-500" : "bg-gray-100 text-gray-600"}`}>
                        {TX_TYPE_LABELS[tx.tx_type] ?? tx.tx_type}
                      </span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className={`max-w-[220px] truncate px-3 py-2 ${isArchived ? "text-gray-400" : "text-gray-800"}`} title={tx.description}>
                    <span>{tx.description}</span>
                    {isArchived && (
                      <span className="ml-2 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                        Archived
                      </span>
                    )}
                  </td>
                  <td className={`max-w-[160px] truncate px-3 py-2 ${isArchived ? "text-gray-400" : "text-gray-500"}`} title={tx.counterpart ?? ""}>
                    {tx.counterpart && tx.counterpart !== tx.description ? tx.counterpart : <span className="text-gray-300">-</span>}
                  </td>
                  <td className={`px-3 py-2 font-mono text-xs ${isArchived ? "text-gray-400" : "text-gray-500"}`}>
                    {tx.card_last4 ? (
                      <span>
                        **** {tx.card_last4}
                        {tx.card_network ? <span className="ml-1 font-sans text-gray-400">{tx.card_network}</span> : null}
                      </span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-gray-400">{fmtDate(tx.value_date)}</td>
                  <td className="px-3 py-2">
                    {tx.category ? (
                      <span className={`rounded px-1.5 py-0.5 text-xs ${isArchived ? "bg-gray-200 text-gray-500" : "bg-indigo-50 text-indigo-600"}`}>{tx.category}</span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {tx.subcategory ? (
                      <span className={`rounded px-1.5 py-0.5 text-xs ${isArchived ? "bg-gray-200 text-gray-500" : "bg-indigo-50 text-indigo-500"}`}>{tx.subcategory}</span>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className={`px-3 py-2 text-right font-mono font-medium ${isArchived ? "text-gray-400" : tx.amount < 0 ? "text-red-600" : "text-emerald-600"}`}>
                    {fmt(tx.amount, tx.currency)}
                  </td>
                  <td className="px-2 py-2 text-right">
                    <ArchiveButton isArchived={isArchived} transactionId={tx.id} />
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
