-- Adds the plans/entitlements (profiles), product analytics (events), and job
-- idempotency/refund/usage-tracking pieces that app code depends on but that
-- were NEVER applied to the live project (confirmed 2026-09-07 via service-role
-- probes: tables profiles/events absent, columns missing).
--
-- Everything is guarded (if not exists / on conflict) so this file is safe to
-- run via the Supabase SQL editor against the live project AND as part of a
-- fresh `supabase db push` (where 0001 already created the core tables).
--
-- To converge the live project to the code's expectations:
--   1. Paste this file's SQL into Dashboard -> SQL Editor, OR
--   2. CLI path:  supabase migration repair 20260907000001_initial.sql --status applied
--                 supabase db push
-- (both require authenticated CLI credentials / a personal access token)

-- ── Profiles: billing plan per user ───────────────────────────────────────────
-- The app treats the DB as source of truth for *what a user may do*; the plan
-- limits themselves live in lib/billing/plans.ts so new tiers ship without a
-- migration. profiles.plan is only ever set server-side (service role) --
-- clients can read their own plan but never write it.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'beta' check (plan in ('beta', 'creator', 'pro', 'studio')),
  plan_status text not null default 'active' check (plan_status in ('active', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = user_id);

-- ── Product analytics events (validation phase) ───────────────────────────────
-- Written via the service role only (lib/analytics/events.ts + /api/events with
-- the anon key). RLS is on with NO policies, so clients can never read or write
-- the event ledger directly.
create table if not exists public.events (
  id bigint generated always as identity primary key,
  name text not null,
  user_id uuid references auth.users(id) on delete set null,
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.events enable row level security;

create index if not exists events_created_idx
  on public.events (created_at desc);

-- ── Measured media length (seconds) ───────────────────────────────────────────
-- Used to enforce the per-plan input cap server-side. Filled by the worker;
-- null until then.
alter table public.sources add column if not exists duration_seconds integer;

-- ── Job idempotency + refund flags ────────────────────────────────────────────
-- Idempotency: a client-supplied key, unique per user, so double-submitting a
-- repurpose job (retries, double clicks, back button) never consumes two jobs.
-- Partial index (nulls excluded) so existing rows without a key stay valid.
alter table public.jobs add column if not exists idempotency_key text;

-- Marks a job whose usage was refunded after a platform-side failure, so a
-- later retry can't refund the same reservation twice.
alter table public.jobs add column if not exists refunded boolean not null default false;

create unique index if not exists jobs_idempotency_idx
  on public.jobs (user_id, idempotency_key)
  where idempotency_key is not null;

-- ── Per-job output budget ─────────────────────────────────────────────────────
-- Incremented server-side by /api/outputs/[id]/regenerate.
alter table public.outputs add column if not exists regeneration_count integer not null default 0;

-- ── Auto-create a profile row for every new auth user ─────────────────────────
-- Removes the entitlement-resolution race on first job. Security definer runs
-- as the table owner; the insert joins the same transaction as the auth insert
-- in most Supabase configs.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();