import Link from "next/link";
import db from "@/lib/db";
import { getBankById } from "@/lib/banks.config";
import { formatCategoryPath } from "@/lib/taxonomy";
import NameDrilldownFilters from "@/app/components/NameDrilldownFilters";

type SearchParamsInput = Record<string, string | string[] | undefined>;
type PageProps = { searchParams: Promise<SearchParamsInput> };

type NameRow = {
  id: string;
  date: string;
  amount: number;
  currency: string;
  description: string;
  counterpart: string | null;
  category_path: string;
  bank_id: string;
};

function firstString(v: string | string[] | undefined) {
  if (Array.isArray(v)) return v[0];
  return v;
}

function fmtMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function fmtMoneyShort(amount: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function fmtMonthFull(key: string) {
  const [year, month] = key.split("-");
  return new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-GB", {
    month: "short",
    year: "numeric",
  });
}

const YEAR_COLORS = [
  "#4f46e5",
  "#0284c7",
  "#0f766e",
  "#65a30d",
  "#ca8a04",
  "#ea580c",
  "#dc2626",
  "#7c3aed",
];

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type MonthlyPoint = {
  key: string;
  label: string;
  year: number;
  amount: number;
  count: number;
  avgAmount: number;
  color: string;
};

type YearlyPoint = {
  year: number;
  amount: number;
  count: number;
  activeMonths: number;
  avgPerMonth: number;
  color: string;
};

type CalendarRow = {
  year: number;
  months: (number | null)[];
  total: number;
  color: string;
};

type CurrencySection = {
  currency: string;
  totalSpend: number;
  count: number;
  avgPerTx: number;
  avgPerActiveMonth: number;
  firstDate: string | null;
  lastDate: string | null;
  activeMonths: number;
  totalMonths: number;
  monthlyPoints: MonthlyPoint[];
  maxMonthlyAmount: number;
  yearlyPoints: YearlyPoint[];
  maxYearlyAmount: number;
  calendarRows: CalendarRow[];
  maxCalendarCell: number;
  yoyDeltas: { year: number; delta: number; pct: number | null }[];
  recent: NameRow[];
};

