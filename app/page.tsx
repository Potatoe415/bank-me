import Link from "next/link";
import { cookies } from "next/headers";
import db from "@/lib/db";
import { getBankById } from "@/lib/banks.config";
import { getProvider } from "@/lib/providers";
import type { Transaction } from "@/lib/providers/types";
import { buildEditableTaxonomy, formatCategoryPath, type EditableTaxonomy } from "@/lib/taxonomy";
import { isTransactionEditModeEnabled, TRANSACTION_EDIT_MODE_COOKIE } from "@/lib/transaction-edit-mode";
import { COLUMN_PREFS_COOKIE, parseHiddenColumns } from "@/lib/column-prefs";
import { syncTransactions } from "./actions";
import TransactionFilters from "./components/TransactionFilters";
import TransactionsTable from "./components/TransactionsTable";

function getAccountUids(bankId: string): string[] {
  const row = db
    .prepare("SELECT account_uids FROM provider_tokens WHERE provider = ?")
    .get(`enablebanking_${bankId}`) as { account_uids: string } | undefined;
  return row ? JSON.parse(row.account_uids) : [];
}

function getLastSyncDate(bankId: string): string | null {
  const row = db
    .prepare("SELECT MAX(updated_at) AS last_sync FROM account_balances WHERE bank_id = ?")
    .get(bankId) as { last_sync: string | null } | undefined;
  return row?.last_sync ?? null;
}

