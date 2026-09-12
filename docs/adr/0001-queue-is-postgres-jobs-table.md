# ADR-0001 — Queue = Postgres jobs table (no broker), atomic claims + advisory-lock serialization

## Context

`POST /api/repurpose` is enqueue-only and must durably persist work across
serverless invocations; `POST /api/process` is an SSE worker that claims and runs
jobs. The monthly usage cap ("used < limit → insert") is a race under concurrent
requests for one user. A broker (Redis/SQS) was available as an option.

## Decision

- The **`jobs` table is the queue** — no broker. Enqueue inserts a row
  (`20260907000004_billing_ledger.sql:162-164`); workers claim via
  `atomic update queued→running`; `running` jobs are re-claimable after a 10-min
  stale window (`lib/agent/orchestrator.ts` mirrors this for agent runs).
- The atomic reserve lives in the `enqueue_job` RPC: one transaction per user
  serialized by `pg_advisory_xact_lock(hashtextextended(p_user_id, 0))`
  (`20260907000004_billing_ledger.sql:119-121`), making the monthly-cap check a true
  serial point (`:150-158`). Ledger write (`reserve`) happens in the same
  transaction (`:178-179`).
- The RPC is service-role-only (`revoke from public; grant to service_role`,
  `:194-195`) and the route **fails closed (503)** if the RPC errors — never a
  fallback to an unchecked insert (`app/api/repurpose/route.ts`).

## Consequences

- Duplicate worker kicks and idempotent client retries are harmless by construction
  (atomic claim + `idempotency_key` replay, `:128-141`).
- No extra infra to operate; the queue scales with Postgres. At 10x–100x, a
  serverless worker polling its own Postgres queue is the growth point; there is no
  backoff on repeated claims.
- A third queue/broker was explicitly rejected — the jobs-table queue is the
  established primitive the agent plane also builds on (ADR-0003's bridge claims
  through the same tables).