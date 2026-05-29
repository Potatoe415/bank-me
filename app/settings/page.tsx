import { cookies } from "next/headers";
import db from "@/lib/db";
import { disconnectBank } from "@/app/actions";
import { getBankById } from "@/lib/banks.config";
import { buildEditableTaxonomy } from "@/lib/taxonomy";
import { COLUMN_PREFS_COOKIE, parseHiddenColumns } from "@/lib/column-prefs";
import CategoriesTab from "./CategoriesTab";
import ColumnsTab from "./ColumnsTab";
import DisconnectButton from "./DisconnectButton";
import MaintenancePromptBox from "./MaintenancePromptBox";

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

type SearchParamsInput = Record<string, string | string[] | undefined>;

type PageProps = {
  searchParams: Promise<SearchParamsInput>;
};

type TabId = "connections" | "categories" | "columns" | "provider" | "maintenance" | "guide" | "sql";

type SqlRow = Record<string, unknown>;

type SqlPreviewResult = {
  changes: number | null;
  columns: string[];
  error: string | null;
  isReadOnly: boolean;
  lastInsertRowid: bigint | number | string | null;
  mode: "admin" | "readonly";
  query: string;
  rows: SqlRow[];
  rowCount: number;
  statementCount: number;
  statementSummaries: Array<{
    changes: number | null;
    index: number;
    isReadOnly: boolean;
    lastInsertRowid: bigint | number | string | null;
    rowCount: number;
    statement: string;
    statementType: string;
    truncated: boolean;
  }>;
  statementType: string;
  truncated: boolean;
};

const SQL_PREVIEW_LIMIT = 200;
const SQL_READ_ONLY_START = /^(SELECT|WITH|PRAGMA|EXPLAIN)\b/i;
const SQL_MUTATING_KEYWORDS = /\b(INSERT|UPDATE|DELETE|ALTER|DROP|CREATE|REPLACE|TRUNCATE)\b/i;
const SQL_ALWAYS_BLOCKED_KEYWORDS =
  /\b(ATTACH|DETACH|VACUUM|REINDEX|ANALYZE|BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)\b/i;

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

