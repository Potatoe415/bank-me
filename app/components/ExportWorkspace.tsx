"use client";

import { useState, useRef, useCallback } from "react";
import type { BankConfig } from "@/lib/banks.config";
import { importCategories, saveTaxonomyPrompt } from "@/app/actions";

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
  return { from: formatDateInput(from), to: formatDateInput(to) };
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

function IconSave() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="M2 2h9l3 3v9a1 1 0 01-1 1H2a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <rect x="5" y="9" width="6" height="5" rx="0.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="5" y="2" width="5" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div className="mt-6 flex items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">{label}</span>
      <div className="flex-1 border-t border-gray-100" />
    </div>
  );
}

type ToggleChipProps = {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  activeClass: string;
};

function ToggleChip({ label, active, onClick, disabled, activeClass }: ToggleChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed ${
        active ? activeClass : "border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50"
      }`}
    >
      {label}
    </button>
  );
}

export default function ExportWorkspace({
  banks,
  taxonomyPrompt,
  imported,
  skipped,
  total,
  skipMissing,
  skipNotFound,
  skipSame,
  skipManual,
  importError,
}: {
  banks: BankConfig[];
  taxonomyPrompt: string;
  imported?: number;
  skipped?: number;
  total?: number;
  skipMissing?: number;
  skipNotFound?: number;
  skipSame?: number;
  skipManual?: number;
  importError?: string;
}) {
  const defaultRange = getDefaultDateRange();

  // Bank selection
  const [selected, setSelected] = useState<Set<string>>(new Set(banks.map((b) => b.id)));

  // Include filters
  const [uncategorizedOnly, setUncategorizedOnly] = useState(false);

  // Date range
  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo]     = useState(defaultRange.to);

  // Exclude filters
  const [excludeCategorized, setExcludeCategorized] = useState(false);
  const [excludeConfidence, setExcludeConfidence]   = useState<Set<string>>(new Set());
  const [excludeSource, setExcludeSource]           = useState<Set<string>>(new Set());

  // Output options
  const [withCategories, setWithCategories] = useState(true);

  // Prompt
  const [promptText, setPromptText]   = useState(taxonomyPrompt);
  const [copied, setCopied]           = useState(false);
  const [saved, setSaved]             = useState(false);
  const [promptDirty, setPromptDirty] = useState(false);

  // File import
  const [dragOver, setDragOver]       = useState(false);
  const [droppedFile, setDroppedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef      = useRef<HTMLFormElement>(null);

  // ── drag-drop handlers ──────────────────────────────────────────
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(false); }, []);
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

  // ── bank helpers ────────────────────────────────────────────────
  function toggleBank(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function setAll(ids: string[]) { setSelected(new Set(ids)); }

  // ── exclude chip helpers ────────────────────────────────────────
  function toggleExcludeConfidence(level: string) {
    setExcludeConfidence((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level); else next.add(level);
      return next;
    });
  }
  function toggleExcludeSource(source: string) {
    setExcludeSource((prev) => {
      const next = new Set(prev);
      if (next.has(source)) next.delete(source); else next.add(source);
      return next;
    });
  }

  // ── prompt helpers ──────────────────────────────────────────────
  async function savePrompt() {
    await saveTaxonomyPrompt(promptText);
    setPromptDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }
  function copyPrompt() {
    navigator.clipboard.writeText(promptText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── export ──────────────────────────────────────────────────────
  function downloadCsv() {
    if (selected.size === 0) return;
    const url = new URL("/api/export", window.location.origin);
    url.searchParams.set("banks", [...selected].join(","));

    if (uncategorizedOnly) {
      url.searchParams.set("uncategorized_only", "1");
    } else {
      url.searchParams.set("from", dateFrom);
      url.searchParams.set("to", dateTo);
      if (withCategories)        url.searchParams.set("categories", "1");
      if (excludeCategorized)    url.searchParams.set("exclude_categorized", "1");
      if (excludeConfidence.size) url.searchParams.set("exclude_confidence", [...excludeConfidence].join(","));
      if (excludeSource.size)    url.searchParams.set("exclude_source", [...excludeSource].join(","));
    }

    window.location.href = url.toString();
  }

  const filtersDisabled = uncategorizedOnly;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Export & taxonomy</h1>
        <p className="mt-2 text-sm text-gray-500">
          Export a taxonomy-ready CSV, copy the prompt, then import categories back into the database.
        </p>
      </div>

      {importError && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {importError}
        </div>
      )}

      {typeof imported === "number" && typeof skipped === "number" && typeof total === "number" && (
        <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <p className="font-medium">
            {imported} row{imported !== 1 ? "s" : ""} updated
            {skipped > 0 ? `, ${skipped} skipped` : ""} out of {total} total.
          </p>
          {skipped > 0 && (
            <ul className="mt-2 space-y-0.5 text-emerald-600">
              {(skipSame     ?? 0) > 0 && <li>· {skipSame} already had the same category — no change needed</li>}
              {(skipManual   ?? 0) > 0 && <li>· {skipManual} are manually locked — protected from overwrite</li>}
              {(skipNotFound ?? 0) > 0 && <li>· {skipNotFound} id{(skipNotFound ?? 0) !== 1 ? "s" : ""} not found in the database</li>}
              {(skipMissing  ?? 0) > 0 && <li>· {skipMissing} row{(skipMissing ?? 0) !== 1 ? "s" : ""} missing id or category_path in the CSV</li>}
            </ul>
          )}
        </div>
      )}

      <div className="flex flex-col gap-6">

        {/* ── Export CSV ─────────────────────────────────────────── */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Export CSV</h2>
              <p className="mt-1 text-sm text-gray-500">
                Select banks, configure filters, then download the CSV for the taxonomy workflow.
              </p>
            </div>
            <button
              type="button"
              onClick={downloadCsv}
              disabled={selected.size === 0}
              className="shrink-0 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <IconDownload />
              Export CSV
            </button>
          </div>

          {/* Banks */}
          <SectionLabel label="Banks" />
          <div className="mt-3 flex gap-2 text-xs mb-2">
            <button type="button" onClick={() => setAll(banks.map((b) => b.id))} className="text-indigo-600 hover:underline">Select all</button>
            <button type="button" onClick={() => setAll([])} className="text-gray-400 hover:text-gray-600 hover:underline">Deselect all</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {banks.map((bank) => (
              <label
                key={bank.id}
                className={`flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
                  selected.has(bank.id)
                    ? "border-indigo-200 bg-indigo-50 text-indigo-800"
                    : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(bank.id)}
                  onChange={() => toggleBank(bank.id)}
                  className="sr-only"
                />
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[9px] font-bold text-white"
                  style={{ backgroundColor: bank.color }}
                >
                  {bank.initial}
                </span>
                {bank.name}
              </label>
            ))}
          </div>

          {/* Include */}
          <SectionLabel label="Include" />
          <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-3 text-sm text-indigo-800">
            <input
              type="checkbox"
              checked={uncategorizedOnly}
              onChange={(e) => setUncategorizedOnly(e.target.checked)}
              className="h-4 w-4 rounded accent-indigo-600"
            />
            <span>
              <span className="font-medium">Uncategorized only</span>
              <span className="ml-2 text-indigo-500">— all banks, all dates</span>
            </span>
          </label>

          {/* Date range */}
          <SectionLabel label="Date range" />
          <div className={`mt-3 grid gap-3 sm:grid-cols-2 transition-opacity ${filtersDisabled ? "pointer-events-none opacity-30" : ""}`}>
            <label className="block rounded-xl border border-gray-100 px-3 py-3 text-sm text-gray-700">
              <span className="mb-2 block font-medium text-gray-700">From</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                max={dateTo}
                disabled={filtersDisabled}
                className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
              />
            </label>
            <label className="block rounded-xl border border-gray-100 px-3 py-3 text-sm text-gray-700">
              <span className="mb-2 block font-medium text-gray-700">To</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                min={dateFrom}
                disabled={filtersDisabled}
                className="block w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
              />
            </label>
          </div>

          {/* Exclude */}
          <SectionLabel label="Exclude" />
          <div className={`mt-3 space-y-3 transition-opacity ${filtersDisabled ? "pointer-events-none opacity-30" : ""}`}>

            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-gray-100 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={excludeCategorized}
                onChange={(e) => setExcludeCategorized(e.target.checked)}
                disabled={filtersDisabled}
                className="h-4 w-4 rounded accent-gray-500"
              />
              <span className="font-medium">Already categorized</span>
              <span className="text-gray-400">— skip rows that already have a category</span>
            </label>

            <div className="rounded-xl border border-gray-100 px-3 py-3">
              <p className="mb-2 text-xs font-medium text-gray-500">Confidence level</p>
              <div className="flex flex-wrap gap-2">
                {(["low", "medium", "high"] as const).map((level) => (
                  <ToggleChip
                    key={level}
                    label={level}
                    active={excludeConfidence.has(level)}
                    onClick={() => toggleExcludeConfidence(level)}
                    disabled={filtersDisabled}
                    activeClass="border-rose-300 bg-rose-50 text-rose-700"
                  />
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 px-3 py-3">
              <p className="mb-2 text-xs font-medium text-gray-500">Categorization source</p>
              <div className="flex flex-wrap gap-2">
                {(["llm", "manual", "rule"] as const).map((src) => (
                  <ToggleChip
                    key={src}
                    label={src === "llm" ? "AI (llm)" : src}
                    active={excludeSource.has(src)}
                    onClick={() => toggleExcludeSource(src)}
                    disabled={filtersDisabled}
                    activeClass="border-rose-300 bg-rose-50 text-rose-700"
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Output */}
          <SectionLabel label="Output" />
          <label className="mt-3 flex cursor-pointer items-center gap-3 rounded-xl border border-gray-100 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
            <input
              type="checkbox"
              checked={withCategories}
              onChange={(e) => setWithCategories(e.target.checked)}
              className="h-4 w-4 rounded accent-indigo-600"
            />
            Include <code className="mx-1 rounded bg-gray-100 px-1 py-0.5 text-xs">category_path</code> column
          </label>
        </section>

        {/* ── Taxonomy prompt ────────────────────────────────────── */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Taxonomy prompt</h2>
              <p className="mt-1 text-sm text-gray-500">
                Copy the prompt, attach the exported CSV, and keep the returned file structure unchanged before import.
              </p>
            </div>
            <button
              type="button"
              onClick={savePrompt}
              disabled={!promptDirty}
              title="Save prompt"
              className={`mt-0.5 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                saved
                  ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              {saved ? <IconCheck /> : <IconSave />}
              {saved ? "Saved" : "Save"}
            </button>
          </div>

          <textarea
            value={promptText}
            onChange={(e) => { setPromptText(e.target.value); setPromptDirty(true); }}
            className="mt-4 h-64 w-full rounded-xl border border-gray-200 bg-gray-50 p-3 font-mono text-xs text-gray-700 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
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

        {/* ── Import categories ──────────────────────────────────── */}
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-gray-900">Import categories</h2>
          <p className="mt-1 text-sm text-gray-500">
            Upload the taxonomy-enriched CSV. Updates <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">category_path</code> and derived metadata, matched by transaction <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">id</code>.
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
    </div>
  );
}
