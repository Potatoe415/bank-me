import db from "@/lib/db";
import { deriveCategoryMetadata } from "@/lib/taxonomy";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PropagationParams = {
  sourceConfidence: "high" | "high_medium";
  normalization: "minimal" | "standard" | "aggressive";
  minSourceCount: number;
  conflictResolution: "skip" | "majority";
  dryRun: boolean;
};

export type RuleEntry = {
  normalizedKey: string;
  category: string;
  sourceCount: number;
  matchCount: number;
  examples: string[];
};

export type ConflictEntry = {
  normalizedKey: string;
  candidates: Array<{ category: string; count: number }>;
  examples: string[];
  skipped: number;
};

export type AppliedTx = {
  id: string;
  description: string;
  normalizedKey: string;
  category: string;
};

export type PropagationResult = {
  params: PropagationParams;
  stats: {
    sourcesTotal: number;
    uniqueKeysBuilt: number;
    conflictsFound: number;
    rulesApplicable: number;
    targetsTotal: number;
    matchesFound: number;
    applied: number;
  };
  rules: RuleEntry[];
  conflicts: ConflictEntry[];
  appliedTransactions: AppliedTx[];
};

// Safest possible parameters — used automatically after every sync
export const WAVE1_SAFE_PARAMS: PropagationParams = {
  sourceConfidence: "high",
  normalization: "standard",
  minSourceCount: 1,
  conflictResolution: "skip",
  dryRun: false,
};

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

