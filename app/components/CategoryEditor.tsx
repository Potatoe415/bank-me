"use client";

import { startTransition, useEffect, useRef, useState } from "react";
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
  isEditMode = false,
}: {
  transactionId: string;
  initialCategoryPath: string;
  taxonomy: EditableTaxonomy;
  isArchived: boolean;
  isEditMode?: boolean;
}) {
  const [categoryPath, setCategoryPath] = useState(initialCategoryPath);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [isEditing, setIsEditing] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    setCategoryPath(initialCategoryPath);
  }, [initialCategoryPath]);

  useEffect(() => {
    if (isEditing && selectRef.current) {
      selectRef.current.focus();
    }
  }, [isEditing]);

  function applySelection(value: string) {
    if (!value || value === categoryPath) {
      setIsEditing(false);
      return;
    }
    setSaveState("saving");
    startTransition(async () => {
      try {
        await updateTransactionCategory(transactionId, value);
        setCategoryPath(value);
        setSaveState("saved");
        setIsEditing(false);
      } catch {
        setSaveState("error");
      }
    });
  }

  function handleDoubleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsEditing(true);
  }

  const label = formatCategoryPath(categoryPath);

  return (
    <td
      onDoubleClick={handleDoubleClick}
      className="px-3 py-2 align-top"
      colSpan={2}
    >
      {isEditing ? (
        <div
          className="flex items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <select
            ref={selectRef}
            autoFocus
            value={categoryPath || ""}
            onChange={(e) => applySelection(e.target.value)}
            onBlur={() => setIsEditing(false)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setIsEditing(false);
              }
            }}
            className="w-full rounded border border-indigo-400 bg-white px-2 py-1 text-xs text-gray-800 shadow-sm outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Choose category...</option>
            {taxonomy.paths.map((p) => (
              <option key={p} value={p}>
                {formatCategoryPath(p)}
              </option>
            ))}
          </select>
          {saveState === "saving" && (
            <span className="text-[10px] text-gray-400">...</span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {categoryPath && categoryPath !== "uncategorized" ? (
            <span
              onDoubleClick={handleDoubleClick}
              title="Double-click to edit category"
              className={`cursor-pointer select-none rounded px-1.5 py-0.5 text-xs transition hover:ring-1 hover:ring-indigo-300 ${
                isArchived ? "bg-gray-200 text-gray-500" : "bg-indigo-50 text-indigo-600"
              }`}
            >
              {label}
            </span>
          ) : (
            <span
              onDoubleClick={handleDoubleClick}
              title="Double-click to edit category"
              className="cursor-pointer select-none rounded px-1.5 py-0.5 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              -
            </span>
          )}

          {isEditMode && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              title="Edit category"
              className={`inline-flex h-6 w-6 items-center justify-center rounded-md border transition ${
                isArchived
                  ? "border-gray-200 bg-gray-100 text-gray-400 hover:bg-gray-200"
                  : "border-gray-200 bg-white text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              }`}
            >
              <IconEdit />
            </button>
          )}
        </div>
      )}
    </td>
  );
}
