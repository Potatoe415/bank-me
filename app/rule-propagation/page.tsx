import db from "@/lib/db";
import PropagationClient from "./PropagationClient";

export const metadata = {
  title: "Rule Propagation Engine - myBanks",
  description: "Propagation automatique des catégories par correspondance exacte normalisée.",
};

type CountRow = { count: number };

export default function RulePropagationPage() {
  const sourcesHigh = (
    db
      .prepare(
        `SELECT COUNT(*) as count FROM transactions
         WHERE confidence_level = 'high'
           AND category_path != 'uncategorized'
           AND is_deleted = 0`
      )
      .get() as CountRow
  ).count;

  const sourcesMedium = (
    db
      .prepare(
        `SELECT COUNT(*) as count FROM transactions
         WHERE confidence_level = 'medium'
           AND category_path != 'uncategorized'
           AND is_deleted = 0`
      )
      .get() as CountRow
  ).count;

  const uncategorized = (
    db
      .prepare(
        `SELECT COUNT(*) as count FROM transactions
         WHERE category_path = 'uncategorized'
           AND is_deleted = 0`
      )
      .get() as CountRow
  ).count;

  const otherCategorized = (
    db
      .prepare(
        `SELECT COUNT(*) as count FROM transactions
         WHERE category_path != 'uncategorized'
           AND confidence_level NOT IN ('high', 'medium')
           AND is_deleted = 0`
      )
      .get() as CountRow
  ).count;

  return (
    <div className="flex-1 min-h-screen bg-gray-50/50 px-6 py-8 max-w-5xl mx-auto w-full">

      {/* Page header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
          <span>Tools</span>
          <span>›</span>
          <span className="text-gray-600 font-medium">Rule Propagation Engine</span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Rule Propagation Engine
            </h1>
            <p className="text-sm text-gray-500 mt-1 max-w-2xl">
              Vague 1 — Correspondance exacte normalisée. Prend toutes les transactions{" "}
              <strong className="text-gray-700">high-confidence</strong> déjà catégorisées
              (manuellement ou LLM), construit des règles de normalisation sur leurs libellés,
              puis recherche les transactions non catégorisées ayant un libellé quasi-identique pour
              les catégoriser <strong className="text-gray-700">sans LLM tierce</strong>.
            </p>
          </div>
          <div className="shrink-0 rounded-xl bg-indigo-50 border border-indigo-100 px-4 py-2 flex flex-col items-center">
            <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-widest">Vague</span>
            <span className="text-3xl font-black text-indigo-600">1</span>
            <span className="text-[10px] text-indigo-400">Exact match</span>
          </div>
        </div>

        {/* Wave explanation banner */}
        <div className="mt-5 bg-white border border-gray-100 rounded-xl p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center text-sm">⚡</div>
            <div className="flex flex-col gap-1">
              <div className="text-sm font-semibold text-gray-800">Comment fonctionne la vague 1</div>
              <ol className="text-xs text-gray-500 list-decimal list-inside space-y-1 mt-1">
                <li>
                  <strong className="text-gray-700">Construction du dictionnaire</strong> — chaque transaction
                  high-confidence est normalisée (lowercase, suppression des refs carte et des dates embarquées).
                  Sa clé normalisée → catégorie forme une règle.
                </li>
                <li>
                  <strong className="text-gray-700">Résolution des conflits</strong> — si une clé normalisée
                  mappe vers plusieurs catégories différentes, la règle est soit ignorée, soit résolue par vote
                  majoritaire (configurable ci-dessous).
                </li>
                <li>
                  <strong className="text-gray-700">Application sur les cibles</strong> — chaque transaction non
                  catégorisée est normalisée de la même façon et recherchée dans le dictionnaire. Si match exact :
                  catégorie copiée, source = <code className="font-mono bg-gray-100 px-1 rounded">rule_propagation</code>,
                  confidence = <code className="font-mono bg-gray-100 px-1 rounded">high</code>.
                </li>
              </ol>
              <div className="mt-2 flex flex-wrap gap-3 text-[11px]">
                <span className="rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 font-semibold">
                  ✓ Zéro appel LLM — 100% local
                </span>
                <span className="rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-1 font-semibold">
                  ✓ Auditabilité totale — applied_rule_id traçé
                </span>
                <span className="rounded-md bg-amber-50 text-amber-700 border border-amber-100 px-2 py-1 font-semibold">
                  ⚠ Toujours prévisualiser avant d'appliquer
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <PropagationClient
        initialSourcesHigh={sourcesHigh}
        initialSourcesMedium={sourcesMedium}
        initialUncategorized={uncategorized}
        initialCategorized={otherCategorized}
      />
    </div>
  );
}
