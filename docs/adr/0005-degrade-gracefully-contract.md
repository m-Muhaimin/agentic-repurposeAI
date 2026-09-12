# ADR-0005 — Degrade-gracefully contract: the app assumes migrations may lag

## Context

Migrations are idempotent and deployed independently of code (fresh `supabase db
push` converges, but a live DB can lag a deploy). Code must keep working when a
column/table the new code expects does not exist yet — and must never mask real
schema bugs.

## Decision

- Match the **PostgREST error family** — `PGRST205|42P01` and the
  `could not find… / does not exist` patterns — and **retry without the column** or
  return `{}`/defaults. Canonical sites:
  - `lib/prompts.ts` — `getUserPrompts` returns `{}` when `user_prompts` is absent.
  - `app/api/process/route.ts` — `formats`/`updated_at` fallbacks.
  - `app/api/outputs/[id]/regenerate/route.ts` — same fallback family.
  - `lib/ingestion/save.ts` — missing `transcripts` table degrades to
    `sources.transcript` (log + denormalised write).
  - `lib/billing/paddle.ts` — pre-migration degrade for `subscriptions.status
    'paused'` and `paddle_event_id`.
- **The one fail-closed exception**: enforce-success paths must NOT degrade —
  `enqueue_job` RPC failure is a **503 fail-closed** (`app/api/repurpose/route.ts`),
  the mark-read RPCs fail closed, the cron sweep deletes nothing on setup failure.
  Billing/abuse enforcement never silently opens (compare the deliberate fail-open
  rate limiter, `lib/rate-limit.ts:27`, which is risk R2).

## Consequences

- Envelope-safe deploys: code can ship before the matching migration lands.
- Risk: a regex miss or an over-broad degrade silently swallows a real schema error.
  Keep the error-family match tight and prefer "retry once without the feature" over
  "return success".
- The pattern is established, not centralized — new call sites should copy the
  documented idiom, not invent a new one.