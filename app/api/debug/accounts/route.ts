import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import db from "@/lib/db";

const APP_ID  = process.env.ENABLE_BANKING_APP_ID!;
const BASE_URL = "https://api.enablebanking.com";

function makeJwt(): string {
  const key = (process.env.ENABLE_BANKING_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  return jwt.sign(
    { iss: "enablebanking.com", aud: "api.enablebanking.com" },
    key,
    { algorithm: "RS256", keyid: APP_ID, expiresIn: 3600 }
  );
}

async function apiFetch(path: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${makeJwt()}`,
      "Content-Type": "application/json",
    },
  });
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; }
  catch { return { status: res.status, data: text }; }
}

export async function GET() {
  // 1. Get all DB sessions
  const rows = db
    .prepare("SELECT provider, session_id, account_uids, state, expires_at FROM provider_tokens")
    .all() as Array<{ provider: string; session_id: string; account_uids: string; state: string | null; expires_at: string | null }>;

  const results: Record<string, unknown> = { db_rows: rows };

  // 2. For each session, try GET /sessions/{id}
  for (const row of rows) {
    const key = row.provider;
    if (row.session_id) {
      results[`GET_sessions_${key}`] = await apiFetch(`/sessions/${row.session_id}`);
    }
  }

  // 3. Try various account discovery paths for ING session
  const ingRow = rows.find(r => r.provider === "enablebanking_ing-nl");
  if (ingRow?.session_id) {
    const sid = ingRow.session_id;
    results["GET_sessions_ing_accounts"]       = await apiFetch(`/sessions/${sid}/accounts`);
    results["GET_accounts_by_session"]         = await apiFetch(`/accounts?session_id=${sid}`);
    results["GET_accounts_no_404"]             = await apiFetch("/accounts/");
    results["GET_psd2_accounts"]               = await apiFetch("/psd2/accounts");
    results["POST_sessions_refresh"]           = await apiFetch(`/sessions/${sid}/refresh`).catch(e => String(e));
    results["GET_v2_sessions_ing"]             = await apiFetch(`/v2/sessions/${sid}`);
  }

  return NextResponse.json(results, { status: 200 });
}
