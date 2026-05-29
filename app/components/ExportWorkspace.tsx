"use client";

import { useState, useRef, useCallback } from "react";
import type { BankConfig } from "@/lib/banks.config";
import { importCategories } from "@/app/actions";

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDefaultDateRange() {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 29);

  return {
    from: formatDateInput(from),
    to: formatDateInput(to),
  };
}

function IconClipboard() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="5" y="1.5" width="6" height="2.5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <path d="M5 2.5H3.5A1.5 1.5 0 002 4v9a1.5 1.5 0 001.5 1.5h9A1.5 1.5 0 0014 13V4a1.5 1.5 0 00-1.5-1.5H11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 8l3.5 3.5L13 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconDownload() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 1v9M5 7.5l3 3 3-3M2 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconUpload() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M8 11V2M5 5l3-3 3 3M2 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ExportWorkspace({
  banks,
  taxonomyPrompt,
  imported,
  skipped,
  total,
  importError,
}: {
  banks: BankConfig[];
  taxonomyPrompt: string;
  imported?: number;
  skipped?: number;
  total?: number;
  importError?: string;
}) {
  const defaultRange = getDefaultDateRange();
  const [selected, setSelected] = useState<Set<string>>(new Set(banks.map((bank) => bank.id)));
  const [withCategories, setWithCategories] = useState(true);
  const [uncategorizedOnly, setUncategorizedOnly] = useState(false);
  const [excludeCategorized, setExcludeCategorized] = useState(false);
  const [copied, setCopied] = useState(false);
  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);
  const [dragOver, setDragOver] = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    setDroppedFile(file);
    if (fileInputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInputRef.current.files = dt.files;
    }
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDroppedFile(e.target.files?.[0] ?? null);
  }, []);

  function toggleBank(bankId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(bankId)) {
        next.delete(bankId);
      } else {
        next.add(bankId);
      }
      return next;
    });
  }

  function setAll(selectedIds: string[]) {
    setSelected(new Set(selectedIds));
  }

  function copyPrompt() {
    navigator.clipboard.writeText(taxonomyPrompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function downloadCsv() {
    if (selected.size === 0) return;
    const url = new URL("/api/export", window.location.origin);
    url.searchParams.set("banks", [...selected].join(","));
    if (uncategorizedOnly) {
      url.searchParams.set("uncategorized_only", "1");
    } else {
      url.searchParams.set("from", dateFrom);
      url.searchParams.set("to", dateTo);
      if (withCategories) {
        url.searchParams.set("categories", "1");
      }
      if (excludeCategorized) {
        url.searchParams.set("exclude_categorized", "1");
      }
    }
    window.location.href = url.toString();
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Export & taxonomy</h1>
        <p className="mt-2 text-sm text-gray-500">
          Export a taxonomy-ready CSV, copy the prompt, then import only categories and subcategories back into the database.
        </p>
      </div>

      {importError && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {importError}
        </div>
      )}

      {typeof imported === "number" && typeof skipped === "number" && typeof total === "number" && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Imported categories for {imported} row{imported !== 1 ? "s" : ""}. Skipped {skipped} of {total} row{total !== 1 ? "s" : ""}.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Export CSV</h2>
              <p className="mt-1 text-sm text-gray-500">
                Choose the banks and date range to include, then download the CSV you want to send through the taxonomy workflow.
              </p>
            </div>
            <button
              type="button"
              onClick={downloadCsv}
              disabled={selected.size === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconDownload />
              Export CSV
            </button>
          </div>

          <div className="mt-5 flex gap-4 text-xs">
            <button type="button" onClick={() => setAll(banks.map((bank) => bank.id))} className="text-indigo-600 hover:underline">
              Select all
            </button>
            <button type="button" onClick={() => setAll([])} className="text-gray-400 hover:text-gray-600 hover:underline">
              Deselect all
            </button>
          </div>

          <ul className="mt-4 space-y-2">
            {banks.map((bank) => (
              <li key={bank.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-100 px-3 py-3 transition-colors hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={selected.has(bank.id)}
                    onChange={() => toggleBank(bank.id)}
                    className="h-4 w-4 rounded accent-indigo-600"
                  />
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
                    style={{ backgroundColor: bank.color }}
                  >
                    {bank.initial}
                  </span>
                  <span className="text-sm text-gray-800">{bank.name}</span>
                </label>
              </li>
            ))}
          </ul>

          <label className="mt-5 flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-3 text-sm text-indigo-800">
            <input
              type="checkbox"
              checked={uncategorizedOnly}
              onChange={(event) => setUncategorizedOnly(event.target.checked)}
              className="h-4 w-4 rounded accent-indigo-600"
            />
            <span>
              <span className="font-medium">Uncategorized only</span>
              <span className="ml-2 text-indigo-500">— all banks, all dates, no category_path column</span>
            </span>
          </label>

          <div className={`mt-5 grid gap-4 md:grid-cols-2 transition-opacity ${uncategorizedOnly ? "pointer-events-none opacity-30" : ""}`}>
            <label className="block rounded-xl border border-gray-100 px-3 py-3 text-sm text-gray-700">
              <span className="mb-2 block font-medium text-gray-700">From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                max={dateTo}
                disabled={uncategorizedOnly}
                className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
              />
            </label>

            <label className="block rounded-xl border border-gray-100 px-3 py-3 text-sm text-gray-700">
              <span className="mb-2 block font-medium text-gray-700">To</span>
              <input
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                min={dateFrom}
                disabled={uncategorizedOnly}
                className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
              />
            </label>
          </div>

          <label className={`mt-5 flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-3 text-sm text-gray-700 transition-opacity ${uncategorizedOnly ? "pointer-events-none opacity-30" : ""}`}>
            <input
              type="checkbox"
              checked={withCategories}
              onChange={(event) => setWithCategories(event.target.checked)}
              disabled={uncategorizedOnly}
              className="h-4 w-4 rounded accent-indigo-600"
            />
            Include category_path column
          </label>

          <label className={`mt-3 flex items-center gap-3 rounded-xl border border-amber-100 bg-amber-50 px-3 py-3 text-sm text-amber-800 transition-opacity ${uncategorizedOnly ? "pointer-events-none opacity-30" : ""}`}>
            <input
              type="checkbox"
              checked={excludeCategorized}
              onChange={(event) => setExcludeCategorized(event.target.checked)}
              disabled={uncategorizedOnly}
              className="h-4 w-4 rounded accent-amber-500"
            />
            <span>
              <span className="font-medium">Exclude already categorized</span>
              <span className="ml-2 text-amber-500">— skip rows that already have a category</span>
            </span>
          </label>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Taxonomy prompt</h2>
          <p className="mt-1 text-sm text-gray-500">
            Copy the prompt, attach the exported CSV, and keep the returned file structure unchanged before import.
          </p>

          <textarea
            readOnly
            value={taxonomyPrompt}
            className="mt-4 h-72 w-full rounded-xl border border-gray-200 bg-gray-50 p-3 font-mono text-xs text-gray-700"
          />

          <button
            type="button"
            onClick={copyPrompt}
            className={`mt-4 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              copied
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                : "bg-gray-900 text-white hover:bg-gray-800"
            }`}
          >
            {copied ? <IconCheck /> : <IconClipboard />}
            {copied ? "Copied" : "Copy prompt"}
          </button>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-gray-900">Import categories</h2>
        <p className="mt-1 text-sm text-gray-500">
          Upload the taxonomy-enriched CSV. The import updates `category_path` and derived metadata, matched by transaction `id`.
        </p>

        <form ref={formRef} action={importCategories} className="mt-5">
          <input
            ref={fileInputRef}
            type="file"
            name="file"
            accept=".csv,text/csv"
            required
            className="sr-only"
            onChange={handleFileChange}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`w-full rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
              dragOver
                ? "border-indigo-400 bg-indigo-50"
                : droppedFile
                ? "border-emerald-300 bg-emerald-50"
                : "border-gray-200 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50/40"
            }`}
          >
            {droppedFile ? (
              <span className="flex flex-col items-center gap-2">
                <IconCheck />
                <span className="text-sm font-medium text-emerald-700">{droppedFile.name}</span>
                <span className="text-xs text-emerald-500">Click to change file</span>
              </span>
            ) : (
              <span className="flex flex-col items-center gap-2">
                <IconUpload />
                <span className="text-sm font-medium text-gray-700">Drop CSV here or click to browse</span>
                <span className="text-xs text-gray-400">.csv files only</span>
              </span>
            )}
          </button>

          <div className="mt-4 flex justify-end">
            <button
              type="submit"
              disabled={!droppedFile}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconUpload />
              Import categories
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
