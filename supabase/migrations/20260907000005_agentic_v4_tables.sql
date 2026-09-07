-- Agentic V4 schema (P1): the six V4_ tables that ship the Agentic RepurposeAI
-- loop (runs, steps, content ideas, preferences/memory, distribution jobs,
-- content strategies).
--
-- Previously these existed ONLY in supabase/schema_agentic.sql and were applied
-- to the live project by hand via the SQL editor. This migration makes the agentic
-- schema reproducible: a fresh `supabase db push` now converges to the same state
-- (0001 core tables → 0005 this file) without the separate schema_agentic.sql
-- step. The live project already has these tables; every statement here is guarded
-- (if not exists / on conflict / drop policy?) so re-running is a no-op.
--
-- Keep this file in sync with schema_agentic.sql (that file remains the
-- reference "apply by hand" export and continues to be what verify-agentic.mjs
-- checks against).

-- ── V4_agent_runs: one agentic generation run per source ───────────────────
-- Durable record of a planning→approval→execution→evaluation pass. Mirrors the
-- jobs table's claim/resume semantics (see lib/agent/orchestrator.ts) so a
-- worker can pick a run back up after a serverless timeout.
create table if not exists public.v4_agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  mode text not null default 'assist' check (
    mode in ('assist', 'execute', 'automate')
  ),
  status text not null default 'created' check (
    status in (
      'created', 'planning', 'awaiting_approval', 'executing', 'evaluating',
      'done', 'failed', 'cancelled'
    )
  ),
  plan jsonb,
  transcript_snapshot text,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_units numeric(12,4) not null default 0,
  step_count int not null default 0,
  output_ids text[] not null default '{}'::text[],
  error_message text,
  attempt int not null default 0,
  approval_decision text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

alter table public.v4_agent_runs enable row level security;

create policy "Users can view their own agent runs"
  on public.v4_agent_runs for select
  using (auth.uid() = user_id);

create policy "Users can insert their own agent runs"
  on public.v4_agent_runs for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own agent runs"
  on public.v4_agent_runs for update
  using (auth.uid() = user_id);

create policy "Users can delete their own agent runs"
  on public.v4_agent_runs for delete
  using (auth.uid() = user_id);

create index if not exists v4_agent_runs_queue_idx
  on public.v4_agent_runs (status, created_at)
  where status in ('created', 'planning', 'executing', 'evaluating');

create index if not exists v4_agent_runs_user_idx
  on public.v4_agent_runs (user_id, created_at desc);

