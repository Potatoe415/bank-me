# AGENTS.md — bank-me

## 1. Context Management

- Read `./tree.md` before touching any feature folder.
- Use `./tree.md` as the architecture map; verify against code when in doubt.
- Do NOT scan the full codebase — use targeted search first.
- Never open `node_modules`, `.next`, `data.db`, or lock files unless explicitly required.
- Every session is isolated. No historical summaries unless directly relevant.

## 2. This is NOT the Next.js you know

Next.js 16 App Router — APIs and conventions differ from training data.
Read `node_modules/next/dist/docs/` before writing any route, layout, or action.
Heed deprecation notices.

## 3. Execution Mode

- Concise, direct, implementation-focused.
- No broad refactors unless explicitly requested.
- No business logic changes unless explicitly requested.
- Code, variables, filenames, comments: English.
- User-facing labels: English (this is an English-language app).
- Never hardcode bank credentials or session data.

## 4. Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16.2.6 App Router |
| DB | better-sqlite3 (sync, local file `data.db`) |
| Styling | Tailwind CSS v4 (no component libraries) |
| Auth | Enable Banking PSD2 OAuth (RS256 JWT) |
| Language | TypeScript 5, React 19 |

No shadcn, no MUI, no Prisma, no ORM.

## 5. Architecture Rules

- Provider pattern: all bank API calls go through `IProvider` — never call Enable Banking directly from pages or actions.
- Adding a new bank = add one entry to `lib/banks.config.ts`. No code changes elsewhere.
- DB schema changes: use `try/catch ALTER TABLE` migrations at the bottom of `lib/db.ts`. No migration files.
- Server Actions live in `app/actions.ts`. Keep them thin — logic belongs in providers.
- Route Handlers in `app/api/*/route.ts` for OAuth redirects only.

## 6. Scope Control

- Implement only the requested task.
- Do not touch `lib/banks.config.ts` unless adding/editing a bank.
- Do not modify the OAuth flow unless explicitly asked.
- Do not change the DB schema unless the task requires new data.
- `app/api/debug/` routes are dev-only — never expose sensitive data in production.

## 7. DRY & Reuse

1. Check `./tree.md` for existing helpers, types, and providers before creating new ones.
2. Types live in `lib/providers/types.ts` — import them, don't redefine.
3. `getBankById` / `getBankByAspspName` already exist in `lib/banks.config.ts`.
4. `apiFetch` / `makeJwt` / `getSession` are internal to `enablebanking.ts` — reuse them inside the file.

## 8. Types & Validation

- `any` is forbidden.
- Canonical types: `Transaction`, `Balance`, `IProvider`, `BankConfig` — import, don't duplicate.
- Validate all Enable Banking API responses before storing (check for null booking_date, empty accounts, etc.).

## 9. Halt Rule

Stop and ask before:
- Adding a new npm dependency
- Changing the DB schema in a breaking way
- Modifying the OAuth flow or JWT signing
- Adding a new provider (non-Enable Banking)
- Touching `.env.local` structure

For UI changes, new bank entries, copy changes, new columns in the transaction table → proceed without stopping.

## 10. Output Format

When done, report:
- Files changed
- What changed
- Whether `tree.md` and `MAGNUM.md` were updated
- Anything intentionally not changed

Keep it short.

## 11. After Any Change

If you make functional, technical, structural, or DB changes → update `./MAGNUM.md` accordingly.
If you change file structure → update `./tree.md` accordingly.
