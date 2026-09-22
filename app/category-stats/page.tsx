import db from "@/lib/db";
import { formatCategoryPath } from "@/lib/taxonomy";
import Link from "next/link";
import type { JSX } from "react";
import CategoryStatsDateFilter from "./CategoryStatsDateFilter";

export const metadata = {
  title: "Category Stats - myBanks",
  description: "Governance, confidence, and taxonomy distribution dashboard for your transactions.",
};

type DbGeneralMetrics = {
  total_count: number;
  categorized_count: number;
  manual_count: number;
};

type DbConfidenceRow = {
  confidence_level: string;
  count: number;
};

type DbReviewRow = {
  review_status: string;
  count: number;
};

type DbSourceRow = {
  categorization_source: string;
  count: number;
};

type DbCategoryRow = {
  category_path: string;
  tx_count: number;
  currency: string | null;
  total_amount: number | null;
  confirmed_count: number;
  needs_review_count: number;
  high_confidence_count: number;
  medium_confidence_count: number;
  low_confidence_count: number;
};

type DbCategorySourceRow = {
  category_path: string;
  categorization_source: string;
  count: number;
};

interface CategoryBreakdown {
  categoryPath: string;
  txCount: number;
  amounts: Record<string, number>;
  confirmedCount: number;
  needsReviewCount: number;
  highConfidenceCount: number;
  mediumConfidenceCount: number;
  lowConfidenceCount: number;
  primarySource: string;
}

type SearchParamsInput = Record<string, string | string[] | undefined>;

type PageProps = {
  searchParams: Promise<SearchParamsInput>;
};

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function normalizeDate(value: string | undefined) {
  return value?.match(/^\d{4}-\d{2}-\d{2}$/) ? value : null;
}

function formatDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getDefaultDateRange() {
  const today = new Date();
  const from = new Date(today);
  from.setDate(from.getDate() - 90);

  return {
    from: formatDateInput(from),
    to: formatDateInput(today),
  };
}