function fmtSyncDate(isoStr: string): string {
  const d = new Date(isoStr + (isoStr.endsWith("Z") ? "" : "Z"));
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

const DEFAULT_PAGE_SIZE = 100;
const ALLOWED_PAGE_SIZES = [25, 50, 100, 200, 500] as const;
const EMPTY_FILTER_VALUE = "__empty__";

function parsePageSize(value: string | undefined): number {
  const n = parseInt(value ?? "", 10);
  return (ALLOWED_PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
}

type SearchParamsInput = Record<string, string | string[] | undefined>;

type PageProps = {
  searchParams: Promise<SearchParamsInput>;
};

type QueryFilters = {
  from: string | null;
  to: string | null;
  category: string | null;
  reviewStatus: string | null;
  confidenceLevel: string | null;
  source: string | null;
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

type PaginatedTransactionsResult = {
  totalActive: number;
  displayTotal: number;
  totalPages: number;
  currentPage: number;
  transactions: Transaction[];
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
    const terms = filters.query.split(/\s+OR\s+/i).map((t) => t.trim()).filter(Boolean);
    if (terms.length === 1) {
      clauses.push("(LOWER(description) LIKE @query OR LOWER(COALESCE(counterpart, '')) LIKE @query)");
      params.query = `%${terms[0].toLowerCase()}%`;
    } else {
      const subClauses = terms.map((term, i) => {
        params[`query${i}`] = `%${term.toLowerCase()}%`;
        return `(LOWER(description) LIKE @query${i} OR LOWER(COALESCE(counterpart, '')) LIKE @query${i})`;
      });
      clauses.push(`(${subClauses.join(" OR ")})`);
    }
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
    clauses.push("category_path = 'uncategorized'");
  } else if (filters.category) {
    clauses.push("category_path = @category");
    params.category = filters.category;
  }

  if (filters.reviewStatus) {
    clauses.push("review_status = @reviewStatus");
    params.reviewStatus = filters.reviewStatus;
  }

  const VALID_CONFIDENCE = new Set(["low", "medium", "high"]);
  if (filters.confidenceLevel && VALID_CONFIDENCE.has(filters.confidenceLevel)) {
    clauses.push("confidence_level = @confidenceLevel");
    params.confidenceLevel = filters.confidenceLevel;
  }

  if (filters.source) {
    clauses.push("categorization_source = @source");
    params.source = filters.source;
  }

  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  return { whereSql, params };
}

function getDistinctCategoryOptions(bankId: string | null, filters: QueryFilters) {
  const optionFilters: QueryFilters = { ...filters, category: null };
  const { whereSql, params } = buildSqlFilters(bankId, optionFilters, { activeOnly: true });
  const rows = db
    .prepare(
      `SELECT DISTINCT category_path FROM transactions ${whereSql}
       ORDER BY category_path COLLATE NOCASE ASC`
    )
    .all(params) as Array<{ category_path: string }>;

  const options: FilterOption[] = [];

  for (const row of rows) {
    const path = row.category_path;
    if (!path || path === "uncategorized") {
      continue;
    }
    options.push({ value: path, label: formatCategoryPath(path) });
  }

  options.unshift({ value: EMPTY_FILTER_VALUE, label: "Uncategorized" });

  return options;
}

function getEditableTaxonomyOptions(): EditableTaxonomy {
  const rows = db
    .prepare("SELECT category FROM taxonomy_entries ORDER BY category COLLATE NOCASE ASC")
    .all() as Array<{ category: string | null }>;

  return buildEditableTaxonomy(rows);
}

function getVisibleTotals(transactions: Transaction[]) {
  const totals = new Map<string, number>();

  for (const tx of transactions) {
    if (tx.archived_at) continue;
    if (tx.is_excluded_from_spending) continue;
    totals.set(tx.currency, (totals.get(tx.currency) ?? 0) + tx.amount);
  }

  return [...totals.entries()].map(([currency, amount]) => fmt(amount, currency));
}

function getGrandTotals(bankId: string | null, filters: QueryFilters) {
  const { whereSql, params } = buildSqlFilters(bankId, filters, { activeOnly: true });
  const rows = db
    .prepare(
      `SELECT currency, SUM(amount) as total
       FROM transactions
       ${whereSql} AND is_excluded_from_spending = 0
       GROUP BY currency`
    )
    .all(params) as Array<{ currency: string; total: number }>;

  return rows.map(({ currency, total }) => fmt(total, currency));
}

function countArchived(transactions: Transaction[]) {
  return transactions.filter((tx) => tx.archived_at !== null).length;
}

function buildPageHref(bankId: string, page: number, filters: QueryFilters, pageSize: number) {
  const params = new URLSearchParams({ bank: bankId, page: String(page) });

  if (filters.from)            params.set("from", filters.from);
  if (filters.to)              params.set("to", filters.to);
  if (filters.category)        params.set("category", filters.category);
  if (filters.reviewStatus)    params.set("review_status", filters.reviewStatus);
  if (filters.confidenceLevel) params.set("confidence_level", filters.confidenceLevel);
  if (filters.source)          params.set("source", filters.source);
  if (filters.query)           params.set("query", filters.query);
  if (filters.amountInput)     params.set("amount", filters.amountInput);
  if (pageSize !== DEFAULT_PAGE_SIZE) params.set("page_size", String(pageSize));

  return `/?${params.toString()}`;
}

function getPaginatedTransactions(
  bankId: string | null,
  filters: QueryFilters,
  rawPage: string | undefined,
  pageSize: number
): PaginatedTransactionsResult {
  const safePage = Math.max(1, parseInt(rawPage ?? "1", 10) || 1);
  const { whereSql, params } = buildSqlFilters(bankId, filters);
  const { whereSql: activeWhereSql, params: activeParams } = buildSqlFilters(bankId, filters, { activeOnly: true });

  const { count: totalActive } = db
    .prepare(`SELECT COUNT(*) as count FROM transactions ${activeWhereSql}`)
    .get(activeParams) as { count: number };
  const { count: displayTotal } = db
    .prepare(`SELECT COUNT(*) as count FROM transactions ${whereSql}`)
    .get(params) as { count: number };

  const totalPages = Math.max(1, Math.ceil(displayTotal / pageSize));
  const currentPage = Math.min(safePage, totalPages);
  const offset = (currentPage - 1) * pageSize;
  const orderBy = filters.reviewStatus === "needs_review"
    ? `ORDER BY CASE confidence_level WHEN 'low' THEN 1 WHEN 'medium' THEN 2 WHEN 'high' THEN 3 ELSE 4 END ASC, date DESC`
    : `ORDER BY date DESC`;

  const transactions = db
    .prepare(
      `SELECT * FROM transactions
       ${whereSql}
       ${orderBy}
       LIMIT @limit OFFSET @offset`
    )
    .all({ ...params, limit: pageSize, offset }) as Transaction[];

  return {
    totalActive,
    displayTotal,
    totalPages,
    currentPage,
    transactions,
  };
}

function resultLabel(activeCount: number, archivedCount: number, totalActive?: number) {
  const base = totalActive === undefined ? `${activeCount} active` : `Showing ${activeCount} / ${totalActive} active`;
  return archivedCount > 0 ? `${base} | ${archivedCount} archived shown` : base;
}

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amount);
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getDefaultDateRange() {
  const today = new Date();
  const from = new Date(today);
  from.setMonth(from.getMonth() - 3);

  return {
    from: formatDateInput(from),
    to: formatDateInput(today),
  };
}

function PaginationNav({
  bankId,
  filters,
  currentPage,
  totalPages,
  pageSize,
}: {
  bankId: string;
  filters: QueryFilters;
  currentPage: number;
  totalPages: number;
  pageSize: number;
}) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="mt-4 flex items-center justify-between">
      <span className="text-xs text-gray-400">
        Page {currentPage} of {totalPages}
      </span>
      <div className="flex gap-1">
        {currentPage > 1 && (
          <Link
            href={buildPageHref(bankId, currentPage - 1, filters, pageSize)}
            className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50"
          >
            Previous
          </Link>
        )}
        {currentPage < totalPages && (
          <Link
            href={buildPageHref(bankId, currentPage + 1, filters, pageSize)}
            className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50"
          >
            Next
          </Link>
        )}
      </div>
    </div>
  );
}

