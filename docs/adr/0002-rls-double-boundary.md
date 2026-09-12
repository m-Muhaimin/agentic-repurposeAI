# ADR-0002 — RLS double-boundary: per-user RLS + service-role ledger, service-client-only outputs

## Context

Every user-owned row must be tenant-isolated; contract/ledger rows
(`events`, `usage_events`, `subscriptions`, `subscription_events`, `profiles`) must
be unreadable by clients; `outputs` needs privileged writes (agent drafts,
regeneration, edits) that no client policy should permit.

## Decision

- **User-owned tables** (base + `V4_` + `content_intelligence` + `notifications`):
  per-user RLS with the `auth.uid() = user_id` grammar on SELECT/INSERT/UPDATE/
  DELETE; `20260907000003_harden_update_policies.sql` makes every UPDATE `WITH CHECK`
  explicit. Identity is resolved server-side from the session — never accepted from
  the request body.
- **Ledger/contract tables**: RLS enabled with **no client policies** and
  service-role writes only (`20260907000004_billing_ledger.sql:7-8,26-34,73-83`).
  `subscriptions` carves out one SELECT policy so the app can display tier from DB
  truth (`:65-67`); `profiles.plan` is the enforcement source of truth
  (`lib/billing/entitlements.ts`).
- **`outputs`**: no UPDATE/DELETE client policy — all edits/regenerates go through
  API routes using the service client (`lib/supabase/server.ts:38-45`), which is
  never imported into client-facing code.
- The `enqueue_job` RPC and notification mark-read RPCs are EXECUTE-restricted
  (service role / `authenticated` only, `20260912000002`).

## Consequences

- The client split (`docs/DISCOVERY_MAP.md` §3) is load-bearing: user client =
  ownership/reads, service client = privileged writes. The DB enforces the same
  boundary a second time.
- Cross-user isolation is regression-tested: `npm run verify:rls` (24/24) and
  `npm run verify:agentic` (38/38) against the live DB.
- New tables must mirror this ownership pattern; new routes must resolve identity
  server-side (ARCHITECTURE_FREEZE §2).