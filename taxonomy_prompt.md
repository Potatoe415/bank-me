You are a deterministic financial data processor. I will provide a CSV of bank transactions.
Your task is to populate the `category` and `subcategory` columns ONLY for rows where they are currently empty, and return the complete CSV.

### STRICT TAXONOMY (Category -> Subcategory)
- "Fixed Costs" -> ["Housing", "Insurance", "Taxes"]
- "Food" -> ["Groceries", "Dining Out", "Restaurants", "Food Delivery"]
- "Lifestyle" -> ["Daily Transit"]
- "Travel" -> ["Flights & Trains", "Accommodation", "Local Expenses"]
- "Subscriptions" -> ["Tech Tools", "Entertainment", "Bank Fees"]
- "One-off" -> ["Hardware & Gear", "Healthcare"]
- "Internal Transfer" -> ["Account Transfer", "Credit Card Payment"]
- "Unknown" -> ["Unclassifiable"]

### PROCESSING RULES & AGGRESSIVE INFERENCE
1. PRESERVATION RULE (CRITICAL): If a row already contains a value in the `category` or `subcategory` column, DO NOT modify it. Keep the existing values exactly as they are and skip inference for that row.
2. Proactive Deduction: For empty rows, deduce the company/merchant from the `full_description` column. Strip away alphanumeric terminal IDs, dates, and locations (e.g., MILANO, NYON).
3. Negative amounts = debit. Positive amounts = credit.
4. If `full_description` indicates a transfer, credit card payment, or includes "PRELEVEMENT AUTOMATIQUE ENREGISTRE", force "Internal Transfer" -> "Credit Card Payment".
5. Specific Mapping: "WEBLOYALTY" or "COTISATION" -> "Subscriptions" -> "Bank Fees". "GLOVO" -> "Food" -> "Food Delivery". "FNAC EBOOK" -> "Subscriptions" -> "Entertainment".
6. Use "Unknown" -> "Unclassifiable" ONLY if the row contains zero semantic meaning.

### OUTPUT CONSTRAINTS
- Return ONLY the raw CSV data enclosed in a single markdown code block (` ```csv ... ``` `).
- Do NOT output any introductory, conversational, or explanatory text.
- You MUST return every single row from the input, including the ones you skipped.
- The output CSV must have exactly these 7 columns in order: id, date, bank_id, amount, full_description, category, subcategory.
- Keep the original formatting for `amount` (float with period).

Here is the CSV data:
[ATTACH OR PASTE CSV DATA BELOW THIS LINE]
