Activity: Financial Data Enrichment (CSV-to-CSV transformation).

I am providing a CSV file containing my bank transactions. Your sole task is to return EXACTLY the same CSV file—with the same columns, the same IDs, and the same row structure—but replacing the 'uncategorized' value in the 'category_path' column with the most appropriate category.

CRITICAL RULE: If a row ALREADY has a category path filled in (any value other than 'uncategorized'), and confidence_level is high or medium you MUST SKIP IT. Leave its 'category_path' exactly as it is. Do not overwrite or modify it.

You must choose the category STRICTLY from the following 29 exact paths of this official taxonomy:

income.regular          income.extra            income.reimbursement
fixed.housing           fixed.utilities         fixed.insurance
fixed.subscriptions.work  fixed.subscriptions.leisure
fixed.obligations       fixed.fees
variable.groceries      variable.restaurant     variable.food_delivery
variable.leisure        variable.transport      variable.shopping
irregular.travel        irregular.maintenance   irregular.medical
irregular.events        irregular.admin
assets.savings          assets.investments.core assets.investments.speculative
transfers.internal      transfers.credit_card
transfers.cash.withdrawal  transfers.cash.deposit
uncategorized

Semantic classification rules to follow:
- 'variable.restaurant': Sit-down dining, cafes, bars, drinks, pub nights.
- 'variable.food_delivery': Online orders (UberEats, Deliveroo), takeaway, pickup.
- 'variable.leisure': Entertainment, sports, cinema, recreational activities (e.g., bowling).
- Analyze the 'full_description' column to determine the path. If you have an absolute doubt, leave it as 'uncategorized'.
-add a column confidence_level that you will fill based on you confidence you found the right category> high,medium,low

Imperative formatting constraints:
1. Return ONLY the raw code block containing the modified CSV data. No introductory phrases, polite filler, or concluding remarks.
2. Do NOT alter any other column (keep id, date, bank_id, amount, and full_description strictly intact).
3. Do not truncate or shorten the file. Process every single row provided, from first to last.

Here is the CSV to process:
[PASTE YOUR CSV CONTENT HERE]