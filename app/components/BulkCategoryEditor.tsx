"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import type { EditableTaxonomy } from "@/lib/taxonomy";
import { formatCategoryPath } from "@/lib/taxonomy";
import { bulkUpdateTransactionCategories } from "@/app/actions";

type SaveState = "idle" | "saving" | "saved" | "error";

function IconStackEdit() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 4.25h6.5M3 8h6.5M3 11.75h4.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
      <path d="M10.75 3.25a1.6 1.6 0 1 1 2.26 2.26L9.5 9.02l-2.25.49.49-2.25 3.01-3.01Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />
    </svg>
  );
}

export default function BulkCategoryEditor({
  taxonomy,
  transactionIds,
  disabled,
}: {
  taxonomy: EditableTaxonomy;
  transactionIds: string[];
  disabled: boolean;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");

  function applySelection(value: string) {
    setSelectedValue(value);
    if (!value) return;

    setSaveState("saving");
    startTransition(async () => {
      try {
        await bulkUpdateTransactionCategories(transactionIds, value);
        setSaveState("saved");
        setIsOpen(false);
        router.refresh();
      } catch {
        setSaveState("error");
      }
    });
  }

  return (
    <div className="relative inline-flex items-center gap-1">
      <span>Category</span>
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        disabled={disabled}
        title="Apply one category to all visible rows"
        className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <IconStackEdit />
      </button>

      {isOpen && !disabled && (
        <div className="absolute left-0 top-8 z-20 w-72 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Apply to {transactionIds.length} visible row{transactionIds.length > 1 ? "s" : ""}
          </p>
          <select
            value={selectedValue}
            onChange={(event) => applySelection(event.target.value)}
            className="w-full rounded-md border border-gray-200 bg-white px-2 py-2 text-xs text-gray-700 shadow-sm outline-none transition focus:border-indigo-400"
          >
            <option value="">Choose category path</option>
            {taxonomy.paths.map((p) => (
              <option key={p} value={p}>
                {formatCategoryPath(p)}
              </option>
            ))}
          </select>
          <p className={`mt-2 text-[10px] ${saveState === "error" ? "text-red-500" : "text-gray-400"}`}>
            {saveState === "saving" && "Saving all visible rows..."}
            {saveState === "saved" && "Saved"}
            {saveState === "error" && "Bulk save failed"}
            {saveState === "idle" && "Auto-save, no validation step"}
          </p>
        </div>
      )}
    </div>
  );
}
