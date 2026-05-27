import jwt from "jsonwebtoken";
import type { IProvider, Transaction, Balance } from "./types";
import db from "@/lib/db";
import { getBankById } from "@/lib/banks.config";

const APP_ID = process.env.ENABLE_BANKING_APP_ID!;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const BASE_URL = "https://api.enablebanking.com";

function providerKey(bankId: string) {
  return `enablebanking_${bankId}`;
}

function privateKey(): string {
  return (process.env.ENABLE_BANKING_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
}

function makeJwt(): string {
  return jwt.sign(
    { iss: "enablebanking.com", aud: "api.enablebanking.com" },
    privateKey(),
    { algorithm: "RS256", keyid: APP_ID, expiresIn: 3600 }
  );
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${makeJwt()}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Enable Banking ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

type SessionRow = {
  session_id: string;
  account_uids: string;
  expires_at: string | null;
  state: string | null;
};

function getSession(bankId: string): SessionRow | null {
  return db
    .prepare(
      "SELECT session_id, account_uids, expires_at, state FROM provider_tokens WHERE provider = ?"
    )
    .get(providerKey(bankId)) as SessionRow | null;
}

function getSessionByState(state: string): (SessionRow & { provider: string }) | null {
  return db
    .prepare(
      "SELECT provider, session_id, account_uids, expires_at, state FROM provider_tokens WHERE state = ?"
    )
    .get(state) as (SessionRow & { provider: string }) | null;
}

function normalizeTransactionDescription(description: string, bankId: string): string {
  if (bankId !== "ing-nl") return description;
  return description.replace(/\bNaam:\s*/gi, "").replace(/\s+/g, " ").trim();
}

export class EnableBankingProvider implements IProvider {
  async connect(bankId: string): Promise<string> {
    const bank = getBankById(bankId);
    if (!bank) throw new Error(`Unknown bank: ${bankId}`);
    const aspsp = { name: bank.aspspName, country: bank.country };

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 89);

    const state = crypto.randomUUID();

    const data = await apiFetch<Record<string, unknown>>("/auth", {
      method: "POST",
      body: JSON.stringify({
        access: { valid_until: expiresAt.toISOString() },
        aspsp,
        redirect_url: `${APP_URL}/callback`,
        psu_type: "personal",
        credentials_autosubmit: false,
        state,
      }),
    });

    const authorizationId = data.authorization_id as string;
    const authUrl = data.url as string;

    // INSERT new row or update only the auth fields — never wipe account_uids of an existing connected session
    db.prepare(
      `INSERT INTO provider_tokens (provider, session_id, account_uids, expires_at, state, created_at)
       VALUES (?, ?, '[]', ?, ?, datetime('now'))
       ON CONFLICT(provider) DO UPDATE SET
         session_id = excluded.session_id,
         expires_at = excluded.expires_at,
         state      = excluded.state`
    ).run(providerKey(bankId), authorizationId, expiresAt.toISOString(), state);

    return authUrl;
  }

  async handleCallback(params: URLSearchParams): Promise<string> {
    const code  = params.get("code");
    const state = params.get("state");
    if (!code) throw new Error(`Missing code in callback. Params: ${params.toString()}`);

    // Identify which bank this callback belongs to via state
    const stored = state ? getSessionByState(state) : null;
    if (!stored) throw new Error(`No pending session found for state: ${state}`);

    const bankId = stored.provider.replace("enablebanking_", "");

    // Exchange code for session + accounts (ONE-TIME — accounts only returned here)
    const data = await apiFetch<Record<string, unknown>>("/sessions", {
      method: "POST",
      body: JSON.stringify({ code }),
    });
    console.log(`[EB:${bankId}] POST /sessions:`, JSON.stringify(data));

    const sessionId = data.session_id as string;
    let accounts = (data.accounts as Array<{ uid: string }>) ?? [];
    let uids = accounts.map((a) => a.uid);

    // Fallback 1: some banks (e.g. ING NL) return accounts:[] in POST /sessions
    // but the session object is accessible via GET /sessions/{session_id}
    if (uids.length === 0 && sessionId) {
      console.log(`[EB:${bankId}] accounts empty — trying GET /sessions/${sessionId}`);
      try {
        const session = await apiFetch<{ accounts?: Array<string | { uid: string }> }>(
          `/sessions/${sessionId}`
        );
        console.log(`[EB:${bankId}] GET /sessions/${sessionId}:`, JSON.stringify(session));
        if (session.accounts && session.accounts.length > 0) {
          uids = session.accounts.map((a) => (typeof a === "string" ? a : a.uid));
        }
      } catch (e) {
        console.warn(`[EB:${bankId}] GET /sessions/${sessionId} failed:`, e);
      }
    }

    // Fallback 2: call GET /accounts — Enable Banking returns all accounts across
    // all authorized sessions; filter by matching session_id field
    if (uids.length === 0 && sessionId) {
      console.log(`[EB:${bankId}] still empty — trying GET /accounts`);
      try {
        const accountsData = await apiFetch<{
          accounts: Array<{ uid: string; session_id?: string; aspsp?: { name?: string; country?: string } }>;
        }>("/accounts");
        console.log(`[EB:${bankId}] GET /accounts:`, JSON.stringify(accountsData));
        const bank = getBankById(bankId);
        const matched = (accountsData.accounts ?? []).filter(
          (a) =>
            a.session_id === sessionId ||
            (bank && a.aspsp?.name === bank.aspspName && a.aspsp?.country === bank.country)
        );
        if (matched.length > 0) {
          uids = matched.map((a) => a.uid);
          console.log(`[EB:${bankId}] matched ${uids.length} account(s) via GET /accounts`);
        }
      } catch (e) {
        console.warn(`[EB:${bankId}] GET /accounts failed:`, e);
      }
    }

    if (uids.length === 0) {
      console.warn(`[EB:${bankId}] No account UIDs found after all fallbacks. Session saved, will retry on sync.`);
    }

    db.prepare(
      `UPDATE provider_tokens SET account_uids = ?, session_id = ?, state = NULL
       WHERE provider = ?`
    ).run(JSON.stringify(uids), sessionId, providerKey(bankId));

    return bankId;
  }

  async fetchTransactions(since?: string, bankId = "revolut"): Promise<Transaction[]> {
    const session = getSession(bankId);
    if (!session) throw new Error(`Not connected — run connect('${bankId}') first`);

    let accountUids: string[] = JSON.parse(session.account_uids);

    // If accounts empty but session_id present, try to recover UIDs via GET /accounts
    if (accountUids.length === 0 && session.session_id) {
      console.log(`[EB:${bankId}] No accounts in DB — retrying GET /accounts`);
      try {
        const bank = getBankById(bankId);
        const accountsData = await apiFetch<{
          accounts: Array<{ uid: string; session_id?: string; aspsp?: { name?: string; country?: string } }>;
        }>("/accounts");
        const matched = (accountsData.accounts ?? []).filter(
          (a) =>
            a.session_id === session.session_id ||
            (bank && a.aspsp?.name === bank.aspspName && a.aspsp?.country === bank.country)
        );
        if (matched.length > 0) {
          accountUids = matched.map((a) => a.uid);
          db.prepare("UPDATE provider_tokens SET account_uids = ? WHERE provider = ?")
            .run(JSON.stringify(accountUids), `enablebanking_${bankId}`);
          console.log(`[EB:${bankId}] Recovered ${accountUids.length} account(s)`);
        }
      } catch (e) {
        console.warn(`[EB:${bankId}] GET /accounts recovery failed:`, e);
      }
    }

    if (accountUids.length === 0) throw new Error(`No accounts found for ${bankId}`);

    const dateFrom = since
      ? since.slice(0, 10)
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const dateTo = new Date().toISOString().slice(0, 10);

    const all: Transaction[] = [];

    for (const uid of accountUids) {
      let continuationKey: string | null = null;

      do {
        const qs = new URLSearchParams({ date_from: dateFrom, date_to: dateTo, transaction_status: "BOOK" });
        if (continuationKey) qs.set("continuation_key", continuationKey);

        const data = await apiFetch<{
          transactions: Array<{
            transaction_id?: string;
            entry_reference?: string;
            booking_date: string;
            value_date?: string;
            transaction_amount: { amount: string; currency: string };
            credit_debit_indicator?: string;
            status?: string;
            remittance_information?: string[];
            creditor?: { name?: string } | null;
            debtor?: { name?: string } | null;
            bank_transaction_code?: { code?: string } | null;
            debtor_account_additional_identification?: Array<{ identification: string; scheme_name: string; issuer?: string }> | null;
          }>;
          continuation_key: string | null;
        }>(`/accounts/${uid}/transactions?${qs}`);

        for (const tx of data.transactions) {
          // Only store finalized/booked transactions; pending card authorizations settle later.
          if (tx.status && tx.status !== "BOOK") continue;

          // Skip transactions without a booking date — they'd corrupt the sync cursor
          if (!tx.booking_date) continue;

          const id =
            tx.transaction_id ??
            tx.entry_reference ??
            `${uid}_${tx.booking_date}_${tx.transaction_amount.amount}`;

          const isDebit = tx.credit_debit_indicator !== "CRDT";
          const rawAmount = parseFloat(tx.transaction_amount.amount);
          const amount = isDebit ? -Math.abs(rawAmount) : Math.abs(rawAmount);

          const remittance = tx.remittance_information?.join(" ").trim();
          const counterpart = (isDebit ? tx.creditor?.name : tx.debtor?.name) ?? null;
          const description = normalizeTransactionDescription(
            remittance || counterpart || "Transaction",
            bankId
          );

          const cardInfo = tx.debtor_account_additional_identification?.find(
            (x) => x.scheme_name === "CPAN" || x.scheme_name === "PAN"
          );

          all.push({
            id,
            date: `${tx.booking_date}T00:00:00.000Z`,
            value_date: tx.value_date ? `${tx.value_date}T00:00:00.000Z` : null,
            amount,
            currency: tx.transaction_amount.currency,
            description,
            counterpart,
            tx_type: tx.bank_transaction_code?.code ?? null,
            card_last4: cardInfo?.identification ?? null,
            card_network: cardInfo?.issuer ?? null,
            bank_id: bankId,
            category: null,
            subcategory: null,
            archived_at: null,
          } as Transaction);
        }

        continuationKey = data.continuation_key;
      } while (continuationKey);
    }

    return all;
  }

  async fetchBalances(bankId = "revolut"): Promise<Balance[]> {
    const session = getSession(bankId);
    if (!session) return [];

    const accountUids: string[] = JSON.parse(session.account_uids);
    if (accountUids.length === 0) return [];

    const all: Balance[] = [];

    for (const uid of accountUids) {
      try {
        const data = await apiFetch<{
          balances: Array<{
            balance_amount: { amount: string; currency: string };
            balance_type: string;
          }>;
        }>(`/accounts/${uid}/balances`);

        for (const b of data.balances ?? []) {
          all.push({
            bank_id:      bankId,
            account_uid:  uid,
            balance_type: b.balance_type,
            amount:       parseFloat(b.balance_amount.amount),
            currency:     b.balance_amount.currency,
          });
        }
      } catch (e) {
        console.warn(`[EB:${bankId}] fetchBalances for ${uid} failed:`, e);
      }
    }

    return all;
  }

  isConnected(bankId: string): boolean {
    const session = getSession(bankId);
    if (!session) return false;
    if (session.expires_at && new Date(session.expires_at) < new Date()) return false;
    // Connected if OAuth was completed (state cleared) — even if account_uids not yet populated
    if (session.state === null) return true;
    // Also connected if account_uids already populated (legacy rows without state=NULL)
    const uids: string[] = JSON.parse(session.account_uids);
    return uids.length > 0;
  }
}
