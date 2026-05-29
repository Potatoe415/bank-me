import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { Suspense } from "react";
import Sidebar from "./components/Sidebar";
import db from "@/lib/db";
import { getBankById, type BankConfig } from "@/lib/banks.config";
import { isTransactionEditModeEnabled, TRANSACTION_EDIT_MODE_COOKIE } from "@/lib/transaction-edit-mode";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "myBanks",
  description: "Suivi de transactions bancaires",
};

// Priority order for balance types — most "real" first
const BALANCE_PRIORITY = ["ITAV", "CLBD", "XPCD", "OTHR"];

function getBankBalances(): Record<string, { amount: number; currency: string } | null> {
  const rows = db
    .prepare(`SELECT bank_id, balance_type, SUM(amount) as amount, currency
              FROM account_balances
              GROUP BY bank_id, balance_type, currency`)
    .all() as { bank_id: string; balance_type: string; amount: number; currency: string }[];

  const result: Record<string, { amount: number; currency: string } | null> = {};

  // Group by bank_id
  const byBank: Record<string, typeof rows> = {};
  for (const r of rows) {
    (byBank[r.bank_id] ??= []).push(r);
  }

  for (const [bankId, bankRows] of Object.entries(byBank)) {
    // Pick the best balance type available
    for (const type of BALANCE_PRIORITY) {
      const found = bankRows.find((r) => r.balance_type === type);
      if (found) {
        result[bankId] = { amount: found.amount, currency: found.currency };
        break;
      }
    }
    if (!result[bankId] && bankRows.length > 0) {
      result[bankId] = { amount: bankRows[0].amount, currency: bankRows[0].currency };
    }
  }

  return result;
}

function getConnectedBanks(): BankConfig[] {
  const rows = db
    .prepare("SELECT provider, account_uids, state, expires_at FROM provider_tokens")
    .all() as { provider: string; account_uids: string; state: string | null; expires_at: string | null }[];

  return rows
    .filter((r) => {
      // Expired → not connected
      if (r.expires_at && new Date(r.expires_at) < new Date()) return false;
      // OAuth completed (state cleared) → connected even if accounts not yet fetched
      if (r.state === null) return true;
      // Fallback: account_uids populated (legacy rows)
      return JSON.parse(r.account_uids).length > 0;
    })
    .map((r) => r.provider.replace("enablebanking_", ""))
    .map((id) => getBankById(id))
    .filter((b): b is BankConfig => b !== undefined);
}

function getArchivedTransactionCount(): number {
  const row = db
    .prepare("SELECT COUNT(*) as count FROM transactions WHERE archived_at IS NOT NULL")
    .get() as { count: number };

  return row.count;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const connectedBanks = getConnectedBanks();
  const bankBalances   = getBankBalances();
  const archivedTransactionCount = getArchivedTransactionCount();
  const isTransactionEditMode = isTransactionEditModeEnabled(cookieStore.get(TRANSACTION_EDIT_MODE_COOKIE)?.value);

  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-gray-50 flex">
        <Suspense fallback={<div className="w-14 shrink-0 bg-white border-r border-gray-100 h-screen sticky top-0" />}>
          <Sidebar
            connectedBanks={connectedBanks}
            bankBalances={bankBalances}
            archivedTransactionCount={archivedTransactionCount}
            isTransactionEditMode={isTransactionEditMode}
          />
        </Suspense>
        <div className="flex-1 min-w-0">
          {children}
        </div>
      </body>
    </html>
  );
}
