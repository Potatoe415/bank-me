export const CATEGORY_PATHS = [
  'income.regular',
  'income.extra',
  'income.reimbursement',
  'fixed.housing',
  'fixed.utilities',
  'fixed.insurance',
  'fixed.subscriptions.work',
  'fixed.subscriptions.leisure',
  'fixed.obligations',
  'fixed.fees',
  'variable.groceries',
  'variable.restaurant',
  'variable.food_delivery',
  'variable.leisure',
  'variable.transport',
  'variable.shopping',
  'irregular.travel',
  'irregular.maintenance',
  'irregular.medical',
  'irregular.events',
  'irregular.admin',
  'assets.savings',
  'assets.investments.core',
  'assets.investments.speculative',
  'transfers.internal',
  'transfers.credit_card',
  'transfers.cash.withdrawal',
  'transfers.cash.deposit',
  'uncategorized',
] as const;

export type CategoryPath = (typeof CATEGORY_PATHS)[number];

export type CategoryMetadata = {
  cashflow_type: string;
  behavior_bucket: string;
  is_subscription: number;
  is_excluded_from_spending: number;
};

const METADATA: Record<string, CategoryMetadata> = {
  'income.regular':                 { cashflow_type: 'income',        behavior_bucket: 'neutral',   is_subscription: 0, is_excluded_from_spending: 0 },
  'income.extra':                   { cashflow_type: 'income',        behavior_bucket: 'neutral',   is_subscription: 0, is_excluded_from_spending: 0 },
  'income.reimbursement':           { cashflow_type: 'reimbursement', behavior_bucket: 'neutral',   is_subscription: 0, is_excluded_from_spending: 1 },
  'fixed.housing':                  { cashflow_type: 'expense',       behavior_bucket: 'fixed',     is_subscription: 0, is_excluded_from_spending: 0 },
  'fixed.utilities':                { cashflow_type: 'expense',       behavior_bucket: 'fixed',     is_subscription: 0, is_excluded_from_spending: 0 },
  'fixed.insurance':                { cashflow_type: 'expense',       behavior_bucket: 'fixed',     is_subscription: 0, is_excluded_from_spending: 0 },
  'fixed.subscriptions.work':       { cashflow_type: 'expense',       behavior_bucket: 'fixed',     is_subscription: 1, is_excluded_from_spending: 0 },
  'fixed.subscriptions.leisure':    { cashflow_type: 'expense',       behavior_bucket: 'fixed',     is_subscription: 1, is_excluded_from_spending: 0 },
  'fixed.obligations':              { cashflow_type: 'expense',       behavior_bucket: 'fixed',     is_subscription: 0, is_excluded_from_spending: 0 },
  'fixed.fees':                     { cashflow_type: 'expense',       behavior_bucket: 'fixed',     is_subscription: 0, is_excluded_from_spending: 0 },
  'variable.groceries':             { cashflow_type: 'expense',       behavior_bucket: 'variable',  is_subscription: 0, is_excluded_from_spending: 0 },
  'variable.restaurant':            { cashflow_type: 'expense',       behavior_bucket: 'variable',  is_subscription: 0, is_excluded_from_spending: 0 },
  'variable.food_delivery':         { cashflow_type: 'expense',       behavior_bucket: 'variable',  is_subscription: 0, is_excluded_from_spending: 0 },
  'variable.leisure':               { cashflow_type: 'expense',       behavior_bucket: 'variable',  is_subscription: 0, is_excluded_from_spending: 0 },
  'variable.transport':             { cashflow_type: 'expense',       behavior_bucket: 'variable',  is_subscription: 0, is_excluded_from_spending: 0 },
  'variable.shopping':              { cashflow_type: 'expense',       behavior_bucket: 'variable',  is_subscription: 0, is_excluded_from_spending: 0 },
  'irregular.travel':               { cashflow_type: 'expense',       behavior_bucket: 'irregular', is_subscription: 0, is_excluded_from_spending: 0 },
  'irregular.maintenance':          { cashflow_type: 'expense',       behavior_bucket: 'irregular', is_subscription: 0, is_excluded_from_spending: 0 },
  'irregular.medical':              { cashflow_type: 'expense',       behavior_bucket: 'irregular', is_subscription: 0, is_excluded_from_spending: 0 },
  'irregular.events':               { cashflow_type: 'expense',       behavior_bucket: 'irregular', is_subscription: 0, is_excluded_from_spending: 0 },
  'irregular.admin':                { cashflow_type: 'expense',       behavior_bucket: 'irregular', is_subscription: 0, is_excluded_from_spending: 0 },
  'assets.savings':                 { cashflow_type: 'allocation',    behavior_bucket: 'asset',     is_subscription: 0, is_excluded_from_spending: 1 },
  'assets.investments.core':        { cashflow_type: 'allocation',    behavior_bucket: 'asset',     is_subscription: 0, is_excluded_from_spending: 1 },
  'assets.investments.speculative': { cashflow_type: 'allocation',    behavior_bucket: 'asset',     is_subscription: 0, is_excluded_from_spending: 1 },
  'transfers.internal':             { cashflow_type: 'transfer',      behavior_bucket: 'neutral',   is_subscription: 0, is_excluded_from_spending: 1 },
  'transfers.credit_card':          { cashflow_type: 'transfer',      behavior_bucket: 'neutral',   is_subscription: 0, is_excluded_from_spending: 1 },
  'transfers.cash.withdrawal':      { cashflow_type: 'transfer',      behavior_bucket: 'neutral',   is_subscription: 0, is_excluded_from_spending: 1 },
  'transfers.cash.deposit':         { cashflow_type: 'transfer',      behavior_bucket: 'neutral',   is_subscription: 0, is_excluded_from_spending: 1 },
  'uncategorized':                  { cashflow_type: 'expense',       behavior_bucket: 'variable',  is_subscription: 0, is_excluded_from_spending: 0 },
};

export function deriveCategoryMetadata(path: string): CategoryMetadata {
  return METADATA[path] ?? METADATA['uncategorized'];
}

export type EditableTaxonomy = {
  paths: string[];
};

export function buildEditableTaxonomy(rows: Array<{ category: string | null }>): EditableTaxonomy {
  const pathSet = new Set<string>(CATEGORY_PATHS);
  for (const row of rows) {
    const p = row.category?.trim();
    if (p) pathSet.add(p);
  }
  const sorted = [...pathSet].sort((a, b) => a.localeCompare(b));
  return { paths: sorted };
}

export function formatCategoryPath(path: string): string {
  if (!path || path === 'uncategorized') return 'Uncategorized';
  return path
    .split('.')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).replace(/_/g, ' '))
    .join(' / ');
}
