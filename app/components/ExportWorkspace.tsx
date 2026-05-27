"use client";

import { useState } from "react";
import type { BankConfig } from "@/lib/banks.config";
import { importCategories } from "@/app/actions";

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
  const [selected, setSelected] = useState<Set<string>>(new Set(banks.map((bank) => bank.id)));
  const [withCategories, setWithCategories] = useState(true);
  const [copied, setCopied] = useState(false);

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
    if (withCategories) {
      url.searchParams.set("categories", "1");
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
                Choose the banks to include, then download the CSV you want to send through the taxonomy workflow.
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

          <label className="mt-5 flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-3 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={withCategories}
              onChange={(event) => setWithCategories(event.target.checked)}
              className="h-4 w-4 rounded accent-indigo-600"
            />
            Include category and subcategory columns
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
          Upload the taxonomy-enriched CSV. The import updates only `category` and `subcategory`, matched by transaction `id`.
        </p>

        <form action={importCategories} className="mt-5 flex flex-col gap-4 md:flex-row md:items-end">
          <label className="flex-1">
            <span className="mb-2 block text-sm font-medium text-gray-700">CSV file</span>
            <input
              type="file"
              name="file"
              accept=".csv,text/csv"
              required
              className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 file:mr-3 file:rounded-md file:border-0 file:bg-gray-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
            />
          </label>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
          >
            <IconUpload />
            Import categories
          </button>
        </form>
      </section>
    </div>
  );
}
