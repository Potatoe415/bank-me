import Link from "next/link";
import type { CSSProperties } from "react";
import db from "@/lib/db";
import { getBankById } from "@/lib/banks.config";
import { formatCategoryPath } from "@/lib/taxonomy";
import { DEFAULT_GRAPHICS_PERIOD, GRAPHICS_PERIOD_OPTIONS, getGraphicsPeriod, getSinceIso } from "@/lib/graphics-periods";

type SearchParamsInput = Record<string, string | string[] | undefined>;

type PageProps = {
  searchParams: Promise<SearchParamsInput>;
};

type SpendingRow = {
  id: string;
  date: string;
  amount: number;
  currency: string;
  description: string;
  counterpart: string | null;
  category_path: string;
  bank_id: string;
};

type CategoryDatum = {
  name: string;
  categoryPath: string;
  amount: number;
  count: number;
  share: number;
  color: string;
};

type CounterpartDatum = {
  name: string;
  amount: number;
  count: number;
};

type MonthDatum = {
  key: string;
  label: string;
  amount: number;
};

type CurrencyAnalytics = {
  currency: string;
  totalSpend: number;
  transactionCount: number;
  averageSpend: number;
  uncategorizedAmount: number;
  uncategorizedCount: number;
  topCategories: CategoryDatum[];
  topCounterparts: CounterpartDatum[];
  monthlyTrend: MonthDatum[];
};

const CATEGORY_COLORS = [
  "#4f46e5",
  "#0f766e",
  "#ea580c",
  "#dc2626",
  "#0284c7",
  "#7c3aed",
  "#65a30d",
  "#ca8a04",
];

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function fmtMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function fmtMonth(key: string) {
  const [year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });
}

function makeCounterpartLabel(row: SpendingRow) {
  const raw = (row.counterpart ?? row.description).trim();
  return raw.length > 0 ? raw : "Unknown";
}

