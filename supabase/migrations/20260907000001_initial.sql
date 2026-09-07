-- Baseline: the schema state ACTUALLY present in the live project as of the P0
-- audit (2026-09-07), verified by service-role REST probes. A fresh `supabase db
-- push` on a new project applies 0001 then 0002 and converges to the full schema
-- the app expects.
--
-- The origin of this baseline is the older portion of the hand-rolled
-- supabase/schema.sql (sources, outputs, jobs, user_prompts, youtube_connections,
-- transcripts + storage). The plans/entitlements + events + idempotency additions
-- from the tail of schema.sql were NEVER applied to the live project — they live
-- in 0002_profiles_events.sql. Do not fold 0002's content back into this file.
--
-- Apply with: supabase db push   (or paste into the Supabase SQL editor)
-- Lifecycle on the existing project: mark this migration applied first, then push
-- so only 0002 executes (see 0002 header).

-- ── Sources: one uploaded podcast/video per row ─────────────────────────────
create table public.sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  storage_path text,          -- path inside the 'sources' storage bucket (file uploads only)
  source_url text,            -- external URL, e.g. a YouTube link (youtube type only)
  source_type text not null check (source_type in ('audio', 'video', 'youtube', 'transcript')),
  status text not null default 'uploaded' check (
    status in ('uploaded', 'transcribing', 'transcribed', 'generating', 'done', 'failed')
  ),
  transcript text,
  error_message text,
  created_at timestamptz not null default now(),
  constraint source_has_location check (
    (source_type = 'youtube' and source_url is not null)
    or (source_type in ('audio', 'video', 'transcript') and storage_path is not null)
  )
);

alter table public.sources enable row level security;

create policy "Users can view their own sources"
  on public.sources for select
  using (auth.uid() = user_id);

create policy "Users can insert their own sources"
  on public.sources for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own sources"
  on public.sources for update
  using (auth.uid() = user_id);

create policy "Users can delete their own sources"
  on public.sources for delete
  using (auth.uid() = user_id);

-- ── Outputs: the three generated formats per source ─────────────────────────
create table public.outputs (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  format text not null check (format in ('linkedin_post', 'newsletter', 'shortform_script')),
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.outputs enable row level security;

create policy "Users can view their own outputs"
  on public.outputs for select
  using (auth.uid() = user_id);

create policy "Users can insert their own outputs"
  on public.outputs for insert
  with check (auth.uid() = user_id);

-- ── Jobs: async reprocessing queue ──────────────────────────────────────────
-- /api/repurpose only enqueues work here and returns immediately;
-- /api/process claims the job, transcribes + generates, then marks it done.
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  status text not null default 'queued' check (
    status in ('queued', 'running', 'done', 'failed')
  ),
  attempt int not null default 0,
  formats text[] not null default array['linkedin_post', 'newsletter', 'shortform_script']::text[],
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

alter table public.jobs enable row level security;

create policy "Users can view their own jobs"
  on public.jobs for select
  using (auth.uid() = user_id);

create policy "Users can insert their own jobs"
  on public.jobs for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own jobs"
  on public.jobs for update
  using (auth.uid() = user_id);

create index jobs_queue_idx
  on public.jobs (status, created_at)
  where status in ('queued', 'running');

-- Speeds up the per-user rate limit check in /api/repurpose.
create index jobs_user_created_idx
  on public.jobs (user_id, created_at);

-- ── User prompts: custom overrides + brand voice (the "Customise" page) ──────
-- One row per format the user has overridden, plus a 'brand_voice' row for the
-- global voice note. format is free text (no check constraint) so new formats
-- don't need a migration; blank-prompt default lives in code (lib/ai/prompts.ts).
create table public.user_prompts (
  user_id uuid not null references auth.users(id) on delete cascade,
  format text not null,
  prompt text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, format)
);

alter table public.user_prompts enable row level security;

create policy "Users can view their own prompts"
  on public.user_prompts for select
  using (auth.uid() = user_id);

create policy "Users can insert their own prompts"
  on public.user_prompts for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own prompts"
  on public.user_prompts for update
  using (auth.uid() = user_id);

create policy "Users can delete their own prompts"
  on public.user_prompts for delete
  using (auth.uid() = user_id);

-- ── YouTube connections: optional per-user Google OAuth link ─────────────────
-- One row per user (unique constraint). The refresh token — and the cached
-- access token, if present — is AES-GCM encrypted with YOUTUBE_TOKEN_ENCRYPTION_KEY
-- before insert; ciphertext is invisible to clients and plaintext is never
-- stored or logged.
create table public.youtube_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel_id text not null,
  channel_title text not null,
  uploads_playlist_id text not null,
  refresh_token text not null,
  access_token text,
  access_token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.youtube_connections enable row level security;

create policy "Users can view their own YouTube connection"
  on public.youtube_connections for select
  using (auth.uid() = user_id);

create policy "Users can insert their own YouTube connection"
  on public.youtube_connections for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own YouTube connection"
  on public.youtube_connections for update
  using (auth.uid() = user_id);

create policy "Users can delete their own YouTube connection"
  on public.youtube_connections for delete
  using (auth.uid() = user_id);

-- ── Transcripts: one canonical ingested transcript per source ────────────────
-- Written by the worker after ingestSource() resolves, so the final transcript
-- (provider, language/duration, full text) survives independently of the source
-- row and any rerun. One row per source; upserts on source_id.
create table public.transcripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_id uuid not null references public.sources(id) on delete cascade,
  provider text not null check (provider in ('assemblyai', 'youtube_captions', 'transcript_file')),
  language text,
  duration_seconds integer,
  status text not null default 'ready' check (status in ('processing', 'ready', 'failed')),
  content text not null,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id)
);

alter table public.transcripts enable row level security;

create policy "Users can view their own transcripts"
  on public.transcripts for select
  using (auth.uid() = user_id);

create policy "Users can insert their own transcripts"
  on public.transcripts for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own transcripts"
  on public.transcripts for update
  using (auth.uid() = user_id);

-- ── Storage bucket for uploaded source files ────────────────────────────────
insert into storage.buckets (id, name, public)
values ('sources', 'sources', false)
on conflict (id) do nothing;

create policy "Users can upload their own source files"
  on storage.objects for insert
  with check (bucket_id = 'sources' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can read their own source files"
  on storage.objects for select
  using (bucket_id = 'sources' and auth.uid()::text = (storage.foldername(name))[1]);

-- Uploads live under sources/{user_id}/{filename} so the policies above apply.

-- NOTE: the plans/entitlements + events tables, the idempotency/refund column
-- additions, and the auto-profile trigger are in 0002_profiles_events.sql —
-- they were missing from the observed live schema and must not be re-added here.