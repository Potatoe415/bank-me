"use client";

import { startTransition, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { BankConfig } from "@/lib/banks.config";
import { setTransactionEditMode, unarchiveAllTransactions } from "@/app/actions";

function IconAllBanks() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="2" width="14" height="3" rx="1" fill="currentColor" opacity=".9" />
      <rect x="1" y="6.5" width="14" height="3" rx="1" fill="currentColor" opacity=".6" />
      <rect x="1" y="11" width="14" height="3" rx="1" fill="currentColor" opacity=".3" />
    </svg>
  );
}

function IconOverview() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".9" />
      <rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor" opacity=".5" />
      <rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".5" />
      <rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor" opacity=".3" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 1v2M8 13v2M1 8h2M13 8h2M2.93 2.93l1.41 1.41M11.66 11.66l1.41 1.41M2.93 13.07l1.41-1.41M11.66 4.34l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconChevronLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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

function IconChart() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2 13.5h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 10.5V7.5M8 10.5V3.5M12 10.5V5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconCategory() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.25" />
      <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.25" />
      <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.25" />
      <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.25" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

function IconWave() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M1 8.5c1-2 2-2 3 0s2 2 3 0 2-2 3 0 2 2 3 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 4V2M10.5 5l1-1.5M5.5 5l-1-1.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" opacity=".5" />
      <path d="M3 13h10" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" opacity=".3" />
    </svg>
  );
}

function IconArchiveRestore() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2.75 5.75h10.5v7a1 1 0 0 1-1 1h-8.5a1 1 0 0 1-1-1v-7Z" stroke="currentColor" strokeWidth="1.25" />
      <path d="M1.75 3.25h12.5v2.5H1.75v-2.5Z" stroke="currentColor" strokeWidth="1.25" />
      <path d="M8 11V7.5m0 0-1.75 1.75M8 7.5l1.75 1.75" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconPencil() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M10.75 2.75a1.77 1.77 0 1 1 2.5 2.5L6 12.5l-3.25.75.75-3.25 7.25-7.25Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" />
      <path d="m9.5 4 2.5 2.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

type BankBalance = { amount: number; currency: string } | null;

function fmtBalance(b: BankBalance) {
  if (!b) return null;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: b.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(b.amount);
}

