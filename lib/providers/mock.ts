import type { Balance, IProvider, Transaction } from "./types";

function mockTransaction(tx: Pick<Transaction, "id" | "date" | "amount" | "currency" | "description">): Transaction {
  return {
    ...tx,
    value_date: null,
    counterpart: null,
    tx_type: null,
    card_last4: null,
    card_network: null,
    bank_id: "mock",
    category: null,
    subcategory: null,
    archived_at: null,
    source: 'api_enablebanking',
    is_deleted: 0,
    counterparty_iban: null,
    resulting_balance: null,
  };
}

const MOCK_TRANSACTIONS: Transaction[] = [
  mockTransaction({
    id: "txn_001_mock",
    date: "2026-05-24T10:32:00.000Z",
    amount: -42.5,
    currency: "EUR",
    description: "Carrefour City Paris 11",
  }),
  mockTransaction({
    id: "txn_002_mock",
    date: "2026-05-22T14:15:00.000Z",
    amount: 2350.0,
    currency: "EUR",
    description: "Virement salaire ACME Corp",
  }),
  mockTransaction({
    id: "txn_003_mock",
    date: "2026-05-20T08:00:00.000Z",
    amount: -9.99,
    currency: "EUR",
    description: "Spotify Premium abonnement",
  }),
];

export class MockProvider implements IProvider {
  async connect(): Promise<string> {
    return "";
  }

  async handleCallback(_params: URLSearchParams): Promise<string> {
    return "mock";
  }

  async fetchTransactions(_since?: string): Promise<Transaction[]> {
    return MOCK_TRANSACTIONS;
  }

  async fetchBalances(_bankId?: string): Promise<Balance[]> {
    return [];
  }

  isConnected(_bankId: string): boolean {
    return true;
  }
}
