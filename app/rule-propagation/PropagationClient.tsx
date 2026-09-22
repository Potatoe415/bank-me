"use client";

import { useState } from "react";
import type { PropagationParams, PropagationResult, RuleEntry, ConflictEntry } from "@/app/api/rule-propagation/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number) {
  return n.toLocaleString("fr-FR");
}

function pct(part: number, total: number) {
  if (total === 0) return 0;
  return Math.round((part / total) * 100);
}

function categoryColor(path: string): string {
  if (path.startsWith("income")) return "#10b981";
  if (path.startsWith("fixed")) return "#6366f1";
  if (path.startsWith("variable")) return "#f59e0b";
  if (path.startsWith("irregular")) return "#f97316";
  if (path.startsWith("assets")) return "#8b5cf6";
  if (path.startsWith("transfers")) return "#06b6d4";
  return "#9ca3af";
}

function categoryLabel(path: string): string {
  return path.replace(/\./g, " › ");
}

// ---------------------------------------------------------------------------
// Small UI atoms
// ---------------------------------------------------------------------------

function ProgressBar({ value, max, color = "#6366f1", height = 8 }: { value: number; max: number; color?: string; height?: number }) {
  const pctVal = max === 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="relative w-full rounded-full overflow-hidden" style={{ height, backgroundColor: "#f1f5f9" }}>
      <div
        className="absolute left-0 top-0 h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${pctVal}%`, backgroundColor: color }}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  color = "#6366f1",
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  icon: string;
}) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-5 flex flex-col gap-2 shadow-sm">
      <div className="flex items-center gap-2 text-gray-400 text-xs font-semibold uppercase tracking-widest">
        <span style={{ fontSize: 16 }}>{icon}</span>
        {label}
      </div>
      <div className="text-3xl font-bold tracking-tight" style={{ color }}>
        {typeof value === "number" ? fmt(value) : value}
      </div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ backgroundColor: color + "20", color }}
    >
      {text}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Parameter controls
// ---------------------------------------------------------------------------

type Params = {
  sourceConfidence: "high" | "high_medium";
  normalization: "minimal" | "standard" | "aggressive";
  minSourceCount: number;
  conflictResolution: "skip" | "majority";
};

const DEFAULT_PARAMS: Params = {
  sourceConfidence: "high",
  normalization: "standard",
  minSourceCount: 1,
  conflictResolution: "skip",
};

