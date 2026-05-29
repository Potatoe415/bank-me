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
  category_path: string;
  cashflow_type: string;
  behavior_bucket: string;
  is_subscription: number;
  is_excluded_from_spending: number;
  reimbursement_of_transaction_id: string | null;
  review_status: string;
  categorization_source: string;
  confidence_level: string;
  applied_rule_id: string | null;
  applied_rule_detail: string | null;
  category_is_manual: number;
  archived_at: string | null;
  source: string;
  is_deleted: number;
  counterparty_iban: string | null;
  resulting_balance: number | null;
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