function AvgPriceChart({ points, currency }: { points: MonthlyPoint[]; currency: string }) {
  if (points.length < 2) return null;

  const W = 900;
  const H = 200;
  const PL = 64;
  const PR = 16;
  const PT = 16;
  const PB = 32;
  const chartW = W - PL - PR;
  const chartH = H - PT - PB;

  const values = points.map((p) => p.avgAmount);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const range = rawMax - rawMin || 1;
  const yMin = Math.max(0, rawMin - range * 0.25);
  const yMax = rawMax + range * 0.25;

  const toX = (i: number) => PL + (i / (points.length - 1)) * chartW;
  const toY = (v: number) => PT + chartH - ((v - yMin) / (yMax - yMin)) * chartH;

  const coords = points.map((p, i) => ({ x: toX(i), y: toY(p.avgAmount), p }));

  let linePath = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    const cpX = ((prev.x + curr.x) / 2).toFixed(1);
    linePath += ` C ${cpX} ${prev.y.toFixed(1)} ${cpX} ${curr.y.toFixed(1)} ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
  }
  const areaPath =
    linePath +
    ` L ${coords[coords.length - 1].x.toFixed(1)} ${(PT + chartH).toFixed(1)}` +
    ` L ${PL.toFixed(1)} ${(PT + chartH).toFixed(1)} Z`;

  const yTicks = 4;
  const yGridLines = Array.from({ length: yTicks + 1 }, (_, i) => {
    const v = yMin + ((yMax - yMin) * i) / yTicks;
    return { y: toY(v), label: fmtMoneyShort(v, currency) };
  });

  const yearBoundaries: { x: number; year: number }[] = [];
  let lastYear = -1;
  coords.forEach((c) => {
    if (c.p.year !== lastYear) {
      yearBoundaries.push({ x: c.x, year: c.p.year });
      lastYear = c.p.year;
    }
  });

  const showDots = points.length <= 48;
  const firstAvg = values[0];
  const lastAvg = values[values.length - 1];
  const trendPct = firstAvg > 0 ? ((lastAvg - firstAvg) / firstAvg) * 100 : null;
  const gradId = `avgGrad_${currency}`;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
            Avg transaction price — evolution
          </p>
          <p className="mt-1 text-sm text-gray-500">
            How much a typical transaction cost, month by month.
          </p>
        </div>
        <div className="flex shrink-0 gap-3">
          <div className="text-right">
            <p className="text-[11px] text-gray-400">First</p>
            <p className="text-sm font-semibold text-gray-700">{fmtMoney(firstAvg, currency)}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-gray-400">Latest</p>
            <p className="text-sm font-semibold text-gray-700">{fmtMoney(lastAvg, currency)}</p>
          </div>
          {trendPct !== null && (
            <div
              className={`rounded-xl px-3 py-1.5 text-center ${
                trendPct > 0 ? "bg-rose-50" : "bg-emerald-50"
              }`}
            >
              <p
                className={`text-lg font-bold leading-none ${
                  trendPct > 0 ? "text-rose-600" : "text-emerald-600"
                }`}
              >
                {trendPct > 0 ? "+" : ""}
                {Math.round(trendPct)}%
              </p>
              <p className="mt-0.5 text-[10px] text-gray-400">vs first</p>
            </div>
          )}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        style={{ display: "block", overflow: "visible" }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {yGridLines.map((tick, i) => (
          <g key={i}>
            <line x1={PL} y1={tick.y.toFixed(1)} x2={W - PR} y2={tick.y.toFixed(1)} stroke="#f3f4f6" strokeWidth="1" />
            <text x={(PL - 8).toFixed(1)} y={tick.y.toFixed(1)} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="#9ca3af">
              {tick.label}
            </text>
          </g>
        ))}

        {yearBoundaries.map((yb, i) => (
          <g key={yb.year}>
            {i > 0 && (
              <line x1={yb.x.toFixed(1)} y1={PT} x2={yb.x.toFixed(1)} y2={PT + chartH} stroke="#e5e7eb" strokeWidth="1" strokeDasharray="3 3" />
            )}
            <text x={yb.x.toFixed(1)} y={(PT + chartH + 20).toFixed(1)} textAnchor="middle" fontSize="11" fill="#9ca3af">
              {yb.year}
            </text>
          </g>
        ))}

        <path d={areaPath} fill={`url(#${gradId})`} />
        <path d={linePath} fill="none" stroke="#4f46e5" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />

        {showDots &&
          coords.map((c, i) => (
            <circle key={i} cx={c.x.toFixed(1)} cy={c.y.toFixed(1)} r="3.5" fill={c.p.color} stroke="white" strokeWidth="1.5" />
          ))}
      </svg>
    </div>
  );
}

