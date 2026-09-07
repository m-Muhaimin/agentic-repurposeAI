-- Billing ledger + subscription scaffold (P3).
--
-- Moves monthly usage accounting from a reactive jobs-table count to an
-- atomic reserve/consume/refund ledger, and adds the subscription tables a
-- payment-provider integration (stripe/paddle/...) will write to later.
--
-- The ledger (`usage_events`) is append-only and service-role-only: RLS is on
-- with no policies, so clients get nothing from it. Enforcement does NOT read
-- the ledger — it reads the jobs table under an advisory lock inside
-- `enqueue_job`, which is the serial point that makes "check used < limit,
-- then insert" atomic (the race that made the reactive count unsafe under
-- concurrent requests). The ledger is the immutable audit trail: `reserve` on
-- enqueue, `consume` on success, `refund` on platform-side failure, `release`
-- reserved for user-cancelled jobs.
--
-- Like 0002/0003, everything is guarded so this file is safe to run via the
-- Supabase SQL editor against the live project AND in `supabase db push`.
--
-- Behavior note: after this migration and the matching route change are live,
-- the enqueue path FAILS CLOSED — if the reservation RPC errors for any reason
-- the job is rejected (503) rather than silently running unbilled.

-- ── Usage ledger: one row per billable event ─────────────────────────────────
-- Written via the service role only. RLS on with NO policies, mirroring
-- `events`: clients can neither read nor write the ledger.
create table if not exists public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  action text not null check (action in ('reserve', 'consume', 'refund', 'release')),
  created_at timestamptz not null default now()
);

alter table public.usage_events enable row level security;

create index if not exists usage_events_user_created_idx
  on public.usage_events (user_id, created_at desc);

-- ── Subscriptions: the billing contract per user ─────────────────────────────
-- One active contract per user today (unique user_id). Plan *limits* stay in
-- lib/billing/plans.ts; this table records which tier is yours and the
-- provider contract (status, period) so the app can gate/display from DB truth
-- once a payment provider lands. Server/webhook writes only; users may read
-- their own row.
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('creator', 'pro', 'studio')),
  status text not null default 'incomplete' check (
    status in ('incomplete', 'active', 'past_due', 'canceled', 'trialing')
  ),
  provider text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id),
  unique (provider_subscription_id)
);

alter table public.subscriptions enable row level security;

create policy "Users can view their own subscription"
  on public.subscriptions for select
  using (auth.uid() = user_id);

create index if not exists subscriptions_user_idx
  on public.subscriptions (user_id);

-- ── Subscription events: immutable provider/webhook state-change log ─────────
-- Written via the service role only; no RLS policies (like `events`).
create table if not exists public.subscription_events (
  id bigint generated always as identity primary key,
  subscription_id uuid references public.subscriptions(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  type text not null, -- e.g. 'checkout.completed', 'invoice.paid', 'customer.subscription.updated'
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.subscription_events enable row level security;

create index if not exists subscription_events_sub_idx
  on public.subscription_events (subscription_id, created_at desc);

-- ── Atomic enqueue reservation ───────────────────────────────────────────────
-- One transaction, serialized per user via an advisory xact lock, so the
-- "used < limit" check and the job insert can never race — the failure mode
-- that made the reactive jobs-count unsafe under concurrent requests.
--
-- The route passes p_max_jobs_per_month / p_max_outputs_per_job straight from
-- lib/billing/plans.ts (server-side, never client-supplied).
create or replace function public.enqueue_job(
  p_user_id uuid,
  p_source_id uuid,
  p_formats text[],
  p_idempotency_key text,
  p_max_jobs_per_month integer, -- null = unlimited
  p_max_outputs_per_job integer -- defensive per-job cap
) returns table (
  job_id uuid,
  created_new boolean,
  jobs_used integer,
  jobs_limit_reached boolean,
  error_code text
)
language plpgsql
set search_path = public
as $$
declare
  v_job_id uuid;
  v_window_start timestamptz;
  v_window_end timestamptz;
  v_used integer;
  v_existing uuid;
begin
  -- Serialize enqueues per user. Hashed so the lock is server-side and cheap;
  -- collisions with another user's hash only serialize those two briefly.
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  -- UTC calendar month, computed without depending on the session timezone.
  v_window_start := date_trunc('month', now() at time zone 'utc') at time zone 'utc';
  v_window_end := v_window_start + interval '1 month';

  -- Idempotent replay: same key for the same user returns the existing job.
  if p_idempotency_key is not null then
    select j.id into v_existing
      from public.jobs j
      where j.user_id = p_user_id and j.idempotency_key = p_idempotency_key
      limit 1;
    if v_existing is not null then
      select count(*) into v_used
        from public.jobs
        where user_id = p_user_id and coalesce(refunded, false) = false
          and created_at >= v_window_start and created_at < v_window_end;
      return query select v_existing, false, v_used, false, null::text;
      return;
    end if;
  end if;

  -- Defensive per-job output cap (the route already truncates/rejects).
  if p_max_outputs_per_job is not null
     and coalesce(array_length(p_formats, 1), 0) > p_max_outputs_per_job then
    return query select null::uuid, false, 0, false, 'OUTPUT_LIMIT_REACHED'::text;
    return;
  end if;

  -- Monthly cap. Under the advisory lock this is the serial point.
  select count(*) into v_used
    from public.jobs
    where user_id = p_user_id and coalesce(refunded, false) = false
      and created_at >= v_window_start and created_at < v_window_end;
  if p_max_jobs_per_month is not null and v_used >= p_max_jobs_per_month then
    return query select null::uuid, false, v_used, true, 'USAGE_LIMIT_REACHED'::text;
    return;
  end if;

  -- Reserve the slot; empty formats defer to the worker's defaults (all three).
  begin
    insert into public.jobs (user_id, source_id, status, formats, idempotency_key)
    values (p_user_id, p_source_id, 'queued', coalesce(p_formats, '{}'::text[]), p_idempotency_key)
    returning id into v_job_id;
  exception when unique_violation then
    -- A concurrent duplicate won the insert; return it.
    select j.id into v_existing
      from public.jobs j
      where j.user_id = p_user_id and j.idempotency_key = p_idempotency_key
      limit 1;
    if v_existing is not null then
      return query select v_existing, false, v_used, false, null::text;
      return;
    end if;
    raise;
  end;

  insert into public.usage_events (user_id, job_id, action)
  values (p_user_id, v_job_id, 'reserve');

  v_used := v_used + 1;
  return query select
    v_job_id,
    true,
    v_used,
    (p_max_jobs_per_month is not null and v_used >= p_max_jobs_per_month),
    null::text;
end;
$$;

-- Only the service role may reserve jobs: PostgreSQL grants EXECUTE to PUBLIC
-- by default, which would let an anonymous caller reserve slots for *any*
-- user_id. The route calls this with the caller's own id from their session.
revoke all on function public.enqueue_job(uuid, uuid, text[], text, integer, integer) from public;
grant execute on function public.enqueue_job(uuid, uuid, text[], text, integer, integer) to service_role;