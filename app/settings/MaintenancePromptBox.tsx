"use client";

import { useState } from "react";

const PROMPT = `# Maintenance prompt - bank-me

You are an expert web development assistant. The user has a project called **bank-me** - a personal web app for tracking bank transactions. Help them refresh bank connections and update the data. Read AGENTS.md, tree.md, and MAGNUM.md at the project root first. Here is the operating context you need.

## What bank-me is

bank-me is a Next.js 16 app connected to banks through PSD2 via **Enable Banking** (enablebanking.com). It stores transactions in a local SQLite database (data.db) and lets the user review and categorize spending.

Technical stack:
- Framework: Next.js 16 App Router (TypeScript)
- Database: SQLite via better-sqlite3 (data.db at the repo root)
- Bank auth: OAuth 2.0 via Enable Banking (RS256 JWT)
- Styling: Tailwind CSS v4

Key files:
- lib/banks.config.ts - supported bank registry
- lib/providers/enablebanking.ts - Enable Banking API integration
- lib/db.ts - SQLite schema and migrations
- app/actions.ts - Server Actions (syncTransactions, etc.)
- app/api/connect/route.ts - starts the OAuth flow
- app/callback/route.ts - receives the OAuth callback
- .env.local - secrets (never commit)
- data.db - local database (never commit)

## How bank connections work

1. The app uses Enable Banking as the PSD2 intermediary.
2. Every bank connection goes through OAuth: the user is redirected to the bank for consent, then back to the app.
3. Enable Banking requires an HTTPS callback URL. Plain localhost HTTP does not work for OAuth, so use an HTTPS tunnel such as Cloudflare Tunnel.
4. Once connected, a session lasts about 90 days.
5. Transactions are synchronized manually from the sidebar.

Database storage for a connection lives in provider_tokens:
- provider = enablebanking_<bankId> (example: enablebanking_revolut)
- session_id = Enable Banking session id
- account_uids = JSON array of account UIDs
- state IS NULL = OAuth completed successfully
- expires_at = session expiration date

## When to reconnect

- When the session expires (about 90 days after the initial connection)
- When Settings shows "Session expired" or "No accounts"
- When synchronization fails with a 401 or 403 error

## Reconnection procedure

### Step 1 - Start the HTTPS tunnel

The app runs locally. OAuth needs port 3000 exposed through HTTPS.
Run:

  cloudflared tunnel --url http://localhost:3000

Cloudflare will print a URL such as https://xxx-yyy-zzz.trycloudflare.com. Keep it.

### Step 2 - Update .env.local

Set:

  NEXT_PUBLIC_APP_URL=https://xxx-yyy-zzz.trycloudflare.com

### Step 3 - Restart Next.js

Stop the dev server and run:

  npm run dev

### Step 4 - Reconnect the bank

1. Open http://localhost:3000/settings
2. Find the bank
3. Click "Reconnect"
4. Complete the bank consent flow
5. Return to the app
6. Confirm the session is active

### Step 5 - Sync transactions

1. Open the bank in the sidebar
2. Click "Synchronize"
3. Confirm new transactions are written to the database

### Step 6 - Switch back to localhost if desired

After all reconnects are done, you can restore:

  NEXT_PUBLIC_APP_URL=http://localhost:3000

Then restart the dev server. The tunnel is not needed again until the next reconnection.

## Common troubleshooting

- 401/403 during sync -> session expired, reconnect the bank
- "No accounts" after reconnect -> known ING NL issue or incomplete consent selection
- Callback never returns -> verify NEXT_PUBLIC_APP_URL matches the tunnel URL and the dev server was restarted
- Tunnel dropped mid-flow -> restart cloudflared, update .env.local, restart Next.js
- Session is valid but sync still fails -> confirm data.db exists and inspect the Next.js terminal logs

## Enable Banking credentials reminder

.env.local contains:
- ENABLE_BANKING_APP_ID - application UUID
- ENABLE_BANKING_PRIVATE_KEY - RS256 private key in PEM form with escaped \\n line breaks

These credentials come from the Enable Banking portal.
`;

export default function MaintenancePromptBox() {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const el = document.getElementById("maintenance-prompt") as HTMLTextAreaElement | null;
      el?.select();
    }
  }

  return (
    <div className="overflow-hidden rounded-[24px] border border-white/70 bg-white/90 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.35)] backdrop-blur">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-slate-800">Maintenance prompt</p>
          <p className="mt-0.5 text-xs text-slate-400">
            Paste this into an LLM with access to the project folder for a guided refresh later.
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
              Copied
            </>
          ) : (
            <>
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="currentColor">
                <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z" />
                <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z" />
              </svg>
              Copy
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