function buildAnalytics(rows: NameRow[]): CurrencySection[] {
  if (rows.length === 0) return [];

  const byCurrency = new Map<string, NameRow[]>();
  for (const row of rows) {
    const g = byCurrency.get(row.currency) ?? [];
    g.push(row);
    byCurrency.set(row.currency, g);
  }

  return [...byCurrency.entries()]
    .map(([currency, cRows]) => {
      const expenses = cRows;
      const sorted = [...expenses].sort((a, b) => a.date.localeCompare(b.date));
      const totalSpend = expenses.reduce((s, r) => s - r.amount, 0);
      const count = expenses.length;
      const avgPerTx = count > 0 ? totalSpend / count : 0;
      const firstDate = sorted[0]?.date ?? null;
      const lastDate = sorted[sorted.length - 1]?.date ?? null;

      const monthMap = new Map<string, { amount: number; count: number }>();
      const yearMap = new Map<number, { amount: number; count: number; months: Set<number> }>();

      for (const row of expenses) {
        const mKey = row.date.slice(0, 7);
        const me = monthMap.get(mKey) ?? { amount: 0, count: 0 };
        me.amount -= row.amount;
        me.count += 1;
        monthMap.set(mKey, me);

        const year = parseInt(row.date.slice(0, 4));
        const month = parseInt(row.date.slice(5, 7));
        const ye = yearMap.get(year) ?? { amount: 0, count: 0, months: new Set() };
        ye.amount -= row.amount;
        ye.count += 1;
        ye.months.add(month);
        yearMap.set(year, ye);
      }

      const years = [...yearMap.keys()].sort();
      const yearColorMap = new Map(years.map((y, i) => [y, YEAR_COLORS[i % YEAR_COLORS.length]]));

      const monthlyPoints: MonthlyPoint[] = [...monthMap.entries()]
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, data]) => ({
          key,
          label: fmtMonthFull(key),
          year: parseInt(key.slice(0, 4)),
          amount: data.amount,
          count: data.count,
          avgAmount: data.count > 0 ? data.amount / data.count : 0,
          color: yearColorMap.get(parseInt(key.slice(0, 4))) ?? YEAR_COLORS[0],
        }));

      const maxMonthlyAmount = Math.max(...monthlyPoints.map((m) => m.amount), 0);
      const avgPerActiveMonth = monthlyPoints.length > 0 ? totalSpend / monthlyPoints.length : 0;

      const yearlyPoints: YearlyPoint[] = years.map((year) => {
        const data = yearMap.get(year)!;
        return {
          year,
          amount: data.amount,
          count: data.count,
          activeMonths: data.months.size,
          avgPerMonth: data.amount / data.months.size,
          color: yearColorMap.get(year)!,
        };
      });

      const maxYearlyAmount = Math.max(...yearlyPoints.map((y) => y.amount), 0);

      const calendarRows: CalendarRow[] = years.map((year) => {
        const months: (number | null)[] = Array(12).fill(null);
        for (const row of expenses) {
          if (parseInt(row.date.slice(0, 4)) === year) {
            const m = parseInt(row.date.slice(5, 7)) - 1;
            months[m] = (months[m] ?? 0) - row.amount;
          }
        }
        const total = months.reduce<number>((s, v) => s + (v ?? 0), 0);
        return { year, months, total, color: yearColorMap.get(year)! };
      });

      const maxCalendarCell = Math.max(
        ...(calendarRows.flatMap((r) => r.months).filter((v) => v !== null) as number[]),
        0
      );

      const yoyDeltas = yearlyPoints.slice(1).map((curr, i) => {
        const prev = yearlyPoints[i];
        const delta = curr.amount - prev.amount;
        const pct = prev.amount > 0 ? (delta / prev.amount) * 100 : null;
        return { year: curr.year, delta, pct };
      });

      const recent = [...sorted].reverse().slice(0, 10);

      const activeMonths = monthlyPoints.length;
      let totalMonths = 0;
      if (firstDate && lastDate) {
        const [fy, fm] = firstDate.slice(0, 7).split("-").map(Number);
        const [ly, lm] = lastDate.slice(0, 7).split("-").map(Number);
        totalMonths = (ly * 12 + lm) - (fy * 12 + fm) + 1;
      }

      return {
        currency,
        totalSpend,
        count,
        avgPerTx,
        avgPerActiveMonth,
        firstDate,
        lastDate,
        activeMonths,
        totalMonths,
        monthlyPoints,
        maxMonthlyAmount,
        yearlyPoints,
        maxYearlyAmount,
        calendarRows,
        maxCalendarCell,
        yoyDeltas,
        recent,
      };
    })
    .sort((a, b) => b.totalSpend - a.totalSpend);
}

function buildNameHref(p: { q?: string; bank?: string; categories?: string[]; dateFrom?: string; dateTo?: string; defaultDateFrom?: string; defaultDateTo?: string }) {
  const params = new URLSearchParams();
  if (p.q) params.set("q", p.q);
  if (p.bank && p.bank !== "all") params.set("bank", p.bank);
  for (const c of p.categories ?? []) params.append("category", c);
  if (p.dateFrom && p.dateFrom !== p.defaultDateFrom) params.set("dateFrom", p.dateFrom);
  if (p.dateTo && p.dateTo !== p.defaultDateTo) params.set("dateTo", p.dateTo);
  const str = params.toString();
  return str ? `/graphics-name?${str}` : "/graphics-name";
}

