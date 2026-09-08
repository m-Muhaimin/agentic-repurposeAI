-- Run this in the Supabase SQL editor (or via `supabase db push`) after creating your project.
--
-- If you already ran an earlier version of this file (without YouTube support), run this
-- migration instead of the CREATE TABLE below:
--   alter table public.sources alter column storage_path drop not null;
--   alter table public.sources add column if not exists source_url text;
--   alter table public.sources drop constraint if exists sources_source_type_check;
--   alter table public.sources add constraint sources_source_type_check
--     check (source_type in ('audio', 'video', 'youtube', 'transcript'));
--   alter table public.sources drop constraint if exists source_has_location;
--   alter table public.sources add constraint source_has_location check (
--     (source_type = 'youtube' and source_url is not null)
--     or (source_type in ('audio', 'video') and storage_path is not null)
--     or (source_type = 'transcript' and (storage_path is not null or source_url is not null))
--   );
--
-- If you already ran an earlier version of the schema (before the jobs table),
-- also run:
--   create table if not exists public.jobs (
--     id uuid primary key default gen_random_uuid(),
--     user_id uuid not null references auth.users(id) on delete cascade,
--     source_id uuid not null references public.sources(id) on delete cascade,
--     status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
--     attempt int not null default 0,
--     error_message text,
--     created_at timestamptz not null default now(),
--     started_at timestamptz,
--     finished_at timestamptz
--   );
--   alter table public.jobs enable row level security;
--   create policy "Users can view their own jobs" on public.jobs for select using (auth.uid() = user_id);
--   create policy "Users can insert their own jobs" on public.jobs for insert with check (auth.uid() = user_id);
--   create policy "Users can update their own jobs" on public.jobs for update using (auth.uid() = user_id);
--   create index if not exists jobs_queue_idx on public.jobs (status, created_at) where status in ('queued', 'running');
--
-- If you've already created the tables before format selection + in-page editing,
-- run this migration to add the two new columns:
--   alter table public.jobs add column if not exists formats text[] not null
--     default array['linkedin_post', 'newsletter', 'shortform_script']::text[];
--   alter table public.outputs add column if not exists updated_at timestamptz not null default now();
--
-- If you've already created the tables before custom prompts (the "Customise"
-- page), run this migration to add the user_prompts table:
--   create table if not exists public.user_prompts (
--     user_id uuid not null references auth.users(id) on delete cascade,
--     format text not null,
--     prompt text not null default '',
--     created_at timestamptz not null default now(),
--     updated_at timestamptz not null default now(),
--     primary key (user_id, format)
--   );
--   alter table public.user_prompts enable row level security;
--   create policy "Users can view their own prompts" on public.user_prompts for select using (auth.uid() = user_id);
--   create policy "Users can insert their own prompts" on public.user_prompts for insert with check (auth.uid() = user_id);
--   create policy "Users can update their own prompts" on public.user_prompts for update using (auth.uid() = user_id);
--   create policy "Users can delete their own prompts" on public.user_prompts for delete using (auth.uid() = user_id);
--
-- If you've already created the tables before YouTube connect (OAuth captions),
-- run this migration to add the youtube_connections table:
--   create table if not exists public.youtube_connections (
--     id uuid primary key default gen_random_uuid(),
--     user_id uuid not null references auth.users(id) on delete cascade,
--     channel_id text not null,
--     channel_title text not null,
--     uploads_playlist_id text not null,
--     refresh_token text not null,
--     access_token text,
--     access_token_expires_at timestamptz,
--     created_at timestamptz not null default now(),
--     updated_at timestamptz not null default now(),
--     unique (user_id)
--   );
--   alter table public.youtube_connections enable row level security;
--   create policy "Users can view their own YouTube connection" on public.youtube_connections for select using (auth.uid() = user_id);
--   create policy "Users can insert their own YouTube connection" on public.youtube_connections for insert with check (auth.uid() = user_id);
--   create policy "Users can update their own YouTube connection" on public.youtube_connections for update using (auth.uid() = user_id);
--   create policy "Users can delete their own YouTube connection" on public.youtube_connections for delete using (auth.uid() = user_id);
--
-- And if you ran the schema before the transcripts table existed, add:
--   create table if not exists public.transcripts (
--     id uuid primary key default gen_random_uuid(),
--     user_id uuid not null references auth.users(id) on delete cascade,
--     source_id uuid not null references public.sources(id) on delete cascade,
--     provider text not null check (provider in ('assemblyai', 'youtube_captions', 'transcript_file')),
--     language text,
--     duration_seconds integer,
--     status text not null default 'ready' check (status in ('processing', 'ready', 'failed')),
--     content text not null,
--     error_message text,
--     created_at timestamptz not null default now(),
--     updated_at timestamptz not null default now(),
--     unique (source_id)
--   );
--   alter table public.transcripts enable row level security;
--   create policy "Users can view their own transcripts" on public.transcripts for select using (auth.uid() = user_id);
--   create policy "Users can insert their own transcripts" on public.transcripts for insert with check (auth.uid() = user_id);
--   create policy "Users can update their own transcripts" on public.transcripts for update using (auth.uid() = user_id);
--
-- If you already ran the schema before plans & entitlements (beta limits),
-- run this migration to add the billing tables and columns:
--   create table if not exists public.profiles (
--     user_id uuid primary key references auth.users(id) on delete cascade,
--     plan text not null default 'beta' check (plan in ('beta', 'creator', 'pro', 'studio')),
--     plan_status text not null default 'active' check (plan_status in ('active', 'cancelled')),
--     created_at timestamptz not null default now(),
--     updated_at timestamptz not null default now()
--   );
--   alter table public.profiles enable row level security;
--   create policy "Users can view their own profile"
--     on public.profiles for select using (auth.uid() = user_id);
--   create table if not exists public.events (
--     id bigint generated always as identity primary key,
--     name text not null,
--     user_id uuid references auth.users(id) on delete set null,
--     properties jsonb not null default '{}'::jsonb,
--     created_at timestamptz not null default now()
--   );
--   alter table public.events enable row level security;
--   (events is write-only from the service role; no select policies are created)
--   alter table public.sources add column if not exists duration_seconds integer;
--   alter table public.jobs add column if not exists idempotency_key text;
--   alter table public.jobs add column if not exists refunded boolean not null default false;
--   alter table public.outputs add column if not exists regeneration_count integer not null default 0;
--   create unique index if not exists jobs_idempotency_idx
--     on public.jobs (user_id, idempotency_key) where idempotency_key is not null;
--   create index if not exists events_created_idx on public.events (created_at desc);
--   (then the auto-profile trigger at the bottom of this file,
--   plus the triggers/grants shown there)

