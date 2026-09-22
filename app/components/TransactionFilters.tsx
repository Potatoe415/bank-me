"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";

type FilterOption = {
  value: string;
  label: string;
};

type FilterValues = {
  from: string;
  to: string;
  category: string;
  reviewStatus: string;
  confidenceLevel: string;
  source: string;
  query: string;
  amount: string;
  pageSize: number;
};

type TransactionFiltersProps = {
  bankId: string;
  initialValues: FilterValues;
  categoryOptions: FilterOption[];
  resetHref: string;
  hasActiveFilters: boolean;
  resultLabel: string;
  totalLabel: string | null;
  grandTotalLabel: string | null;
  allowedPageSizes: readonly number[];
};

const DEFAULT_PAGE_SIZE = 100;

function buildHref(bankId: string, values: FilterValues, pathname: string) {
  const params = new URLSearchParams();
  params.set("bank", bankId);

  if (values.from)                          params.set("from", values.from);
  if (values.to)                            params.set("to", values.to);
  if (values.category)                      params.set("category", values.category);
  if (values.reviewStatus)                  params.set("review_status", values.reviewStatus);
  if (values.confidenceLevel)               params.set("confidence_level", values.confidenceLevel);
  if (values.source)                        params.set("source", values.source);
  if (values.query.trim())                  params.set("query", values.query.trim());
  if (values.amount.trim())                 params.set("amount", values.amount.trim());
  if (values.pageSize !== DEFAULT_PAGE_SIZE) params.set("page_size", String(values.pageSize));

  return `${pathname}?${params.toString()}`;
}

const CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;

export default function TransactionFilters({
  bankId,
  initialValues,
  categoryOptions,
  resetHref,
  hasActiveFilters,
  resultLabel,
  totalLabel,
  grandTotalLabel,
  allowedPageSizes,
}: TransactionFiltersProps) {
  const router   = useRouter();
  const pathname = usePathname();
  const mountedRef             = useRef(false);
  const lastAppliedValuesRef   = useRef(JSON.stringify(initialValues));

  const [from,            setFrom]            = useState(initialValues.from);
  const [to,              setTo]              = useState(initialValues.to);
  const [category,        setCategory]        = useState(initialValues.category);
  const [reviewStatus,    setReviewStatus]    = useState(initialValues.reviewStatus);
  const [confidenceLevel, setConfidenceLevel] = useState(initialValues.confidenceLevel);
  const [source,          setSource]          = useState(initialValues.source);
  const [query,           setQuery]           = useState(initialValues.query);
  const [amount,          setAmount]          = useState(initialValues.amount);
  const [pageSize,        setPageSize]        = useState(initialValues.pageSize);

  const currentValues: FilterValues = { from, to, category, reviewStatus, confidenceLevel, source, query, amount, pageSize };

  function applyFilters() {
    const href = buildHref(bankId, currentValues, pathname);
    lastAppliedValuesRef.current = JSON.stringify({
      ...currentValues,
      query: currentValues.query.trim(),
      amount: currentValues.amount.trim(),
    });
    startTransition(() => { router.replace(href); });
  }

  useEffect(() => {
    const nextValues = JSON.stringify(initialValues);
    if (nextValues === lastAppliedValuesRef.current) return;
    setFrom(initialValues.from);
    setTo(initialValues.to);
    setCategory(initialValues.category);
    setReviewStatus(initialValues.reviewStatus);
    setConfidenceLevel(initialValues.confidenceLevel);
    setSource(initialValues.source);
    setQuery(initialValues.query);
    setAmount(initialValues.amount);
    setPageSize(initialValues.pageSize);
    lastAppliedValuesRef.current = nextValues;
  }, [initialValues]);

  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return; }
    const id = window.setTimeout(() => applyFilters(), 250);
    return () => window.clearTimeout(id);
  }, [from, to, category, reviewStatus, confidenceLevel, source, query, amount, pageSize]);

  const inputCls = "rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 w-full";

  return (
    <form
      className="mb-5 flex flex-wrap items-start gap-3 rounded-xl border border-gray-200 bg-white p-4"
      onSubmit={(e) => { e.preventDefault(); applyFilters(); }}
    >
      {/* Dates — stacked */}
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      {/* Category + Review status — stacked */}
      <div className="flex flex-col gap-1.5 min-w-[200px]">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
            <option value="">All categories</option>
            {categoryOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Review status</label>
          <select value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value)} className={inputCls}>
            <option value="">All statuses</option>
            <option value="needs_review">Needs review</option>
            <option value="confirmed">Confirmed</option>
            <option value="ignored">Ignored</option>
          </select>
        </div>
      </div>

      {/* Confidence chips */}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500">Confidence</label>
        <div className="flex flex-col gap-1.5">
          {CONFIDENCE_LEVELS.map((level) => {
            const active = confidenceLevel === level;
            return (
              <button
                key={level}
                type="button"
                onClick={() => setConfidenceLevel(active ? "" : level)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? level === "low"
                      ? "border-rose-300 bg-rose-50 text-rose-700"
                      : level === "medium"
                      ? "border-amber-300 bg-amber-50 text-amber-700"
                      : "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                {level}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search fields */}
      <div className="flex flex-1 flex-col gap-1.5 min-w-[200px]">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Search name</label>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Description or counterpart"
            className={inputCls}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Amount</label>
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="12.50 or >100"
            className={inputCls}
          />
        </div>
      </div>

      {/* Actions + result */}
      <div className="flex flex-col justify-between self-stretch gap-2 pt-5">
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-md bg-gray-100 px-4 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
          >
            Apply
          </button>
          {hasActiveFilters && (
            <Link href={resetHref} className="py-1.5 text-sm text-gray-400 transition-colors hover:text-gray-600">
              Reset
            </Link>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-xs text-gray-400">Per page</label>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            {allowedPageSizes.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
            {resultLabel}
          </span>
          {totalLabel && (
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
              {totalLabel}
            </span>
          )}
          {grandTotalLabel && (
            <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700">
              {grandTotalLabel}
            </span>
          )}
        </div>
      </div>
    </form>
  );
}