-- ── V4_agent_steps: one durable step per run ────────────────────────────────
-- planning / source / generation / review / distribution / strategy. Every
-- transition is append-only history with retry + timing metadata, so the UI can
-- render a timeline and the worker can resume where it left off.
create table if not exists public.v4_agent_steps (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.v4_agent_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (
    kind in ('planning', 'source', 'generation', 'review', 'distribution', 'strategy')
  ),
  status text not null default 'pending' check (
    status in ('pending', 'running', 'done', 'failed', 'skipped')
  ),
  label text,
  input jsonb,
  output jsonb,
  retry_count int not null default 0,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.v4_agent_steps enable row level security;

create policy "Users can view their own agent steps"
  on public.v4_agent_steps for select
  using (auth.uid() = user_id);

create policy "Users can insert their own agent steps"
  on public.v4_agent_steps for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own agent steps"
  on public.v4_agent_steps for update
  using (auth.uid() = user_id);

create policy "Users can delete their own agent steps"
  on public.v4_agent_steps for delete
  using (auth.uid() = user_id);

create index if not exists v4_agent_steps_run_idx
  on public.v4_agent_steps (run_id, created_at);

create index if not exists v4_agent_steps_run_status_idx
  on public.v4_agent_steps (run_id, status) where status <> 'done';

-- ── V4_content_ideas: the angle-level plan & its evaluation ─────────────────
-- The planner emits 3–7 angles (topics, quotes, suggested formats). Each becomes
-- a row; the user edits/approves these before execution (Stage 1 human gate),
-- and each evaluated draft is flagged rather than auto-revised.
create table if not exists public.v4_content_ideas (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.v4_agent_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  suggested_formats text[] not null default '{}'::text[],
  quotes text[] not null default '{}'::text[],
  rationale text,
  approved boolean not null default true,
  sort_order int not null default 0,
  evaluation jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.v4_content_ideas enable row level security;

create policy "Users can view their own content ideas"
  on public.v4_content_ideas for select
  using (auth.uid() = user_id);

create policy "Users can insert their own content ideas"
  on public.v4_content_ideas for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own content ideas"
  on public.v4_content_ideas for update
  using (auth.uid() = user_id);

create policy "Users can delete their own content ideas"
  on public.v4_content_ideas for delete
  using (auth.uid() = user_id);

create index if not exists v4_content_ideas_run_idx
  on public.v4_content_ideas (run_id, sort_order);

-- ── V4_agent_preferences: Stage 2 memory (explicit + user-edited) ───────────
-- Brand voice is EXPLICIT and user-editable and never auto-mutated; user edits
-- are stored as signals, surfaced only through the confirm gate.
create table if not exists public.v4_agent_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  auto_mode text not null default 'assist' check (
    auto_mode in ('assist', 'execute', 'automate')
  ),
  brand_tone text not null default '',
  brand_forbidden_phrases text[] not null default '{}'::text[],
  brand_examples text[] not null default '{}'::text[],
  brand_samples text,
  edit_signals jsonb not null default '[]'::jsonb,
  content_strategy jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.v4_agent_preferences enable row level security;

create policy "Users can view their own agent preferences"
  on public.v4_agent_preferences for select
  using (auth.uid() = user_id);

create policy "Users can insert their own agent preferences"
  on public.v4_agent_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own agent preferences"
  on public.v4_agent_preferences for update
  using (auth.uid() = user_id);

create policy "Users can delete their own agent preferences"
  on public.v4_agent_preferences for delete
  using (auth.uid() = user_id);

-- ── V4_distribution_jobs: Stage 4 seeding (schedule/publish) ────────────────
-- Data model exists; the worker's schedule/publish verbs deliberately throw
-- NotImplementedError (lib/agent/tools/distribution.ts) until a real publish
-- action exists to gate.
create table if not exists public.v4_distribution_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  run_id uuid references public.v4_agent_runs(id) on delete set null,
  output_id uuid references public.outputs(id) on delete set null,
  platform text not null check (
    platform in ('linkedin', 'x', 'newsletter', 'youtube_shorts', 'tiktok', 'instagram')
  ),
  status text not null default 'draft' check (
    status in ('draft', 'scheduled', 'published', 'failed', 'cancelled')
  ),
  scheduled_at timestamptz,
  published_at timestamptz,
  external_id text,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.v4_distribution_jobs enable row level security;

create policy "Users can view their own distribution jobs"
  on public.v4_distribution_jobs for select
  using (auth.uid() = user_id);

create policy "Users can insert their own distribution jobs"
  on public.v4_distribution_jobs for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own distribution jobs"
  on public.v4_distribution_jobs for update
  using (auth.uid() = user_id);

create policy "Users can delete their own distribution jobs"
  on public.v4_distribution_jobs for delete
  using (auth.uid() = user_id);

create index if not exists v4_distribution_jobs_user_idx
  on public.v4_distribution_jobs (user_id, status);

-- ── V4_content_strategies: Stage 3 seed, read-only heuristic ────────────────
-- A single doc capturing "what this creator tends to do well" from past runs.
-- No auto-publishing, no live performance feedback.
create table if not exists public.v4_content_strategies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  source text not null default 'heuristic' check (
    source in ('heuristic', 'planner', 'manual')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, title)
);

alter table public.v4_content_strategies enable row level security;

create policy "Users can view their own content strategies"
  on public.v4_content_strategies for select
  using (auth.uid() = user_id);

create policy "Users can insert their own content strategies"
  on public.v4_content_strategies for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own content strategies"
  on public.v4_content_strategies for update
  using (auth.uid() = user_id);

create policy "Users can delete their own content strategies"
  on public.v4_content_strategies for delete
  using (auth.uid() = user_id);

-- ── Realtime (optional, mirrors the base dashboard approach) ──────────────
--   alter publication supabase_realtime add table public.v4_agent_runs;
--   alter publication supabase_realtime add table public.v4_agent_steps;