function firstString(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function getCurrentTab(rawValue: string | undefined): TabId {
  switch (rawValue) {
    case "categories":
    case "columns":
    case "provider":
    case "maintenance":
    case "guide":
    case "sql":
      return rawValue;
    default:
      return "connections";
  }
}

function fmtDate(iso: string | null) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-US", {
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

function normalizeSqlQuery(rawValue: string | undefined) {
  if (!rawValue) return "";
  return rawValue.trim();
}

function splitSqlStatements(query: string) {
  const statements: string[] = [];
  let current = "";
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let index = 0; index < query.length; index += 1) {
    const char = query[index];
    const nextChar = query[index + 1];

    if (inLineComment) {
      current += char;
      if (char === "\n") {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      current += char;
      if (char === "*" && nextChar === "/") {
        current += nextChar;
        index += 1;
        inBlockComment = false;
      }
      continue;
    }

    if (!inSingleQuote && !inDoubleQuote) {
      if (char === "-" && nextChar === "-") {
        current += char + nextChar;
        index += 1;
        inLineComment = true;
        continue;
      }

      if (char === "/" && nextChar === "*") {
        current += char + nextChar;
        index += 1;
        inBlockComment = true;
        continue;
      }
    }

    if (char === "'" && !inDoubleQuote) {
      current += char;
      if (nextChar === "'") {
        current += nextChar;
        index += 1;
      } else {
        inSingleQuote = !inSingleQuote;
      }
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      current += char;
      if (nextChar === '"') {
        current += nextChar;
        index += 1;
      } else {
        inDoubleQuote = !inDoubleQuote;
      }
      continue;
    }

    if (char === ";" && !inSingleQuote && !inDoubleQuote) {
      const trimmed = current.trim();
      if (trimmed) {
        statements.push(trimmed);
      }
      current = "";
      continue;
    }

    current += char;
  }

  const trailing = current.trim();
  if (trailing) {
    statements.push(trailing);
  }

  return statements;
}

function isAdminMode(rawValue: string | undefined) {
  return rawValue === "1";
}

function executeSqlPreview(query: string | undefined, adminMode: boolean): SqlPreviewResult | null {
  const normalized = normalizeSqlQuery(query);
  if (!normalized) return null;

  const statements = splitSqlStatements(normalized);
  if (statements.length === 0) {
    return null;
  }

  if (!adminMode && statements.length > 1) {
    return {
      changes: null,
      columns: [],
      error: "Only a single SQL statement is allowed until Admin mode is enabled.",
      isReadOnly: true,
      lastInsertRowid: null,
      mode: "readonly",
      query: normalized,
      rows: [],
      rowCount: 0,
      statementCount: statements.length,
      statementSummaries: [],
      statementType: "MULTI",
      truncated: false,
    };
  }

  const firstCompact = statements[0].replace(/\s+/g, " ");
  const firstStatementType = firstCompact.split(" ")[0]?.toUpperCase() ?? "UNKNOWN";

  for (const statementText of statements) {
    const compact = statementText.replace(/\s+/g, " ");
    if (SQL_ALWAYS_BLOCKED_KEYWORDS.test(compact)) {
      return {
        changes: null,
        columns: [],
        error: "This SQL workspace blocks ATTACH, DETACH, VACUUM, REINDEX, ANALYZE, and transaction-control statements.",
        isReadOnly: true,
        lastInsertRowid: null,
        mode: adminMode ? "admin" : "readonly",
        query: normalized,
        rows: [],
        rowCount: 0,
        statementCount: statements.length,
        statementSummaries: [],
        statementType: firstStatementType,
        truncated: false,
      };
    }
  }

  if (!adminMode && !SQL_READ_ONLY_START.test(firstCompact)) {
    return {
      changes: null,
      columns: [],
      error: "Only read-only SELECT, WITH, PRAGMA, and EXPLAIN queries are allowed until Admin mode is enabled.",
      isReadOnly: true,
      lastInsertRowid: null,
      mode: "readonly",
      query: normalized,
      rows: [],
      rowCount: 0,
      statementCount: statements.length,
      statementSummaries: [],
      statementType: firstStatementType,
      truncated: false,
    };
  }

  try {
    let previewRows: SqlRow[] = [];
    let previewColumns: string[] = [];
    let previewRowCount = 0;
    let previewTruncated = false;
    let aggregateChanges: number | null = 0;
    let lastInsertRowid: bigint | number | string | null = null;
    let hasReadOnlyStatement = false;
    const statementSummaries: SqlPreviewResult["statementSummaries"] = [];

    for (let index = 0; index < statements.length; index += 1) {
      const statementText = statements[index];
      const compact = statementText.replace(/\s+/g, " ");

      if (!adminMode && SQL_MUTATING_KEYWORDS.test(compact)) {
        return {
          changes: null,
          columns: [],
          error: "Mutating SQL keywords are blocked until Admin mode is enabled.",
          isReadOnly: true,
          lastInsertRowid: null,
          mode: "readonly",
          query: normalized,
          rows: [],
          rowCount: 0,
          statementCount: statements.length,
          statementSummaries: [],
          statementType: firstStatementType,
          truncated: false,
        };
      }

      const statement = db.prepare(statementText);
      const statementType = compact.split(" ")[0]?.toUpperCase() ?? "UNKNOWN";
      const columns = statement.columns().map((column) => column.name);

      if (statement.reader) {
        const rows = statement.all() as SqlRow[];
        const truncated = rows.length > SQL_PREVIEW_LIMIT;
        hasReadOnlyStatement = true;
        previewRows = rows.slice(0, SQL_PREVIEW_LIMIT);
        previewColumns = columns;
        previewRowCount = rows.length;
        previewTruncated = truncated;
        statementSummaries.push({
          changes: null,
          index: index + 1,
          isReadOnly: true,
          lastInsertRowid: null,
          rowCount: rows.length,
          statement: statementText,
          statementType,
          truncated,
        });
        continue;
      }

      const runResult = statement.run();
      aggregateChanges = (aggregateChanges ?? 0) + runResult.changes;
      lastInsertRowid = runResult.lastInsertRowid;
      statementSummaries.push({
        changes: runResult.changes,
        index: index + 1,
        isReadOnly: false,
        lastInsertRowid: runResult.lastInsertRowid,
        rowCount: 0,
        statement: statementText,
        statementType,
        truncated: false,
      });
    }

    return {
      changes: hasReadOnlyStatement ? null : aggregateChanges,
      columns: previewColumns,
      error: null,
      isReadOnly: hasReadOnlyStatement,
      lastInsertRowid,
      mode: adminMode ? "admin" : "readonly",
      query: normalized,
      rows: previewRows,
      rowCount: previewRowCount,
      statementCount: statements.length,
      statementSummaries,
      statementType: statements.length > 1 ? "MULTI" : firstStatementType,
      truncated: previewTruncated,
    };
  } catch (error) {
    return {
      changes: null,
      columns: [],
      error: error instanceof Error ? error.message : "Unknown SQL error.",
      isReadOnly: !adminMode || SQL_READ_ONLY_START.test(firstCompact),
      lastInsertRowid: null,
      mode: adminMode ? "admin" : "readonly",
      query: normalized,
      rows: [],
      rowCount: 0,
      statementCount: statements.length,
      statementSummaries: [],
      statementType: firstStatementType,
      truncated: false,
    };
  }
}

function formatSqlValue(value: unknown) {
  if (value === null) {
    return <span className="font-medium text-slate-400">NULL</span>;
  }

  if (value === undefined) {
    return <span className="font-medium text-slate-400">undefined</span>;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (value instanceof Uint8Array) {
    return `<binary ${value.byteLength} bytes>`;
  }

  return JSON.stringify(value);
}

export default async function SettingsPage({ searchParams }: PageProps) {
  const rawParams = await searchParams;
  const currentTab = getCurrentTab(firstString(rawParams.tab));
  const cookieStore = await cookies();
  const hiddenColumns = [...parseHiddenColumns(cookieStore.get(COLUMN_PREFS_COOKIE)?.value)];
  const sqlAdminMode = isAdminMode(firstString(rawParams.admin));
  const sqlPreview = currentTab === "sql" ? executeSqlPreview(firstString(rawParams.sql), sqlAdminMode) : null;

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

  const taxonomyRows = db
    .prepare("SELECT category FROM taxonomy_entries ORDER BY category COLLATE NOCASE ASC")
    .all() as Array<{ category: string | null }>;
  const taxonomy = buildEditableTaxonomy(taxonomyRows);

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "connections", label: "Connections" },
    { id: "categories", label: "Categories" },
    { id: "columns", label: "Columns" },
    { id: "provider", label: "Enable Banking" },
    { id: "maintenance", label: "Maintenance" },
    { id: "guide", label: "Guide" },
    { id: "sql", label: "SQL" },
  ];

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
                Workspace settings
              </h1>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Manage bank connections, taxonomy, provider setup, and maintenance workflows from one place.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[420px]">
              <div className="rounded-2xl border border-slate-200/80 bg-white/85 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Active sessions
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{activeSessions}</p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white/85 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Tracked banks
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-900">{trackedBanks}</p>
              </div>
              <div className="rounded-2xl border border-slate-200/80 bg-white/85 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Callback
                </p>
                <p className="mt-2 text-sm font-medium text-slate-900">
                  {isTunnel ? "HTTPS tunnel" : appUrl.startsWith("https://") ? "Direct HTTPS" : "Local HTTP"}
                </p>
              </div>
            </div>
          </div>
        </section>

        <nav className="overflow-x-auto rounded-[24px] border border-white/70 bg-white/85 p-2 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.35)] backdrop-blur">
          <div className="flex min-w-max gap-2">
            {tabs.map((tab) => {
              const isActive = tab.id === currentTab;
              return (
                <a
                  key={tab.id}
                  href={`/settings?tab=${tab.id}`}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  {tab.label}
                </a>
              );
            })}
          </div>
        </nav>

        {currentTab === "connections" && (
          <Section title="Connected banks">
            {sessions.length === 0 ? (
              <div className="rounded-[24px] border border-dashed border-slate-300 bg-white/70 px-6 py-10 text-center text-sm text-slate-500">
                No bank configured yet.
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
                    ? "OAuth pending"
                    : expired
                      ? "Session expired"
                      : accountUids.length === 0
                        ? "No accounts"
                        : "Connected";
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
                        <Row label="Accounts">
                          {accountUids.length === 0 ? (
                            <span className="font-medium text-amber-600">No account UID returned</span>
                          ) : (
                            <span>
                              {accountUids.length} account{accountUids.length === 1 ? "" : "s"}
                            </span>
                          )}
                        </Row>
                        <Row label="Expiration">
                          <span className={days !== null && days < 7 ? "font-medium text-amber-600" : ""}>
                            {fmtDate(session.expires_at)}
                            {days !== null && (
                              <span className="ml-2 text-xs text-slate-400">
                                ({days > 0 ? `in ${days} day${days === 1 ? "" : "s"}` : "expired"})
                              </span>
                            )}
                          </span>
                        </Row>
                        <Row label="Connected on">{fmtDate(session.created_at)}</Row>
                        <Row label="Transactions">
                          {tx ? (
                            <>
                              {tx.count} - latest on {fmtDate(tx.last_date)}
                            </>
                          ) : (
                            <span className="text-slate-400">None yet - synchronize first</span>
                          )}
                        </Row>
                        <Row label="Balances updated">
                          {lastBalance ? fmtDate(lastBalance) : <span className="text-slate-400">Never - synchronize first</span>}
                        </Row>
                      </div>

                      <div className="flex items-center gap-3 bg-slate-50/80 px-5 py-4">
                        <a
                          href={`/api/connect?bank=${bankId}`}
                          className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100"
                        >
                          Reconnect
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
        )}

        {currentTab === "categories" && (
          <Section title="Category manager">
            <CategoriesTab taxonomy={taxonomy} />
          </Section>
        )}

        {currentTab === "columns" && (
          <Section title="Displayed columns">
            <ColumnsTab initialHidden={hiddenColumns} />
          </Section>
        )}

        {currentTab === "provider" && (
          <Section title="Enable Banking">
            <Card>
              <div className="divide-y divide-slate-100">
                <Row label="APP_ID">
                  <span className="font-mono text-xs">
                    {appId ? `${appId.slice(0, 8)}...${appId.slice(-4)}` : <span className="text-red-500">Missing</span>}
                  </span>
                </Row>
                <Row label="RS256 private key">
                  <StatusBadge ok={hasKey} label={hasKey ? "Present" : "Missing"} />
                </Row>
                <Row label="Public callback URL">
                  <span className="font-mono text-xs">{appUrl}</span>
                </Row>
                <Row label="URL type">
                  {isTunnel ? (
                    <StatusBadge ok={true} label="HTTPS tunnel (OAuth ready)" />
                  ) : appUrl.startsWith("https://") ? (
                    <StatusBadge ok={true} label="HTTPS (OAuth ready)" />
                  ) : (
                    <StatusBadge ok={false} label="Local HTTP (OAuth blocked)" />
                  )}
                </Row>
              </div>
            </Card>
          </Section>
        )}

        {currentTab === "maintenance" && (
          <Section title="Maintenance prompt">
            <MaintenancePromptBox />
          </Section>
        )}

        {currentTab === "guide" && (
          <Section title="Guide">
            <div className="grid gap-4 lg:grid-cols-2">
              <InfoBlock
                title="When is the tunnel required?"
                color="indigo"
                items={[
                  "Only for the initial bank connection and later reauthorization flows.",
                  "Enable Banking requires an HTTPS callback URL, so plain localhost does not work for OAuth.",
                  "Run: cloudflared tunnel --url http://localhost:3000",
                  "Copy the tunnel URL into NEXT_PUBLIC_APP_URL in .env.local, then restart the dev server.",
                  "After the connection is active, the tunnel is no longer required for browsing or synchronization.",
                ]}
              />
              <InfoBlock
                title="When should you reauthorize?"
                color="amber"
                items={[
                  "When the session expires, usually about 89 days after the original connection.",
                  "When the status becomes Session expired or No accounts.",
                  "When synchronization fails with a 401 or 403 error.",
                  "Flow: restart the tunnel -> Settings -> Reconnect -> complete OAuth again.",
                ]}
              />
              <InfoBlock
                title="How to handle American Express"
                color="gray"
                items={[
                  "Connect American Express as its own bank feed through Enable Banking.",
                  "This keeps the original merchant detail on card transactions instead of relying on the repayment debit from another bank.",
                  "Categorize the repayment movement between your primary bank and American Express exactly as Internal Transfer.",
                  "With that rule, the repayment stays out of visible totals and spending analytics even if only one side of the transfer has synchronized.",
                  "In practice, keep the Amex purchases as the real spend and neutralize only the settlement transfer between accounts.",
                ]}
              />
              <InfoBlock
                title="Add a new bank"
                color="gray"
                items={[
                  "Enable the bank in the Enable Banking portal under your application's ASPSPs list.",
                  "Add the HTTPS callback URL in the Enable Banking application settings.",
                  "Start the tunnel, update .env.local, and restart the server.",
                  "Open Add bank, choose the bank, and complete the OAuth flow.",
                  "On the bank consent page, explicitly select the accounts to share.",
                ]}
              />
              <InfoBlock
                title="Important files"
                color="gray"
                items={[
                  ".env.local - Enable Banking credentials, never commit it.",
                  "data.db - local SQLite database for transactions, sessions, and balances.",
                  "lib/banks.config.ts - supported bank registry.",
                  "MAGNUM.md - technical knowledge base for the project.",
                ]}
              />
            </div>
          </Section>
        )}

        {currentTab === "sql" && (
          <Section title="SQL workspace">
            <div className="space-y-5">
              <Card>
                <form method="GET" className="space-y-4 p-5 sm:p-6">
                  <input type="hidden" name="tab" value="sql" />
                  <div className="space-y-2">
                    <label htmlFor="sql" className="text-sm font-semibold text-slate-900">
                      SQL query
                    </label>
                    <p className="text-sm leading-6 text-slate-500">
                      Run a single statement against <span className="font-mono">data.db</span>. Read-only mode accepts
                      <span className="font-mono"> SELECT</span>, <span className="font-mono"> WITH</span>,
                      <span className="font-mono"> PRAGMA</span>, and <span className="font-mono"> EXPLAIN</span>. Admin mode
                      also allows multiple statements and mutating statements like <span className="font-mono">UPDATE</span>
                      and <span className="font-mono">DELETE</span>.
                    </p>
                    <textarea
                      id="sql"
                      name="sql"
                      rows={8}
                      defaultValue={sqlPreview?.query ?? "SELECT * FROM transactions ORDER BY date DESC LIMIT 25"}
                      className="w-full rounded-[24px] border border-slate-200 bg-slate-950 px-4 py-3 font-mono text-sm text-slate-100 shadow-inner outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                      spellCheck={false}
                    />
                  </div>

                  <label className="flex items-start gap-3 rounded-[20px] border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-900">
                    <input
                      type="checkbox"
                      name="admin"
                      value="1"
                      defaultChecked={sqlAdminMode}
                      className="mt-1 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-200"
                    />
                    <span>
                      <span className="block font-semibold">Admin mode</span>
                      <span className="block text-amber-800/90">
                        Allows single-statement writes to the local SQLite database. Use with care.
                      </span>
                    </span>
                  </label>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                    >
                      Run query
                    </button>
                    <a
                      href="/settings?tab=sql"
                      className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                    >
                      Clear
                    </a>
                    <span className="text-xs uppercase tracking-[0.18em] text-slate-400">
                      Read previews capped at {SQL_PREVIEW_LIMIT} rows
                    </span>
                  </div>
                </form>
              </Card>

              {sqlPreview && (
                <Card>
                  <div className="border-b border-slate-100 px-5 py-4 sm:px-6">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Query result</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                          {sqlPreview.error
                            ? "Execution failed"
                            : sqlPreview.isReadOnly
                              ? `${sqlPreview.rowCount} row${sqlPreview.rowCount === 1 ? "" : "s"} returned`
                              : `${sqlPreview.statementCount} statement${sqlPreview.statementCount === 1 ? "" : "s"} executed`}
                        </p>
                      </div>
                      {!sqlPreview.error && sqlPreview.isReadOnly && (
                        <StatusBadge
                          ok={true}
                          label={sqlPreview.truncated ? `Showing first ${SQL_PREVIEW_LIMIT}` : "Complete preview"}
                        />
                      )}
                      {!sqlPreview.error && !sqlPreview.isReadOnly && (
                        <StatusBadge
                          ok={true}
                          label={sqlPreview.mode === "admin" ? `${sqlPreview.statementCount} admin statements` : "Executed"}
                        />
                      )}
                    </div>
                  </div>

                  {sqlPreview.error ? (
                    <div className="px-5 py-5 sm:px-6">
                      <div className="rounded-[20px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {sqlPreview.error}
                      </div>
                    </div>
                  ) : !sqlPreview.isReadOnly ? (
                    <div className="space-y-4 px-5 py-5 sm:px-6">
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 px-4 py-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Statements</p>
                          <p className="mt-2 text-2xl font-semibold text-slate-900">{sqlPreview.statementCount}</p>
                        </div>
                        <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 px-4 py-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Total changes</p>
                          <p className="mt-2 text-2xl font-semibold text-slate-900">{sqlPreview.changes ?? 0}</p>
                        </div>
                        <div className="rounded-[20px] border border-slate-200 bg-slate-50/80 px-4 py-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Last insert rowid</p>
                          <p className="mt-2 font-mono text-sm text-slate-900">
                            {sqlPreview.lastInsertRowid === null ? "-" : String(sqlPreview.lastInsertRowid)}
                          </p>
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-[20px] border border-slate-200">
                        <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                          <thead className="bg-slate-50/80">
                            <tr>
                              <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                #
                              </th>
                              <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Type
                              </th>
                              <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Changes
                              </th>
                              <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Last insert rowid
                              </th>
                              <th className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                                Statement
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {sqlPreview.statementSummaries.map((summary) => (
                              <tr key={`${summary.index}-${summary.statementType}`}>
                                <td className="px-4 py-3 align-top text-slate-700">{summary.index}</td>
                                <td className="px-4 py-3 align-top font-mono text-slate-700">{summary.statementType}</td>
                                <td className="px-4 py-3 align-top text-slate-700">{summary.changes ?? "-"}</td>
                                <td className="px-4 py-3 align-top font-mono text-slate-700">
                                  {summary.lastInsertRowid === null ? "-" : String(summary.lastInsertRowid)}
                                </td>
                                <td className="max-w-[520px] whitespace-pre-wrap break-words px-4 py-3 align-top font-mono text-xs text-slate-600">
                                  {summary.statement}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : sqlPreview.columns.length === 0 ? (
                    <div className="px-5 py-5 text-sm text-slate-500 sm:px-6">
                      The query ran successfully but did not return tabular data.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                        <thead className="bg-slate-50/80">
                          <tr>
                            {sqlPreview.columns.map((column) => (
                              <th
                                key={column}
                                className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
                              >
                                {column}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {sqlPreview.rows.length === 0 ? (
                            <tr>
                              <td
                                colSpan={sqlPreview.columns.length}
                                className="px-4 py-8 text-center text-sm text-slate-500"
                              >
                                No rows returned.
                              </td>
                            </tr>
                          ) : (
                            sqlPreview.rows.map((row, index) => (
                              <tr key={`${index}-${sqlPreview.columns.map((column) => String(row[column] ?? "")).join("|")}`}>
                                {sqlPreview.columns.map((column) => (
                                  <td
                                    key={column}
                                    className="max-w-[320px] whitespace-pre-wrap break-words px-4 py-3 align-top text-slate-700"
                                  >
                                    {formatSqlValue(row[column])}
                                  </td>
                                ))}
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              )}
            </div>
          </Section>
        )}
      </div>
    </main>
  );
}
