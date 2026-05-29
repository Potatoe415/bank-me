"use server";

import { revalidatePath, refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import db from "@/lib/db";
import { getProvider } from "@/lib/providers";
import { importCategoriesCsv } from "@/lib/category-import";
import { TRANSACTION_EDIT_MODE_COOKIE } from "@/lib/transaction-edit-mode";
import { COLUMN_PREFS_COOKIE, serializeHiddenColumns, type ColumnId } from "@/lib/column-prefs";
import { deriveCategoryMetadata } from "@/lib/taxonomy";

const insertTx = db.prepare(
  `INSERT INTO transactions
     (id, date, value_date, amount, currency, description, counterpart, tx_type, card_last4, card_network, bank_id,
      category_path, cashflow_type, behavior_bucket, is_subscription, is_excluded_from_spending,
      reimbursement_of_transaction_id, review_status, categorization_source, confidence_level,
      applied_rule_id, applied_rule_detail,
      archived_at, source, is_deleted, counterparty_iban, resulting_balance)
   VALUES
     (@id, @date, @value_date, @amount, @currency, @description, @counterpart, @tx_type, @card_last4, @card_network, @bank_id,
      @category_path, @cashflow_type, @behavior_bucket, @is_subscription, @is_excluded_from_spending,
      @reimbursement_of_transaction_id, @review_status, @categorization_source, @confidence_level,
      @applied_rule_id, @applied_rule_detail,
      @archived_at, @source, @is_deleted, @counterparty_iban, @resulting_balance)
   ON CONFLICT(id) DO NOTHING`
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

export async function setTransactionEditMode(enabled: boolean) {
  const cookieStore = await cookies();
  cookieStore.set(TRANSACTION_EDIT_MODE_COOKIE, enabled ? "1" : "0", {
    path: "/",
    sameSite: "lax",
  });
  refresh();
}

function revalidateTransactionViews() {
  revalidatePath("/");
  revalidatePath("/overview");
  revalidatePath("/graphics");
  revalidatePath("/graphics-actionable");
  revalidatePath("/export");
}

function revalidateTaxonomyViews() {
  revalidateTransactionViews();
  revalidatePath("/settings");
}

function getRequiredFormText(formData: FormData, key: string, label: string) {
  const value = formData.get(key);
  if (typeof value !== "string") {
    throw new Error(`${label} is required.`);
  }

  const normalized = value.trim();
  if (!normalized) {
    throw new Error(`${label} is required.`);
  }

  return normalized;
}

export async function updateTransactionCategory(transactionId: string, categoryPath: string) {
  const meta = deriveCategoryMetadata(categoryPath);
  db.prepare(
    `UPDATE transactions
     SET category_path = ?, cashflow_type = ?, behavior_bucket = ?,
         is_subscription = ?, is_excluded_from_spending = ?,
         category_is_manual = 1,
         review_status = 'confirmed',
         categorization_source = 'manual',
         confidence_level = 'high',
         applied_rule_id = 'ui_manual_action',
         applied_rule_detail = 'Modifié manuellement via l''interface utilisateur'
     WHERE id = ?`
  ).run(categoryPath, meta.cashflow_type, meta.behavior_bucket, meta.is_subscription, meta.is_excluded_from_spending, transactionId);

  revalidateTransactionViews();
}

export async function bulkUpdateTransactionCategories(transactionIds: string[], categoryPath: string) {
  const meta = deriveCategoryMetadata(categoryPath);
  const update = db.prepare(
    `UPDATE transactions
     SET category_path = ?, cashflow_type = ?, behavior_bucket = ?,
         is_subscription = ?, is_excluded_from_spending = ?,
         category_is_manual = 1,
         review_status = 'confirmed',
         categorization_source = 'manual',
         confidence_level = 'high',
         applied_rule_id = 'ui_manual_action',
         applied_rule_detail = 'Modifié manuellement via l''interface utilisateur'
     WHERE id = ?`
  );

  db.transaction(() => {
    for (const id of transactionIds) {
      update.run(categoryPath, meta.cashflow_type, meta.behavior_bucket, meta.is_subscription, meta.is_excluded_from_spending, id);
    }
  })();

  revalidateTransactionViews();
}

export async function addTaxonomyCategory(formData: FormData) {
  const categoryPath = getRequiredFormText(formData, "category", "Category path");

  db.prepare("INSERT OR IGNORE INTO taxonomy_entries (category, subcategory) VALUES (?, '')").run(categoryPath);

  revalidateTaxonomyViews();
}

export async function renameTaxonomyCategory(formData: FormData) {
  const currentPath = getRequiredFormText(formData, "currentCategory", "Current path");
  const nextPath = getRequiredFormText(formData, "nextCategory", "New path");

  if (currentPath === nextPath) {
    return;
  }

  db.transaction(() => {
    db.prepare("INSERT OR IGNORE INTO taxonomy_entries (category, subcategory) VALUES (?, '')").run(nextPath);
    const meta = deriveCategoryMetadata(nextPath);
    db.prepare(
      `UPDATE transactions
       SET category_path = ?,
           cashflow_type = ?, behavior_bucket = ?, is_subscription = ?, is_excluded_from_spending = ?,
           category_is_manual = 1,
           review_status = 'confirmed',
           categorization_source = 'manual',
           confidence_level = 'high',
           applied_rule_id = 'ui_manual_action',
           applied_rule_detail = NULL
       WHERE category_path = ?`
    ).run(nextPath, meta.cashflow_type, meta.behavior_bucket, meta.is_subscription, meta.is_excluded_from_spending, currentPath);
    db.prepare("DELETE FROM taxonomy_entries WHERE category = ?").run(currentPath);
  })();

  revalidateTaxonomyViews();
}

export async function setColumnPreferences(hiddenColumns: ColumnId[]) {
  const cookieStore = await cookies();
  cookieStore.set(COLUMN_PREFS_COOKIE, serializeHiddenColumns(hiddenColumns), {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/");
}

export async function deleteTaxonomyCategory(formData: FormData) {
  const categoryPath = getRequiredFormText(formData, "category", "Category path");

  db.transaction(() => {
    db.prepare(
      `UPDATE transactions
       SET category_path = 'uncategorized', cashflow_type = 'expense', behavior_bucket = 'variable',
           is_subscription = 0, is_excluded_from_spending = 0,
           category_is_manual = 0,
           review_status = 'needs_review',
           categorization_source = 'ingestion_raw',
           confidence_level = 'low',
           applied_rule_id = NULL,
           applied_rule_detail = NULL
       WHERE category_path = ?`
    ).run(categoryPath);
    db.prepare("DELETE FROM taxonomy_entries WHERE category = ?").run(categoryPath);
  })();

  revalidateTaxonomyViews();
}
