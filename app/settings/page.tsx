import db from "@/lib/db";
import { disconnectBank } from "@/app/actions";
import { getBankById } from "@/lib/banks.config";
import DisconnectButton from "./DisconnectButton";

type SessionRow = {
  provider: string;
  session_id: string;
  account_uids: string;
  expires_at: string | null;
  state: string | null;
  created_at: string;
};

type BalanceMeta = {
  bank_id: string;
  updated_at: string;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-gradient-to-r from-slate-200 via-slate-300 to-transparent" />
        <h2 className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[24px] border border-white/70 bg-white/90 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.35)] backdrop-blur">
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <span className="shrink-0 text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
        {label}
      </span>
      <span className="break-all text-sm text-slate-900 sm:max-w-[60%] sm:text-right">{children}</span>
    </div>
  );
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
        ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"}`} />
      {label}
    </span>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function SettingsPage() {
  const sessions = db
    .prepare("SELECT * FROM provider_tokens ORDER BY created_at DESC")
    .all() as SessionRow[];

  const txCounts = db
    .prepare(
      "SELECT bank_id, COUNT(*) as count, MAX(date) as last_date FROM transactions WHERE archived_at IS NULL GROUP BY bank_id"
    )
    .all() as { bank_id: string; count: number; last_date: string }[];
  const txByBank = Object.fromEntries(txCounts.map((row) => [row.bank_id, row]));

  const balanceMetas = db
    .prepare("SELECT bank_id, MAX(updated_at) as updated_at FROM account_balances GROUP BY bank_id")
    .all() as BalanceMeta[];
  const balanceByBank = Object.fromEntries(balanceMetas.map((row) => [row.bank_id, row.updated_at]));

  const appId = process.env.ENABLE_BANKING_APP_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const hasKey = Boolean(process.env.ENABLE_BANKING_PRIVATE_KEY);
  const isTunnel = appUrl.includes("trycloudflare.com") || appUrl.includes("ngrok");
  const activeSessions = sessions.filter((session) => {
    const expired = session.expires_at ? new Date(session.expires_at) < new Date() : false;
    const accountUids: string[] = JSON.parse(session.account_uids);
    return session.state === null && !expired && accountUids.length > 0;
  }).length;
  const trackedBanks = txCounts.length;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.14),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.12),_transparent_24%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)] px-4 py-6 sm:px-8 sm:py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <section className="overflow-hidden rounded-[32px] border border-white/70 bg-white/80 p-6 shadow-[0_24px_80px_-36px_rgba(15,23,42,0.45)] backdrop-blur sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-indigo-500">
                Settings
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Paramètres
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Vue de pilotage pour les connexions bancaires, la configuration Enable Banking et les procédures utiles au quotidien.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px]">
              <div className="rounded-2xl border border-slate-200/80 bg-white/85 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Sessions actives
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{activeSessions}</p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white/85 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Banques suivies
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{trackedBanks}</p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white/85 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Callback
                </p>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {isTunnel ? "Tunnel HTTPS" : appUrl.startsWith("https://") ? "HTTPS direct" : "HTTP local"}
                </p>
              </div>
            </div>
          </div>
        </section>

        <Section title="Banques connectées">
          {sessions.length === 0 ? (
            <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/70 px-6 py-10 text-center text-sm text-slate-500">
              Aucune banque configurée.
            </div>
          ) : (
            <div className="grid gap-5 xl:grid-cols-2">
              {sessions.map((session) => {
                const bankId = session.provider.replace("enablebanking_", "");
                const cfg = getBankById(bankId);
                const accountUids: string[] = JSON.parse(session.account_uids);
                const expired = session.expires_at ? new Date(session.expires_at) < new Date() : false;
                const oauthDone = session.state === null;
                const days = daysUntil(session.expires_at);
                const tx = txByBank[bankId];
                const lastBalance = balanceByBank[bankId];
                const statusOk = oauthDone && !expired && accountUids.length > 0;
                const statusLabel = !oauthDone
                  ? "En attente OAuth"
                  : expired
                    ? "Session expirée"
                    : accountUids.length === 0
                      ? "Aucun compte"
                      : "Connectée";
                const disconnectAction = disconnectBank.bind(null, bankId) as () => Promise<void>;

                return (
                  <div
                    key={session.provider}
                    className="overflow-hidden rounded-[28px] border border-white/75 bg-white/90 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.45)] backdrop-blur"
                  >
                    <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-3">
                        {cfg && (
                          <span
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-[10px] font-bold text-white shadow-sm"
                            style={{ backgroundColor: cfg.color }}
                          >
                            {cfg.initial}
                          </span>
                        )}
                        <div>
                          <p className="text-base font-semibold text-slate-900">{cfg?.name ?? bankId}</p>
                          <p className="font-mono text-xs text-slate-400">{session.provider}</p>
                        </div>
                      </div>
                      <StatusBadge ok={statusOk} label={statusLabel} />
                    </div>

                    <div className="divide-y divide-slate-100">
                      <Row label="Session ID">
                        <span className="font-mono text-xs text-slate-600">{session.session_id}</span>
                      </Row>
                      <Row label="Comptes">
                        {accountUids.length === 0 ? (
                          <span className="font-medium text-amber-600">Aucun UID récupéré</span>
                        ) : (
                          <span>
                            {accountUids.length} compte{accountUids.length > 1 ? "s" : ""}
                          </span>
                        )}
                      </Row>
                      <Row label="Expiration">
                        <span className={days !== null && days < 7 ? "font-medium text-amber-600" : ""}>
                          {fmtDate(session.expires_at)}
                          {days !== null && (
                            <span className="ml-2 text-xs text-slate-400">
                              ({days > 0 ? `dans ${days} j` : "expirée"})
                            </span>
                          )}
                        </span>
                      </Row>
                      <Row label="Connectée le">{fmtDate(session.created_at)}</Row>
                      <Row label="Transactions">
                        {tx ? (
                          <>
                            {tx.count} — dernière le {fmtDate(tx.last_date)}
                          </>
                        ) : (
                          <span className="text-slate-400">Aucune — synchronisez</span>
                        )}
                      </Row>
                      <Row label="Soldes mis à jour">
                        {lastBalance ? fmtDate(lastBalance) : <span className="text-slate-400">Jamais — synchronisez</span>}
                      </Row>
                    </div>

                    <div className="flex items-center gap-3 bg-slate-50/80 px-5 py-4">
                      <a
                        href={`/api/connect?bank=${bankId}`}
                        className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
                      >
                        Reconnecter
                      </a>
                      <span className="text-slate-300">|</span>
                      <DisconnectButton action={disconnectAction} bankName={cfg?.name ?? bankId} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        <Section title="Enable Banking">
          <Card>
            <div className="divide-y divide-slate-100">
              <Row label="APP_ID">
                <span className="font-mono text-xs">
                  {appId ? `${appId.slice(0, 8)}…${appId.slice(-4)}` : <span className="text-red-500">Non défini</span>}
                </span>
              </Row>
              <Row label="Clé privée RS256">
                <StatusBadge ok={hasKey} label={hasKey ? "Présente" : "Manquante"} />
              </Row>
              <Row label="URL publique (OAuth callback)">
                <span className="font-mono text-xs">{appUrl}</span>
              </Row>
              <Row label="Type d'URL">
                {isTunnel ? (
                  <StatusBadge ok={true} label="Tunnel HTTPS (OAuth OK)" />
                ) : appUrl.startsWith("https://") ? (
                  <StatusBadge ok={true} label="HTTPS (OAuth OK)" />
                ) : (
                  <StatusBadge ok={false} label="HTTP local (OAuth impossible)" />
                )}
              </Row>
            </div>
          </Card>
        </Section>

        <Section title="Guide d'utilisation">
          <div className="grid gap-4 lg:grid-cols-2">
            <InfoBlock
              title="Quand faut-il le tunnel ?"
              color="indigo"
              items={[
                "Uniquement pour la connexion initiale d'une banque (flux OAuth).",
                "Enable Banking exige une URL de callback HTTPS — localhost ne fonctionne pas.",
                "Commande : cloudflared tunnel --url http://localhost:3000",
                "Mettre l'URL du tunnel dans NEXT_PUBLIC_APP_URL dans .env.local, puis redémarrer le serveur.",
                "Une fois connecté, le tunnel n'est plus nécessaire pour naviguer ou synchroniser.",
              ]}
            />
            <InfoBlock
              title="Quand refaire l'authentification ?"
              color="amber"
              items={[
                "Quand la session expire (89 jours après connexion — voir dates ci-dessus).",
                "Quand le statut affiche « Session expirée » ou « Aucun compte ».",
                "Quand la synchronisation échoue avec une erreur 401 ou 403.",
                "Procédure : relancer le tunnel → Paramètres → Reconnecter → refaire le flux OAuth.",
              ]}
            />
            <InfoBlock
              title="Comment gérer American Express"
              color="gray"
              items={[
                "Méthode proposée : connecter American Express comme une banque séparée via Enable Banking, au même titre qu'un compte courant.",
                "Les dépenses carte sont alors lues côté American Express, ce qui donne le vrai détail marchand et évite de s'appuyer uniquement sur le débit global du compte bancaire de remboursement.",
                "Le prélèvement ou virement de remboursement entre votre banque principale et American Express doit être catégorisé exactement `Internal Transfer`.",
                "Avec cette convention, le remboursement Amex n'entre ni dans les totaux visibles ni dans les analytics de dépense, même si un seul côté du transfert a été synchronisé.",
                "En pratique : on garde les achats sur American Express comme dépenses réelles, et on neutralise uniquement le mouvement de règlement entre comptes.",
              ]}
            />
            <InfoBlock
              title="Ajouter une nouvelle banque"
              color="gray"
              items={[
                "Activer la banque dans le portail Enable Banking (enablebanking.com → votre app → ASPSPs).",
                "Ajouter l'URL de callback HTTPS dans les paramètres de l'app Enable Banking.",
                "Lancer le tunnel, mettre l'URL dans .env.local, redémarrer.",
                "Aller dans « Ajouter une banque » → sélectionner la banque → suivre le flux OAuth.",
                "Sur la page de consentement de la banque, sélectionner explicitement les comptes à partager.",
              ]}
            />
            <InfoBlock
              title="Fichiers importants"
              color="gray"
              items={[
                ".env.local — credentials Enable Banking (ne jamais committer).",
                "data.db — base SQLite locale (transactions, sessions, soldes).",
                "lib/banks.config.ts — liste de toutes les banques supportées.",
                "MAGNUM.md — documentation technique complète du projet.",
              ]}
            />
          </div>
        </Section>
      </div>
    </main>
  );
}

function InfoBlock({
  title,
  items,
  color,
}: {
  title: string;
  items: string[];
  color: "indigo" | "amber" | "gray";
}) {
  const colors = {
    indigo: "border-indigo-200/80 bg-white/85",
    amber: "border-amber-200/80 bg-white/85",
    gray: "border-slate-200/80 bg-white/85",
  };
  const dot = {
    indigo: "bg-indigo-400",
    amber: "bg-amber-400",
    gray: "bg-slate-300",
  };

  return (
    <div
      className={`rounded-[24px] border px-5 py-5 shadow-[0_16px_45px_-34px_rgba(15,23,42,0.45)] backdrop-blur ${colors[color]}`}
    >
      <p className="mb-3 text-base font-semibold text-slate-800">{title}</p>
      <ul className="space-y-1.5">
        {items.map((item, index) => (
          <li key={index} className="flex items-start gap-2.5 text-sm leading-6 text-slate-600">
            <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full ${dot[color]}`} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
