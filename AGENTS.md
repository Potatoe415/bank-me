# AGENTS.md — bank-me

Purpose: Canonical operating protocol for all agents and humans.
Status: Source of truth. All other agent files route here.
Scope: Entire repository.

---

## 1. Startup Protocol

Load files on a strict need-to-know basis.

| Condition | Load |
|---|---|
| Always | `STATE.md` |
| Task touches scope, users, features, UX, or acceptance criteria | `docs/PRODUCT.md` |
| Task touches stack, DB, security, infra, API specifics, code structure, or feature folders | `docs/TECH.md` |
| Task touches planning or prioritisation | `docs/BACKLOG.md` |
| About to reverse or modify a prior decision | `docs/DECISIONS.md` |
| Task contains: run / test / build / deploy / migrate / install | `docs/RUNBOOK.md` |
| Resuming after time away (> 1 day) | `docs/DECISIONS.md` + Recent_Changes in `STATE.md` |

Do not load `docs/DECISIONS.md` or `docs/RUNBOOK.md` by default.
Never open `node_modules`, `.next`, `data.db`, or lock files unless explicitly required.

---

## 2. Execution Protocol

- Make the smallest coherent change.
- Concise, direct, implementation-focused. No broad refactors unless explicitly requested.
- Do not silently choose a stack, framework, DB, hosting, auth, or payment provider.
- Flag conflicts with `docs/PRODUCT.md` or `docs/TECH.md` immediately.
- Ask for explicit authorisation before modifying read-only files (`docs/PRODUCT.md`, `docs/TECH.md`).
- Prefer boring, maintainable solutions. No speculative architecture.
- No placeholder production logic unless marked `# TEMP` with a reason.
- No secrets in committed files. Never read, print, or summarise `.env` values.
- `any` is forbidden. Canonical types: `Transaction`, `Balance`, `IProvider`, `BankConfig` — import, don't duplicate.
- Next.js 16 App Router — APIs differ from training data. Read `node_modules/next/dist/docs/` before writing any route, layout, or action.

---

## 3. Update Protocol

Run after every meaningful unit of work.

### Always update
- `STATE.md`: replace Current_Goal, Last_Action, Next_Actions. Append one line to Recent_Changes (keep max 5).

### Update when tasks change
- `docs/BACKLOG.md`: move items between Now / Next / Later / Done / Blocked.

### Append when a non-trivial decision is made
- `docs/DECISIONS.md`: use the standard template (see file).

**Decision threshold** — log if any of these is true:
- Locks in a technology, library, or vendor.
- Changes ownership or structure of a file or module.
- Cannot be reversed in under 30 minutes.
- Contradicts a previous entry in `docs/DECISIONS.md`.

### Update when code changes
- `docs/TECH.md`: update if stack, schema, API behaviour, or file structure changed.

---

## 4. Language Rules

- Code, filenames, comments, commits, docs: English.
- User-facing copy: English.
- No corporate filler. No vague summaries.
- Use concrete facts, paths, commands, and decisions.

---

## 5. File Ownership

| File | Rule |
|---|---|
| `AGENTS.md` | Edit only to improve agent workflow. |
| `STATE.md` | Replace on every update. Never append history here. Max 60 lines. |
| `docs/PRODUCT.md` | Read-only by default. Requires explicit user authorisation to edit. |
| `docs/TECH.md` | Read-only by default. Requires explicit user authorisation to edit. |
| `docs/BACKLOG.md` | Living document. Always current. |
| `docs/DECISIONS.md` | Append-only. Never edit past entries. |
| `docs/RUNBOOK.md` | Update when commands or steps change. |

---

## 6. Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16.2.6 App Router |
| DB | better-sqlite3 (sync, local file `data.db`) |
| Styling | Tailwind CSS v4 (no component libraries) |
| Auth | Enable Banking PSD2 OAuth (RS256 JWT) |
| Language | TypeScript 5, React 19 |

No shadcn, no MUI, no Prisma, no ORM.

---

## 7. Architecture Rules

- Provider pattern: all bank API calls go through `IProvider` — never call Enable Banking directly from pages or actions.
- Adding a new bank = add one entry to `lib/banks.config.ts`. No code changes elsewhere.
- DB schema changes: use `try/catch ALTER TABLE` migrations at the bottom of `lib/db.ts`. No migration files.
- Server Actions live in `app/actions.ts`. Keep them thin — logic belongs in providers.
- Route Handlers in `app/api/*/route.ts` for OAuth redirects only.

---

## 8. Scope Control

- Implement only the requested task.
- Do not touch `lib/banks.config.ts` unless adding/editing a bank.
- Do not modify the OAuth flow unless explicitly asked.
- Do not change the DB schema unless the task requires new data.
- `app/api/debug/` routes are dev-only — never expose sensitive data in production.

---

## 9. DRY & Reuse

1. Check `docs/TECH.md` → File Structure for existing helpers, types, and providers before creating new ones.
2. Types live in `lib/providers/types.ts` — import them, don't redefine.
3. `getBankById` / `getBankByAspspName` already exist in `lib/banks.config.ts`.
4. `apiFetch` / `makeJwt` / `getSession` are internal to `enablebanking.ts` — reuse them inside the file.

---

## 10. Types & Validation

- `any` is forbidden.
- Canonical types: `Transaction`, `Balance`, `IProvider`, `BankConfig` — import, don't duplicate.
- Validate all Enable Banking API responses before storing (check for null booking_date, empty accounts, etc.).

---

## 11. Halt Rule

Stop and ask before:
- Adding a new npm dependency
- Changing the DB schema in a breaking way
- Modifying the OAuth flow or JWT signing
- Adding a new provider (non-Enable Banking)
- Touching `.env.local` structure

For UI changes, new bank entries, copy changes, new columns in the transaction table → proceed without stopping.

---

## 12. Output Format

When done, report:
- Files changed
- What changed
- Whether `docs/TECH.md` was updated
- Anything intentionally not changed

Keep it short.