function normalizeMinimal(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeStandard(s: string): string {
  return s
    .toLowerCase()
    .replace(/\*[a-z0-9]{3,}/gi, "")
    .replace(/(?:x{4}|[*]{4})[- ]?\d{4}/gi, "")
    .replace(/\b\d{5,}\b/g, "")
    .replace(/\b\d{2}[/\-]\d{2}(?:[/\-]\d{2,4})?\b/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAggressive(s: string): string {
  return normalizeStandard(s)
    .replace(/\b(?:cb|carte|virement|vir|prlv|prélèv|prelev|sepa|ref|no|n°|chez|pour|par)\b/gi, "")
    .replace(/\b\d{1,4}[.,]\d{2}\b/g, "")
    .replace(/\b\d{1,4}\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalize(s: string, level: PropagationParams["normalization"]): string {
  if (level === "minimal") return normalizeMinimal(s);
  if (level === "aggressive") return normalizeAggressive(s);
  return normalizeStandard(s);
}

// ---------------------------------------------------------------------------
// Core propagation engine
// ---------------------------------------------------------------------------

type SourceRow = { id: string; description: string; category_path: string };
type TargetRow = { id: string; description: string };

export function runWave1Propagation(params: PropagationParams): PropagationResult {
  const confidenceFilter =
    params.sourceConfidence === "high_medium" ? ["high", "medium"] : ["high"];

  const placeholders = confidenceFilter.map(() => "?").join(", ");

  const sources = db
    .prepare(
      `SELECT id, description, category_path
       FROM transactions
       WHERE confidence_level IN (${placeholders})
         AND category_path != 'uncategorized'
         AND is_deleted = 0`
    )
    .all(...confidenceFilter) as SourceRow[];

  // Build rule map: normalizedKey → Map<category, {count, examples}>
  type CategoryEntry = { count: number; examples: string[] };
  const ruleMap = new Map<string, Map<string, CategoryEntry>>();

  for (const src of sources) {
    const key = normalize(src.description, params.normalization);
    if (!key || key.length < 2) continue;

    if (!ruleMap.has(key)) ruleMap.set(key, new Map());
    const catMap = ruleMap.get(key)!;

    if (!catMap.has(src.category_path)) {
      catMap.set(src.category_path, { count: 0, examples: [] });
    }
    const entry = catMap.get(src.category_path)!;
    entry.count++;
    if (entry.examples.length < 3) entry.examples.push(src.description);
  }

  // Resolve conflicts
  type ResolvedRule = {
    normalizedKey: string;
    category: string;
    sourceCount: number;
    examples: string[];
  };

  const resolvedRules = new Map<string, ResolvedRule>();
  const conflicts: ConflictEntry[] = [];

  for (const [key, catMap] of ruleMap) {
    const candidates = Array.from(catMap.entries())
      .map(([category, entry]) => ({ category, count: entry.count, examples: entry.examples }))
      .sort((a, b) => b.count - a.count);

    const totalCount = candidates.reduce((s, c) => s + c.count, 0);
    const winner = candidates[0];

    if (candidates.length === 1) {
      if (winner.count < params.minSourceCount) continue;
      resolvedRules.set(key, {
        normalizedKey: key,
        category: winner.category,
        sourceCount: winner.count,
        examples: winner.examples,
      });
    } else {
      const runnerUp = candidates[1];
      if (params.conflictResolution === "majority" && winner.count > runnerUp.count) {
        if (winner.count < params.minSourceCount) continue;
        resolvedRules.set(key, {
          normalizedKey: key,
          category: winner.category,
          sourceCount: totalCount,
          examples: winner.examples,
        });
      } else {
        conflicts.push({
          normalizedKey: key,
          candidates: candidates.map((c) => ({ category: c.category, count: c.count })),
          examples: winner.examples,
          skipped: totalCount,
        });
      }
    }
  }

  // Fetch uncategorized targets
  const targets = db
    .prepare(
      `SELECT id, description
       FROM transactions
       WHERE category_path = 'uncategorized'
         AND is_deleted = 0`
    )
    .all() as TargetRow[];

  // Match
  const matchedMap = new Map<string, number>();
  const allApplied: AppliedTx[] = [];

  for (const target of targets) {
    const key = normalize(target.description, params.normalization);
    const rule = resolvedRules.get(key);
    if (!rule) continue;

    allApplied.push({ id: target.id, description: target.description, normalizedKey: key, category: rule.category });
    matchedMap.set(key, (matchedMap.get(key) ?? 0) + 1);
  }

  // Build rules output
  const rules: RuleEntry[] = Array.from(resolvedRules.values())
    .map((rule) => ({
      normalizedKey: rule.normalizedKey,
      category: rule.category,
      sourceCount: rule.sourceCount,
      matchCount: matchedMap.get(rule.normalizedKey) ?? 0,
      examples: rule.examples,
    }))
    .filter((r) => r.matchCount > 0)
    .sort((a, b) => b.matchCount - a.matchCount);

  // Apply to DB
  let applied = 0;
  if (!params.dryRun && allApplied.length > 0) {
    const update = db.prepare(
      `UPDATE transactions
       SET category_path = ?,
           cashflow_type = ?, behavior_bucket = ?, is_subscription = ?, is_excluded_from_spending = ?,
           categorization_source = 'rule_propagation',
           confidence_level = 'high',
           review_status = 'confirmed',
           applied_rule_id = 'wave1_exact_match',
           applied_rule_detail = ?
       WHERE id = ?`
    );

    db.transaction(() => {
      for (const tx of allApplied) {
        const meta = deriveCategoryMetadata(tx.category);
        update.run(
          tx.category,
          meta.cashflow_type,
          meta.behavior_bucket,
          meta.is_subscription,
          meta.is_excluded_from_spending,
          `Wave 1 — exact match sur clé normalisée "${tx.normalizedKey}"`,
          tx.id
        );
        applied++;
      }
    })();
  }

  return {
    params,
    stats: {
      sourcesTotal: sources.length,
      uniqueKeysBuilt: ruleMap.size,
      conflictsFound: conflicts.length,
      rulesApplicable: resolvedRules.size,
      targetsTotal: targets.length,
      matchesFound: allApplied.length,
      applied: params.dryRun ? 0 : applied,
    },
    rules,
    conflicts,
    appliedTransactions: allApplied.slice(0, 200),
  };
}

// ---------------------------------------------------------------------------
// Custom keyword rules
// ---------------------------------------------------------------------------

export function runCustomKeywordRules(): number {
  const customRules = [
    { keyword: '%SFDC NETHERLANDS%', category: 'income.regular' },
  ];

  let applied = 0;
  
  const update = db.prepare(`
    UPDATE transactions
    SET category_path = ?,
        cashflow_type = ?, behavior_bucket = ?, is_subscription = ?, is_excluded_from_spending = ?,
        categorization_source = 'rule_propagation',
        confidence_level = 'high',
        review_status = 'confirmed',
        applied_rule_id = 'custom_keyword_match',
        applied_rule_detail = ?
    WHERE category_path = 'uncategorized'
      AND is_deleted = 0
      AND description LIKE ?
  `);

  db.transaction(() => {
    for (const rule of customRules) {
      const meta = deriveCategoryMetadata(rule.category);
      const info = update.run(
        rule.category,
        meta.cashflow_type,
        meta.behavior_bucket,
        meta.is_subscription,
        meta.is_excluded_from_spending,
        `Mot-clé "${rule.keyword}" détecté`,
        rule.keyword
      );
      applied += info.changes;
    }
  })();

  return applied;
}

