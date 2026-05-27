import db from "@/lib/db";
import { getBankById } from "@/lib/banks.config";
import SyncAllButton from "./SyncAllButton";

type BalanceRow = {
  bank_id: string;
  balance_type: string;
  amount: number;
  currency: string;
};

type TxCountRow = {
  bank_id: string;
  count: number;
};

const BALANCE_PRIORITY = ["ITAV", "CLBD", "XPCD", "OTHR"];

function getBestBalance(
  rows: BalanceRow[]
): { amount: number; currency: string } | null {
  for (const type of BALANCE_PRIORITY) {
    const found = rows.find((r) => r.balance_type === type);
    if (found) return { amount: found.amount, currency: found.currency };
  }
  return rows[0] ? { amount: rows[0].amount, currency: rows[0].currency } : null;
}

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(amount);
}

export default function OverviewPage() {
  // All balances summed per bank + balance_type
  const balanceRows = db
    .prepare(
      `SELECT bank_id, balance_type, SUM(amount) as amount, currency
       FROM account_balances
       GROUP BY bank_id, balance_type, currency`
    )
    .all() as BalanceRow[];

  // Transaction counts per bank
  const txCounts = db
    .prepare(`SELECT bank_id, COUNT(*) as count FROM transactions WHERE archived_at IS NULL GROUP BY bank_id`)
    .all() as TxCountRow[];
  const countByBank = Object.fromEntries(txCounts.map((r) => [r.bank_id, r.count]));

  // Connected banks (state NULL = OAuth completed)
  const providerRows = db
    .prepare(
      `SELECT provider, account_uids FROM provider_tokens
       WHERE state IS NULL AND (expires_at IS NULL OR expires_at > datetime('now'))`
    )
    .all() as { provider: string; account_uids: string }[];

  const connectedBankIds = providerRows
    .map((r) => r.provider.replace("enablebanking_", ""));

  // Per-bank best balance
  const bankData = connectedBankIds
    .map((id) => {
      const cfg = getBankById(id);
      if (!cfg) return null;
      const rows = balanceRows.filter((r) => r.bank_id === id);
      const balance = getBestBalance(rows);
      return { cfg, balance, txCount: countByBank[id] ?? 0 };
    })
    .filter(Boolean) as {
      cfg: NonNullable<ReturnType<typeof getBankById>>;
      balance: { amount: number; currency: string } | null;
      txCount: number;
    }[];

  // Grand total per currency
  const totals: Record<string, number> = {};
  for (const { balance } of bankData) {
    if (!balance) continue;
    totals[balance.currency] = (totals[balance.currency] ?? 0) + balance.amount;
  }
  const totalEntries = Object.entries(totals);

  return (
    <main className="px-8 py-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Overview</h1>
        {bankData.length > 0 && (
          <SyncAllButton bankIds={connectedBankIds} />
        )}
      </div>

      {/* Total global */}
      {totalEntries.length > 0 && (
        <div className="mb-8 bg-white border border-gray-200 rounded-xl px-6 py-5">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Total across all accounts
          </p>
          <div className="flex flex-wrap gap-6">
            {totalEntries.map(([currency, amount]) => (
              <div key={currency}>
                <span
                  className={`text-3xl font-bold tabular-nums ${
                    amount < 0 ? "text-red-600" : "text-gray-900"
                  }`}
                >
                  {fmt(amount, currency)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Per-bank cards */}
      {bankData.length === 0 ? (
        <p className="text-gray-500 text-sm">
          No bank connected. Add a bank to see your balances.
        </p>
      ) : (
        <div className="space-y-2">
          {bankData.map(({ cfg, balance, txCount }) => (
            <a
              key={cfg.id}
              href={`/?bank=${cfg.id}`}
              className="flex items-center gap-4 bg-white border border-gray-200 rounded-xl px-5 py-4 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors group"
            >
              {/* Avatar */}
              <span
                className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                style={{ backgroundColor: cfg.color }}
              >
                {cfg.initial}
              </span>

              {/* Name + tx count */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{cfg.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {txCount > 0
                    ? `${txCount} transaction${txCount > 1 ? "s" : ""}`
                    : "No transactions — sync first"}
                </p>
              </div>

              {/* Balance */}
              <div className="text-right shrink-0">
                {balance ? (
                  <span
                    className={`text-base font-semibold tabular-nums ${
                      balance.amount < 0 ? "text-red-600" : "text-gray-900"
                    }`}
                  >
                    {fmt(balance.amount, balance.currency)}
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">Balance unavailable</span>
                )}
              </div>

              {/* Arrow */}
              <svg
                className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors shrink-0"
                viewBox="0 0 16 16" fill="none"
              >
                <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
