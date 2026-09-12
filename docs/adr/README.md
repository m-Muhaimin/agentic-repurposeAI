# Architecture Decision Records — VervAI

Decision records for the load-bearing choices this codebase embodies. Each ADR is
15–30 lines: Context / Decision / Consequences, with file:line evidence. Recorded
2026-09-12 from the discovery pass (`tasks/discovery-*.md`,
`docs/DISCOVERY_MAP.md`); statuses reflect the code as it exists today, not plans.

| # | Decision | Status |
|---|---|---|
| [0001](0001-queue-is-postgres-jobs-table.md) | Queue = Postgres `jobs` table (no broker); atomic claims + advisory-lock tenant serialization | Accepted (live) |
| [0002](0002-rls-double-boundary.md) | RLS double-boundary: per-user RLS for user tables; service-role/no-client-policy for ledger; service-client-only `outputs` writes | Accepted (live) |
| [0003](0003-v1-policy-package-and-bridge.md) | v1 orchestrator = pure policy package + sibling bridge behind `VERVAI_ORCHESTRATOR_V1`; deep-import rule | Accepted (flag OFF — bridge inert in prod) |
| [0004](0004-agent-drafts-in-outputs.md) | Agent drafts land in the existing `outputs` table; distribution never fabricates `published` | Accepted (live) |
| [0005](0005-degrade-gracefully-contract.md) | Degrade-gracefully contract: PostgREST error family → retry without column / defaults | Accepted (live, ≥5 sites) |
| [0006](0006-registry-first-output-formats.md) | Registry-first output formats: `lib/output-registry` is source of truth; thread/carousel first-class | Accepted (live) |

Superseded/alternative approaches are noted in each ADR under Consequences or in the
referenced docs (`docs/ARCHITECTURE_FREEZE.md`, `docs/IMPLEMENTATION_MAP.md`).