function fmtMoney(amount: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getSourceConfig(source: string) {
  switch (source) {
    case "manual":
      return { label: "Manual UI/Batch", color: "bg-purple-50 text-purple-700 border-purple-200" };
    case "llm":
      return { label: "LLM Classification", color: "bg-blue-50 text-blue-700 border-blue-200" };
    case "propagation_iban":
      return { label: "Prop (IBAN)", color: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "propagation_merchant":
      return { label: "Prop (Merchant)", color: "bg-teal-50 text-teal-700 border-teal-200" };
    case "propagation_description":
      return { label: "Prop (Desc)", color: "bg-green-50 text-green-700 border-green-200" };
    case "propagation_keyword":
      return { label: "Prop (Keyword)", color: "bg-cyan-50 text-cyan-700 border-cyan-200" };
    case "hardcoded_rule":
    case "rule":
      return { label: "Rules", color: "bg-amber-50 text-amber-700 border-amber-200" };
    case "deterministic_cache":
      return { label: "Cache Match", color: "bg-slate-100 text-slate-700 border-slate-200" };
    case "ingestion_raw":
      return { label: "Raw Ingestion", color: "bg-gray-100 text-gray-600 border-gray-200" };
    default:
      return { label: source || "Unknown", color: "bg-gray-50 text-gray-500 border-gray-200" };
  }
}

export default async function CategoryStatsPage({ searchParams }: PageProps): Promise<JSX.Element> {
  const rawParams = await searchParams;
  const isDefaultRange = rawParams.from === undefined && rawParams.to === undefined;
  
  const defaultRange = getDefaultDateRange();
  const from = isDefaultRange
    ? defaultRange.from
    : normalizeDate(firstString(rawParams.from));
  const to = isDefaultRange
    ? defaultRange.to
    : normalizeDate(firstString(rawParams.to));

  // Build filters dynamically
  const clauses = ["archived_at IS NULL", "is_deleted = 0"];
  const queryParams: Record<string, string> = {};

  if (from) {
    clauses.push("date >= @from");
    queryParams.from = from;
  }
  if (to) {
    clauses.push("date <= @to || 'T23:59:59.999Z'");
    queryParams.to = to;
  }

  const whereClause = clauses.join(" AND ");

  // 1. General Metrics
  const generalMetrics = db
    .prepare(`
      SELECT 
        COUNT(*) as total_count,
        SUM(CASE WHEN category_path != 'uncategorized' THEN 1 ELSE 0 END) as categorized_count,
        SUM(CASE WHEN category_is_manual = 1 THEN 1 ELSE 0 END) as manual_count
      FROM transactions
      WHERE ${whereClause}
    `)
    .get(queryParams) as DbGeneralMetrics;

  const totalCount = generalMetrics?.total_count ?? 0;
  const categorizedCount = generalMetrics?.categorized_count ?? 0;
  const manualCount = generalMetrics?.manual_count ?? 0;
  const uncategorizedCount = totalCount - categorizedCount;
  const coverageRate = totalCount > 0 ? (categorizedCount / totalCount) * 100 : 0;
  const manualRate = totalCount > 0 ? (manualCount / totalCount) * 100 : 0;

  // 2. Count of unique taxonomy paths
  const taxonomyCountRow = db
    .prepare("SELECT COUNT(*) as count FROM taxonomy_entries")
    .get() as { count: number } | undefined;
  const totalTaxonomyCount = taxonomyCountRow?.count ?? 0;

  const usedTaxonomyRow = db
    .prepare(`
      SELECT COUNT(DISTINCT category_path) as count 
      FROM transactions 
      WHERE ${whereClause} AND category_path != 'uncategorized'
    `)
    .get(queryParams) as { count: number } | undefined;
  const usedTaxonomyCount = usedTaxonomyRow?.count ?? 0;

  // 3. Confidence level aggregates
  const confidenceRows = db
    .prepare(`
      SELECT confidence_level, COUNT(*) as count
      FROM transactions
      WHERE ${whereClause}
      GROUP BY confidence_level
    `)
    .all(queryParams) as DbConfidenceRow[];

  // 4. Review status aggregates
  const reviewRows = db
    .prepare(`
      SELECT review_status, COUNT(*) as count
      FROM transactions
      WHERE ${whereClause}
      GROUP BY review_status
    `)
    .all(queryParams) as DbReviewRow[];

  // 5. Source aggregates
  const sourceRows = db
    .prepare(`
      SELECT categorization_source, COUNT(*) as count
      FROM transactions
      WHERE ${whereClause}
      GROUP BY categorization_source
      ORDER BY count DESC
    `)
    .all(queryParams) as DbSourceRow[];

  // 6. Category breakdown rows (we keep all categories in the list by applying date filters on LEFT JOIN)
  const categoryBreakdownRows = db
    .prepare(`
      SELECT 
        te.category as category_path,
        COUNT(t.id) as tx_count,
        t.currency,
        SUM(t.amount) as total_amount,
        SUM(CASE WHEN t.review_status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_count,
        SUM(CASE WHEN t.review_status = 'needs_review' THEN 1 ELSE 0 END) as needs_review_count,
        SUM(CASE WHEN t.confidence_level = 'high' THEN 1 ELSE 0 END) as high_confidence_count,
        SUM(CASE WHEN t.confidence_level = 'medium' THEN 1 ELSE 0 END) as medium_confidence_count,
        SUM(CASE WHEN t.confidence_level = 'low' THEN 1 ELSE 0 END) as low_confidence_count
      FROM taxonomy_entries te
      LEFT JOIN transactions t ON te.category = t.category_path 
        AND t.archived_at IS NULL 
        AND t.is_deleted = 0
        ${from ? "AND t.date >= @from" : ""}
        ${to ? "AND t.date <= @to || 'T23:59:59.999Z'" : ""}
      GROUP BY te.category, t.currency
      ORDER BY te.category ASC
    `)
    .all(queryParams) as DbCategoryRow[];

  // 7. Category-source mappings to find the primary source for each category
  const categorySourceRows = db
    .prepare(`
      SELECT 
        category_path,
        categorization_source,
        COUNT(*) as count
      FROM transactions
      WHERE ${whereClause}
      GROUP BY category_path, categorization_source
    `)
    .all(queryParams) as DbCategorySourceRow[];

  // Process category source maps
  const primarySourceMap = new Map<string, string>();
  const sourceCountMap = new Map<string, { source: string; count: number }>();
  for (const row of categorySourceRows) {
    const currentMax = sourceCountMap.get(row.category_path);
    if (!currentMax || row.count > currentMax.count) {
      sourceCountMap.set(row.category_path, { source: row.categorization_source, count: row.count });
      primarySourceMap.set(row.category_path, row.categorization_source);
    }
  }

  // Aggregate currency specific amounts and other details
  const breakdownsMap = new Map<string, CategoryBreakdown>();
  for (const row of categoryBreakdownRows) {
    let entry = breakdownsMap.get(row.category_path);
    if (!entry) {
      entry = {
        categoryPath: row.category_path,
        txCount: 0,
        amounts: {},
        confirmedCount: 0,
        needsReviewCount: 0,
        highConfidenceCount: 0,
        mediumConfidenceCount: 0,
        lowConfidenceCount: 0,
        primarySource: primarySourceMap.get(row.category_path) ?? "ingestion_raw",
      };
      breakdownsMap.set(row.category_path, entry);
    }

    entry.txCount += row.tx_count;
    if (row.currency && row.total_amount !== null) {
      entry.amounts[row.currency] = (entry.amounts[row.currency] ?? 0) + row.total_amount;
    }
    entry.confirmedCount += row.confirmed_count;
    entry.needsReviewCount += row.needs_review_count;
    entry.highConfidenceCount += row.high_confidence_count;
    entry.mediumConfidenceCount += row.medium_confidence_count;
    entry.lowConfidenceCount += row.low_confidence_count;
  }

  const breakdowns = Array.from(breakdownsMap.values());

  // Extract totals for confidence
  const confHigh = confidenceRows.find((r) => r.confidence_level === "high")?.count ?? 0;
  const confMedium = confidenceRows.find((r) => r.confidence_level === "medium")?.count ?? 0;
  const confLow = confidenceRows.find((r) => r.confidence_level === "low")?.count ?? 0;

  // Extract totals for review status
  const revConfirmed = reviewRows.find((r) => r.review_status === "confirmed")?.count ?? 0;
  const revNeedsReview = reviewRows.find((r) => r.review_status === "needs_review")?.count ?? 0;
  const revIgnored = reviewRows.find((r) => r.review_status === "ignored")?.count ?? 0;

  // Build the triage URL preserving dates
  const triageParams = new URLSearchParams({ bank: "all", category: "__empty__" });
  if (from) triageParams.set("from", from);
  if (to) triageParams.set("to", to);
  const triageHref = `/?${triageParams.toString()}`;

  // Helper to build inspect links preserving dates
  const buildInspectHref = (categoryPath: string) => {
    const params = new URLSearchParams({ bank: "all" });
    if (categoryPath === "uncategorized") {
      params.set("category", "__empty__");
    } else {
      params.set("category", categoryPath);
    }
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return `/?${params.toString()}`;
  };

  return (
    <main className="px-8 py-8 w-full max-w-[1600px] mx-auto">
      {/* Title block & Date Filter */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-5">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Category Taxonomy Stats</h1>
          <p className="max-w-xl text-sm text-gray-500">
            Global status dashboard for transaction categorization. Audit your classification coverage, review confidence levels, and analyze assignment origins.
          </p>
        </div>
        <div className="shrink-0">
          <CategoryStatsDateFilter initialFrom={from ?? ""} initialTo={to ?? ""} />
        </div>
      </div>

      {totalCount === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-6 py-12 text-center">
          <p className="text-base font-medium text-gray-800">No transaction data available for this range.</p>
          <p className="mt-2 text-sm text-gray-500">
            Try adjusting your date range filter or synchronize transactions first.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Key Metrics Cards */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Card 1: Coverage */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 flex flex-col justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
                  Categorization Coverage
                </p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-gray-900">
                  {coverageRate.toFixed(1)}%
                </p>
              </div>
              <div className="mt-4">
                <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-indigo-600"
                    style={{ width: `${coverageRate}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {categorizedCount.toLocaleString()} of {totalCount.toLocaleString()} transactions categorized
                </p>
              </div>
            </div>

            {/* Card 2: Taxonomy Usage */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 flex flex-col justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
                  Taxonomy Usage
                </p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-gray-900">
                  {usedTaxonomyCount} <span className="text-lg font-normal text-gray-400">/ {totalTaxonomyCount}</span>
                </p>
              </div>
              <div className="mt-4">
                <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${(usedTaxonomyCount / totalTaxonomyCount) * 100}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Active taxonomy category paths in use (excluding uncategorized)
                </p>
              </div>
            </div>

            {/* Card 3: Manual Locks */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 flex flex-col justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
                  Manual Overrides
                </p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-gray-900">
                  {manualRate.toFixed(1)}%
                </p>
              </div>
              <div className="mt-4">
                <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-purple-500"
                    style={{ width: `${manualRate}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {manualCount.toLocaleString()} transactions human-locked and protected from automation
                </p>
              </div>
            </div>

            {/* Card 4: Uncategorized Queue */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 flex flex-col justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">
                  Uncategorized Queue
                </p>
                <p className="mt-3 text-3xl font-semibold tracking-tight text-gray-950">
                  {uncategorizedCount.toLocaleString()}
                </p>
              </div>
              <div className="mt-4">
                {uncategorizedCount > 0 ? (
                  <Link
                    href={triageHref}
                    className="inline-flex w-full items-center justify-center rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-100"
                  >
                    Triage Uncategorized
                  </Link>
                ) : (
                  <span className="inline-flex w-full items-center justify-center rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                    Perfect Score! 0 remaining
                  </span>
                )}
                <p className="mt-2 text-xs text-gray-400">
                  Active transactions requiring manual or rule-based assignment
                </p>
              </div>
            </div>
          </section>

          {/* Graphical Distributions panels */}
          <section className="grid gap-4 md:grid-cols-3">
            {/* Confidence distribution panel */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 flex flex-col justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400 mb-1">
                  Confidence levels
                </p>
                <p className="text-xs text-gray-500 mb-4">Trust level distribution across all classifications</p>
                
                {/* Horizontal Stacked Bar */}
                <div className="h-4 w-full rounded-full bg-gray-100 overflow-hidden flex mb-5 shadow-inner">
                  {confHigh > 0 && (
                    <div
                      className="h-full bg-emerald-500 transition-all border-r border-white/20"
                      style={{ width: `${(confHigh / totalCount) * 100}%` }}
                      title={`High confidence: ${confHigh}`}
                    />
                  )}
                  {confMedium > 0 && (
                    <div
                      className="h-full bg-amber-400 transition-all border-r border-white/20"
                      style={{ width: `${(confMedium / totalCount) * 100}%` }}
                      title={`Medium confidence: ${confMedium}`}
                    />
                  )}
                  {confLow > 0 && (
                    <div
                      className="h-full bg-rose-500 transition-all"
                      style={{ width: `${(confLow / totalCount) * 100}%` }}
                      title={`Low confidence: ${confLow}`}
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      <span className="font-medium text-gray-700">High Confidence</span>
                    </div>
                    <span className="font-mono text-gray-600">
                      {confHigh.toLocaleString()} ({((confHigh / totalCount) * 100).toFixed(1)}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                      <span className="font-medium text-gray-700">Medium Confidence</span>
                    </div>
                    <span className="font-mono text-gray-600">
                      {confMedium.toLocaleString()} ({((confMedium / totalCount) * 100).toFixed(1)}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                      <span className="font-medium text-gray-700">Low Confidence</span>
                    </div>
                    <span className="font-mono text-gray-600">
                      {confLow.toLocaleString()} ({((confLow / totalCount) * 100).toFixed(1)}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Review status distribution panel */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 flex flex-col justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400 mb-1">
                  Governance Audit Status
                </p>
                <p className="text-xs text-gray-500 mb-4">Confirmed locks vs items needing manual review</p>

                {/* Horizontal Stacked Bar */}
                <div className="h-4 w-full rounded-full bg-gray-100 overflow-hidden flex mb-5 shadow-inner">
                  {revConfirmed > 0 && (
                    <div
                      className="h-full bg-indigo-600 transition-all border-r border-white/20"
                      style={{ width: `${(revConfirmed / totalCount) * 100}%` }}
                      title={`Confirmed: ${revConfirmed}`}
                    />
                  )}
                  {revNeedsReview > 0 && (
                    <div
                      className="h-full bg-orange-400 transition-all border-r border-white/20"
                      style={{ width: `${(revNeedsReview / totalCount) * 100}%` }}
                      title={`Needs Review: ${revNeedsReview}`}
                    />
                  )}
                  {revIgnored > 0 && (
                    <div
                      className="h-full bg-slate-400 transition-all"
                      style={{ width: `${(revIgnored / totalCount) * 100}%` }}
                      title={`Ignored: ${revIgnored}`}
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-600" />
                      <span className="font-medium text-gray-700">Confirmed (Stable)</span>
                    </div>
                    <span className="font-mono text-gray-600">
                      {revConfirmed.toLocaleString()} ({((revConfirmed / totalCount) * 100).toFixed(1)}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-orange-400" />
                      <span className="font-medium text-gray-700">Needs Review</span>
                    </div>
                    <span className="font-mono text-gray-600">
                      {revNeedsReview.toLocaleString()} ({((revNeedsReview / totalCount) * 100).toFixed(1)}%)
                    </span>
                  </div>
                  {revIgnored > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                        <span className="font-medium text-gray-700">Ignored</span>
                      </div>
                      <span className="font-mono text-gray-600">
                        {revIgnored.toLocaleString()} ({((revIgnored / totalCount) * 100).toFixed(1)}%)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sources distribution panel */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 flex flex-col justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400 mb-1">
                  Categorization Sources
                </p>
                <p className="text-xs text-gray-500 mb-4">Origins of category classifications</p>

                <div className="space-y-3 max-h-36 overflow-y-auto pr-1">
                  {sourceRows.map((source) => {
                    const config = getSourceConfig(source.categorization_source);
                    const pct = (source.count / totalCount) * 100;
                    return (
                      <div key={source.categorization_source} className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-medium text-gray-700 truncate max-w-[150px]">{config.label}</span>
                          <span className="font-mono text-gray-500 shrink-0">
                            {source.count.toLocaleString()} ({pct.toFixed(1)}%)
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-gray-50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gray-400 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          {/* Taxonomy breakdown table card */}
          <section className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Taxonomy Breakdown</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Detailed analysis of each category defined in the schema.
                </p>
              </div>
              <div className="flex gap-4 text-xs font-medium text-gray-400">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>High Confidence / Confirmed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span>Medium / Needs Review</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                  <span>Low / Unconfirmed</span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-500 border-collapse">
                <thead className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest bg-gray-50/70 border-b border-gray-100">
                  <tr>
                    <th scope="col" className="px-6 py-3">Category Path</th>
                    <th scope="col" className="px-6 py-3 text-right">Transactions</th>
                    <th scope="col" className="px-6 py-3 text-right">Total Net Amount</th>
                    <th scope="col" className="px-6 py-3">Confidence Breakdown</th>
                    <th scope="col" className="px-6 py-3">Primary Source</th>
                    <th scope="col" className="px-6 py-3 text-center">Status</th>
                    <th scope="col" className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {breakdowns.map((category) => {
                    const formattedPath = formatCategoryPath(category.categoryPath);
                    const config = getSourceConfig(category.primarySource);
                    
                    // Determine Status badge
                    let statusLabel = "Unused";
                    let statusColor = "bg-gray-50 text-gray-500 border-gray-100";
                    
                    if (category.txCount > 0) {
                      if (category.needsReviewCount === 0) {
                        statusLabel = "Sure";
                        statusColor = "bg-emerald-50 text-emerald-700 border-emerald-100";
                      } else {
                        statusLabel = `${category.needsReviewCount} to Review`;
                        statusColor = "bg-amber-50 text-amber-700 border-amber-100";
                      }
                    }

                    // Format amount strings
                    const amountStrings = Object.entries(category.amounts);

                    return (
                      <tr
                        key={category.categoryPath}
                        className="hover:bg-gray-50/50 transition-colors group"
                      >
                        <td className="px-6 py-4 font-medium text-gray-900 font-mono text-xs">
                          {category.categoryPath === "uncategorized" ? (
                            <span className="text-amber-600 font-semibold">{formattedPath}</span>
                          ) : (
                            formattedPath
                          )}
                        </td>
                        
                        <td className="px-6 py-4 text-right font-mono text-xs text-gray-900">
                          {category.txCount > 0 ? (
                            category.txCount.toLocaleString()
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-right font-mono text-xs text-gray-900 whitespace-nowrap">
                          {amountStrings.length > 0 ? (
                            <div className="flex flex-col items-end">
                              {amountStrings.map(([currency, amt]) => {
                                const isNegative = amt < 0;
                                return (
                                  <span
                                    key={currency}
                                    className={isNegative ? "text-red-500" : "text-emerald-600"}
                                  >
                                    {isNegative ? "" : "+"}
                                    {fmtMoney(amt, currency)}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>

                        <td className="px-6 py-4 min-w-[180px]">
                          {category.txCount > 0 ? (
                            <div className="flex flex-col gap-1.5">
                              <div className="flex h-2 w-full overflow-hidden rounded-full bg-gray-100 shadow-inner">
                                {category.highConfidenceCount > 0 && (
                                  <div
                                    className="h-full bg-emerald-500 transition-all border-r border-white/10"
                                    style={{ width: `${(category.highConfidenceCount / category.txCount) * 100}%` }}
                                    title={`High confidence: ${category.highConfidenceCount}`}
                                  />
                                )}
                                {category.mediumConfidenceCount > 0 && (
                                  <div
                                    className="h-full bg-amber-400 transition-all border-r border-white/10"
                                    style={{ width: `${(category.mediumConfidenceCount / category.txCount) * 100}%` }}
                                    title={`Medium confidence: ${category.mediumConfidenceCount}`}
                                  />
                                )}
                                {category.lowConfidenceCount > 0 && (
                                  <div
                                    className="h-full bg-rose-500 transition-all"
                                    style={{ width: `${(category.lowConfidenceCount / category.txCount) * 100}%` }}
                                    title={`Low confidence: ${category.lowConfidenceCount}`}
                                  />
                                )}
                              </div>
                              <div className="flex justify-between text-[10px] font-mono text-gray-400">
                                <span>High: {Math.round((category.highConfidenceCount / category.txCount) * 100)}%</span>
                                <span>Low: {Math.round((category.lowConfidenceCount / category.txCount) * 100)}%</span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-300">No transactions</span>
                          )}
                        </td>

                        <td className="px-6 py-4">
                          {category.txCount > 0 ? (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${config.color}`}>
                              {config.label}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusColor}`}>
                            {statusLabel}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-right">
                          {category.txCount > 0 ? (
                            <Link
                              href={buildInspectHref(category.categoryPath)}
                              className="text-xs font-semibold text-indigo-600 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100/70 border border-transparent rounded-lg px-2.5 py-1.5 transition-all inline-flex items-center gap-1 group-hover:border-indigo-200"
                            >
                              Inspect
                              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="transition-transform group-hover:translate-x-0.5">
                                <path d="M4.5 9l3-3-3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </Link>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