export default async function Home({ searchParams }: PageProps) {
  const cookieStore = await cookies();
  const isEditMode = isTransactionEditModeEnabled(cookieStore.get(TRANSACTION_EDIT_MODE_COOKIE)?.value);
  const hiddenColumns = parseHiddenColumns(cookieStore.get(COLUMN_PREFS_COOKIE)?.value);
  const taxonomy = getEditableTaxonomyOptions();
  const rawParams = await searchParams;
  const error = firstString(rawParams.error);
  const syncError = firstString(rawParams.sync_error);
  const bankId = firstString(rawParams.bank) ?? "revolut";
  const rawPage = firstString(rawParams.page);
  const pageSize = parsePageSize(firstString(rawParams.page_size));

  const amountFilter = parseAmountFilter(normalizeAmountInput(firstString(rawParams.amount)));

  const filters: QueryFilters = {
    from: normalizeDate(firstString(rawParams.from)),
    to: normalizeDate(firstString(rawParams.to)),
    category: normalizeText(firstString(rawParams.category)),
    reviewStatus: normalizeText(firstString(rawParams.review_status)),
    confidenceLevel: normalizeText(firstString(rawParams.confidence_level)),
    source: normalizeText(firstString(rawParams.source)),
    query: normalizeText(firstString(rawParams.query)),
    amountInput: normalizeAmountInput(firstString(rawParams.amount)),
    amountOperator: amountFilter.amountOperator,
    amountAbs: amountFilter.amountAbs,
  };

  const visibleBankId = bankId === "all" ? null : bankId;
  const categoryOptions = getDistinctCategoryOptions(visibleBankId, filters);
  const hasActiveFilters = Boolean(
    filters.from ||
    filters.to ||
    filters.category ||
    filters.reviewStatus ||
    filters.confidenceLevel ||
    filters.source ||
    filters.query ||
    filters.amountInput
  );

  const activeFilters: Record<string, string> = {
    bank: bankId,
    ...(filters.from            && { from: filters.from }),
    ...(filters.to              && { to: filters.to }),
    ...(filters.category        && { category: filters.category }),
    ...(filters.reviewStatus    && { review_status: filters.reviewStatus }),
    ...(filters.confidenceLevel && { confidence_level: filters.confidenceLevel }),
    ...(filters.source          && { source: filters.source }),
    ...(filters.query           && { query: filters.query }),
    ...(filters.amountInput     && { amount: filters.amountInput }),
  };

  const filterProps = {
    bankId,
    initialValues: {
      from: filters.from ?? "",
      to: filters.to ?? "",
      category: filters.category ?? "",
      reviewStatus: filters.reviewStatus ?? "",
      confidenceLevel: filters.confidenceLevel ?? "",
      source: filters.source ?? "",
      query: filters.query ?? "",
      amount: filters.amountInput,
      pageSize,
    },
    categoryOptions,
    resetHref: `/?bank=${bankId}`,
    hasActiveFilters,
    allowedPageSizes: ALLOWED_PAGE_SIZES,
  };

  if (bankId === "all") {
    const { totalActive, transactions, totalPages, currentPage } = getPaginatedTransactions(null, filters, rawPage, pageSize);
    const visibleTotals = getVisibleTotals(transactions);
    const grandTotals = getGrandTotals(null, filters);
    const archivedShown = countArchived(transactions);
    const activeShown = transactions.length - archivedShown;

    return (
      <main className="px-8 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-gray-900">All banks</h1>
            {isEditMode && (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                Edit mode
              </span>
            )}
          </div>
          <span className="text-xs text-gray-400">
            {totalActive} active transaction{totalActive > 1 ? "s" : ""}
          </span>
        </div>

        <TransactionFilters
          {...filterProps}
          resultLabel={resultLabel(activeShown, archivedShown, totalActive)}
          totalLabel={visibleTotals.length > 0 ? `Visible total: ${visibleTotals.join(" | ")}` : null}
          grandTotalLabel={grandTotals.length > 0 ? `Total: ${grandTotals.join(" | ")}` : null}
        />

        {transactions.length === 0 ? (
          <p className="text-sm text-gray-500">No transactions found.</p>
        ) : (
          <>
            <TransactionsTable transactions={transactions} showBankColumn isEditMode={isEditMode} taxonomy={taxonomy} hiddenColumns={hiddenColumns} activeFilters={activeFilters} />
            <PaginationNav bankId={bankId} filters={filters} currentPage={currentPage} totalPages={totalPages} pageSize={pageSize} />
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

  const { totalActive, transactions, totalPages, currentPage } = getPaginatedTransactions(bankId, filters, rawPage, pageSize);
  const visibleTotals = getVisibleTotals(transactions);
  const grandTotals = getGrandTotals(visibleBankId, filters);
  const archivedShown = countArchived(transactions);
  const activeShown = transactions.length - archivedShown;
  const syncWithBank = syncTransactions.bind(null, bankId);
  const lastSyncRaw = getLastSyncDate(bankId);
  const lastSyncLabel = lastSyncRaw ? fmtSyncDate(lastSyncRaw) : null;

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
          {isEditMode && (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
              Edit mode
            </span>
          )}
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
            <div className="flex items-center gap-2">
              {lastSyncLabel && (
                <span className="text-xs text-gray-400">Synced {lastSyncLabel}</span>
              )}
              <form action={syncWithBank}>
                <button
                  type="submit"
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  Synchronize
                </button>
              </form>
            </div>
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
          resultLabel={resultLabel(activeShown, archivedShown, totalActive)}
          totalLabel={visibleTotals.length > 0 ? `Visible total: ${visibleTotals.join(" | ")}` : null}
          grandTotalLabel={grandTotals.length > 0 ? `Total: ${grandTotals.join(" | ")}` : null}
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
        <>
          <TransactionsTable transactions={transactions} showBankColumn={false} isEditMode={isEditMode} taxonomy={taxonomy} hiddenColumns={hiddenColumns} activeFilters={activeFilters} />
          <PaginationNav bankId={bankId} filters={filters} currentPage={currentPage} totalPages={totalPages} pageSize={pageSize} />
        </>
      )}
    </main>
  );
}
