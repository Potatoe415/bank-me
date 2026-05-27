import db from "@/lib/db";
import { getBankById } from "@/lib/banks.config";
import { disconnectBank } from "@/app/actions";
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
    <section className="mb-10">
      <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 px-5 py-3.5">
      <span className="text-sm text-gray-500 shrink-0">{label}</span>
      <span className="text-sm text-gray-900 text-right break-all">{children}</span>
    </div>
  );
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${
      ok ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
         : "bg-red-50 text-red-700 border border-red-200"
    }`}>
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-red-400"}`} />
      {label}
    </span>
  );
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
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
    .prepare("SELECT bank_id, COUNT(*) as count, MAX(date) as last_date FROM transactions WHERE archived_at IS NULL GROUP BY bank_id")
    .all() as { bank_id: string; count: number; last_date: string }[];
  const txByBank = Object.fromEntries(txCounts.map((r) => [r.bank_id, r]));

  const balanceMetas = db
    .prepare("SELECT bank_id, MAX(updated_at) as updated_at FROM account_balances GROUP BY bank_id")
    .all() as BalanceMeta[];
  const balanceByBank = Object.fromEntries(balanceMetas.map((r) => [r.bank_id, r.updated_at]));

  const appId  = process.env.ENABLE_BANKING_APP_ID;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const hasKey = !!(process.env.ENABLE_BANKING_PRIVATE_KEY);
  const isTunnel = appUrl.includes("trycloudflare.com") || appUrl.includes("ngrok");

  return (
    <main className="px-8 py-8 max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-8">Paramètres</h1>

      {/* ── Banques connectées ─────────────────────────────────── */}
      <Section title="Banques connectées">
        {sessions.length === 0 ? (
          <p className="text-sm text-gray-500">Aucune banque configurée.</p>
        ) : (
          <div className="space-y-4">
            {sessions.map((s) => {
              const bankId   = s.provider.replace("enablebanking_", "");
              const cfg      = getBankById(bankId);
              const uids: string[] = JSON.parse(s.account_uids);
              const expired  = s.expires_at ? new Date(s.expires_at) < new Date() : false;
              const oauthDone = s.state === null;
              const days     = daysUntil(s.expires_at);
              const tx       = txByBank[bankId];
              const lastBalance = balanceByBank[bankId];

              const statusOk = oauthDone && !expired && uids.length > 0;
              const statusLabel = !oauthDone ? "En attente OAuth"
                : expired ? "Session expirée"
                : uids.length === 0 ? "Aucun compte"
                : "Connectée";

              const disconnectAction = disconnectBank.bind(null, bankId) as () => Promise<void>;

              return (
                <div key={s.provider} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  {/* Bank header */}
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      {cfg && (
                        <span
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                          style={{ backgroundColor: cfg.color }}
                        >
                          {cfg.initial}
                        </span>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{cfg?.name ?? bankId}</p>
                        <p className="text-xs text-gray-400 font-mono">{s.provider}</p>
                      </div>
                    </div>
                    <StatusBadge ok={statusOk} label={statusLabel} />
                  </div>

                  {/* Details */}
                  <div className="divide-y divide-gray-50">
                    <Row label="Session ID">
                      <span className="font-mono text-xs text-gray-600">{s.session_id}</span>
                    </Row>
                    <Row label="Comptes">
                      {uids.length === 0
                        ? <span className="text-amber-600">Aucun UID récupéré</span>
                        : <span>{uids.length} compte{uids.length > 1 ? "s" : ""}</span>}
                    </Row>
                    <Row label="Expiration">
                      <span className={days !== null && days < 7 ? "text-amber-600 font-medium" : ""}>
                        {fmtDate(s.expires_at)}
                        {days !== null && (
                          <span className="ml-2 text-xs text-gray-400">
                            ({days > 0 ? `dans ${days} j` : "expirée"})
                          </span>
                        )}
                      </span>
                    </Row>
                    <Row label="Connectée le">{fmtDate(s.created_at)}</Row>
                    <Row label="Transactions">
                      {tx
                        ? <>{tx.count} — dernière le {fmtDate(tx.last_date)}</>
                        : <span className="text-gray-400">Aucune — synchronisez</span>}
                    </Row>
                    <Row label="Soldes mis à jour">
                      {lastBalance ? fmtDate(lastBalance) : <span className="text-gray-400">Jamais — synchronisez</span>}
                    </Row>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 px-5 py-3 bg-gray-50">
                    <a
                      href={`/api/connect?bank=${bankId}`}
                      className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      Reconnecter
                    </a>
                    <span className="text-gray-300">|</span>
                    <DisconnectButton
                      action={disconnectAction}
                      bankName={cfg?.name ?? bankId}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* ── Configuration Enable Banking ──────────────────────── */}
      <Section title="Enable Banking">
        <Card>
          <Row label="APP_ID">
            <span className="font-mono text-xs">
              {appId ? `${appId.slice(0, 8)}…${appId.slice(-4)}` : <span className="text-red-500">Non défini</span>}
            </span>
          </Row>
          <Row label="Clé privée RS256">
            <StatusBadge ok={hasKey} label={hasKey ? "Présente" : "Manquante"} />
          </Row>
          <Row label="URL publique (OAuth callback)">
            <span className="font-mono text-xs break-all">{appUrl}</span>
          </Row>
          <Row label="Type d'URL">
            {isTunnel
              ? <StatusBadge ok={true} label="Tunnel HTTPS (OAuth OK)" />
              : appUrl.startsWith("https://")
              ? <StatusBadge ok={true} label="HTTPS (OAuth OK)" />
              : <StatusBadge ok={false} label="HTTP local (OAuth impossible)" />}
          </Row>
        </Card>
      </Section>

      {/* ── Guide ─────────────────────────────────────────────── */}
      <Section title="Guide d'utilisation">
        <div className="space-y-3">
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
    </main>
  );
}

function InfoBlock({
  title, items, color,
}: {
  title: string;
  items: string[];
  color: "indigo" | "amber" | "gray";
}) {
  const colors = {
    indigo: "border-indigo-200 bg-indigo-50",
    amber:  "border-amber-200  bg-amber-50",
    gray:   "border-gray-200   bg-gray-50",
  };
  const dot = {
    indigo: "bg-indigo-400",
    amber:  "bg-amber-400",
    gray:   "bg-gray-300",
  };
  return (
    <div className={`border rounded-xl px-5 py-4 ${colors[color]}`}>
      <p className="text-sm font-semibold text-gray-800 mb-2">{title}</p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${dot[color]}`} />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
