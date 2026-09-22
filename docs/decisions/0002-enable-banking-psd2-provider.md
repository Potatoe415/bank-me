# 0002 — Enable Banking as PSD2 provider

Date: 2026-05-xx
Status: Accepted
Decision: Use Enable Banking as the sole PSD2 API provider via `IProvider` abstraction.
Context: Need to connect multiple European banks without maintaining direct integrations per bank.
Rationale: Enable Banking aggregates multiple ASPSPs; one integration covers all target banks. RS256 JWT auth is well-understood.
Consequences: All bank API calls go through `lib/providers/enablebanking.ts`. Adding a bank requires only a new entry in `lib/banks.config.ts`.
Alternatives_Rejected: Direct bank APIs — each bank has a different PSD2 implementation, maintenance cost too high for personal use.
