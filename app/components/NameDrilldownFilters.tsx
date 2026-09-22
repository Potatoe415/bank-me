"use client";

import { usePathname, useRouter } from "next/navigation";
import { startTransition, useEffect, useRef, useState } from "react";

type FilterOption = { value: string; label: string };

type Props = {
  initialQ: string;
  initialCategories: string[];
  bankId: string;
  categoryOptions: FilterOption[];
  initialDateFrom: string;
  initialDateTo: string;
  defaultDateFrom: string;
  defaultDateTo: string;
};

export default function NameDrilldownFilters({
  initialQ,
  initialCategories,
  bankId,
  categoryOptions,
  initialDateFrom,
  initialDateTo,
  defaultDateFrom,
  defaultDateTo,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const mountedRef = useRef(false);
  const lastAppliedRef = useRef(
    JSON.stringify({ q: initialQ, categories: [...initialCategories].sort(), dateFrom: initialDateFrom, dateTo: initialDateTo })
  );

  const [q, setQ] = useState(initialQ);
  const [categories, setCategories] = useState<string[]>(initialCategories);
  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);

  useEffect(() => {
    const next = JSON.stringify({ q: initialQ, categories: [...initialCategories].sort(), dateFrom: initialDateFrom, dateTo: initialDateTo });
    if (next === lastAppliedRef.current) return;
    setQ(initialQ);
    setCategories(initialCategories);
    setDateFrom(initialDateFrom);
    setDateTo(initialDateTo);
    lastAppliedRef.current = next;
  }, [initialQ, initialCategories, initialDateFrom, initialDateTo]);

  function buildHref(newQ: string, newCats: string[], newDateFrom: string, newDateTo: string) {
    const params = new URLSearchParams();
    if (bankId !== "all") params.set("bank", bankId);
    if (newQ.trim()) params.set("q", newQ.trim());
    for (const cat of newCats) params.append("category", cat);
    if (newDateFrom && newDateFrom !== defaultDateFrom) params.set("dateFrom", newDateFrom);
    if (newDateTo && newDateTo !== defaultDateTo) params.set("dateTo", newDateTo);
    const str = params.toString();
    return str ? `${pathname}?${str}` : pathname;
  }

  function navigate(newQ: string, newCats: string[], newDateFrom: string, newDateTo: string) {
    const href = buildHref(newQ, newCats, newDateFrom, newDateTo);
    lastAppliedRef.current = JSON.stringify({ q: newQ.trim(), categories: [...newCats].sort(), dateFrom: newDateFrom, dateTo: newDateTo });
    startTransition(() => router.replace(href));
  }

  // Debounced name search
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    const id = window.setTimeout(() => navigate(q, categories, dateFrom, dateTo), 300);
    return () => window.clearTimeout(id);
  }, [q]);

  function toggleCategory(value: string) {
    const isSelected = categories.includes(value);
    if (isSelected) {
      const next = categories.filter((c) => c !== value);
      setCategories(next);
      navigate(q, next, dateFrom, dateTo);
    } else if (categories.length < 3) {
      const next = [...categories, value];
      setCategories(next);
      navigate(q, next, dateFrom, dateTo);
    }
  }

  function handleDateFromChange(val: string) {
    setDateFrom(val);
    navigate(q, categories, val, dateTo);
  }

  function handleDateToChange(val: string) {
    setDateTo(val);
    navigate(q, categories, dateFrom, val);
  }

  function clear() {
    setQ("");
    setCategories([]);
    setDateFrom(defaultDateFrom);
    setDateTo(defaultDateTo);
    navigate("", [], defaultDateFrom, defaultDateTo);
  }

  const isDefaultDate = dateFrom === defaultDateFrom && dateTo === defaultDateTo;
  const hasFilters = q.trim().length > 0 || categories.length > 0 || !isDefaultDate;

  const inputCls =
    "w-full rounded-xl border border-gray-300 bg-white py-2.5 pl-9 pr-4 text-sm text-gray-800 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200";

  const dateInputCls =
    "w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-800 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200";

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-4">
      {/* Row 1: name search + date range */}
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1">
          <svg
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
            />
          </svg>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filter by name, merchant, counterpart… (optional)"
            className={inputCls}
          />
        </div>

        {/* Date range */}
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex flex-col">
            <label className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">From</label>
            <input
              type="date"
              value={dateFrom}
              max={dateTo}
              onChange={(e) => handleDateFromChange(e.target.value)}
              className={dateInputCls}
            />
          </div>
          <span className="mt-5 text-gray-400">—</span>
          <div className="flex flex-col">
            <label className="mb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">To</label>
            <input
              type="date"
              value={dateTo}
              min={dateFrom}
              onChange={(e) => handleDateToChange(e.target.value)}
              className={dateInputCls}
            />
          </div>
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={clear}
            className="mt-auto flex items-center rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-500 transition-colors hover:bg-gray-50"
          >
            Clear
          </button>
        )}
      </div>

      {/* Category chips */}
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-gray-400">
          Categories{" "}
          <span className="normal-case font-normal tracking-normal text-gray-400">
            — select up to 3
            {categories.length > 0 && (
              <span className="ml-1 text-indigo-500">({categories.length} selected)</span>
            )}
          </span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {categoryOptions.map((opt) => {
            const selected = categories.includes(opt.value);
            const disabled = !selected && categories.length >= 3;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={disabled}
                onClick={() => toggleCategory(opt.value)}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  selected
                    ? "border-indigo-400 bg-indigo-600 text-white"
                    : disabled
                    ? "cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300"
                    : "border-gray-200 bg-white text-gray-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
