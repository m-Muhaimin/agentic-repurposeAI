-- Orchestrator v1 idempotency anchor (docs/VERVAI_ORCHESTRATOR_ARCHITECTURE.md:109-110).
-- Pure key derivation lives in lib/agent/orchestrator/idempotency.ts; this is the
-- row-level guarantee: the same (user, run, objective, sources, output) can only
-- ever produce one step row. Mirrors sources.content_hash's partial-unique anchor
-- (20260908000002). Idempotent: safe to re-apply on the live project.

alter table public.v4_agent_steps
  add column if not exists idempotency_key text;

do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and tablename = 'v4_agent_steps'
      and indexname = 'v4_agent_steps_idempotency_key_unique'
  ) then
    create unique index v4_agent_steps_idempotency_key_unique
      on public.v4_agent_steps (idempotency_key)
      where idempotency_key is not null;
  end if;
end $$;