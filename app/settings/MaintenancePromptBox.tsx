"use client";

import { useState } from "react";

const PROMPT = `# Prompt de maintenance — bank-me

Tu es un assistant expert en développement web. L'utilisateur a un projet appelé **bank-me** — une application web personnelle de suivi des transactions bancaires. Tu vas l'aider à remettre à jour les connexions bancaires et à rafraîchir les données. Lis d'abord les fichiers AGENTS.md, tree.md et MAGNUM.md à la racine du projet. Voici tout ce que tu dois savoir pour démarrer.

## Ce qu'est bank-me

bank-me est une application Next.js 16 qui se connecte aux banques via le protocole PSD2 grâce à un service tiers appelé **Enable Banking** (enablebanking.com). Elle stocke les transactions dans une base SQLite locale (data.db) et permet de visualiser et catégoriser les dépenses.

Stack technique :
- Framework : Next.js 16 App Router (TypeScript)
- Base de données : SQLite via better-sqlite3 (fichier data.db à la racine)
- Auth bancaire : OAuth 2.0 via Enable Banking (JWT RS256)
- Style : Tailwind CSS v4

Fichiers clés :
- lib/banks.config.ts — liste toutes les banques supportées
- lib/providers/enablebanking.ts — toute la logique d'appel à l'API Enable Banking
- lib/db.ts — schéma SQLite et migrations
- app/actions.ts — Server Actions (syncTransactions, etc.)
- app/api/connect/route.ts — démarre le flux OAuth
- app/callback/route.ts — reçoit le callback OAuth
- .env.local — clés secrètes (ne jamais committer)
- data.db — base de données locale (ne jamais committer)

## Comment fonctionnent les connexions bancaires

1. L'app utilise Enable Banking comme intermédiaire PSD2.
2. Chaque connexion bancaire passe par un flux OAuth : l'utilisateur est redirigé vers sa banque pour donner son consentement, puis redirigé back vers l'app.
3. Enable Banking exige une URL de callback HTTPS — localhost HTTP ne fonctionne PAS pour ce flux. Il faut un tunnel HTTPS (ex : Cloudflare Tunnel).
4. Une fois connectée, la session dure environ 90 jours (voir la date d'expiration dans Paramètres).
5. Les transactions sont synchronisées manuellement depuis la barre latérale ("Synchroniser").

En base de données, la connexion est stockée dans la table provider_tokens :
- provider = enablebanking_<bankId> (ex: enablebanking_revolut)
- session_id = l'ID de session Enable Banking
- account_uids = JSON array des UIDs de comptes bancaires
- state IS NULL = OAuth terminé avec succès
- expires_at = date d'expiration de la session

## Quand doit-on reconnecter ?

- Quand la session expire (env. 90 jours après la connexion initiale)
- Quand Paramètres affiche "Session expirée" ou "Aucun compte"
- Quand la synchronisation échoue avec erreur 401/403

## Procédure pas à pas pour reconnecter une banque

### Étape 1 — Préparer le tunnel HTTPS

L'app tourne en local. Pour l'OAuth, il faut exposer le port 3000 via HTTPS.
Ouvre un terminal et lance :

  cloudflared tunnel --url http://localhost:3000

Cloudflare affiche une URL comme https://xxx-yyy-zzz.trycloudflare.com. Note cette URL.

### Étape 2 — Mettre à jour .env.local

Dans .env.local, remplace la valeur de NEXT_PUBLIC_APP_URL par l'URL du tunnel :

  NEXT_PUBLIC_APP_URL=https://xxx-yyy-zzz.trycloudflare.com

### Étape 3 — Redémarrer le serveur Next.js

Arrête le serveur (Ctrl+C) et relance :

  npm run dev

Le serveur doit être redémarré pour prendre en compte le changement d'URL.

### Étape 4 — Reconnecter la banque

1. Aller sur http://localhost:3000/settings
2. Trouver la banque à reconnecter
3. Cliquer "Reconnecter"
4. Tu seras redirigé vers la banque pour re-donner le consentement
5. Après validation, tu reviens automatiquement sur l'app
6. La session est maintenant active (statut vert "Connectée")

### Étape 5 — Synchroniser les transactions

1. Dans la barre latérale, cliquer sur la banque reconnectée
2. Cliquer "Synchroniser"
3. Les nouvelles transactions sont ajoutées à la base

### Étape 6 — Remettre .env.local en localhost (optionnel)

Une fois toutes les banques reconnectées, tu peux remettre :

  NEXT_PUBLIC_APP_URL=http://localhost:3000

et redémarrer le serveur. Le tunnel n'est plus nécessaire jusqu'à la prochaine reconnexion.

## Résolution de problèmes courants

Erreur 401/403 pendant la sync → session expirée, reconnecter la banque.

"Aucun compte" après reconnexion → bug connu d'ING NL (le portail Enable Banking doit avoir les comptes configurés). Pour les autres banques, déconnecter + reconnecter.

Callback ne revient pas → vérifier que NEXT_PUBLIC_APP_URL correspond bien à l'URL du tunnel et que le serveur a bien été redémarré après la modification.

Tunnel déconnecté en cours de route → relancer cloudflared, noter la nouvelle URL, mettre à jour .env.local, redémarrer le serveur.

La session est OK mais les transactions ne se synchronisent pas → vérifier que data.db est présent et consulter les logs du terminal Next.js.

## Rappel credentials Enable Banking

Les credentials sont dans .env.local :
- ENABLE_BANKING_APP_ID — UUID de l'application
- ENABLE_BANKING_PRIVATE_KEY — clé privée RS256 (format PEM, les sauts de ligne sont échappés avec \\n)

Ces clés se trouvent sur le portail Enable Banking : enablebanking.com → ton application.
`;

export default function MaintenancePromptBox() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select textarea
      const el = document.getElementById("maintenance-prompt") as HTMLTextAreaElement | null;
      el?.select();
    }
  }

  return (
    <div className="overflow-hidden rounded-[24px] border border-white/70 bg-white/90 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.35)] backdrop-blur">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-slate-800">Prompt de maintenance</p>
          <p className="mt-0.5 text-xs text-slate-400">
            Dans 3 mois, copie-colle ce prompt dans un LLM avec accès au dossier du projet — il te guidera pas à pas.
          </p>
        </div>
        <button
          onClick={handleCopy}
          className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${
            copied
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
          }`}
        >
          {copied ? (
            <>
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
                <path d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.75.75 0 0 1 1.06-1.06L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z" />
              </svg>
              Copié !
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
                <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z" />
                <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z" />
              </svg>
              Copier
            </>
          )}
        </button>
      </div>
      <textarea
        id="maintenance-prompt"
        readOnly
        value={PROMPT}
        className="w-full resize-none bg-slate-50/60 px-5 py-4 font-mono text-xs leading-5 text-slate-600 outline-none"
        rows={14}
      />
    </div>
  );
}
