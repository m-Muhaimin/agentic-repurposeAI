-- Phase 4: content intelligence — grounded per-source analysis (topics, themes,
-- claims, quotes, stories, questions, hooks, entities, insights, opportunities).
--
-- Detailed by the deterministic extractor in lib/intelligence (pure function, no
-- LLM): every claim/question/hook carries an EvidenceSegment stored inside the
-- jsonb that is a verbatim slice of the source; opportunities are marked
-- synthesized. This table decouples "understand this source" from "generate
-- outputs from it" — the worker computes intelligence after a successful ingest
-- regardless of whether any output formats were requested.
--
-- Keys on source_id (one intelligence artifact per source, superseded in place),
-- RLS mirrors the owner-pattern on sources. Idempotent: policy/constraint guards
-- mean re-applying on the live project converges to the same end state.

create table if not exists public.content_intelligence (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  intelligence jsonb not null,
  provenance text not null default 'deterministic',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.content_intelligence enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policy
    where polrelid = 'public.content_intelligence'::regclass
      and polname = 'Users can view their own content intelligence'
  ) then
    create policy "Users can view their own content intelligence"
      on public.content_intelligence for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policy
    where polrelid = 'public.content_intelligence'::regclass
      and polname = 'Users can insert their own content intelligence'
  ) then
    create policy "Users can insert their own content intelligence"
      on public.content_intelligence for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policy
    where polrelid = 'public.content_intelligence'::regclass
      and polname = 'Users can update their own content intelligence'
  ) then
    create policy "Users can update their own content intelligence"
      on public.content_intelligence for update
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policy
    where polrelid = 'public.content_intelligence'::regclass
      and polname = 'Users can delete their own content intelligence'
  ) then
    create policy "Users can delete their own content intelligence"
      on public.content_intelligence for delete
      using (auth.uid() = user_id);
  end if;
end $$;

-- One artifact per source; upsert on conflict updates in place.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'content_intelligence_source_id_unique'
      and conrelid = 'public.content_intelligence'::regclass
  ) then
    alter table public.content_intelligence
      add constraint content_intelligence_source_id_unique unique (source_id);
  end if;
end $$;

create index if not exists content_intelligence_user_idx
  on public.content_intelligence (user_id);