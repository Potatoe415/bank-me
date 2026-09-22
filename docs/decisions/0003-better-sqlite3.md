# 0003 — better-sqlite3 (synchronous SQLite)

Date: 2026-05-xx
Status: Accepted
Decision: Use better-sqlite3 with a local `data.db` file. No ORM, no migration files.
Context: Personal single-user tool; no need for cloud DB, connection pooling, or schema migration tooling.
Rationale: Synchronous API fits Next.js Server Actions cleanly. No external dependencies. Migrations as `try/catch ALTER TABLE` in `lib/db.ts` are simple and transparent.
Consequences: DB is a local file only. No horizontal scaling possible. `serverExternalPackages: ["better-sqlite3"]` required in `next.config.ts`.
Alternatives_Rejected: Prisma — ORM overhead not justified for single-user tool. PostgreSQL — no cloud hosting needed.
