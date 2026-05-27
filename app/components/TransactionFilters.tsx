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
  subcategory: string;
  query: string;
  amount: string;
};

type TransactionFiltersProps = {
  bankId: string;
  initialValues: FilterValues;
  categoryOptions: FilterOption[];
  subcategoryOptions: FilterOption[];
  resetHref: string;
  hasActiveFilters: boolean;
  resultLabel: string;
  totalLabel: string | null;
};

function buildHref(bankId: string, values: FilterValues, pathname: string) {
  const params = new URLSearchParams();
  params.set("bank", bankId);

  if (values.from) params.set("from", values.from);
  if (values.to) params.set("to", values.to);
  if (values.category) params.set("category", values.category);
  if (values.subcategory) params.set("subcategory", values.subcategory);
  if (values.query.trim()) params.set("query", values.query.trim());
  if (values.amount.trim()) params.set("amount", values.amount.trim());

  return `${pathname}?${params.toString()}`;
}

export default function TransactionFilters({
  bankId,
  initialValues,
  categoryOptions,
  subcategoryOptions,
  resetHref,
  hasActiveFilters,
  resultLabel,
  totalLabel,
}: TransactionFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const mountedRef = useRef(false);
  const lastAppliedValuesRef = useRef(JSON.stringify(initialValues));

  const [from, setFrom] = useState(initialValues.from);
  const [to, setTo] = useState(initialValues.to);
  const [category, setCategory] = useState(initialValues.category);
  const [subcategory, setSubcategory] = useState(initialValues.subcategory);
  const [query, setQuery] = useState(initialValues.query);
  const [amount, setAmount] = useState(initialValues.amount);

  const currentValues: FilterValues = {
    from,
    to,
    category,
    subcategory,
    query,
    amount,
  };

  function applyFilters() {
    const href = buildHref(bankId, currentValues, pathname);
    lastAppliedValuesRef.current = JSON.stringify(currentValues);
    startTransition(() => {
      router.replace(href);
    });
  }

  useEffect(() => {
    const nextValues = JSON.stringify(initialValues);
    if (nextValues === lastAppliedValuesRef.current) {
      return;
    }

    setFrom(initialValues.from);
    setTo(initialValues.to);
    setCategory(initialValues.category);
    setSubcategory(initialValues.subcategory);
    setQuery(initialValues.query);
    setAmount(initialValues.amount);
    lastAppliedValuesRef.current = nextValues;
  }, [initialValues]);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      applyFilters();
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [from, to, category, subcategory, query, amount]);

  return (
    <form
      className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4"
      onSubmit={(event) => {
        event.preventDefault();
        applyFilters();
      }}
    >
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500">From</label>
        <input
          type="date"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-gray-500">To</label>
        <input
          type="date"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      <div className="flex min-w-[180px] flex-col gap-1">
        <label className="text-xs font-medium text-gray-500">Category</label>
        <select
          value={category}
          onChange={(event) => {
            setCategory(event.target.value);
            setSubcategory("");
          }}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">All categories</option>
          {categoryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex min-w-[180px] flex-col gap-1">
        <label className="text-xs font-medium text-gray-500">Subcategory</label>
        <select
          value={subcategory}
          onChange={(event) => setSubcategory(event.target.value)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="">All subcategories</option>
          {subcategoryOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex min-w-[240px] flex-1 flex-col gap-1">
        <label className="text-xs font-medium text-gray-500">Search name</label>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Description or counterpart"
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      <div className="flex min-w-[180px] flex-col gap-1">
        <label className="text-xs font-medium text-gray-500">Search amount</label>
        <input
          type="text"
          inputMode="decimal"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="12.50 or 12,50"
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

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

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
          {resultLabel}
        </span>
        {totalLabel && (
          <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700">
            {totalLabel}
          </span>
        )}
      </div>
    </form>
  );
}
