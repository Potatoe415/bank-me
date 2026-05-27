export type Transaction = {
  id: string;
  date: string;
  value_date: string | null;
  amount: number;
  currency: string;
  description: string;
  counterpart: string | null;
  tx_type: string | null;
  card_last4: string | null;
  card_network: string | null;
  bank_id: string;
  category: string | null;
  subcategory: string | null;
  archived_at: string | null;
};

export type Balance = {
  bank_id:      string;
  account_uid:  string;
  balance_type: string;
  amount:       number;
  currency:     string;
};

export interface IProvider {
  connect(bankId: string): Promise<string>;
  handleCallback(params: URLSearchParams): Promise<string>; // returns bankId
  fetchTransactions(since?: string, bankId?: string): Promise<Transaction[]>;
  fetchBalances(bankId?: string): Promise<Balance[]>;
  isConnected(bankId: string): boolean;
}
