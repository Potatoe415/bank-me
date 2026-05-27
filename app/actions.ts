"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import { getProvider } from "@/lib/providers";
import { importCategoriesCsv } from "@/lib/category-import";

const insertTx = db.prepare(
  `INSERT INTO transactions
     (id, date, value_date, amount, currency, description, counterpart, tx_type, card_last4, card_network, bank_id, category, subcategory, archived_at)
   VALUES
     (@id, @date, @value_date, @amount, @currency, @description, @counterpart, @tx_type, @card_last4, @card_network, @bank_id, @category, @subcategory, @archived_at)
   ON CONFLICT(id) DO UPDATE SET
     category = COALESCE(excluded.category, transactions.category),
     subcategory = COALESCE(excluded.subcategory, transactions.subcategory)`
);

const upsertBalance = db.prepare(
  `INSERT INTO account_balances (bank_id, account_uid, balance_type, amount, currency, updated_at)
   VALUES (@bank_id, @account_uid, @balance_type, @amount, @currency, datetime('now'))
   ON CONFLICT(bank_id, account_uid, balance_type) DO UPDATE SET
     amount     = excluded.amount,
     currency   = excluded.currency,
     updated_at = excluded.updated_at`
);

export async function disconnectBank(bankId: string) {
  db.prepare("DELETE FROM provider_tokens WHERE provider = ?").run(`enablebanking_${bankId}`);
  db.prepare("DELETE FROM account_balances WHERE bank_id = ?").run(bankId);
  revalidatePath("/");
  revalidatePath("/settings");
  redirect("/overview");
}

export async function syncAllTransactions(bankIds: string[]): Promise<{ errors: Record<string, string> }> {
  const provider = getProvider();
  const errors: Record<string, string> = {};

  for (const bankId of bankIds) {
    try {
      const lastTxRow = db
        .prepare("SELECT date FROM transactions WHERE bank_id = ? AND date NOT LIKE 'null%' ORDER BY date DESC LIMIT 1")
        .get(bankId) as { date: string } | undefined;

      const transactions = await provider.fetchTransactions(lastTxRow?.date, bankId);
      for (const tx of transactions) {
        insertTx.run(tx);
      }

      try {
        const balances = await provider.fetchBalances(bankId);
        for (const b of balances) {
          upsertBalance.run(b);
        }
      } catch (e) {
        console.warn(`[syncAll] fetchBalances failed for ${bankId}:`, e);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[syncAll] failed for ${bankId}:`, msg);
      errors[bankId] = msg;
    }
  }

  revalidatePath("/");
  revalidatePath("/overview");
  return { errors };
}

export async function syncTransactions(bankId: string) {
  const provider = getProvider();

  try {
    const lastTxRow = db
      .prepare("SELECT date FROM transactions WHERE bank_id = ? AND date NOT LIKE 'null%' ORDER BY date DESC LIMIT 1")
      .get(bankId) as { date: string } | undefined;

    // Fetch and store transactions
    const transactions = await provider.fetchTransactions(lastTxRow?.date, bankId);
    for (const tx of transactions) {
      insertTx.run(tx);
    }

    // Fetch and store balances
    try {
      const balances = await provider.fetchBalances(bankId);
      for (const b of balances) {
        upsertBalance.run(b);
      }
    } catch (e) {
      console.warn(`[sync] fetchBalances failed for ${bankId}:`, e);
    }

    revalidatePath("/");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`[sync] syncTransactions failed for ${bankId}:`, msg);
    redirect(`/?bank=${bankId}&sync_error=${encodeURIComponent(msg)}`);
  }
}

export async function importCategories(formData: FormData) {
  let destination = "/export";

  try {
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new Error("Please choose a CSV file to import.");
    }

    const text = await file.text();
    const result = importCategoriesCsv(text);

    revalidatePath("/");
    revalidatePath("/overview");
    revalidatePath("/export");

    const params = new URLSearchParams({
      imported: String(result.updated),
      skipped: String(result.skipped),
      total: String(result.totalRows),
    });
    destination = `/export?${params.toString()}`;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    destination = `/export?import_error=${encodeURIComponent(msg)}`;
  }

  redirect(destination);
}

export async function toggleTransactionArchive(transactionId: string) {
  db.prepare(
    `UPDATE transactions
     SET archived_at = CASE
       WHEN archived_at IS NULL THEN datetime('now')
       ELSE NULL
     END
     WHERE id = ?`
  ).run(transactionId);

  revalidatePath("/");
  revalidatePath("/overview");
  revalidatePath("/graphics");
  revalidatePath("/graphics-actionable");
  revalidatePath("/export");
  revalidatePath("/settings");
}

export async function unarchiveAllTransactions() {
  db.prepare("UPDATE transactions SET archived_at = NULL WHERE archived_at IS NOT NULL").run();

  revalidatePath("/");
  revalidatePath("/overview");
  revalidatePath("/graphics");
  revalidatePath("/graphics-actionable");
  revalidatePath("/export");
  revalidatePath("/settings");
}