function RadioGroup<T extends string>({
  label,
  description,
  options,
  value,
  onChange,
}: {
  label: string;
  description: string;
  options: Array<{ value: T; label: string; desc: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <div className="text-sm font-semibold text-gray-700">{label}</div>
        <div className="text-xs text-gray-400 mt-0.5">{description}</div>
      </div>
      <div className="flex flex-col gap-1.5">
        {options.map((opt) => (
          <label
            key={opt.value}
            className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all ${
              value === opt.value
                ? "border-indigo-300 bg-indigo-50"
                : "border-gray-100 hover:border-gray-200 bg-white"
            }`}
          >
            <input
              type="radio"
              className="mt-0.5 accent-indigo-600"
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
            />
            <div>
              <div className="text-sm font-medium text-gray-800">{opt.label}</div>
              <div className="text-xs text-gray-400 mt-0.5">{opt.desc}</div>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Results sub-components
// ---------------------------------------------------------------------------

function SummaryStats({ result, prevUncategorized }: { result: PropagationResult; prevUncategorized: number }) {
  const { stats } = result;
  const coveragePct = pct(stats.matchesFound, stats.targetsTotal);
  const newUncategorized = stats.targetsTotal - stats.matchesFound;
  const improvementPct = pct(stats.matchesFound, prevUncategorized);

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <span className="text-lg">📊</span>
        <h3 className="text-base font-bold text-gray-800">Résumé de la propagation</h3>
        {result.params.dryRun && (
          <span className="ml-auto rounded-full bg-amber-100 text-amber-700 text-[11px] font-semibold px-2.5 py-0.5">
            MODE PRÉVISUALISATION — aucune modification
          </span>
        )}
        {!result.params.dryRun && (
          <span className="ml-auto rounded-full bg-emerald-100 text-emerald-700 text-[11px] font-semibold px-2.5 py-0.5">
            APPLIQUÉ — {fmt(stats.applied)} transactions modifiées
          </span>
        )}
      </div>

      {/* 4-stat row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="bg-indigo-50 rounded-lg p-3 flex flex-col gap-1">
          <div className="text-[11px] font-semibold text-indigo-400 uppercase tracking-widest">Règles construites</div>
          <div className="text-2xl font-bold text-indigo-700">{fmt(stats.rulesApplicable)}</div>
          <div className="text-[11px] text-indigo-400">{fmt(stats.uniqueKeysBuilt)} clés uniques extraites</div>
        </div>
        <div className="bg-emerald-50 rounded-lg p-3 flex flex-col gap-1">
          <div className="text-[11px] font-semibold text-emerald-400 uppercase tracking-widest">Transactions matchées</div>
          <div className="text-2xl font-bold text-emerald-700">{fmt(stats.matchesFound)}</div>
          <div className="text-[11px] text-emerald-400">sur {fmt(stats.targetsTotal)} non catégorisées</div>
        </div>
        <div className="bg-amber-50 rounded-lg p-3 flex flex-col gap-1">
          <div className="text-[11px] font-semibold text-amber-400 uppercase tracking-widest">Conflits détectés</div>
          <div className="text-2xl font-bold text-amber-700">{fmt(stats.conflictsFound)}</div>
          <div className="text-[11px] text-amber-400">clés avec catégories contradictoires</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 flex flex-col gap-1">
          <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Restant non catégorisé</div>
          <div className="text-2xl font-bold text-gray-600">{fmt(newUncategorized)}</div>
          <div className="text-[11px] text-gray-400">après application</div>
        </div>
      </div>

      {/* Coverage progress bar */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-gray-700">Couverture de la vague 1</span>
          <span className="font-bold text-indigo-600">{coveragePct}% des transactions non catégorisées matchées</span>
        </div>
        <ProgressBar value={stats.matchesFound} max={stats.targetsTotal} color="#6366f1" height={12} />
        <div className="flex items-center justify-between text-[11px] text-gray-400">
          <span>0 — aucun match</span>
          <span>{fmt(stats.matchesFound)} matchés</span>
          <span>{fmt(stats.targetsTotal)} cibles totales</span>
        </div>
      </div>

      {/* Improvement bar */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-gray-700">Amélioration du taux de catégorisation</span>
          <span className="font-bold text-emerald-600">+{improvementPct}%</span>
        </div>
        <ProgressBar value={stats.matchesFound} max={prevUncategorized} color="#10b981" height={10} />
        <div className="text-[11px] text-gray-400">
          Rapport par rapport au total de départ ({fmt(prevUncategorized)} transactions non catégorisées avant la vague)
        </div>
      </div>

      {/* Source breakdown */}
      <div className="flex flex-col gap-1.5">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-widest">Sources utilisées</div>
        <div className="flex flex-wrap gap-2 text-xs text-gray-500">
          <span className="rounded-md bg-gray-50 border border-gray-100 px-2.5 py-1">
            <span className="font-semibold text-gray-800">{fmt(stats.sourcesTotal)}</span> transactions high-confidence extraites comme sources
          </span>
          <span className="rounded-md bg-gray-50 border border-gray-100 px-2.5 py-1">
            Normalisation : <span className="font-semibold text-gray-800">{result.params.normalization}</span>
          </span>
          <span className="rounded-md bg-gray-50 border border-gray-100 px-2.5 py-1">
            Occurrences min. source : <span className="font-semibold text-gray-800">{result.params.minSourceCount}</span>
          </span>
          <span className="rounded-md bg-gray-50 border border-gray-100 px-2.5 py-1">
            Conflits : <span className="font-semibold text-gray-800">{result.params.conflictResolution === "skip" ? "ignorés" : "vote majoritaire"}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

function RulesTable({ rules }: { rules: RuleEntry[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rules : rules.slice(0, 15);
  const totalMatches = rules.reduce((s, r) => s + r.matchCount, 0);

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
            <span>📋</span> Règles actives
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {fmt(rules.length)} règles correspondent à au moins une transaction non catégorisée — {fmt(totalMatches)} matchs au total
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-50 bg-gray-50/50 text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
              <th className="px-4 py-3 text-left">Clé normalisée</th>
              <th className="px-4 py-3 text-left">Catégorie assignée</th>
              <th className="px-4 py-3 text-right">Sources high-conf</th>
              <th className="px-4 py-3 text-right">Matchs trouvés</th>
              <th className="px-4 py-3 text-left">Exemples de libellés bruts</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {visible.map((rule, i) => (
              <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                <td className="px-4 py-3 font-mono text-[11px] text-gray-600 max-w-[220px] truncate">
                  {rule.normalizedKey}
                </td>
                <td className="px-4 py-3">
                  <Badge text={categoryLabel(rule.category)} color={categoryColor(rule.category)} />
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="font-semibold text-gray-700">{rule.sourceCount}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <ProgressBar value={rule.matchCount} max={Math.max(...rules.map((r) => r.matchCount), 1)} color={categoryColor(rule.category)} height={6} />
                    <span className="font-bold text-gray-800 w-6 text-right">{rule.matchCount}</span>
                  </div>
                </td>
                <td className="px-4 py-3 max-w-[240px]">
                  <div className="flex flex-col gap-0.5">
                    {rule.examples.slice(0, 2).map((ex, j) => (
                      <span key={j} className="text-[11px] text-gray-400 truncate" title={ex}>
                        {ex}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rules.length > 15 && (
        <div className="px-6 py-3 border-t border-gray-50 flex items-center justify-between bg-gray-50/30">
          <span className="text-xs text-gray-400">{rules.length - 15} règles supplémentaires</span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            {expanded ? "Réduire ↑" : `Afficher tout (${rules.length}) ↓`}
          </button>
        </div>
      )}
    </div>
  );
}

function ConflictsPanel({ conflicts }: { conflicts: ConflictEntry[] }) {
  const [open, setOpen] = useState(false);
  if (conflicts.length === 0) return null;

  return (
    <div className="bg-white border border-amber-100 rounded-xl shadow-sm overflow-hidden">
      <button
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-amber-50/30 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">⚠️</span>
          <div className="text-left">
            <div className="text-base font-bold text-amber-700">
              {fmt(conflicts.length)} conflits détectés — ignorés
            </div>
            <div className="text-xs text-amber-500 mt-0.5">
              Ces clés normalisées mappent vers plusieurs catégories différentes dans les sources high-confidence.
              Aucune règle n'a été appliquée pour éviter une mauvaise catégorisation.
            </div>
          </div>
        </div>
        <span className="text-amber-400 font-mono text-lg">{open ? "↑" : "↓"}</span>
      </button>

      {open && (
        <div className="border-t border-amber-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-amber-50 bg-amber-50/30 text-[11px] font-semibold text-amber-400 uppercase tracking-widest">
                <th className="px-4 py-3 text-left">Clé normalisée</th>
                <th className="px-4 py-3 text-left">Catégories en conflit</th>
                <th className="px-4 py-3 text-left">Exemple libellé</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-50">
              {conflicts.map((c, i) => (
                <tr key={i} className="hover:bg-amber-50/20">
                  <td className="px-4 py-3 font-mono text-[11px] text-gray-600 max-w-[200px] truncate">
                    {c.normalizedKey}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {c.candidates.map((cand, j) => (
                        <span key={j} className="text-[10px] rounded-full px-2 py-0.5 font-semibold" style={{ backgroundColor: categoryColor(cand.category) + "20", color: categoryColor(cand.category) }}>
                          {categoryLabel(cand.category)} ({cand.count})
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[11px] text-gray-400 max-w-[200px] truncate">
                    {c.examples[0] ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AppliedPanel({ transactions, dryRun }: { transactions: PropagationResult["appliedTransactions"]; dryRun: boolean }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  if (transactions.length === 0) return null;

  const filtered = filter
    ? transactions.filter(
        (t) =>
          t.description.toLowerCase().includes(filter.toLowerCase()) ||
          t.category.toLowerCase().includes(filter.toLowerCase())
      )
    : transactions;

  const byCategory = transactions.reduce<Record<string, number>>((acc, t) => {
    acc[t.category] = (acc[t.category] ?? 0) + 1;
    return acc;
  }, {});

  const categoryEntries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

  return (
    <div className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <button
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">{dryRun ? "🔍" : "✅"}</span>
          <div className="text-left">
            <div className="text-base font-bold text-gray-800">
              {dryRun ? "Aperçu : " : ""}{fmt(transactions.length)} transactions {dryRun ? "seraient" : "ont été"} catégorisées
            </div>
            <div className="text-xs text-gray-400 mt-0.5">
              {dryRun ? "Aucune modification en base de données — c'est une simulation." : "Modifications appliquées. Source : rule_propagation, confidence : high."}
            </div>
          </div>
        </div>
        <span className="text-gray-400 font-mono text-lg">{open ? "↑" : "↓"}</span>
      </button>

      {open && (
        <div className="border-t border-gray-100">
          {/* Category breakdown */}
          <div className="px-6 py-4 border-b border-gray-50 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {categoryEntries.map(([cat, count]) => (
              <div key={cat} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <Badge text={categoryLabel(cat)} color={categoryColor(cat)} />
                  <span className="font-semibold text-gray-700">{count}</span>
                </div>
                <ProgressBar value={count} max={categoryEntries[0][1]} color={categoryColor(cat)} height={5} />
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="px-6 py-3 border-b border-gray-50">
            <input
              type="text"
              placeholder="Filtrer par libellé ou catégorie..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full text-sm rounded-lg border border-gray-200 px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-300"
            />
          </div>

          {/* Table */}
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-gray-50 text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
                  <th className="px-4 py-3 text-left">Libellé brut</th>
                  <th className="px-4 py-3 text-left">Clé normalisée</th>
                  <th className="px-4 py-3 text-left">Catégorie assignée</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.slice(0, 200).map((tx, i) => (
                  <tr key={i} className="hover:bg-gray-50/50">
                    <td className="px-4 py-2.5 max-w-[260px] truncate text-gray-700" title={tx.description}>
                      {tx.description}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-gray-400 max-w-[200px] truncate">
                      {tx.normalizedKey}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge text={categoryLabel(tx.category)} color={categoryColor(tx.category)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 200 && (
              <div className="px-4 py-3 text-xs text-gray-400 text-center border-t border-gray-50">
                {fmt(filtered.length - 200)} lignes supplémentaires non affichées — appliquez pour tout voir dans la vue principale.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

type Phase = "idle" | "loading" | "previewed" | "applying" | "applied";

export default function PropagationClient({
  initialSourcesHigh,
  initialSourcesMedium,
  initialUncategorized,
  initialCategorized,
}: {
  initialSourcesHigh: number;
  initialSourcesMedium: number;
  initialUncategorized: number;
  initialCategorized: number;
}) {
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<PropagationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const totalTx = initialSourcesHigh + initialSourcesMedium + initialUncategorized + initialCategorized;
  const categorizedPct = pct(initialCategorized + initialSourcesHigh + initialSourcesMedium, totalTx);

  async function runPropagation(dryRun: boolean) {
    setPhase(dryRun ? "loading" : "applying");
    setError(null);

    const body: PropagationParams = { ...params, dryRun };

    try {
      const res = await fetch("/api/rule-propagation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(`Erreur serveur ${res.status}: ${msg}`);
      }

      const data: PropagationResult = await res.json();
      setResult(data);
      setPhase(dryRun ? "previewed" : "applied");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("idle");
    }
  }

  function reset() {
    setPhase("idle");
    setResult(null);
    setError(null);
  }

  const isRunning = phase === "loading" || phase === "applying";
  const canApply = phase === "previewed" && result !== null && result.stats.matchesFound > 0;

  return (
    <div className="flex flex-col gap-8">

      {/* ── DATABASE STATE ────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">État actuel de la base</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon="🟢" label="High-confidence" value={initialSourcesHigh} sub="Disponibles comme sources wave 1" color="#10b981" />
          <StatCard icon="🟡" label="Medium-confidence" value={initialSourcesMedium} sub="Disponibles si activé" color="#f59e0b" />
          <StatCard icon="⬜" label="Non catégorisées" value={initialUncategorized} sub="Cibles de la propagation" color="#6366f1" />
          <StatCard
            icon="📈"
            label="Taux de catégorisation"
            value={`${categorizedPct}%`}
            sub={`${fmt(initialCategorized + initialSourcesHigh + initialSourcesMedium)} / ${fmt(totalTx)} transactions`}
            color="#8b5cf6"
          />
        </div>
        {/* Global progress bar */}
        <div className="mt-3 bg-white border border-gray-100 rounded-xl p-4 shadow-sm flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Catégorisées</span>
            <span className="font-semibold">{categorizedPct}% ({fmt(initialCategorized + initialSourcesHigh + initialSourcesMedium)})</span>
          </div>
          <div className="relative h-3 rounded-full overflow-hidden bg-gray-100 flex">
            {/* Manual / high */}
            <div
              style={{ width: `${pct(initialSourcesHigh, totalTx)}%`, backgroundColor: "#10b981" }}
              title={`High-confidence : ${initialSourcesHigh}`}
            />
            {/* Medium */}
            <div
              style={{ width: `${pct(initialSourcesMedium, totalTx)}%`, backgroundColor: "#f59e0b" }}
              title={`Medium-confidence : ${initialSourcesMedium}`}
            />
            {/* Other categorized */}
            <div
              style={{ width: `${pct(initialCategorized, totalTx)}%`, backgroundColor: "#c7d2fe" }}
              title={`Autres catégorisées : ${initialCategorized}`}
            />
            {/* Uncategorized = remainder */}
          </div>
          <div className="flex items-center gap-4 text-[10px] text-gray-400 flex-wrap">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: "#10b981" }} />High-conf ({fmt(initialSourcesHigh)})</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: "#f59e0b" }} />Medium-conf ({fmt(initialSourcesMedium)})</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ backgroundColor: "#c7d2fe" }} />Autres catégorisées ({fmt(initialCategorized)})</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm inline-block bg-gray-100" />Non catégorisées ({fmt(initialUncategorized)})</span>
          </div>
        </div>
      </section>

      {/* ── PARAMETERS ───────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest mb-3">Paramètres de la vague 1</h2>
        <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm grid grid-cols-1 gap-8 sm:grid-cols-2">

          <RadioGroup
            label="Confiance source"
            description="Quelles transactions high-confidence utiliser comme référence pour construire les règles."
            value={params.sourceConfidence}
            onChange={(v) => { setParams((p) => ({ ...p, sourceConfidence: v })); reset(); }}
            options={[
              { value: "high", label: "High uniquement", desc: "Transactions manuelles + LLM haute confiance. Règles très fiables, couverture moindre." },
              { value: "high_medium", label: "High + Medium", desc: "Inclut les transactions LLM medium-confidence. Plus de règles, risque légèrement supérieur." },
            ]}
          />

          <RadioGroup
            label="Niveau de normalisation"
            description="Détermine comment les libellés sont normalisés avant comparaison. Plus agressif = plus de matchs, plus de risque de faux positifs."
            value={params.normalization}
            onChange={(v) => { setParams((p) => ({ ...p, normalization: v })); reset(); }}
            options={[
              { value: "minimal", label: "Minimal", desc: "Uniquement lowercase + espaces normalisés. Zéro risque de faux positif, couverture très limitée." },
              { value: "standard", label: "Standard (recommandé)", desc: "Supprime les suffixes *REF, les numéros de carte ****1234, les dates embarquées et la ponctuation." },
              { value: "aggressive", label: "Agressif", desc: "Standard + suppression des mots bancaires génériques (VIR, CB, PRLV), des montants et petits nombres. Couverture maximale." },
            ]}
          />

          <div className="flex flex-col gap-3">
            <div>
              <div className="text-sm font-semibold text-gray-700">Occurrences minimum dans les sources</div>
              <div className="text-xs text-gray-400 mt-0.5">
                Ignorer une règle si la clé normalisée n'apparaît que N fois dans les sources high-confidence.
                Valeur 1 = toutes les règles. Valeur 3 = seulement les patterns récurrents.
              </div>
            </div>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={params.minSourceCount}
                onChange={(e) => { setParams((p) => ({ ...p, minSourceCount: Number(e.target.value) })); reset(); }}
                className="flex-1 accent-indigo-600"
              />
              <div className="w-10 text-center">
                <span className="text-xl font-bold text-indigo-600">{params.minSourceCount}</span>
              </div>
            </div>
            <div className="flex justify-between text-[10px] text-gray-300">
              <span>1 — toutes les règles</span>
              <span>5 — patterns récurrents</span>
              <span>10 — très récurrents</span>
            </div>
          </div>

          <RadioGroup
            label="Résolution des conflits"
            description="Que faire quand une même clé normalisée mappe vers plusieurs catégories différentes dans les sources."
            value={params.conflictResolution}
            onChange={(v) => { setParams((p) => ({ ...p, conflictResolution: v })); reset(); }}
            options={[
              { value: "skip", label: "Ignorer (prudent)", desc: "Ne pas catégoriser les transactions ambiguës. Affiche les conflits pour résolution manuelle." },
              { value: "majority", label: "Vote majoritaire", desc: "Prendre la catégorie la plus fréquente. Appliqué seulement si une catégorie est clairement majoritaire." },
            ]}
          />
        </div>
      </section>

      {/* ── ACTIONS ──────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
            <span className="font-semibold">Erreur : </span>{error}
          </div>
        )}

        {phase === "idle" && (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => runPropagation(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-sm px-8 py-4 transition-colors shadow-md shadow-indigo-200"
            >
              <span>🔍</span> Lancer la prévisualisation
            </button>
            <p className="text-xs text-gray-400">Aucune modification en base — simulation complète avec rapport détaillé.</p>
          </div>
        )}

        {isRunning && (
          <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-xl px-6 py-4">
            <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin shrink-0" />
            <div>
              <div className="text-sm font-semibold text-indigo-700">
                {phase === "loading" ? "Analyse en cours..." : "Application en cours..."}
              </div>
              <div className="text-xs text-indigo-400 mt-0.5">
                {phase === "loading"
                  ? "Construction des règles, matching des cibles, calcul des conflits."
                  : "Écriture en base de données, revalidation des caches."}
              </div>
            </div>
          </div>
        )}

        {phase === "previewed" && result && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => runPropagation(false)}
              disabled={!canApply}
              className={`inline-flex items-center gap-2 rounded-xl font-semibold text-sm px-8 py-4 transition-colors shadow-md ${
                canApply
                  ? "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-emerald-200"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed shadow-none"
              }`}
            >
              <span>✅</span>
              Appliquer {fmt(result.stats.matchesFound)} catégorisations
            </button>
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 font-semibold text-sm px-6 py-4 transition-colors"
            >
              ↺ Modifier les paramètres
            </button>
            {result.stats.matchesFound === 0 && (
              <span className="text-sm text-gray-500">Aucun match trouvé avec ces paramètres — essayez un niveau de normalisation plus agressif.</span>
            )}
          </div>
        )}

        {phase === "applied" && (
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-5 py-3">
              <span className="text-emerald-600 text-lg">✅</span>
              <span className="text-sm font-semibold text-emerald-700">
                {fmt(result?.stats.applied ?? 0)} transactions catégorisées avec succès
              </span>
            </div>
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 font-semibold text-sm px-6 py-3 transition-colors"
            >
              ↺ Nouvelle vague
            </button>
          </div>
        )}
      </section>

      {/* ── RESULTS ──────────────────────────────────────────────────── */}
      {result && (
        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-widest">
            Résultats {result.params.dryRun ? "— Prévisualisation" : "— Appliqués"}
          </h2>

          <SummaryStats result={result} prevUncategorized={initialUncategorized} />

          {result.rules.length > 0 && <RulesTable rules={result.rules} />}

          <AppliedPanel transactions={result.appliedTransactions} dryRun={result.params.dryRun} />

          <ConflictsPanel conflicts={result.conflicts} />
        </section>
      )}
    </div>
  );
}
