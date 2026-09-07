-- P2: Run budgets + heartbeat for v4_agent_runs.
-- Adds per-run budget ceilings (snapshotted from the user's plan at creation,
-- never client-supplied) so a run is always bounded: max tool-call steps, max
-- accumulated cost units, and max wall-clock runtime. Adds heartbeat_at so the
-- claim logic can re-claim a run whose worker died mid-step instead of parking
-- it forever at the coarse 10-minute stale window.
--
-- Idempotent (column guards + constraint guards) so this can be re-applied on
-- the live project exactly like migration 0005.

alter table public.v4_agent_runs
  add column if not exists max_steps int not null default 50,
  add column if not exists max_cost_units numeric not null default 2500,
  add column if not exists max_runtime_s int not null default 1800,
  add column if not exists heartbeat_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'v4_agent_runs_max_steps_bound'
  ) then
    alter table public.v4_agent_runs add constraint v4_agent_runs_max_steps_bound
      check (max_steps between 1 and 200);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'v4_agent_runs_max_cost_positive'
  ) then
    alter table public.v4_agent_runs add constraint v4_agent_runs_max_cost_positive
      check (max_cost_units > 0);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'v4_agent_runs_max_runtime_bound'
  ) then
    alter table public.v4_agent_runs add constraint v4_agent_runs_max_runtime_bound
      check (max_runtime_s between 30 and 14400);
  end if;
end $$;