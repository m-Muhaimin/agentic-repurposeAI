-- Paddle Billing integration (P3 — paid-tier activation).
--
-- Companion to lib/billing/paddle.ts + /api/billing/checkout + /api/billing/webhook.
-- The schema needed by the webhook:
--
--   1. subscriptions.status gains 'paused' so the Paddle `subscription.paused`
--      lifecycle event maps 1:1 instead of being forced into 'past_due'.
--   2. subscription_events gets paddle_event_id (+ unique index) so duplicate
--      webhook deliveries (Paddle retries over ~3 days) are idempotent instead
--      of spamming the audit trail.
--
-- Like 0002/0003/0004, everything is guarded so this file is safe to run via
-- the Supabase SQL editor against the live project AND in `supabase db push`.
-- The app-layer code degrades gracefully if this file has NOT been applied yet
-- (webhook audit insert retries without paddle_event_id), but apply it anyway.
--
-- To converge the live project: paste this file's SQL into Dashboard -> SQL
-- Editor (the same path used for 0004 billing_ledger).

-- ── subscriptions.status: allow 'paused' ─────────────────────────────────────
-- 0004 created the check as ('incomplete','active','past_due','canceled','trialing').
-- Postgres rewrites `IN` to `= ANY (ARRAY[...])` internally, so we locate the
-- constraint by conname/definition rather than string-matching the literal.
do $$
declare
  v_constraint text;
begin
  if to_regclass('public.subscriptions') is null then
    return;
  end if;

  select c.conname into v_constraint
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'subscriptions'
      and c.contype = 'c'
      and c.conname like '%status%'
    limit 1;

  if v_constraint is not null
     and not exists (
       select 1
       from pg_constraint c
       where c.conname = v_constraint
         and pg_get_constraintdef(c.oid) like '%paused%'
     ) then
    execute format('alter table public.subscriptions drop constraint %I', v_constraint);
    alter table public.subscriptions add constraint subscriptions_status_check check (
      status in ('incomplete', 'active', 'past_due', 'canceled', 'trialing', 'paused')
    );
  end if;
end;
$$;

-- ── subscription_events: idempotent webhook dedup ─────────────────────────────
-- Added ONLY to the audit trail; the state writes (subscriptions / profiles
-- upserts) are already idempotent by key, so a unique null-excluded index on
-- the Paddle event id makes duplicate deliveries a no-op end to end.
alter table public.subscription_events add column if not exists paddle_event_id text;

create unique index if not exists subscription_events_paddle_event_idx
  on public.subscription_events (paddle_event_id)
  where paddle_event_id is not null;