# Data model

Source of truth: `supabase/migrations/` (apply with `supabase db push`). The
older hand-rolled `supabase/schema.sql` is retained only as reference.

All tables live in the `public` schema. Every user-owned table ships with row
level security enabled; app code never stores secrets in plaintext.

## Entities

| Table | Purpose | Key | RLS posture |
|---|---|---|---|
| `sources` | One uploaded podcast/video/YouTube URL/transcript per row | `id` | View/insert/update/delete own (`auth.uid() = user_id`) |
| `outputs` | Generated format content per source | `id`, one row per (source, format) | View/insert own. **No UPDATE policy** — writes go through the service role |
| `jobs` | Async reprocessing queue (enqueue → claim → done/failed) | `id` | View/insert/update own |
| `user_prompts` | Per-format prompt overrides + global `brand_voice` row | composite `(user_id, format)` | View/insert/update/delete own |
| `youtube_connections` | One OAuth connection per user (tokens AES-GCM encrypted) | `id`, `unique (user_id)` | View/insert/update/delete own |
| `transcripts` | Canonical ingested transcript per source (upsert on `source_id`) | `id`, `unique (source_id)` | View/insert/update own |
| `profiles` | Billing plan per user; auto-created by `handle_new_user` trigger | `user_id` | View own only. **Not client-writable** (service role only) |
| `events` | Product analytics ledger (allowlisted names) | identity `id` | RLS on with **no policies** — service-role write, client read- and write-blocked |
| `usage_events` | Billable event ledger: `reserve` (enqueue), `consume` (success), `refund` (platform failure), `release` (cancelled, unused) | identity `id` | RLS on with **no policies** — service-role write, client read- and write-blocked |
| `subscriptions` | Paid billing contract per user (one active per user, `unique (user_id)`) | `id` | **Select own only.** Insert/update/delete service-role/webhook only |
| `subscription_events` | Immutable provider/webhook state-change log | identity `id` | RLS on with **no policies** — service-role write |

## Ownership rule

Every user-owned row carries `user_id` referencing `auth.users(id)`. With
`FOR SELECT/INSERT … USING (auth.uid() = user_id)`, foreign rows are invisible
and foreign writes are blocked. Deleting a user cascades to all their rows.

## Enforcement notes

- **Usage enforcement is ATOMIC, in the DB (P3)**: `/api/repurpose` does NOT
  read a count and then insert — the monthly cap is enforced inside the
  `enqueue_job` DB function, which runs one transaction serialized per user via
  an advisory xact lock. The "used < limit" check and the job insert share the
  lock, so concurrent enqueues can't overshoot the cap. It also handles
  idempotent replay and writes the `reserve` ledger row in the same
  transaction. The RPC's execute privilege is revoked from `public`/`anon`/
  `authenticated` and granted only to `service_role`. Limits are passed from
  `lib/billing/plans.ts` server-side, never from the client.
- **Display counts are *reactive***: `/api/usage` computes the monthly job count
  from `jobs` (`user_id` + `created_at` in the UTC month, excluding `refunded`).
  Display-only and fail-open; it never gate-keeps an enqueue.
- **Refunds**: `jobs.refunded = true` marks a platform-side failure that was
  refunded so a retry can't refund twice; the worker also appends a `refund`
  ledger event. Invalid-user-input failures (e.g. a recording over the plan
  cap) are counted and NOT refunded.
- **Idempotency**: partial unique index on `(user_id, idempotency_key)` where
  the key is not null. Replay is handled inside `enqueue_job`, so double
  submits resolve to the existing job and never consume a second slot.
- **Plan limits** are *not* in the DB; they live in `lib/billing/plans.ts`
  (beta/creator/pro/studio; only `beta` is public today), keyed by
  `profiles.plan`, resolved server-side with the service role.
- **Status enums** are `check` constraints (see `sources.status`,
  `jobs.status`, `transcripts.status`, `subscriptions.status`). Adding a status
  requires a migration.

## Storage

Bucket `sources` is private. Files are stored at
`sources/{user_id}/{filename}`; storage policies allow upload/read only when
the first folder segment equals `auth.uid()`. `storage_path` on `sources`
mirrors the full object path for asset cleanup.

## Migrations

New schema changes go in `supabase/migrations/` with a
`YYYYMMDDHHMMSS_description.sql` name, applied once, in order. Never edit an
already-applied migration; write a new one. Regenerate client types after a
change with `npm run db:types` (see `scripts/gen-types.mjs`), and re-run the
cross-user RLS suite with `npm run verify:rls`.