export default function Sidebar({
  connectedBanks,
  bankBalances = {},
  archivedTransactionCount = 0,
  isTransactionEditMode = false,
}: {
  connectedBanks: BankConfig[];
  bankBalances?: Record<string, BankBalance>;
  archivedTransactionCount?: number;
  isTransactionEditMode?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [editMode, setEditMode] = useState(isTransactionEditMode);

  useEffect(() => {
    setEditMode(isTransactionEditMode);
  }, [isTransactionEditMode]);

  const pathname    = usePathname();
  const searchParams = useSearchParams();
  const isOverview  = pathname === "/overview";
  const isGraphics  = pathname === "/graphics";
  const isCategoryStats = pathname === "/category-stats";
  const isRulePropagation = pathname === "/rule-propagation";
  const isExport    = pathname === "/export";
  const bankParam   = searchParams.get("bank");
  const isAllBanks  = pathname === "/" && bankParam === "all";
  const activeBank  = pathname === "/" && !isAllBanks
    ? (bankParam ?? connectedBanks[0]?.id ?? "revolut")
    : null;

  return (
    <aside
      className="flex flex-col h-screen sticky top-0 bg-white border-r border-gray-100 transition-all duration-200 shrink-0"
      style={{ width: collapsed ? 56 : 220 }}
    >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-4 border-b border-gray-100 h-14">
          {!collapsed && (
            <span className="text-sm font-semibold text-gray-800 tracking-tight truncate">
              myBanks
            </span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors ${collapsed ? "mx-auto" : "ml-auto"}`}
          >
            {collapsed ? <IconChevronRight /> : <IconChevronLeft />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-5">

          {/* Overview + All banks */}
          <div className="space-y-0.5">
            <Link
              href="/overview"
              className={`flex items-center gap-2.5 px-2 py-2 rounded-md text-sm transition-colors ${
                isOverview
                  ? "bg-indigo-50 text-indigo-700 font-medium"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              } ${collapsed ? "justify-center" : ""}`}
            >
              <span className="shrink-0"><IconOverview /></span>
              {!collapsed && <span>Overview</span>}
            </Link>
            <Link
              href="/?bank=all"
              className={`flex items-center gap-2.5 px-2 py-2 rounded-md text-sm transition-colors ${
                isAllBanks
                  ? "bg-indigo-50 text-indigo-700 font-medium"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              } ${collapsed ? "justify-center" : ""}`}
            >
              <span className="shrink-0"><IconAllBanks /></span>
              {!collapsed && <span>All Banks</span>}
            </Link>
          </div>

          {/* Connected banks */}
          <div>
            {!collapsed && (
              <p className="px-2 mb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                My Banks
              </p>
            )}
            <ul className="space-y-0.5">
              {connectedBanks.map((bank) => {
                const isActive = activeBank === bank.id;
                const balance  = bankBalances[bank.id] ?? null;
                const balanceFmt = fmtBalance(balance);
                return (
                  <li key={bank.id}>
                    <Link
                      href={`/?bank=${bank.id}`}
                      className={`flex items-center gap-2.5 px-2 py-2 rounded-md text-sm transition-colors ${
                        isActive
                          ? "bg-indigo-50 text-indigo-700 font-medium"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <span
                        className="w-5 h-5 rounded-md flex items-center justify-center text-white text-[9px] font-bold shrink-0"
                        style={{ backgroundColor: bank.color }}
                      >
                        {bank.initial}
                      </span>
                      {!collapsed && (
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center justify-between gap-1">
                            <span className="truncate">{bank.name}</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                          </span>
                          {balanceFmt && (
                            <span className={`block text-[11px] font-mono font-semibold mt-0.5 ${
                              isActive ? "text-indigo-500" : "text-gray-500"
                            } ${balance && balance.amount < 0 ? "text-red-500" : ""}`}>
                              {balanceFmt}
                            </span>
                          )}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>

            {/* Add bank button */}
            <div className="mt-1">
              <Link
                href="/add-bank"
                className={`flex items-center gap-2.5 px-2 py-2 rounded-md text-sm text-gray-400 hover:bg-gray-50 hover:text-indigo-600 transition-colors ${collapsed ? "justify-center" : ""}`}
              >
                <span className="shrink-0 w-5 h-5 rounded-md border border-dashed border-gray-300 flex items-center justify-center">
                  <IconPlus />
                </span>
                {!collapsed && <span>Add a bank</span>}
              </Link>
            </div>
          </div>

          {/* Export section */}
          <div>
            {!collapsed && (
              <p className="px-2 mb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
                Tools
              </p>
            )}
            <Link
              href="/graphics"
              className={`flex items-center gap-2.5 px-2 py-2 rounded-md text-sm transition-colors ${
                isGraphics
                  ? "bg-indigo-50 text-indigo-700 font-medium"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              } ${collapsed ? "justify-center" : ""}`}
            >
              <span className="shrink-0"><IconChart /></span>
              {!collapsed && <span>Graphics</span>}
            </Link>
            <Link
              href="/category-stats"
              className={`flex items-center gap-2.5 px-2 py-2 rounded-md text-sm transition-colors ${
                isCategoryStats
                  ? "bg-indigo-50 text-indigo-700 font-medium"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              } ${collapsed ? "justify-center" : ""}`}
            >
              <span className="shrink-0"><IconCategory /></span>
              {!collapsed && <span>Category Stats</span>}
            </Link>
            <Link
              href="/rule-propagation"
              className={`flex items-center gap-2.5 px-2 py-2 rounded-md text-sm transition-colors ${
                isRulePropagation
                  ? "bg-indigo-50 text-indigo-700 font-medium"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              } ${collapsed ? "justify-center" : ""}`}
            >
              <span className="shrink-0"><IconWave /></span>
              {!collapsed && (
                <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                  <span className="truncate">Rule Engine</span>
                  <span className="rounded-full bg-indigo-100 text-indigo-600 text-[10px] font-semibold px-1.5 py-0.5">W1</span>
                </span>
              )}
            </Link>
            <Link
              href="/export"
              className={`flex items-center gap-2.5 px-2 py-2 rounded-md text-sm transition-colors ${
                isExport
                  ? "bg-indigo-50 text-indigo-700 font-medium"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              } ${collapsed ? "justify-center" : ""}`}
            >
              <span className="shrink-0"><IconDownload /></span>
              {!collapsed && <span>Export</span>}
            </Link>
            <button
              type="button"
              onClick={() => {
                const nextValue = !editMode;
                setEditMode(nextValue);
                startTransition(async () => {
                  await setTransactionEditMode(nextValue);
                });
              }}
              className={`flex w-full items-center gap-2.5 px-2 py-2 rounded-md text-sm transition-colors ${
                editMode
                  ? "bg-emerald-50 text-emerald-700"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              } ${collapsed ? "justify-center" : ""}`}
            >
              <span className="shrink-0"><IconPencil /></span>
              {!collapsed && (
                <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                  <span className="truncate">Edit mode</span>
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                    editMode ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {editMode ? "ON" : "OFF"}
                  </span>
                </span>
              )}
            </button>
            {archivedTransactionCount > 0 && (
              <form action={unarchiveAllTransactions}>
                <button
                  type="submit"
                  title={`Restore ${archivedTransactionCount} archived transaction${archivedTransactionCount > 1 ? "s" : ""}`}
                  className={`flex w-full items-center gap-2.5 px-2 py-2 rounded-md text-sm text-amber-700 transition-colors hover:bg-amber-50 hover:text-amber-800 ${collapsed ? "justify-center" : ""}`}
                >
                  <span className="shrink-0"><IconArchiveRestore /></span>
                  {!collapsed && (
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                      <span className="truncate">Unarchive all</span>
                      <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                        {archivedTransactionCount}
                      </span>
                    </span>
                  )}
                </button>
              </form>
            )}
          </div>
        </nav>

        {/* Footer */}
        <div className="px-2 py-3 border-t border-gray-100">
          <Link
            href="/settings"
            className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-md text-sm transition-colors ${
              pathname === "/settings"
                ? "bg-indigo-50 text-indigo-700 font-medium"
                : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
            } ${collapsed ? "justify-center" : ""}`}
          >
            <span className="shrink-0"><IconSettings /></span>
            {!collapsed && <span>Settings</span>}
          </Link>
        </div>
      </aside>
  );
}
