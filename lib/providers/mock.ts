import type { Balance, IProvider, Transaction } from "./types";
import db from "@/lib/db";

function mockTransaction(tx: Pick<Transaction, "id" | "date" | "amount" | "currency" | "description" | "bank_id" | "counterpart">): Transaction {
  return {
    ...tx,
    value_date: null,
    tx_type: null,
    card_last4: null,
    card_network: null,
    category_path: 'uncategorized',
    cashflow_type: 'expense',
    behavior_bucket: 'variable',
    is_subscription: 0,
    is_excluded_from_spending: 0,
    reimbursement_of_transaction_id: null,
    review_status: 'needs_review',
    categorization_source: 'ingestion_raw',
    confidence_level: 'low',
    applied_rule_id: null,
    applied_rule_detail: null,
    category_is_manual: 0,
    archived_at: null,
    source: 'api_enablebanking',
    is_deleted: 0,
    counterparty_iban: null,
    resulting_balance: null,
  };
}

// Generate transactions from June 2026 to Sept 21 2026 for testing
function generateMockData(bankId: string, since?: string): Transaction[] {
  const txs: Transaction[] = [];
  const start = since ? new Date(since) : new Date("2026-05-27T00:00:00.000Z");
  const end = new Date("2026-09-21T00:00:00.000Z");
  
  let current = new Date(start);
  let idCounter = 1;

  while (current <= end) {
    // Regular expense
    txs.push(mockTransaction({
      id: `mock_${bankId}_${current.toISOString()}_DBIT_${idCounter++}`,
      date: current.toISOString(),
      amount: -15.50,
      currency: "EUR",
      description: "Supermarché " + bankId,
      bank_id: bankId,
      counterpart: "Supermarché",
    }));

    // Generate a refund scenario occasionally (e.g. on the 10th of the month)
    if (current.getDate() === 10) {
      // The original debit
      txs.push(mockTransaction({
        id: `mock_${bankId}_${current.toISOString()}_DBIT_100`,
        date: current.toISOString(),
        amount: -100.0,
        currency: "EUR",
        description: "Achat Amazon (Refundable)",
        bank_id: bankId,
        counterpart: "Amazon",
      }));
      // The exact same amount refunded on the same day (simulating the bug fix scenario)
      txs.push(mockTransaction({
        id: `mock_${bankId}_${current.toISOString()}_CRDT_100`,
        date: current.toISOString(),
        amount: 100.0,
        currency: "EUR",
        description: "Remboursement Amazon",
        bank_id: bankId,
        counterpart: "Amazon",
      }));
    }

    // Salary on the 1st
    if (current.getDate() === 1) {
      txs.push(mockTransaction({
        id: `mock_${bankId}_${current.toISOString()}_CRDT_SALARY`,
        date: current.toISOString(),
        amount: 2500.0,
        currency: "EUR",
        description: "Virement Salaire",
        bank_id: bankId,
        counterpart: "Employeur",
      }));
    }

    current.setDate(current.getDate() + 5);
  }
  return txs;
}

export class MockProvider implements IProvider {
  async connect(bankId: string): Promise<string> {
    // Return a dummy URL that just redirects back immediately with a fake code and state
    // We assume NEXT_PUBLIC_APP_URL is localhost for Mock provider
    return `http://localhost:3000/callback?code=mock_code&state=mock_state_${bankId}`;
  }

  async handleCallback(params: URLSearchParams): Promise<string> {
    const state = params.get("state");
    const bankId = state ? state.replace("mock_state_", "") : "mock";

    db.prepare(`
      INSERT INTO provider_tokens (provider, session_id, account_uids, expires_at, state)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(provider) DO UPDATE SET
        account_uids = excluded.account_uids,
        expires_at = excluded.expires_at
    `).run(
      `enablebanking_${bankId}`,
      `mock_session_${bankId}`,
      JSON.stringify(["mock_account"]),
      "2099-12-31T23:59:59.000Z",
      state
    );

    return bankId;
  }

  async fetchTransactions(since?: string, bankId?: string): Promise<Transaction[]> {
    return generateMockData(bankId || "mock", since);
  }

  async fetchBalances(bankId?: string): Promise<Balance[]> {
    return [{
      bank_id: bankId || "mock",
      account_uid: "mock_account",
      balance_type: "ITAV",
      amount: 1250.0,
      currency: "EUR"
    }];
  }

  isConnected(bankId: string): boolean {
    return true; // Mock provider is always connected
  }
}
