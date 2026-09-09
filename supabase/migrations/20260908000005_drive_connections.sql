-- Google Drive connection storage, mirroring buffer_connections: one row per
-- user, tokens AES-GCM encrypted before insert (same key material as YouTube
-- tokens via lib/crypto.ts). Column layout is (email/name stamp + encrypted
-- refresh/access tokens + expiry) — identical shape to youtube_connections.
--
-- Idempotent (table/column/policy guards) so it can be re-applied on the live
-- project exactly like migrations 0007/0008.

create table if not exists public.drive_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  drive_email text not null,
  drive_name text not null,
  access_token text,
  refresh_token text not null,
  access_token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.drive_connections enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'drive_connections' and policyname = 'Users can view their own Google Drive connection'
  ) then
    create policy "Users can view their own Google Drive connection"
      on public.drive_connections for select
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'drive_connections' and policyname = 'Users can insert their own Google Drive connection'
  ) then
    create policy "Users can insert their own Google Drive connection"
      on public.drive_connections for insert
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'drive_connections' and policyname = 'Users can update their own Google Drive connection'
  ) then
    create policy "Users can update their own Google Drive connection"
      on public.drive_connections for update
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where tablename = 'drive_connections' and policyname = 'Users can delete their own Google Drive connection'
  ) then
    create policy "Users can delete their own Google Drive connection"
      on public.drive_connections for delete
      using (auth.uid() = user_id);
  end if;
end $$;