"use client";

import { startTransition, useState } from "react";
import type { EditableTaxonomy } from "@/lib/taxonomy";
import { formatCategoryPath } from "@/lib/taxonomy";
import { updateTransactionCategory } from "@/app/actions";

type SaveState = "idle" | "saving" | "saved" | "error";

function IconEdit() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M10.75 2.75a1.77 1.77 0 1 1 2.5 2.5L6 12.5l-3.25.75.75-3.25 7.25-7.25Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="m9.5 4 2.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export default function CategoryEditor({
  transactionId,
  initialCategoryPath,
  taxonomy,
  isArchived,
}: {
  transactionId: string;
  initialCategoryPath: string;
  taxonomy: EditableTaxonomy;
  isArchived: boolean;
}) {
  const [categoryPath, setCategoryPath] = useState(initialCategoryPath);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [isOpen, setIsOpen] = useState(false);

  function applySelection(value: string) {
    if (!value) return;
    setSaveState("saving");
    startTransition(async () => {
      try {
        await updateTransactionCategory(transactionId, value);
        setCategoryPath(value);
        setSaveState("saved");
        setIsOpen(false);
      } catch {
        setSaveState("error");
      }
    });
  }

  const label = formatCategoryPath(categoryPath);

  return (
    <td className="px-3 py-2 align-top" colSpan={2}>
      <div className="relative flex items-center gap-2">
        {categoryPath && categoryPath !== "uncategorized" ? (
          <span className={`rounded px-1.5 py-0.5 text-xs ${isArchived ? "bg-gray-200 text-gray-500" : "bg-indigo-50 text-indigo-600"}`}>
            {label}
          </span>
        ) : (
          <span className="text-gray-300">-</span>
        )}

        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          title="Edit category"
          className={`inline-flex h-6 w-6 items-center justify-center rounded-md border transition ${
            isArchived
              ? "border-gray-200 bg-gray-100 text-gray-400 hover:bg-gray-200"
              : "border-gray-200 bg-white text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          }`}
        >
          <IconEdit />
        </button>

        {isOpen && (
          <div className="absolute left-0 top-8 z-20 w-72 rounded-lg border border-gray-200 bg-white p-3 shadow-lg">
            <select
              defaultValue=""
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
              {saveState === "saving" && "Saving..."}
              {saveState === "saved" && "Saved"}
              {saveState === "error" && "Save failed"}
            </p>
          </div>
        )}
      </div>
    </td>
  );
}
