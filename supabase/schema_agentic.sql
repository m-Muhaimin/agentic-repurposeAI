-- Agentic RepurposeAI — additive schema. Run after schema.sql (the base app's).
-- All tables use the V4_ prefix to keep them clearly separate from the legacy
-- flat model (sources/outputs/jobs). Every user-owned table ships with the same
-- per-user RLS grammar as the base tables: view/insert/update(/delete) where
-- auth.uid() = user_id.
--
-- This is Stage 0's durable-state foundation. Nothing here relies on in-memory
-- continuity between requests: a run's status, its steps, its planned angles,
-- memory, and distribution jobs all survive restarts and serverless timeouts.

-- ── V4_agent_runs: one agentic generation run per source ██████████████████
-- The durable record of a planning→approval→execution→evaluation pass. Mirrors
-- the jobs table's claim/resume semantics (see the identity-claim in
-- lib/agent/orchestrator.ts) so a worker can pick a run back up after a
-- serverless timeout instead of dropping it.
create table if not exists public.v4_agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  mode text not null default 'assist' check (
    mode in ('assist', 'execute', 'automate')
  ),
  status text not null default 'created' check (
    status in (
      'created',        -- row created, nothing done yet
      'planning',       -- planner call in flight
      'awaiting_approval', -- plan produced, waiting on user
      'executing',      -- approved, deterministic generation running
      'evaluating',     -- post-execution rubric pass
      'done',           -- finished
      'failed',         -- unrecoverable
      'cancelled'       -- user abandoned / rejected
    )
  ),
  plan jsonb,                  -- the structured Content Plan (see types/agent.ts)
  transcript_snapshot text,    -- the transcript text the run worked from (durable)
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_units numeric(12,4) not null default 0,   -- coarse cost tracker (see roadmap "cost multiplier")
  step_count int not null default 0,
  output_ids text[] not null default '{}'::text[], -- outputs rows this run wrote
  error_message text,
  attempt int not null default 0,     -- how many times the worker has claimed it
  approval_decision text,              -- 'approved' | 'rejected' | null
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

-- ── V4_agent_steps: one durable step per run ███████████████████████████████
-- planning / source / generation / review / distribution / strategy. Every
-- transition is append-only history with retry + timing metadata, so the UI can
-- render a timeline and the worker can resume exactly where it left off.
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

-- ── V4_content_ideas: the angle-level plan & its evaluation ████████████████
-- The planner emits 3–7 angles (topics, quotes, suggested formats). Each becomes
-- a row; the user edits/approves these before execution (Stage 1's human-gate),
-- and each evaluated draft is flagged rather than auto-revised (V1 keeps the
-- revision loop bounded).
create table if not exists public.v4_content_ideas (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.v4_agent_runs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  suggested_formats text[] not null default '{}'::text[],
  quotes text[] not null default '{}'::text[],      -- pull-quotes from the transcript
  rationale text,                                     -- why this angle matters
  approved boolean not null default true,             -- user keeps/edits/removes
  sort_order int not null default 0,
  evaluation jsonb,                                   -- rubric result (see types/agent.ts)
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

-- ── V4_agent_preferences: Stage 2 memory (explicit + user-edited) ██████████
-- Brand voice is EXPLICIT and user-editable (tone, forbidden phrases, examples).
-- It is never auto-mutated; the confidence-gated "suggested update" flow lives
-- on the agent side, and a user edit is stored as a signal (tone/forbidden/
-- example) against edits — not an automatic profile rewrite.
create table if not exists public.v4_agent_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  auto_mode text not null default 'assist' check (
    auto_mode in ('assist', 'execute', 'automate')
  ),
  -- Brand voice profile (Stage 2) — explicit fields the user maintains.
  brand_tone text not null default '',
  brand_forbidden_phrases text[] not null default '{}'::text[],
  brand_examples text[] not null default '{}'::text[],
  brand_samples text,   -- raw few-shot samples the user pasted
  -- Signals: each user edit records a small structured hint for future planners.
  -- Never applied automatically; surfaced only via the confirm gate.
  edit_signals jsonb not null default '[]'::jsonb,
  content_strategy jsonb,      -- Stage 3 seed: favorite angles, beating topics
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

-- ── V4_distribution_jobs: Stage 4 seeding (schedule/publish) ██████████████
-- Data model exists; the worker's schedule/publish verbs deliberately throw
-- NotImplementedError (see lib/agent/tools/distribution.ts) until there is a
-- real publish action to gate.
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

-- ── V4_content_strategies: Stage 3 seed, read-only heuristic ███████████████
-- Deliberately NOT the full performance loop. A single doc capturing the
-- planner's heuristic view of "what this creator tends to do well" from past
-- runs. No auto-publishing, no live performance feedback.
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

-- ── Realtime (optional, mirrors the base dashboard approach) ───────────────
--   alter publication supabase_realtime add table public.v4_agent_runs;
--   alter publication supabase_realtime add table public.v4_agent_steps;
