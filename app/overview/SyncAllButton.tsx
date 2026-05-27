"use client";

import { useState, useTransition } from "react";
import { syncAllTransactions } from "@/app/actions";

export default function SyncAllButton({ bankIds }: { bankIds: string[] }) {
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSync() {
    setErrors({});
    startTransition(async () => {
      const result = await syncAllTransactions(bankIds);
      setErrors(result.errors);
    });
  }

  const errorCount = Object.keys(errors).length;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleSync}
        disabled={isPending}
        className="flex items-center gap-2 bg-white border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-gray-700 hover:text-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        <svg
          width="15" height="15" viewBox="0 0 15 15" fill="none"
          className={isPending ? "animate-spin" : ""}
        >
          <path
            d="M13 7.5A5.5 5.5 0 1 1 7.5 2a5.5 5.5 0 0 1 3.89 1.61M13 2v3.5H9.5"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
        {isPending ? "Synchronisation…" : "Synchroniser tout"}
      </button>
      {errorCount > 0 && (
        <p className="text-xs text-red-500">
          {errorCount} banque{errorCount > 1 ? "s" : ""} en erreur
        </p>
      )}
    </div>
  );
}
