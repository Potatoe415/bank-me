# ARCHITECTURE

Agents propose changes; the user confirms before any edit.
Every stack choice also gets a decision in `docs/decisions/`.
Full file structure, key flows, DB schema, and API details: `docs/TECH.md` (read-only, kept as the detailed technical reference).

## Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16.2.6 App Router, React 19.2.4, Tailwind CSS v4 |
| Backend | Next.js Server Actions (`app/actions.ts`) + Route Handlers (`app/api/*`, `app/callback`) |
| Database | better-sqlite3 12.x, synchronous, local file `data.db` |
| Runtime | Node.js 20+ |
| Package manager | npm (`package-lock.json` committed) |
| Hosting | Local-only (localhost or personal Cloudflare tunnel for OAuth) — see `docs/PRODUCT.md` Constraints |
| Authentication | Enable Banking PSD2 OAuth, RS256 JWT (`jsonwebtoken`) — provider pattern via `IProvider` |
| Validation library | Not decided (no schema validation library in `package.json`) |
| Logger | Not decided (ad hoc `console.*` calls — see `docs/DEBUGGING.md`) |
| Testing | Not decided (no test runner in `package.json`) |

No shadcn, no MUI, no Prisma, no ORM (see `docs/DECISIONS.md`).

## Style: flat monolith (not modular)

This project does **not** use the `src/modules/<name>/` layout from the bootstrap template.
Feature code lives flat under `app/` (routes, Server Actions) and `lib/` (providers, DB, taxonomy, helpers).
This fits the current scope: single user, single deployable, no bounded-context pressure yet.

Full current layout: `docs/TECH.md` → "File Structure".

If the project grows enough to need module boundaries (multiple contributors, competing data ownership, a file or function regularly too large to reason about), adopt `src/modules/<name>/` per `docs/_templates/MODULE_AGENTS.md` and `docs/_templates/MODULE_DATA.md`. Not needed today — do not restructure speculatively.

## Module map

| Module | Purpose | Owns data | May depend on |
|---|---|---|---|
| N/A — flat layout | `lib/providers/*` (bank API access), `lib/db.ts` (schema/migrations), `lib/taxonomy.ts` (category rules), `app/actions.ts` (Server Actions) | All tables in `data.db` (single owner: the app itself) | — |

## Conventions

- Naming: kebab-case files, PascalCase React components, camelCase functions/variables (as observed in `app/` and `lib/`).
- Formatting and linting: Not decided — no ESLint/Prettier config found in the repo root.
- Tests: Not decided — no test files or test runner found.
- Configuration: read from `process.env` directly where needed (e.g. `ENABLE_BANKING_APP_ID` in `lib/providers/enablebanking.ts`); no single typed config object today. `(inferred — confirm)`: consider centralizing in `docs/BACKLOG.md` if env var count grows.
