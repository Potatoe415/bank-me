import db from "@/lib/db";
import { BANKS } from "@/lib/banks.config";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

function getConnectedBankIds(): string[] {
  const rows = db
    .prepare("SELECT provider, account_uids FROM provider_tokens")
    .all() as { provider: string; account_uids: string }[];
  return rows
    .filter((r) => JSON.parse(r.account_uids).length > 0)
    .map((r) => r.provider.replace("enablebanking_", ""));
}

export default function AddBankPage() {
  const connected = getConnectedBankIds();
  const popular = BANKS.filter((b) => b.popular && !connected.includes(b.id));
  const others  = BANKS.filter((b) => !b.popular && !connected.includes(b.id));

  return (
    <main className="px-8 py-8 max-w-3xl">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Ajouter une banque</h1>
      <p className="text-sm text-gray-500 mb-8">
        Sélectionnez votre banque. Vous serez redirigé vers son interface de connexion sécurisée.
      </p>

      {popular.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Banques populaires
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {popular.map((bank) => (
              <a
                key={bank.id}
                href={`${APP_URL}/api/connect?bank=${bank.id}`}
                className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-indigo-300 hover:shadow-sm transition-all group"
              >
                <span
                  className="w-8 h-8 rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ backgroundColor: bank.color }}
                >
                  {bank.initial}
                </span>
                <span className="text-sm text-gray-700 font-medium group-hover:text-indigo-700 leading-tight">
                  {bank.name}
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Toutes les banques
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {others.map((bank) => (
              <a
                key={bank.id}
                href={`${APP_URL}/api/connect?bank=${bank.id}`}
                className="flex items-center gap-3 px-4 py-3 bg-white border border-gray-200 rounded-lg hover:border-indigo-300 hover:shadow-sm transition-all group"
              >
                <span
                  className="w-8 h-8 rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ backgroundColor: bank.color }}
                >
                  {bank.initial}
                </span>
                <span className="text-sm text-gray-700 font-medium group-hover:text-indigo-700 leading-tight">
                  {bank.name}
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      {popular.length === 0 && others.length === 0 && (
        <p className="text-gray-500 text-sm">Toutes les banques supportées sont déjà connectées.</p>
      )}
    </main>
  );
}
