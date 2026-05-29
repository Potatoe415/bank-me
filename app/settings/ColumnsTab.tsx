"use client";

import { useTransition, useState } from "react";
import { setColumnPreferences } from "@/app/actions";
import { ALL_COLUMNS, type ColumnId } from "@/lib/column-prefs";

export default function ColumnsTab({ initialHidden }: { initialHidden: ColumnId[] }) {
  const [isPending, startTransition] = useTransition();
  const [hiddenSet, setHiddenSet] = useState<Set<ColumnId>>(new Set(initialHidden));

  function handleChange(columnId: ColumnId, checked: boolean) {
    const next = new Set(hiddenSet);
    if (checked) {
      next.delete(columnId);
    } else {
      next.add(columnId);
    }
    setHiddenSet(next);
    const hidden = ALL_COLUMNS.map((c) => c.id).filter((id) => next.has(id));
    startTransition(() => {
      setColumnPreferences(hidden);
    });
  }

  return (
    <div className="overflow-hidden rounded-[24px] border border-white/70 bg-white/90 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.35)] backdrop-blur">
      <div className="border-b border-slate-100 px-5 py-4">
        <p className="text-sm font-semibold text-slate-900">Visible columns</p>
        <p className="mt-1 text-xs text-slate-500">
          Choose which columns appear in the transaction table. Date and Amount are always visible.
        </p>
      </div>
      <div className="divide-y divide-slate-100">
        {ALL_COLUMNS.map((column) => {
          const isVisible = !hiddenSet.has(column.id);
          return (
            <label
              key={column.id}
              className="flex cursor-pointer items-center justify-between px-5 py-3.5 transition-colors hover:bg-slate-50/60"
            >
              <span className="text-sm font-medium text-slate-700">{column.label}</span>
              <div className="relative">
                <input
                  type="checkbox"
                  checked={isVisible}
                  onChange={(e) => handleChange(column.id, e.target.checked)}
                  disabled={isPending}
                  className="sr-only"
                />
                <div
                  className={`h-5 w-9 rounded-full transition-colors ${
                    isVisible ? "bg-indigo-600" : "bg-slate-200"
                  } ${isPending ? "opacity-50" : ""}`}
                />
                <div
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    isVisible ? "translate-x-4" : "translate-x-0.5"
                  }`}
                />
              </div>
            </label>
          );
        })}
      </div>
      {isPending && (
        <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
          Saving…
        </div>
      )}
    </div>
  );
}