-- ── Sources: one uploaded podcast/video per row ───────────────────────────
create table if not exists public.sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  storage_path text,                   -- path inside the 'sources' storage bucket (file uploads only)
  source_url text,                     -- external URL, e.g. a YouTube link (youtube type only)
  source_type text not null check (source_type in ('audio', 'video', 'youtube', 'transcript')),
  status text not null default 'uploaded' check (
    status in ('uploaded', 'transcribing', 'transcribed', 'generating', 'done', 'failed')
  ),
  transcript text,
  error_message text,
  created_at timestamptz not null default now(),
  constraint source_has_location check (
    (source_type = 'youtube' and source_url is not null)
    or (source_type in ('audio', 'video') and storage_path is not null)
    or (source_type = 'transcript' and (storage_path is not null or source_url is not null))
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

-- ── Outputs: the three generated formats per source ───────────────────────
create table if not exists public.outputs (
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

-- ── Jobs: async reprocessing queue ─────────────────────────────────────────
-- The /api/repurpose route only enqueues work here and returns immediately;
-- /api/process claims the job, transcribes + generates, then marks it done.
create table if not exists public.jobs (
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

create index if not exists jobs_queue_idx
  on public.jobs (status, created_at)
  where status in ('queued', 'running');

-- Speeds up the per-user rate limit check in /api/repurpose (count of jobs
-- created in the last minute). If you've already run an earlier schema version,
-- add it with:
--   create index if not exists jobs_user_created_idx on public.jobs (user_id, created_at);
create index if not exists jobs_user_created_idx
  on public.jobs (user_id, created_at);

-- ── User prompts: custom overrides + brand voice (the "Customise" page) ────
-- One row per format the user has overridden, plus a 'brand_voice' row for the
-- global voice note. format is free text (no check constraint) so new formats
-- don't need a migration, and the blank-prompt default lives in code
-- (lib/ai/prompts.ts) rather than in the DB.
create table if not exists public.user_prompts (
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

-- ── YouTube connections: optional per-user Google OAuth link ────────────────
-- One row per user (unique constraint). The refresh token — and the cached
-- access token, if present — is AES-GCM encrypted with
-- YOUTUBE_TOKEN_ENCRYPTION_KEY before insert; the ciphertext is invisible to
-- clients and the plaintext is never stored or logged. Consumed by the OAuth
-- captions ingestion provider and the "recent videos" picker.
create table if not exists public.youtube_connections (
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

-- ── Transcripts: one canonical ingested transcript per source ──────────────
-- Written by the worker after ingestSource() resolves, so the final transcript
-- (which provider produced it, its language/duration, the full text) survives
-- independently of the source row and any rerun. One row per source — an upsert
-- on source_id keeps reruns/regenerations from stacking duplicates.
create table if not exists public.transcripts (
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

-- Live status for the dashboard. Requires Realtime; the dashboard also has a
-- polling fallback, so this is optional but recommended:
--   alter publication supabase_realtime add table public.sources;
--   alter publication supabase_realtime add table public.jobs;

-- ── Storage bucket for uploaded source files ──────────────────────────────
insert into storage.buckets (id, name, public)
values ('sources', 'sources', false)
on conflict (id) do nothing;

create policy "Users can upload their own source files"
  on storage.objects for insert
  with check (bucket_id = 'sources' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can read their own source files"
  on storage.objects for select
  using (bucket_id = 'sources' and auth.uid()::text = (storage.foldername(name))[1]);

-- Store uploads under `sources/{user_id}/{filename}` so the policy above applies.

-- ── Plans & entitlements (beta limits) ─────────────────────────────────────
-- The app treats the DB as the source of truth for *what a user may do*; the
-- plan limits themselves live in lib/billing/plans.ts so new tiers can be
-- shipped without a migration. profiles.plan is only ever set server-side
-- (service role, /api/admin or lib/billing/entitlements.ts ensureProfile) —
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

-- ── Plans & entitlements (beta limits) ─────────────────────────────────────
-- Usage is *counted* reactively from the jobs table (user_id + created_at
-- within the UTC month, excluding refunded rows) — race-free, self-healing,
-- and no maintenance writes; jobs_user_created_idx makes it an indexed scan.
-- ── Product analytics events (validation phase). Written via the service role
-- only (lib/analytics/events.ts + /api/events with the anon key). RLS is on
-- and no policies exist, so clients can never read the event ledger.
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

-- Measured media length (seconds) once the worker has ingested the source.
-- Used to enforce the beta 30-minute cap server-side. Filled by the worker;
-- null until then.
alter table public.sources add column if not exists duration_seconds integer;

-- Idempotency: a client-supplied key, unique per user, so double-submitting a
-- repurpose job (retries, double clicks, back button) never consumes two jobs.
-- Partial index (nulls excluded) so existing rows with no key stay valid.
alter table public.jobs add column if not exists idempotency_key text;

-- Marks a job whose usage was refunded after a platform-side failure, so a
-- later retry can't refund the same reservation twice.
alter table public.jobs add column if not exists refunded boolean not null default false;

create unique index if not exists jobs_idempotency_idx
  on public.jobs (user_id, idempotency_key)
  where idempotency_key is not null;

-- Per-job output budget (beta: 3 formats + 2 regenerations). Incremented
-- server-side by /api/outputs/[id]/regenerate.
alter table public.outputs add column if not exists regeneration_count integer not null default 0;

-- Auto-create a profile row for every new auth user so entitlements can be
-- resolved without a race on first job. Runs as the table owner via security
-- definer; the new-profile insert becomes part of the same transaction as the
-- auth insert in most Supabase configs.
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