function buildTabHref(path: string, bankId: string) {
  if (bankId === "all") return path;
  return `${path}?bank=${bankId}`;
}

function buildTxListHref({
  bankId,
  q,
  categories,
  from,
  to,
}: {
  bankId: string;
  q?: string;
  categories?: string[];
  from: string;
  to: string;
}) {
  const params = new URLSearchParams();
  params.set("bank", "all");
  if (q) params.set("query", q);
  if (categories && categories.length > 0) {
    params.set("category", categories[0]);
  }
  params.set("from", from);
  params.set("to", to);
  return `/?${params.toString()}`;
}

function getMonthDateRange(key: string) {
  const [yearStr, monthStr] = key.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const from = `${yearStr}-${monthStr}-01`;
  const lastDayNum = new Date(year, month, 0).getDate();
  const lastDayStr = String(lastDayNum).padStart(2, "0");
  const to = `${yearStr}-${monthStr}-${lastDayStr}`;
  return { from, to };
}

export default async function GraphicsNamePage({ searchParams }: PageProps) {
  const rawParams = await searchParams;
  const q = firstString(rawParams.q)?.trim() ?? "";
  const bankId = firstString(rawParams.bank) ?? "all";
  const rawCategories = rawParams.category;
  const categories = (
    Array.isArray(rawCategories)
      ? rawCategories
      : rawCategories
      ? [rawCategories]
      : []
  ).map((c) => c.trim()).filter(Boolean).slice(0, 3);

  const todayDate = new Date();
  const defaultDateTo = todayDate.toISOString().slice(0, 10);
  const oneYearAgo = new Date(todayDate);
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const defaultDateFrom = oneYearAgo.toISOString().slice(0, 10);

  const dateFrom = firstString(rawParams.dateFrom)?.trim() || defaultDateFrom;
  const dateTo = firstString(rawParams.dateTo)?.trim() || defaultDateTo;

  const bankRows = db
    .prepare(
      "SELECT DISTINCT bank_id FROM transactions WHERE archived_at IS NULL ORDER BY bank_id ASC"
    )
    .all() as Array<{ bank_id: string }>;

  const bankOptions = bankRows.map(({ bank_id }) => ({
    id: bank_id,
    name: getBankById(bank_id)?.name ?? bank_id,
    color: getBankById(bank_id)?.color ?? "#6b7280",
    initial: getBankById(bank_id)?.initial ?? bank_id.slice(0, 2).toUpperCase(),
  }));

  const catClauseParts = ["archived_at IS NULL", "cashflow_type = 'expense'"];
  const catParamsBase: Record<string, string> = {};
  if (bankId !== "all") {
    catClauseParts.push("bank_id = @bankId");
    catParamsBase.bankId = bankId;
  }
  const categoryOptions = (
    db
      .prepare(
        `SELECT DISTINCT category_path FROM transactions WHERE ${catClauseParts.join(" AND ")} ORDER BY category_path ASC`
      )
      .all(catParamsBase) as Array<{ category_path: string }>
  ).map((r) => ({ value: r.category_path, label: formatCategoryPath(r.category_path) }));

  const terms = q.length >= 2
    ? q.split(/\s+OR\s+/i).map((t) => t.trim()).filter(Boolean)
    : [];

  const hasFilters = terms.length > 0 || categories.length > 0;

  let rows: NameRow[] = [];
  if (hasFilters) {
    const clauses = ["archived_at IS NULL", "cashflow_type = 'expense'"];
    const sqlParams: Record<string, string> = {};

    if (terms.length === 1) {
      sqlParams.query = `%${terms[0].toLowerCase()}%`;
      clauses.push("(LOWER(description) LIKE @query OR LOWER(COALESCE(counterpart,'')) LIKE @query)");
    } else if (terms.length > 1) {
      const subClauses = terms.map((term, i) => {
        sqlParams[`query${i}`] = `%${term.toLowerCase()}%`;
        return `(LOWER(description) LIKE @query${i} OR LOWER(COALESCE(counterpart,'')) LIKE @query${i})`;
      });
      clauses.push(`(${subClauses.join(" OR ")})`);
    }

    if (categories.length > 0) {
      const catPlaceholders = categories.map((c, i) => {
        sqlParams[`cat${i}`] = c;
        return `@cat${i}`;
      });
      clauses.push(`category_path IN (${catPlaceholders.join(", ")})`);
    }

    if (bankId !== "all") {
      clauses.push("bank_id = @bankId");
      sqlParams.bankId = bankId;
    }

    clauses.push("date >= @dateFrom");
    clauses.push("date <= @dateTo");
    sqlParams.dateFrom = dateFrom;
    sqlParams.dateTo = dateTo;

    rows = db
      .prepare(
        `SELECT id, date, amount, currency, description, counterpart, category_path, bank_id
         FROM transactions
         WHERE ${clauses.join(" AND ")}
         ORDER BY date DESC`
      )
      .all(sqlParams) as NameRow[];
  }

  const analytics = buildAnalytics(rows);

  return (
    <main className="px-8 py-8">
      {/* Tab navigation */}
      <div className="mb-8 flex flex-col gap-5">
        <div className="flex flex-wrap gap-2">
          <Link
            href={buildTabHref("/graphics", bankId)}
            className="rounded-full bg-gray-100 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-200"
          >
            Macro View
          </Link>
          <Link
            href={buildTabHref("/graphics-actionable", bankId)}
            className="rounded-full bg-gray-100 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-200"
          >
            Actionable Drilldown
          </Link>
          <Link
            href={buildTabHref("/graphics-name", bankId)}
            className="rounded-full bg-gray-900 px-3 py-1.5 text-sm text-white"
          >
            Name Drilldown
          </Link>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Name Drilldown</h1>
          <p className="max-w-3xl text-sm text-gray-500">
            Search for a merchant, counterpart, or keyword to see the full history of that spending — month by month, year by year.
          </p>
        </div>

        {/* Bank scope */}
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">Scope</p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={buildNameHref({ q, bank: "all", categories, dateFrom, dateTo, defaultDateFrom, defaultDateTo })}
              className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                bankId === "all" ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              All banks
            </Link>
            {bankOptions.map((bank) => (
              <Link
                key={bank.id}
                href={buildNameHref({ q, bank: bank.id, categories, dateFrom, dateTo, defaultDateFrom, defaultDateTo })}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm transition-colors ${
                  bank.id === bankId ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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

        {/* Filters */}
        <NameDrilldownFilters
          initialQ={q}
          initialCategories={categories}
          bankId={bankId}
          categoryOptions={categoryOptions}
          initialDateFrom={dateFrom}
          initialDateTo={dateTo}
          defaultDateFrom={defaultDateFrom}
          defaultDateTo={defaultDateTo}
        />
      </div>

      {/* Empty state — no filters active */}
      {!hasFilters && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50">
            <svg className="h-6 w-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          </div>
          <p className="text-base font-medium text-gray-800">Select at least one category or enter a name</p>
          <p className="mt-2 text-sm text-gray-500">
            Pick up to 3 categories, type a merchant name, or combine both to explore spending history.
          </p>
        </div>
      )}

      {/* Query too short / only invalid OR */}
      {q.length >= 1 && q.length < 2 && categories.length === 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-6 text-center">
          <p className="text-sm text-amber-700">Please enter at least 2 characters for the name search.</p>
        </div>
      )}

      {/* Filters active but no results */}
      {hasFilters && rows.length === 0 && (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-10 text-center">
          <p className="text-base font-medium text-gray-800">No outgoing transactions found for this filter combination.</p>
          <p className="mt-2 text-sm text-gray-500">Try broadening the name, removing a category, or switching to All banks.</p>
        </div>
      )}

      {/* Query too short */}
      {q.length === 1 && terms.length === 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-6 text-center">
          <p className="text-sm text-amber-700">Please enter at least 2 characters.</p>
        </div>
      )}

      {/* Analytics */}
      {analytics.length > 0 && (
        <div className="space-y-12">
          {analytics.map((section) => (
            <div key={section.currency} className="space-y-6">
              {/* Section header */}
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-gray-400">Currency</p>
                  <h2 className="mt-1 text-xl font-semibold text-gray-900">
                    {section.currency}
                    {q && <> — &ldquo;{q}&rdquo;</>}
                    {categories.length > 0 && (
                      <span className="ml-2 text-sm font-normal text-indigo-600">
                        [{categories.map((c) => formatCategoryPath(c)).join(", ")}]
                      </span>
                    )}
                  </h2>
                </div>
                <p className="text-sm text-gray-500">
                  {section.count} transaction{section.count > 1 ? "s" : ""} from{" "}
                  {section.firstDate ? fmtDate(section.firstDate) : "—"} to{" "}
                  {section.lastDate ? fmtDate(section.lastDate) : "—"}
                </p>
              </div>

              {/* KPI cards */}
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">Total spent</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-gray-900">
                    {fmtMoney(section.totalSpend, section.currency)}
                  </p>
                  <p className="mt-2 text-sm text-gray-500">{section.count} outgoing payments</p>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">Avg per payment</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-gray-900">
                    {fmtMoney(section.avgPerTx, section.currency)}
                  </p>
                  <p className="mt-2 text-sm text-gray-500">Per individual transaction</p>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">Avg per active month</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-gray-900">
                    {fmtMoney(section.avgPerActiveMonth, section.currency)}
                  </p>
                  <p className="mt-2 text-sm text-gray-500">
                    Over {section.monthlyPoints.length} month{section.monthlyPoints.length > 1 ? "s" : ""}
                  </p>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">Active months</p>
                  <p className="mt-3 text-3xl font-semibold tracking-tight text-gray-900">
                    {section.activeMonths}
                    <span className="ml-1 text-lg font-normal text-gray-400">
                      / {section.totalMonths}
                    </span>
                  </p>
                  <p className="mt-2 text-sm text-gray-500">
                    {section.totalMonths > 0
                      ? `${Math.round((section.activeMonths / section.totalMonths) * 100)}% coverage over ${section.yearlyPoints.length} year${section.yearlyPoints.length > 1 ? "s" : ""}`
                      : `Over ${section.yearlyPoints.length} year${section.yearlyPoints.length > 1 ? "s" : ""}`}
                  </p>
                </div>
              </div>

              {/* Avg price evolution curve */}
              <AvgPriceChart points={section.monthlyPoints} currency={section.currency} />

              {/* Year comparison */}
              {section.yearlyPoints.length > 0 && (
                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">Year by year</p>
                      <p className="mt-1 text-sm text-gray-500">Annual total — outgoing only.</p>
                    </div>
                    {/* Year legend */}
                    <div className="flex flex-wrap gap-2">
                      {section.yearlyPoints.map((y) => (
                        <span key={y.year} className="flex items-center gap-1.5 text-xs text-gray-500">
                          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: y.color }} />
                          {y.year}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-end gap-4">
                    {section.yearlyPoints.map((y) => {
                      const height = section.maxYearlyAmount > 0 ? (y.amount / section.maxYearlyAmount) * 100 : 0;
                      const delta = section.yoyDeltas.find((d) => d.year === y.year);
                      const txListUrl = buildTxListHref({
                        bankId,
                        q,
                        categories,
                        from: `${y.year}-01-01`,
                        to: `${y.year}-12-31`,
                      });
                      return (
                        <Link
                          key={y.year}
                          href={txListUrl}
                          className="flex flex-1 flex-col items-center gap-2 group cursor-pointer hover:no-underline"
                        >
                          <span className="text-xs font-medium text-gray-600 group-hover:text-indigo-600 transition-colors">
                            {fmtMoney(y.amount, section.currency)}
                          </span>
                          {delta && (
                            <span
                              className={`text-[10px] font-semibold ${
                                delta.delta > 0 ? "text-rose-500" : "text-emerald-600"
                              }`}
                            >
                              {delta.delta > 0 ? "+" : ""}
                              {delta.pct !== null ? `${Math.round(delta.pct)}%` : "N/A"}
                            </span>
                          )}
                          <div className="flex h-40 w-full items-end rounded-t-xl px-1 transition-all group-hover:scale-[1.02] group-hover:shadow-sm" style={{ background: `color-mix(in srgb, ${y.color} 8%, transparent)` }}>
                            <div
                              className="w-full rounded-t-xl transition-all"
                              style={{
                                height: `${Math.max(height, 4)}%`,
                                backgroundColor: y.color,
                              }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-gray-700 group-hover:text-indigo-600 transition-colors">{y.year}</span>
                          <span className="text-xs text-gray-400">{y.count} tx · {y.activeMonths}mo</span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Monthly chronological chart */}
              {section.monthlyPoints.length > 0 && (
                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="mb-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
                      Month by month — all time
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      Every active month, color-coded by year.
                    </p>
                  </div>
                  <div className="overflow-x-auto pb-2">
                    <div
                      className="flex items-end gap-1.5"
                      style={{ minWidth: `${section.monthlyPoints.length * 52}px` }}
                    >
                      {section.monthlyPoints.map((m) => {
                        const height =
                          section.maxMonthlyAmount > 0
                            ? (m.amount / section.maxMonthlyAmount) * 100
                            : 0;
                        const { from, to } = getMonthDateRange(m.key);
                        const txListUrl = buildTxListHref({
                          bankId,
                          q,
                          categories,
                          from,
                          to,
                        });
                        return (
                          <Link
                            key={m.key}
                            href={txListUrl}
                            className="flex flex-1 min-w-[44px] flex-col items-center gap-1.5 group cursor-pointer hover:no-underline"
                          >
                            <span className="text-[10px] font-medium text-gray-500 whitespace-nowrap group-hover:text-indigo-600 transition-colors">
                              {fmtMoney(m.amount, section.currency)}
                            </span>
                            <div
                              className="flex h-32 w-full items-end rounded-t-lg px-1 transition-all group-hover:scale-[1.02]"
                              style={{ background: `color-mix(in srgb, ${m.color} 6%, transparent)` }}
                            >
                              <div
                                className="w-full rounded-t-lg"
                                style={{
                                  height: `${Math.max(height, 4)}%`,
                                  backgroundColor: m.color,
                                  opacity: 0.85,
                                }}
                              />
                            </div>
                            <span className="text-[9px] text-gray-400 whitespace-nowrap group-hover:text-indigo-600 transition-colors">{m.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Calendar heatmap */}
              {section.calendarRows.length > 0 && (
                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <div className="mb-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
                      Calendar heatmap
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      Spend per calendar month. Darker = higher spend.
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr>
                          <th className="pb-3 pr-4 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">
                            Year
                          </th>
                          {MONTH_LABELS.map((m) => (
                            <th key={m} className="pb-3 px-1 text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400 min-w-[52px]">
                              {m}
                            </th>
                          ))}
                          <th className="pb-3 pl-4 text-right text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">
                            Total
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {section.calendarRows.map((row) => (
                          <tr key={row.year}>
                            <td className="py-2 pr-4 font-semibold text-gray-700">
                              <Link
                                href={buildTxListHref({
                                  bankId,
                                  q,
                                  categories,
                                  from: `${row.year}-01-01`,
                                  to: `${row.year}-12-31`,
                                })}
                                className="hover:text-indigo-600 transition-colors"
                              >
                                {row.year}
                              </Link>
                            </td>
                            {row.months.map((val, i) => {
                              const opacity =
                                val !== null && section.maxCalendarCell > 0
                                  ? 0.1 + (val / section.maxCalendarCell) * 0.85
                                  : 0;
                              return (
                                <td key={i} className="px-1 py-1 text-center">
                                  {val !== null ? (
                                    <Link
                                      href={(() => {
                                        const mStr = String(i + 1).padStart(2, "0");
                                        const { from, to } = getMonthDateRange(`${row.year}-${mStr}`);
                                        return buildTxListHref({ bankId, q, categories, from, to });
                                      })()}
                                      className="mx-auto flex h-9 w-full min-w-[44px] max-w-[60px] items-center justify-center rounded-lg text-[10px] font-medium transition-transform hover:scale-105 cursor-pointer"
                                      style={{
                                        backgroundColor: `color-mix(in srgb, ${row.color} ${Math.round(opacity * 100)}%, #f9fafb)`,
                                        color: opacity > 0.55 ? "white" : "#374151",
                                      }}
                                    >
                                      {fmtMoney(val, section.currency)}
                                    </Link>
                                  ) : (
                                    <div className="mx-auto h-9 w-full min-w-[44px] max-w-[60px] rounded-lg bg-gray-50" />
                                  )}
                                </td>
                              );
                            })}
                            <td className="py-2 pl-4 text-right font-semibold text-gray-900">
                              <Link
                                href={buildTxListHref({
                                  bankId,
                                  q,
                                  categories,
                                  from: `${row.year}-01-01`,
                                  to: `${row.year}-12-31`,
                                })}
                                className="hover:text-indigo-600 transition-colors"
                              >
                                {fmtMoney(row.total, section.currency)}
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      {section.calendarRows.length > 1 && (
                        <tfoot>
                          <tr className="border-t-2 border-gray-200">
                            <td className="pt-3 pr-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-gray-400">
                              Total
                            </td>
                            {MONTH_LABELS.map((_, i) => {
                              const monthTotal = section.calendarRows.reduce(
                                (s, r) => s + (r.months[i] ?? 0),
                                0
                              );
                              return (
                                <td key={i} className="pt-3 px-1 text-center text-[10px] font-medium text-gray-500">
                                  {monthTotal > 0 ? fmtMoney(monthTotal, section.currency) : "—"}
                                </td>
                              );
                            })}
                            <td className="pt-3 pl-4 text-right font-bold text-gray-900">
                              {fmtMoney(section.totalSpend, section.currency)}
                            </td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              )}

              {/* YoY deltas */}
              {section.yoyDeltas.length > 0 && (
                <div className="rounded-2xl border border-gray-200 bg-white p-5">
                  <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
                    Year-over-year change
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {section.yoyDeltas.map((d) => (
                      <div
                        key={d.year}
                        className={`flex-1 min-w-[140px] rounded-xl border p-4 ${
                          d.delta > 0
                            ? "border-rose-200 bg-rose-50"
                            : "border-emerald-200 bg-emerald-50"
                        }`}
                      >
                        <p className="text-xs font-semibold text-gray-500">{d.year - 1} → {d.year}</p>
                        <p
                          className={`mt-2 text-2xl font-semibold ${
                            d.delta > 0 ? "text-rose-600" : "text-emerald-600"
                          }`}
                        >
                          {d.delta > 0 ? "+" : ""}
                          {fmtMoney(d.delta, section.currency)}
                        </p>
                        {d.pct !== null && (
                          <p className={`mt-1 text-sm font-medium ${d.delta > 0 ? "text-rose-500" : "text-emerald-500"}`}>
                            {d.delta > 0 ? "+" : ""}{Math.round(d.pct)}%
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent transactions */}
              <div className="rounded-2xl border border-gray-200 bg-white p-5">
                <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
                  Most recent transactions
                </p>
                <div className="divide-y divide-gray-100">
                  {section.recent.map((row) => {
                    const label = (row.counterpart ?? row.description).trim() || row.description;
                    const bank = getBankById(row.bank_id);
                    return (
                      <div key={row.id} className="flex items-center justify-between gap-4 py-3">
                        <div className="flex min-w-0 items-center gap-3">
                          {bank && (
                            <span
                              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[8px] font-bold text-white"
                              style={{ backgroundColor: bank.color }}
                            >
                              {bank.initial}
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-gray-800">{label}</p>
                            <p className="text-xs text-gray-400">{fmtDate(row.date)}</p>
                          </div>
                        </div>
                          <span className="shrink-0 text-sm font-semibold text-gray-900">
                            {fmtMoney(-row.amount, section.currency)}
                          </span>
                      </div>
                    );
                  })}
                </div>
                {section.count > 10 && (
                  <p className="mt-3 text-center text-xs text-gray-400">
                    Showing 10 of {section.count} transactions.{" "}
                    <Link
                      href={`/?query=${encodeURIComponent(q)}${bankId !== "all" ? `&bank=${bankId}` : ""}`}
                      className="text-indigo-500 underline hover:text-indigo-700"
                    >
                      See all in transaction list
                    </Link>
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
