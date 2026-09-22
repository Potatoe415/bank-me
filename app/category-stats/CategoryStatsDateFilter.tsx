"use client";

import { useState, useTransition, type JSX } from "react";
import { useRouter, usePathname } from "next/navigation";

interface CategoryStatsDateFilterProps {
  initialFrom?: string;
  initialTo?: string;
}

export default function CategoryStatsDateFilter({
  initialFrom = "",
  initialTo = "",
}: CategoryStatsDateFilterProps): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [isPending, startTransition] = useTransition();

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  };

  const handleReset = () => {
    setFrom("");
    setTo("");
    startTransition(() => {
      router.replace(pathname);
    });
  };

  return (
    <form
      onSubmit={handleApply}
      className="flex flex-wrap items-end gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
    >
      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          From Date
        </label>
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all font-mono"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          To Date
        </label>
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:bg-white transition-all font-mono"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 h-[32px] cursor-pointer"
        >
          {isPending ? "Applying..." : "Apply Range"}
        </button>
        {(from || to) && (
          <button
            type="button"
            onClick={handleReset}
            disabled={isPending}
            className="rounded-lg bg-gray-100 px-4 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-200 disabled:opacity-50 h-[32px] cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>
    </form>
  );
}