function buildCurrencyAnalytics(rows: SpendingRow[]): CurrencyAnalytics[] {
  const rowsByCurrency = new Map<string, SpendingRow[]>();

  for (const row of rows) {
    const group = rowsByCurrency.get(row.currency) ?? [];
    group.push(row);
    rowsByCurrency.set(row.currency, group);
  }

  return [...rowsByCurrency.entries()]
    .map(([currency, currencyRows]) => {
      const categoryTotals = new Map<string, { amount: number; count: number }>();
      const counterpartTotals = new Map<string, { amount: number; count: number }>();
      const monthTotals = new Map<string, number>();

      let totalSpend = 0;
      let uncategorizedAmount = 0;
      let uncategorizedCount = 0;

      for (const row of currencyRows) {
        const spend = -row.amount;
        totalSpend += spend;

        const path = row.category_path || "uncategorized";
        const label = formatCategoryPath(path);
        const categoryEntry = categoryTotals.get(path) ?? { amount: 0, count: 0 };
        categoryEntry.amount += spend;
        categoryEntry.count += 1;
        categoryTotals.set(path, categoryEntry);

        if (path === "uncategorized") {
          uncategorizedAmount += spend;
          uncategorizedCount += 1;
        }

        const counterpartLabel = makeCounterpartLabel(row);
        const counterpartEntry = counterpartTotals.get(counterpartLabel) ?? { amount: 0, count: 0 };
        counterpartEntry.amount += spend;
        counterpartEntry.count += 1;
        counterpartTotals.set(counterpartLabel, counterpartEntry);

        const monthKey = row.date.slice(0, 7);
        monthTotals.set(monthKey, (monthTotals.get(monthKey) ?? 0) + spend);
      }

      const positiveCategories = [...categoryTotals.entries()]
        .filter(([, data]) => data.amount > 0);
      
      const pieTotal = positiveCategories.reduce((sum, [, data]) => sum + data.amount, 0);

      const topCategories = positiveCategories
        .sort((a, b) => b[1].amount - a[1].amount)
        .slice(0, 8)
        .map(([path, data], index) => ({
          name: formatCategoryPath(path),
          categoryPath: path,
          amount: data.amount,
          count: data.count,
          share: pieTotal > 0 ? data.amount / pieTotal : 0,
          color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
        }));

      const topCounterparts = [...counterpartTotals.entries()]
        .sort((a, b) => b[1].amount - a[1].amount)
        .slice(0, 6)
        .map(([name, data]) => ({
          name,
          amount: data.amount,
          count: data.count,
        }));

      const monthlyTrend = [...monthTotals.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .slice(-6)
        .map(([key, amount]) => ({
          key,
          label: fmtMonth(key),
          amount,
        }));

      return {
        currency,
        totalSpend,
        transactionCount: currencyRows.length,
        averageSpend: currencyRows.length > 0 ? totalSpend / currencyRows.length : 0,
        uncategorizedAmount,
        uncategorizedCount,
        topCategories,
        topCounterparts,
        monthlyTrend,
      };
    })
    .sort((a, b) => b.totalSpend - a.totalSpend);
}

function buildDonutStyle(categories: CategoryDatum[]) {
  if (categories.length === 0) {
    return {
      background: "conic-gradient(#e5e7eb 0deg 360deg)",
    } satisfies CSSProperties;
  }

  let current = 0;
  const segments = categories.map((category) => {
    const start = current;
    const degrees = category.share * 360;
    current += degrees;
    return `${category.color} ${start}deg ${current}deg`;
  });

  if (current < 360) {
    segments.push(`#e5e7eb ${current}deg 360deg`);
  }

  return {
    background: `conic-gradient(${segments.join(", ")})`,
  } satisfies CSSProperties;
}

function buildGraphicsHref(bankId: string, period: string) {
  if (bankId === "all" && period === DEFAULT_GRAPHICS_PERIOD) return "/graphics";
  const params = new URLSearchParams();
  if (bankId !== "all") params.set("bank", bankId);
  if (period !== DEFAULT_GRAPHICS_PERIOD) params.set("period", period);
  return `/graphics?${params.toString()}`;
}

function buildActionableHref(bankId: string, period: string) {
  if (bankId === "all" && period === DEFAULT_GRAPHICS_PERIOD) return "/graphics-actionable";
  const params = new URLSearchParams();
  if (bankId !== "all") params.set("bank", bankId);
  if (period !== DEFAULT_GRAPHICS_PERIOD) params.set("period", period);
  return `/graphics-actionable?${params.toString()}`;
}

export default async function GraphicsPage({ searchParams }: PageProps) {
  const rawParams = await searchParams;
  const bankId = firstString(rawParams.bank) ?? "all";
  const period = getGraphicsPeriod(firstString(rawParams.period));
  const sinceIso = getSinceIso(period.days);

  const bankRows = db
    .prepare("SELECT DISTINCT bank_id FROM transactions WHERE archived_at IS NULL ORDER BY bank_id ASC")
    .all() as Array<{ bank_id: string }>;

  const bankOptions = bankRows
    .map(({ bank_id }) => ({
      id: bank_id,
      name: getBankById(bank_id)?.name ?? bank_id,
      color: getBankById(bank_id)?.color ?? "#6b7280",
      initial: getBankById(bank_id)?.initial ?? bank_id.slice(0, 2).toUpperCase(),
    }));

  const clauses = [
    "cashflow_type = 'expense'",
    "is_excluded_from_spending = 0",
    "archived_at IS NULL",
  ];
  const params: Record<string, string> = {};

  if (bankId !== "all") {
    clauses.push("bank_id = @bankId");
    params.bankId = bankId;
  }

  if (sinceIso) {
    clauses.push("date >= @sinceIso");
    params.sinceIso = sinceIso;
  }

  const rows = db
    .prepare(
      `SELECT id, date, amount, currency, description, counterpart, category_path, bank_id
       FROM transactions
       WHERE ${clauses.join(" AND ")}
       ORDER BY date DESC`
    )
    .all(params) as SpendingRow[];

  const analytics = buildCurrencyAnalytics(rows);
  const selectedBank = bankId === "all" ? null : getBankById(bankId);
  const title = selectedBank ? `${selectedBank.name} graphics` : "Graphics";
  const periodDescription = period.value === "all" ? "all available time" : `the last ${period.label.toLowerCase()}`;
  const description = selectedBank
    ? `Spending analysis for ${selectedBank.name} over ${periodDescription}.`
    : `Spending analysis across all banks over ${periodDescription}.`;

  return (
    <main className="px-8 py-8">
      <div className="mb-8 flex flex-col gap-5">
        <div className="flex flex-wrap gap-2">
          <Link
            href={buildGraphicsHref(bankId, period.value)}
            className="rounded-full bg-gray-900 px-3 py-1.5 text-sm text-white"
          >
            Macro View
          </Link>
          <Link
            href={buildActionableHref(bankId, period.value)}
            className="rounded-full bg-gray-100 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-200"
          >
            Actionable Drilldown
          </Link>
          <Link
            href={bankId === "all" ? "/graphics-name" : `/graphics-name?bank=${bankId}`}
            className="rounded-full bg-gray-100 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-200"
          >
            Name Drilldown
          </Link>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{title}</h1>
          <p className="max-w-3xl text-sm text-gray-500">
            {description} This view focuses on outgoing money only, so refunds and incoming transfers do not dilute the picture.
          </p>
        </div>

        <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
              Scope
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={buildGraphicsHref("all", period.value)}
                className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                  bankId === "all"
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                All banks
              </Link>
              {bankOptions.map((bank) => (
                <Link
                  key={bank.id}
                  href={buildGraphicsHref(bank.id, period.value)}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors ${
                    bank.id === bankId
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[9px] font-bold text-white"
                    style={{ backgroundColor: bank.color }}
                  >
                    {bank.initial}
                  </span>
                  <span>{bank.name}</span>
                </Link>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
              Period
            </p>
            <div className="flex flex-wrap gap-2">
              {GRAPHICS_PERIOD_OPTIONS.map((option) => (
                <Link
                  key={option.value}
                  href={buildGraphicsHref(bankId, option.value)}
                  className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                    option.value === period.value
                      ? "bg-gray-900 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {option.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
          <p className="text-base font-medium text-gray-800">No spending data for this selection.</p>
          <p className="mt-2 text-sm text-gray-500">
            Try another bank, widen the period, or synchronize transactions first.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {analytics.map((currencyData) => {
            const biggestCategory = currencyData.topCategories[0];
            const biggestCounterpart = currencyData.topCounterparts[0];
            const maxMonthlyAmount = Math.max(...currencyData.monthlyTrend.map((month) => month.amount), 0);

            return (
              <section key={currencyData.currency} className="space-y-5">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">
                      Currency
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-gray-900">{currencyData.currency}</h2>
                  </div>
                  <p className="max-w-xl text-sm text-gray-500">
                    {biggestCategory
                      ? `${biggestCategory.name} is the largest bucket at ${Math.round(biggestCategory.share * 100)}% of spend.`
                      : "No category split available yet."}{" "}
                    {biggestCounterpart
                      ? `${biggestCounterpart.name} is the heaviest counterpart in this slice.`
                      : ""}
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
                      Total spent
                    </p>
                    <p className="mt-3 text-3xl font-semibold tracking-tight text-gray-900">
                      {fmtMoney(currencyData.totalSpend, currencyData.currency)}
                    </p>
                    <p className="mt-2 text-sm text-gray-500">
                      {currencyData.transactionCount} outgoing transaction{currencyData.transactionCount > 1 ? "s" : ""}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
                      Average expense
                    </p>
                    <p className="mt-3 text-3xl font-semibold tracking-tight text-gray-900">
                      {fmtMoney(currencyData.averageSpend, currencyData.currency)}
                    </p>
                    <p className="mt-2 text-sm text-gray-500">
                      Useful to compare routine spending versus one-off spikes.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
                      Uncategorized share
                    </p>
                    <p className="mt-3 text-3xl font-semibold tracking-tight text-gray-900">
                      {Math.round(
                        currencyData.totalSpend > 0
                          ? (currencyData.uncategorizedAmount / currencyData.totalSpend) * 100
                          : 0
                      )}
                      %
                    </p>
                    <p className="mt-2 text-sm text-gray-500">
                      {currencyData.uncategorizedCount} transaction{currencyData.uncategorizedCount > 1 ? "s" : ""} still need a category.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
                          Spending by category
                        </p>
                        <p className="mt-1 text-sm text-gray-500">
                          Each category path is shown as a distinct bucket.
                        </p>
                      </div>
                      <div className="relative h-24 w-24 shrink-0">
                        <div
                          className="h-24 w-24 rounded-full"
                          style={buildDonutStyle(currencyData.topCategories)}
                        />
                        <div className="absolute inset-4 rounded-full bg-white" />
                      </div>
                    </div>

                    <div className="space-y-3">
                      {currencyData.topCategories.map((category) => {
                        const categoryParams = new URLSearchParams({
                          bank: selectedBank?.id ?? "all",
                          category: category.categoryPath,
                        });
                        const categoryHref = `/?${categoryParams.toString()}`;

                        return (
                          <Link
                            key={category.categoryPath}
                            href={categoryHref}
                            className="block rounded-xl border border-transparent p-2 transition-colors hover:border-gray-200 hover:bg-gray-50"
                          >
                            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                              <div className="flex min-w-0 items-center gap-2">
                                <span
                                  className="h-3 w-3 shrink-0 rounded-full"
                                  style={{ backgroundColor: category.color }}
                                />
                                <span className="truncate font-medium text-gray-800">{category.name}</span>
                              </div>
                              <div className="text-right">
                                <span className="font-semibold text-gray-900">
                                  {fmtMoney(category.amount, currencyData.currency)}
                                </span>
                                <span className="ml-2 text-xs text-gray-400">
                                  {Math.round(category.share * 100)}%
                                </span>
                              </div>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${Math.max(category.share * 100, 4)}%`,
                                  backgroundColor: category.color,
                                }}
                              />
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 bg-white p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
                      Monthly trend
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      Last six visible months for this currency.
                    </p>

                    <div className="mt-6 flex min-h-56 items-end gap-3">
                      {currencyData.monthlyTrend.map((month) => {
                        const height = maxMonthlyAmount > 0 ? (month.amount / maxMonthlyAmount) * 100 : 0;

                        return (
                          <div key={month.key} className="flex flex-1 flex-col items-center gap-3">
                            <span className="text-[11px] font-medium text-gray-400">
                              {fmtMoney(month.amount, currencyData.currency)}
                            </span>
                            <div className="flex h-36 w-full items-end rounded-t-2xl bg-gradient-to-t from-indigo-50 to-transparent px-1">
                              <div
                                className="w-full rounded-t-2xl bg-gradient-to-b from-indigo-400 to-indigo-600"
                                style={{ height: `${Math.max(height, 6)}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">{month.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
                        Top counterparts
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        The merchants or payees absorbing the most money in this slice.
                      </p>
                    </div>
                    <span className="text-xs text-gray-400">
                      Based on outgoing transactions only
                    </span>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {currencyData.topCounterparts.map((counterpart, index) => (
                      <div
                        key={counterpart.name}
                        className="rounded-xl border border-gray-200 bg-gray-50/70 p-4"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">
                          #{index + 1}
                        </p>
                        <p className="mt-2 truncate text-base font-medium text-gray-900" title={counterpart.name}>
                          {counterpart.name}
                        </p>
                        <p className="mt-3 text-lg font-semibold text-gray-900">
                          {fmtMoney(counterpart.amount, currencyData.currency)}
                        </p>
                        <p className="mt-1 text-sm text-gray-500">
                          {counterpart.count} payment{counterpart.count > 1 ? "s" : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
